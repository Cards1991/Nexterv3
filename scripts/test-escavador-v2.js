const axios = require('axios');
const fs = require('fs');

async function getEscavadorToken() {
  try {
    const token = fs.readFileSync('../TokenEscavador.txt', 'utf8').trim();
    return token;
  } catch (err) {
    console.error('Erro ao ler ../TokenEscavador.txt. Verifique se o arquivo existe.');
    process.exit(1);
  }
}

async function runTest(cpf, nome) {
  const token = await getEscavadorToken();
  const api = axios.create({
    baseURL: 'https://api.escavador.com/api/v2',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  console.log(`\n=== INICIANDO TESTE DE PARIDADE ESCAVADOR V2 ===`);
  console.log(`CPF: ${cpf}`);
  console.log(`NOME: ${nome}\n`);

  let cpfExatoProcessos = [];
  let cpfHomonimosProcessos = [];
  let nomeProcessos = [];

  // ETAPA A: CPF Exato
  try {
    console.log('[Camada 1] Consultando CPF exato...');
    const resCpf = await api.get('/envolvido/processos', {
      params: {
        cpf_cnpj: cpf,
        incluir_homonimos: false,
        limit: 100
      }
    });
    cpfExatoProcessos = resCpf.data.items || [];
    console.log(`-> Resultado CPF exato: ${cpfExatoProcessos.length} processo(s).`);
  } catch (err) {
    console.error(`-> Erro CPF exato: ${err.response?.status} - ${JSON.stringify(err.response?.data) || err.message}`);
  }

  // ETAPA B: CPF + Homônimos
  try {
    console.log('\n[Camada 2] Consultando CPF + incluir_homonimos...');
    const resHomonimos = await api.get('/envolvido/processos', {
      params: {
        cpf_cnpj: cpf,
        incluir_homonimos: true,
        limit: 100
      }
    });
    cpfHomonimosProcessos = resHomonimos.data.items || [];
    console.log(`-> Resultado CPF + homônimos: ${cpfHomonimosProcessos.length} processo(s).`);
  } catch (err) {
    console.error(`-> Erro CPF + homônimos: ${err.response?.status} - ${JSON.stringify(err.response?.data) || err.message}`);
  }

  // ETAPA C: Busca por Nome
  try {
    console.log('\n[Camada 3] Consultando por Nome...');
    const resNome = await api.get('/envolvido/processos', {
      params: {
        nome: nome,
        limit: 100
      }
    });
    nomeProcessos = resNome.data.items || [];
    console.log(`-> Resultado Busca por Nome: ${nomeProcessos.length} processo(s).`);
  } catch (err) {
    console.error(`-> Erro Busca por Nome: ${err.response?.status} - ${JSON.stringify(err.response?.data) || err.message}`);
  }

  console.log('\n=== RESUMO DO DIAGNÓSTICO ===');
  console.log(`CPF exato: ${cpfExatoProcessos.length} processos`);
  console.log(`CPF + homônimos: ${cpfHomonimosProcessos.length} processos`);
  console.log(`Nome: ${nomeProcessos.length} processos`);

  // Consolidação
  const todosCnj = new Set();
  cpfExatoProcessos.forEach(p => todosCnj.add(p.numero_cnj));
  cpfHomonimosProcessos.forEach(p => todosCnj.add(p.numero_cnj));
  nomeProcessos.forEach(p => todosCnj.add(p.numero_cnj));

  console.log(`Resultados únicos (por CNJ): ${todosCnj.size} processos\n`);

  console.log('Classificações sugeridas baseadas na origem:');
  const confirmados = cpfExatoProcessos.length;
  const homonimos = nomeProcessos.length; // simplified

  console.log(`CPF Confirmado (Estimado): ${confirmados}`);
  console.log(`Possíveis correspondências/Homônimos: ${homonimos}`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Uso: node test-escavador-v2.js <CPF> <NOME_COMPLETO>");
  process.exit(1);
}

const cpfArg = args[0].replace(/\D/g, '');
const nomeArg = args.slice(1).join(' ');

runTest(cpfArg, nomeArg);
