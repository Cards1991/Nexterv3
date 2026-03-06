// js/afd-parser.js

// Variáveis globais para armazenar os dados processados
let dadosAFDProcessados = [];
let dadosClassificacao = {
    antecipadas: [],
    atrasos: [],
    normal: [],
    faltas: []
};

// Constantes de configuração de horário
// Removidas constantes fixas. Agora o horário é dinâmico por setor.
// Tolerância padrão de 10 minutos.

// Função para inicializar os listeners do Ponto Eletrônico quando a view for injetada
function inicializarPontoEletronico() {
    const btnImportar = document.getElementById('btn-importar-afd');
    const fileInput = document.getElementById('input-afd-file');

    if (btnImportar && fileInput) {
        // Redefinir para evitar listeners duplicados
        const newBtn = btnImportar.cloneNode(true);
        btnImportar.parentNode.replaceChild(newBtn, btnImportar);

        const newFile = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFile, fileInput);

        // Limpar o valor do input para permitir selecionar o mesmo arquivo novamente
        newFile.value = '';

        newBtn.addEventListener('click', () => {
            newFile.click();
        });

        newFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                processarArquivoAFD(file);
            }
            // Limpa o valor para permitir selecionar o mesmo arquivo novamente
            event.target.value = '';
        });
    }
}

// Mantendo para execução na primeira carga
document.addEventListener('DOMContentLoaded', () => {
    inicializarPontoEletronico();
});

/**
 * Lê o arquivo AFD e inicia o processamento.
 * @param {File} file O arquivo selecionado pelo usuário.
 */
function processarArquivoAFD(file) {
    const statusDiv = document.getElementById('afd-status');
    if (statusDiv) {
        statusDiv.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin"></i> Processando arquivo AFD...</div>';
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        const conteudo = e.target.result;
        try {
            // Parse do arquivo AFD
            const marcacoes = parseAFD(conteudo);
            console.log('Marcações de ponto extraídas:', marcacoes);

            if (marcacoes.length === 0) {
                if (statusDiv) {
                    statusDiv.innerHTML = '<div class="alert alert-warning">Nenhuma marcação de ponto encontrada no arquivo.</div>';
                }
                return;
            }

            // Buscar nomes dos colaboradores pelo PIS
            await processarMarcacoes(marcacoes);

            if (statusDiv) {
                statusDiv.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${marcacoes.length} marcações de ponto foram importadas com sucesso!</div>`;
            }

        } catch (error) {
            console.error("Erro ao processar o arquivo AFD:", error);
            if (statusDiv) {
                statusDiv.innerHTML = `<div class="alert alert-danger">Erro ao processar arquivo: ${error.message}</div>`;
            }
        }
    };

    reader.onerror = () => {
        if (statusDiv) {
            statusDiv.innerHTML = '<div class="alert alert-danger">Erro ao ler o arquivo.</div>';
        }
    };

    reader.readAsText(file, 'UTF-8');
}

/**
 * Interpreta o conteúdo de texto de um arquivo AFD.
 * Suporta o formato descrito pelo usuário:
 * - Linha tipo 1: Header (dados da empresa)
 * - Linha tipo 3: Marcações
 *   - NSR (9) | Tipo (1) | Data (8) | Hora (4) | PIS (12)
 * 
 * O formato AFD padrão brasileiro (Portaria 1510) usa:
 * - Tipo 3: Registros de marcação
 *   - Posição 1-9: Número do REP
 *   - Posição 10: Tipo de registro (3)
 *   - Posição 11-22: PIS (12 dígitos)
 *   - Posição 23-30: Data (DDMMAAAA)
 *   - Posição 31-34: Hora (HHMM)
 *   - Posição 35+: Dígitos verificação
 * 
 * @param {string} conteudo O conteúdo do arquivo.
 * @returns {Array<Object>} Uma lista de objetos de marcação.
 */
function parseAFD(conteudo) {
    const linhas = conteudo.split(/\r\n|\n/);
    const marcacoes = [];

    for (const linha of linhas) {
        if (!linha || linha.trim() === '') continue;

        // Verifica se é uma linha de marcação (tipo 3)
        // O tipo de registro '3' indica uma marcação de ponto
        if (linha.length >= 34 && linha.substring(9, 10) === '3') {
            // Formato customizado: NSR(9) | Tipo(1) | Data(8) | Hora(4) | PIS(12)

            // Data e hora
            const dataStr = linha.substring(10, 18); // ddmmyyyy
            const horaStr = linha.substring(18, 22); // hhmm

            // Extrai o PIS (posições 22-34)
            const pisCompleto = linha.substring(22, 34).trim();
            // Remove zeros à esquerda se necessário
            const pis = parseInt(pisCompleto, 10).toString();

            const dia = dataStr.substring(0, 2);
            const mes = dataStr.substring(2, 4);
            const ano = dataStr.substring(4, 8);
            const hora = horaStr.substring(0, 2);
            const minuto = horaStr.substring(2, 4);

            // Valida a data
            const dataObj = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00`);

            if (isNaN(dataObj.getTime())) {
                console.warn('Data inválida:', dataStr, horaStr);
                continue;
            }

            marcacoes.push({
                pis: pis,
                pisFormatado: pisCompleto,
                data: `${ano}-${mes}-${dia}`,
                hora: `${hora}:${minuto}`,
                horaCompleta: `${hora}:${minuto}:00`,
                dataObj: dataObj,
                dataFormatada: `${dia}/${mes}/${ano}`,
                horaFormatada: `${hora}:${minuto}`
            });
        }
    }

    return marcacoes;
}

/**
 * Classifica o tipo de ponto baseado no horário de entrada.
 * - Antes das 06:50 = Entrada Antecipada
 * - 07:10 ou após = Atraso
 * - Entre 06:50 e 07:10 = Normal
 * 
 * @param {string} hora - Hora no formato HH:mm
 * @returns {string} - Tipo de classificação: 'antecipada', 'atraso' ou 'normal'
 */
function classificarPonto(hora, horarioBase = "07:00") {
    // Converte hora para minutos para facilitar comparação
    const [h, m] = hora.split(':').map(Number);
    const minutos = h * 60 + m;

    const [hBase, mBase] = horarioBase.split(':').map(Number);
    const minutosBase = hBase * 60 + mBase;

    const minutosAntecipada = minutosBase - 10; // Tolerância de 10 min antes
    const minutosAtraso = minutosBase + 10; // Tolerância de 10 min depois

    if (minutos < minutosAntecipada) {
        return 'antecipada';
    } else if (minutos >= minutosAtraso) {
        return 'atraso';
    } else {
        return 'normal';
    }
}

/**
 * Processa as marcações e classifica cada entrada.
 * @param {Array<Object>} marcacoes - Lista de marcações processadas
 */
function processarClassificacao(marcacoes) {
    // Reinicia os dados de classificação
    dadosClassificacao = {
        antecipadas: [],
        atrasos: [],
        normal: [],
        faltas: []
    };

    // Primeiro, identificar a primeira marcação de cada dia para cada funcionário
    const primeiroRegistroPorDia = {};

    marcacoes.forEach(marcacao => {
        const chave = `${marcacao.pis}-${marcacao.data}`;

        if (!primeiroRegistroPorDia[chave]) {
            primeiroRegistroPorDia[chave] = marcacao;
        } else {
            // Se a marcação atual for anterior à armazenada, atualiza
            if (marcacao.dataObj < primeiroRegistroPorDia[chave].dataObj) {
                primeiroRegistroPorDia[chave] = marcacao;
            }
        }
    });

    // Classificar cada primeiro registro do dia
    Object.values(primeiroRegistroPorDia).forEach(marcacao => {
        const tipo = classificarPonto(marcacao.hora, marcacao.horarioEntradaSetor);

        // Recalcula os horários de limite para a observação
        const [hBase, mBase] = (marcacao.horarioEntradaSetor || "07:00").split(':').map(Number);
        const minBase = hBase * 60 + mBase;
        const horaAnt = Math.floor((minBase - 10) / 60).toString().padStart(2, '0') + ':' + ((minBase - 10) % 60).toString().padStart(2, '0');
        const horaAtr = Math.floor((minBase + 10) / 60).toString().padStart(2, '0') + ':' + ((minBase + 10) % 60).toString().padStart(2, '0');

        const itemClassificado = {
            ...marcacao,
            tipoClassificacao: tipo,
            observacao: tipo === 'antecipada' ? `Entrada antes das ${horaAnt}` :
                tipo === 'atraso' ? `Entrada após as ${horaAtr}` : 'Entrada normal'
        };

        if (tipo === 'antecipada') {
            dadosClassificacao.antecipadas.push(itemClassificado);
        } else if (tipo === 'atraso') {
            dadosClassificacao.atrasos.push(itemClassificado);
        } else {
            dadosClassificacao.normal.push(itemClassificado);
        }
    });
}

/**
 * Detecta faltantes comparando funcionários ativos com registros de ponto.
 * @param {Array<Object>} marcacoes - Lista de todas as marcações
 */
async function detectarFaltantes(marcacoes) {
    try {
        // Obter todas as datas únicas presentes no arquivo
        const datasUnicas = [...new Set(marcacoes.map(m => m.data))].sort();

        if (datasUnicas.length === 0) return;

        // Buscar funcionários ativos com controle de ponto eletrônico
        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .where('controlePontoEletronico', '==', true)
            .get();

        const empresasSnap = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnap.forEach(doc => empresasMap[doc.id] = doc.data().nome);

        const funcionariosMap = {};
        snapshot.forEach(doc => {
            const func = doc.data();
            if (func.pis) {
                const pisNormalizado = parseInt(func.pis.toString().replace(/\D/g, ''), 10).toString();
                funcionariosMap[pisNormalizado] = {
                    id: doc.id,
                    nome: func.nome,
                    pis: func.pis,
                    setor: func.setor || '-',
                    empresaNome: func.empresaId ? (empresasMap[func.empresaId] || '-') : '-'
                };
            }
        });

        // Para cada data, verificar quais funcionários não registraram ponto
        datasUnicas.forEach(data => {
            // Obter todos os PIS que registraram ponto nesta data
            const pisComRegistro = new Set(
                marcacoes
                    .filter(m => m.data === data)
                    .map(m => parseInt(m.pis, 10).toString())
            );

            // Verificar cada funcionário ativo
            Object.values(funcionariosMap).forEach(func => {
                const pisNormalizado = parseInt(func.pis.toString().replace(/\D/g, ''), 10).toString();

                if (!pisComRegistro.has(pisNormalizado)) {
                    // Formatar a data para exibição
                    const [ano, mes, dia] = data.split('-');
                    const dataFormatada = `${dia}/${mes}/${ano}`;

                    dadosClassificacao.faltas.push({
                        pis: func.pis,
                        pisFormatado: func.pis,
                        nomeFuncionario: func.nome,
                        empresaNome: func.empresaNome,
                        setor: func.setor,
                        data: data,
                        dataFormatada: dataFormatada,
                        hora: '-',
                        horaFormatada: '-',
                        tipoClassificacao: 'falta',
                        observacao: 'Sem registro de ponto'
                    });
                }
            });
        });

    } catch (error) {
        console.error('Erro ao detectar faltantes:', error);
    }
}

/**
 * Processa as marcações extraídas, buscando os nomes dos colaboradores
 * e exibindo os resultados na tabela.
 * @param {Array<Object>} marcacoes A lista de marcações extraídas.
 */
async function processarMarcacoes(marcacoes) {
    if (marcacoes.length === 0) {
        mostrarMensagem("Nenhuma marcação de ponto encontrada no arquivo.", "info");
        return;
    }

    // Passo 1: Extrair todos os PIS únicos
    const pisUnicos = [...new Set(marcacoes.map(m => m.pis))];
    console.log('PIS únicos encontrados:', pisUnicos);

    // Passo 2: Buscar funcionários pelo PIS no Firestore
    const funcionariosMap = {};

    try {
        // Busca todos os funcionários que têm PIS cadastrado
        const snapshot = await db.collection('funcionarios')
            .where('pis', '!=', '')
            .get();

        const empresasSnap = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnap.forEach(doc => empresasMap[doc.id] = doc.data().nome);

        // Busca setores para obter horários de entrada
        const setoresSnap = await db.collection('setores').get();
        const setoresHorarios = {};
        setoresSnap.forEach(doc => {
            const s = doc.data();
            if (s.descricao) setoresHorarios[s.descricao] = s.horarioEntrada || "07:00";
        });

        snapshot.forEach(doc => {
            const func = doc.data();
            if (func.pis) {
                // Normaliza o PIS para comparação (remove zeros à esquerda)
                const pisNormalizado = parseInt(func.pis.toString().replace(/\D/g, ''), 10).toString();
                funcionariosMap[pisNormalizado] = {
                    nome: func.nome,
                    id: doc.id,
                    pis: func.pis,
                    setor: func.setor || '-',
                    empresaNome: func.empresaId ? (empresasMap[func.empresaId] || '-') : '-'
                };
            }
        });

        console.log('Funcionários carregados:', Object.keys(funcionariosMap));
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
    }

    // Passo 3: Associar cada marcação ao funcionário correspondente
    dadosAFDProcessados = marcacoes.map(marcacao => {
        const pisNormalizado = parseInt(marcacao.pis, 10).toString();
        const funcionario = funcionariosMap[pisNormalizado];

        return {
            ...marcacao,
            nomeFuncionario: funcionario ? funcionario.nome : 'Não encontrado',
            funcionariosId: funcionario ? funcionario.id : null,
            status: funcionario ? 'Encontrado' : 'PIS não cadastrado',
            setor: funcionario ? funcionario.setor : '-',
            empresaNome: funcionario ? funcionario.empresaNome : '-'
        };
    });

    // Passo 4: Processar classificação dos pontos
    processarClassificacao(dadosAFDProcessados);

    // Passo 5: Detectar faltantes
    await detectarFaltantes(dadosAFDProcessados);

    // Passo 6: Ocultar a tabela de registros importados (Solicitado: Eliminar Tabela)
    const tbodyImportados = document.getElementById('tabela-ponto-eletronico-body');
    if (tbodyImportados) {
        const container = tbodyImportados.closest('.card') || tbodyImportados.closest('table');
        if (container) container.style.display = 'none';
    }

    // Passo 7: Ocultar resumo por colaborador (Solicitado: Eliminar Tabela)
    const tbodyResumo = document.getElementById('tabela-resumo-colaborador-body');
    if (tbodyResumo) {
        const container = tbodyResumo.closest('.card') || tbodyResumo.closest('table');
        if (container) container.style.display = 'none';
    }

    // Passo 8: Exibir relatório classificado (novo)
    exibirRelatorioClassificado();

    // Mostrar a seção de resultados
    const resultadosDiv = document.getElementById('afd-resultados');
    if (resultadosDiv) {
        resultadosDiv.classList.remove('d-none');
    }
}

/**
 * Exibe os resultados na tabela de ponto eletrônico.
 * @param {Array<Object>} dados Os dados processados.
 */
function exibirResultadosTabela(dados) {
    const tbody = document.getElementById('tabela-ponto-eletronico-body');
    if (!tbody) return;

    // Ordenar por data e hora
    dados.sort((a, b) => a.dataObj - b.dataObj);

    tbody.innerHTML = dados.map(item => {
        const statusClass = item.status === 'Encontrado' ? 'bg-success' : 'bg-warning';
        const nomeClasse = item.status === 'Encontrado' ? '' : 'text-muted';

        return `
            <tr>
                <td>${item.pisFormatado}</td>
                <td class="${nomeClasse}">${item.nomeFuncionario}</td>
                <td>${item.dataFormatada}</td>
                <td>${item.horaFormatada}</td>
                <td><span class="badge ${statusClass}">${item.status}</span></td>
            </tr>
        `;
    }).join('');
}

/**
 * Exibe o resumo por colaborador.
 * @param {Array<Object>} dados Os dados processados.
 */
function exibirResumoColaborador(dados) {
    const tbody = document.getElementById('tabela-resumo-colaborador-body');
    if (!tbody) return;

    // Agrupar por funcionário
    const resumo = {};

    dados.forEach(item => {
        const chave = item.pisFormatado;
        if (!resumo[chave]) {
            resumo[chave] = {
                pis: item.pisFormatado,
                nome: item.nomeFuncionario,
                total: 0,
                primeiro: item.dataObj,
                ultimo: item.dataObj
            };
        }

        resumo[chave].total++;

        if (item.dataObj < resumo[chave].primeiro) {
            resumo[chave].primeiro = item.dataObj;
        }
        if (item.dataObj > resumo[chave].ultimo) {
            resumo[chave].ultimo = item.dataObj;
        }
    });

    // Converter para array e ordenar por nome
    const resumoArray = Object.values(resumo).sort((a, b) => a.nome.localeCompare(b.nome));

    tbody.innerHTML = resumoArray.map(item => {
        const dataPrimeiro = item.primeiro.toLocaleDateString('pt-BR');
        const horaPrimeiro = item.primeiro.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataUltimo = item.ultimo.toLocaleDateString('pt-BR');
        const horaUltimo = item.ultimo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const nomeClasse = item.nome === 'Não encontrado' ? 'text-muted' : '';

        return `
            <tr class="${nomeClasse}">
                <td>${item.nome}</td>
                <td>${item.pis}</td>
                <td class="text-center"><span class="badge bg-primary">${item.total}</span></td>
                <td>${dataPrimeiro} ${horaPrimeiro}</td>
                <td>${dataUltimo} ${horaUltimo}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Exibe o relatório classificado com as três categorias:
 * Entradas Antecipadas, Atrasos e Faltas.
 */
function exibirRelatorioClassificado() {
    const container = document.getElementById('relatorio-classificado-container');
    if (!container) return;

    // Mostrar o container
    container.classList.remove('d-none');

    // Atualizar contadores nos cards
    document.getElementById('count-antecipadas').textContent = dadosClassificacao.antecipadas.length;
    document.getElementById('count-atrasos').textContent = dadosClassificacao.atrasos.length;
    document.getElementById('count-faltas').textContent = dadosClassificacao.faltas.length;

    // Renderizar tabelas
    renderizarTabelaAntecipadas();
    renderizarTabelaAtrasos();
    renderizarTabelaFaltas();
}

/**
 * Renderiza a tabela de entradas antecipadas.
 */
function renderizarTabelaAntecipadas() {
    const tbody = document.getElementById('tabela-antecipadas-body');
    if (!tbody) return;

    if (dadosClassificacao.antecipadas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma entrada antecipada registrada</td></tr>';
        return;
    }

    // Ordenar por data e hora
    const sorted = [...dadosClassificacao.antecipadas].sort((a, b) => a.dataObj - b.dataObj);

    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td>${item.nomeFuncionario || '-'}</td>
            <td>${item.empresaNome || '-'}</td>
            <td>${item.setor || '-'}</td>
            <td>${item.dataFormatada}</td>
            <td><span class="badge bg-warning text-dark">${item.horaFormatada}</span></td>
            <td>${item.observacao}</td>
        </tr>
    `).join('');
}

/**
 * Renderiza a tabela de atrasos.
 */
function renderizarTabelaAtrasos() {
    const tbody = document.getElementById('tabela-atrasos-body');
    if (!tbody) return;

    if (dadosClassificacao.atrasos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum atraso registrado</td></tr>';
        return;
    }

    // Ordenar por data e hora
    const sorted = [...dadosClassificacao.atrasos].sort((a, b) => a.dataObj - b.dataObj);

    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td>${item.nomeFuncionario || '-'}</td>
            <td>${item.empresaNome || '-'}</td>
            <td>${item.setor || '-'}</td>
            <td>${item.dataFormatada}</td>
            <td><span class="badge bg-danger">${item.horaFormatada}</span></td>
            <td>${item.observacao}</td>
        </tr>
    `).join('');
}

/**
 * Renderiza a tabela de faltas.
 */
function renderizarTabelaFaltas() {
    const tbody = document.getElementById('tabela-faltas-body');
    if (!tbody) return;

    if (dadosClassificacao.faltas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma falta registrada</td></tr>';
        return;
    }

    // Ordenar por nome e data
    const sorted = [...dadosClassificacao.faltas].sort((a, b) => {
        const nomeCompare = (a.nomeFuncionario || '').localeCompare(b.nomeFuncionario || '');
        if (nomeCompare !== 0) return nomeCompare;
        return a.data.localeCompare(b.data);
    });

    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td>${item.nomeFuncionario || '-'}</td>
            <td>${item.empresaNome || '-'}</td>
            <td>${item.setor || '-'}</td>
            <td>${item.dataFormatada}</td>
            <td><span class="badge bg-dark">-</span></td>
            <td>${item.observacao}</td>
        </tr>
    `).join('');
}

/**
 * Exporta o relatório classificado para Excel.
 */
function exportarRelatorioClassificadoExcel() {
    if (typeof XLSX === 'undefined') {
        mostrarMensagem("Biblioteca de Excel não disponível. Contate o administrador.", "error");
        return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Entradas Antecipadas
    if (dadosClassificacao.antecipadas.length > 0) {
        const dadosAnt = dadosClassificacao.antecipadas.map(item => ({
            'Colaborador': item.nomeFuncionario,
            'Empresa': item.empresaNome || '-',
            'Setor': item.setor || '-',
            'Data': item.dataFormatada,
            'Hora': item.horaFormatada,
            'Observação': item.observacao
        }));
        const wsAnt = XLSX.utils.json_to_sheet(dadosAnt);
        XLSX.utils.book_append_sheet(wb, wsAnt, "Entradas Antecipadas");
    }

    // Sheet 2: Atrasos
    if (dadosClassificacao.atrasos.length > 0) {
        const dadosAtr = dadosClassificacao.atrasos.map(item => ({
            'Colaborador': item.nomeFuncionario,
            'Empresa': item.empresaNome || '-',
            'Setor': item.setor || '-',
            'Data': item.dataFormatada,
            'Hora': item.horaFormatada,
            'Observação': item.observacao
        }));
        const wsAtr = XLSX.utils.json_to_sheet(dadosAtr);
        XLSX.utils.book_append_sheet(wb, wsAtr, "Atrasos");
    }

    // Sheet 3: Faltas
    if (dadosClassificacao.faltas.length > 0) {
        const dadosFal = dadosClassificacao.faltas.map(item => ({
            'Colaborador': item.nomeFuncionario,
            'Empresa': item.empresaNome || '-',
            'Setor': item.setor || '-',
            'Data': item.dataFormatada,
            'Hora': item.horaFormatada,
            'Observação': item.observacao
        }));
        const wsFal = XLSX.utils.json_to_sheet(dadosFal);
        XLSX.utils.book_append_sheet(wb, wsFal, "Faltas");
    }

    if (wb.SheetNames.length === 0) {
        mostrarMensagem("Nenhum dado para exportar.", "warning");
        return;
    }

    const dataAtual = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `relatorio_ponto_classificado_${dataAtual}.xlsx`);

    mostrarMensagem("Relatório classificado exportado com sucesso!", "success");
}

/**
 * Exporta o relatório de ponto eletrônico para Excel.
 */
function exportarRelatorioAFDExcel() {
    if (!dadosAFDProcessados || dadosAFDProcessados.length === 0) {
        mostrarMensagem("Nenhum dado para exportar.", "warning");
        return;
    }

    // Verifica se a biblioteca XLSX está disponível
    if (typeof XLSX === 'undefined') {
        mostrarMensagem("Biblioteca de Excel não disponível. Contate o administrador.", "error");
        return;
    }

    // Preparar dados para exportação
    const dadosExport = dadosAFDProcessados.map(item => ({
        'PIS': item.pisFormatado,
        'Colaborador': item.nomeFuncionario,
        'Data': item.dataFormatada,
        'Hora': item.horaFormatada,
        'Status': item.status
    }));

    // Criar planilha
    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registros de Ponto");

    // Adicionar aba de resumo
    const resumo = {};
    dadosAFDProcessados.forEach(item => {
        const chave = item.pisFormatado;
        if (!resumo[chave]) {
            resumo[chave] = {
                'Colaborador': item.nomeFuncionario,
                'PIS': item.pisFormatado,
                'Total Registros': 0,
                'Primeiro Registro': item.dataObj,
                'Último Registro': item.dataObj
            };
        }
        resumo[chave]['Total Registros']++;
        if (item.dataObj < resumo[chave]['Primeiro Registro']) {
            resumo[chave]['Primeiro Registro'] = item.dataObj;
        }
        if (item.dataObj > resumo[chave]['Último Registro']) {
            resumo[chave]['Último Registro'] = item.dataObj;
        }
    });

    // Converter datas para string
    const resumoArray = Object.values(resumo).map(item => ({
        ...item,
        'Primeiro Registro': item['Primeiro Registro'].toLocaleString('pt-BR'),
        'Último Registro': item['Último Registro'].toLocaleString('pt-BR')
    }));

    const wsResumo = XLSX.utils.json_to_sheet(resumoArray);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo por Colaborador");

    // Gerar arquivo
    const dataAtual = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `relatorio_ponto_${dataAtual}.xlsx`);

    mostrarMensagem("Relatório exportado com sucesso!", "success");
}

// Exportar funções para o escopo global
window.processarArquivoAFD = processarArquivoAFD;
window.exportarRelatorioAFDExcel = exportarRelatorioAFDExcel;
window.exportarRelatorioClassificadoExcel = exportarRelatorioClassificadoExcel;
