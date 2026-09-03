const axios = require('axios');
const crypto = require('crypto');

class NexterMatchScore {
  static calculate(processo, cpfPesquisado, nomePesquisado, ufPesquisada) {
    let score = 0;
    let matchReason = processo.match_documento_por;

    if (!matchReason) {
      matchReason = 'MATCH_APENAS_NOMINAL'; // Fallback
    }

    // Base score based on Escavador's match_documento_por
    switch (matchReason) {
      case 'DOCUMENTO_TRIBUNAL':
        score += 100;
        break;
      case 'DOCUMENTO_TRIBUNAL_OUTRA_FONTE':
        score += 98;
        break;
      case 'NOME_EXATO_UNICO':
        score += 95;
        break;
      case 'NOME_EXATO_MUNICIPIO':
        score += 92;
        break;
      case 'NOME_EXATO_ESTADO':
        score += 90;
        break;
      case 'MESMO_ADVOGADO_OUTRO_PROCESSO':
        score += 88;
        break;
      case 'NOME_ALGORITMO':
      case 'MATCH_APENAS_NOMINAL':
      default:
        score += 50; // Base score for homonyms
        break;
    }

    // Additional validations
    const nomeNormProc = processo.titulo_polo_ativo?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nomeNormPesq = nomePesquisado?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (nomeNormProc && nomeNormPesq && nomeNormProc.includes(nomeNormPesq)) {
      score += 10;
    }

    if (ufPesquisada && processo.estado_origem && processo.estado_origem.sigla === ufPesquisada.toUpperCase()) {
      score += 20;
    }

    if (score > 100) score = 100;

    let classificacao = 'HOMONIMO_BAIXA_CONFIANCA';
    let badgeText = 'Possível homônimo';

    if (score >= 95) {
      classificacao = 'CONFIRMADO';
      badgeText = 'CPF confirmado';
    } else if (score >= 80) {
      classificacao = 'ALTA_PROBABILIDADE';
      badgeText = 'Alta correspondência';
    } else if (score >= 60) {
      classificacao = 'POSSIVEL_CORRESPONDENCIA';
      badgeText = 'Verificar identidade';
    }

    return { score, classificacao, badgeText, matchReason };
  }
}

class EscavadorProcessSearchService {
  constructor(token, firestoreDb) {
    this.token = token;
    this.db = firestoreDb; // Firebase Admin Firestore Instance
    this.api = axios.create({
      baseURL: 'https://api.escavador.com/api/v2',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000 // 10s
    });
  }

  normalizarCpf(cpf) {
    return cpf.replace(/\D/g, '');
  }

  normalizarNome(nome) {
    if (!nome) return '';
    return nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  }

  async fetchPage(url, params = {}) {
    try {
      const response = await this.api.get(url, { params });
      return response.data;
    } catch (error) {
      // Handle rate limits and auth errors here
      if (error.response) {
        if (error.response.status === 401) throw new Error('ESCAVADOR_UNAUTHENTICATED');
        if (error.response.status === 402) throw new Error('ESCAVADOR_INSUFFICIENT_CREDIT');
        if (error.response.status === 429) throw new Error('RATE_LIMIT');
      }
      throw error; // Other errors
    }
  }

  async getAllPages(endpoint, params, maxPages = 20) {
    let allItems = [];
    let currentPageUrl = endpoint;
    let pageCount = 0;
    let envolvidoEncontrado = null;

    while (currentPageUrl && pageCount < maxPages) {
      const data = await this.fetchPage(currentPageUrl, pageCount === 0 ? params : {}); // params only on first call, URL contains query for next pages
      
      if (data.items && data.items.length > 0) {
        allItems = allItems.concat(data.items);
      }

      if (pageCount === 0 && data.envolvido_encontrado) {
        envolvidoEncontrado = data.envolvido_encontrado;
      }

      if (data.links && data.links.next) {
        // Escavador next link might be a full URL
        const nextUrl = data.links.next;
        currentPageUrl = nextUrl.replace('https://api.escavador.com/api/v2', '');
      } else {
        currentPageUrl = null;
      }
      pageCount++;
    }

    return { items: allItems, envolvidoEncontrado };
  }

  async runSearch(personId, personData, deepSearchMode = 'AUTO') {
    const startTime = Date.now();
    const cpfLimpo = this.normalizarCpf(personData.cpf);
    const nomeOriginal = personData.nome;
    const nomeNorm = this.normalizarNome(nomeOriginal);
    const uf = personData.uf || null;

    let allProcesses = new Map();
    let strategiesExecuted = [];
    let nomeEscavador = null;

    // Helper para consolidar processos
    const addProcess = (processo, source) => {
      const cnj = processo.numero_cnj;
      if (!cnj) return;

      if (!allProcesses.has(cnj)) {
        processo.searchSources = [source];
        allProcesses.set(cnj, processo);
      } else {
        const existing = allProcesses.get(cnj);
        if (!existing.searchSources.includes(source)) {
          existing.searchSources.push(source);
        }
        // Preserve best match document reason if current is better (naive logic: keep the first or non-nominal)
        if (processo.match_documento_por && processo.match_documento_por.includes('DOCUMENTO')) {
          existing.match_documento_por = processo.match_documento_por;
        }
      }
    };

    try {
      // Camada 1 - CPF Exato
      strategiesExecuted.push('CPF_EXACT');
      const resCpfExato = await this.getAllPages('/envolvido/processos', {
        cpf_cnpj: cpfLimpo,
        incluir_homonimos: 0,
        limit: 100,
        ordena_por: 'data_inicio',
        ordem: 'desc'
      });
      
      if (resCpfExato.envolvidoEncontrado && resCpfExato.envolvidoEncontrado.nome) {
        nomeEscavador = resCpfExato.envolvidoEncontrado.nome;
      }

      resCpfExato.items.forEach(p => addProcess(p, 'CPF_EXACT'));

      const needsDeepSearch = deepSearchMode === 'ALWAYS' || (deepSearchMode === 'AUTO' && resCpfExato.items.length === 0);

      if (needsDeepSearch) {
        // Camada 2 - CPF Homônimos
        strategiesExecuted.push('CPF_HOMONYMS');
        const resCpfHomonimos = await this.getAllPages('/envolvido/processos', {
          cpf_cnpj: cpfLimpo,
          incluir_homonimos: 1,
          limit: 100
        });

        resCpfHomonimos.items.forEach(p => addProcess(p, 'CPF_HOMONYMS'));

        // Camada 3 - Nome
        strategiesExecuted.push('NAME_SEARCH');
        const searchName = nomeEscavador ? nomeEscavador : nomeNorm;
        
        if (searchName) {
            const resNome = await this.getAllPages('/envolvido/processos', {
              nome: searchName,
              limit: 100,
              ordena_por: 'data_inicio',
              ordem: 'desc'
            });

            resNome.items.forEach(p => addProcess(p, 'NAME_SEARCH'));
        }
      }

      // Consolidar e calcular Match Score
      let finalProcesses = Array.from(allProcesses.values());
      
      let counts = {
        total: finalProcesses.length,
        confirmed: 0,
        highConfidence: 0,
        possible: 0,
        homonyms: 0
      };

      finalProcesses = finalProcesses.map(p => {
        const matchData = NexterMatchScore.calculate(p, cpfLimpo, nomeNorm, uf);
        p.nexterMatchScore = matchData.score;
        p.classificacao = matchData.classificacao;
        p.badgeText = matchData.badgeText;
        p.match_documento_por = matchData.matchReason;

        if (p.classificacao === 'CONFIRMADO') counts.confirmed++;
        else if (p.classificacao === 'ALTA_PROBABILIDADE') counts.highConfidence++;
        else if (p.classificacao === 'POSSIVEL_CORRESPONDENCIA') counts.possible++;
        else counts.homonyms++;

        return p;
      });

      // Ordenar por score desc
      finalProcesses.sort((a, b) => b.nexterMatchScore - a.nexterMatchScore);

      const status = finalProcesses.length > 0 ? 'SUCCESS_WITH_RESULTS' : 'SUCCESS_NO_RESULTS';
      
      const durationMs = Date.now() - startTime;

      // Auditoria
      const auditLog = {
        personId,
        cpfHash: crypto.createHash('sha256').update(cpfLimpo).digest('hex'),
        searchedName: nomeNorm,
        searchedState: uf,
        createdAt: new Date(),
        searchMode: deepSearchMode,
        strategiesExecuted,
        uniqueProcessesCount: finalProcesses.length,
        durationMs,
        apiStatus: status
      };

      if (this.db) {
        await this.db.collection('ProcessSearchAudit').add(auditLog).catch(e => console.error("Falha ao salvar auditoria:", e));
      }

      return {
        status,
        person: {
          name: nomeOriginal,
          cpfMasked: `***.***.${cpfLimpo.substring(6, 9)}-**`
        },
        summary: counts,
        strategiesExecuted,
        processes: finalProcesses
      };

    } catch (error) {
      let status = 'API_ERROR';
      if (error.message === 'ESCAVADOR_UNAUTHENTICATED') status = 'AUTH_ERROR';
      if (error.message === 'ESCAVADOR_INSUFFICIENT_CREDIT') status = 'NO_CREDIT';
      if (error.message === 'RATE_LIMIT') status = 'RATE_LIMIT';

      if (this.db) {
        await this.db.collection('ProcessSearchAudit').add({
          personId,
          createdAt: new Date(),
          searchMode: deepSearchMode,
          apiStatus: status,
          errorDetail: error.message
        }).catch(e => {});
      }

      return { status, error: error.message };
    }
  }
}

module.exports = EscavadorProcessSearchService;
