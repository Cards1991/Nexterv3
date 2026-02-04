// js/afd-parser.js

document.addEventListener('DOMContentLoaded', () => {
    const btnImportar = document.getElementById('btn-importar-afd');
    const fileInput = document.getElementById('input-afd-file');

    if (btnImportar && fileInput) {
        btnImportar.addEventListener('click', () => {
            fileInput.click(); // Aciona o input de arquivo oculto
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                processarArquivoAFD(file);
            }
            // Limpa o valor para permitir selecionar o mesmo arquivo novamente
            event.target.value = '';
        });
    }
});

/**
 * Lê o arquivo AFD e inicia o processamento.
 * @param {File} file O arquivo selecionado pelo usuário.
 */
function processarArquivoAFD(file) {
    const reader = new FileReader();

    reader.onload = async (e) => {
        const conteudo = e.target.result;
        try {
            const marcacoes = parseAFD(conteudo);
            console.log('Marcações de ponto extraídas:', marcacoes);
            
            // Aqui você pode decidir o que fazer com as marcações.
            // Por exemplo, exibir em uma tabela ou processar para gerar faltas.
            await processarMarcacoes(marcacoes);

        } catch (error) {
            console.error("Erro ao processar o arquivo AFD:", error);
            mostrarMensagem("O arquivo selecionado não parece ser um AFD válido.", "error");
        }
    };

    reader.onerror = () => {
        mostrarMensagem("Erro ao ler o arquivo.", "error");
    };

    reader.readAsText(file, 'UTF-8'); // Tenta ler como UTF-8
}

/**
 * Interpreta o conteúdo de texto de um arquivo AFD.
 * @param {string} conteudo O conteúdo do arquivo.
 * @returns {Array<Object>} Uma lista de objetos de marcação.
 */
function parseAFD(conteudo) {
    const linhas = conteudo.split(/\r\n|\n/);
    const marcacoes = [];

    for (const linha of linhas) {
        // O tipo de registro '3' indica uma marcação de ponto
        if (linha.length >= 34 && linha.substring(9, 10) === '3') {
            const pis = linha.substring(10, 22).trim();
            const dataStr = linha.substring(22, 30); // ddmmyyyy
            const horaStr = linha.substring(30, 34); // hhmm

            const dia = dataStr.substring(0, 2);
            const mes = dataStr.substring(2, 4);
            const ano = dataStr.substring(4, 8);
            const hora = horaStr.substring(0, 2);
            const minuto = horaStr.substring(2, 4);

            marcacoes.push({
                pis: pis,
                data: `${ano}-${mes}-${dia}`,
                hora: `${hora}:${minuto}`,
                dataObj: new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00`)
            });
        }
    }

    return marcacoes;
}

/**
 * Processa as marcações extraídas para gerar faltas ou outros registros.
 * (Esta é uma função de exemplo para o próximo passo)
 * @param {Array<Object>} marcacoes A lista de marcações extraídas.
 */
async function processarMarcacoes(marcacoes) {
    if (marcacoes.length === 0) {
        mostrarMensagem("Nenhuma marcação de ponto encontrada no arquivo.", "info");
        return;
    }

    // Passo 1: Agrupar marcações por funcionário (PIS) e por dia.
    const porFuncionarioPorDia = marcacoes.reduce((acc, marcacao) => {
        const chave = `${marcacao.pis}-${marcacao.data}`;
        if (!acc[chave]) {
            acc[chave] = [];
        }
        acc[chave].push(marcacao.hora);
        return acc;
    }, {});

    console.log("Marcações agrupadas:", porFuncionarioPorDia);
    mostrarMensagem(`${marcacoes.length} marcações de ponto foram importadas com sucesso!`, "success");

    // Próximos passos (a serem implementados):
    // 1. Buscar no banco de dados os funcionários correspondentes aos PIS.
    // 2. Para cada funcionário, comparar as marcações com sua jornada de trabalho.
    // 3. Identificar dias com menos marcações que o esperado (ex: só entrada ou só saída) e registrar como falta.
    // 4. Atualizar a tabela de faltas na tela.
}