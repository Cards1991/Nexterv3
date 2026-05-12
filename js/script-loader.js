/**
 * NEXTER - Script Loader
 * Dynamically loads JavaScript files only when needed.
 */

const ScriptLoader = {
    loadedScripts: new Set(),

    /**
     * Map of sections to their required scripts
     */
    sectionScripts: {
        'empresas': ['js/empresas.js'],
        'setores': ['js/setores.js'],
        'funcionarios': ['js/funcionarios.js'],
        'movimentacoes': ['js/movimentacoes.js'],
        'admissao': ['js/movimentacoes.js'],
        'demissao': ['js/movimentacoes.js'],
        'painel-demitidos': ['js/painel-demitidos.js'],
        'transferencia': ['js/transferencia.js'],
        'alteracao-funcao': ['js/alteracao-funcao.js'],
        'faltas': ['js/faltas.js'],
        'afastamentos': ['js/afastamentos.js'],
        'atestados': ['js/atestados.js'],
        'controle-disciplinar': ['js/controle-disciplinar.js'],
        'dp-calculos': ['js/dp-calculos.js'],
        'controle-cestas': ['js/controle-cestas.js'],
        'dp-horas-extras': ['js/horas-extras.js'],
        'dp-horas-extras-lancamento': ['js/horas-extras-lancamento.js'],
        'dp-horas-solicitacao': ['js/solicitacao-horas-extras.js'],
        'control-horas-autorizacao': ['js/autorizacao-horas.js'],
        'financeiro': ['js/financeiro.js'],
        'analise-custos': ['js/custos.js'],
        'iso-maquinas': ['js/iso-maquinas.js'],
        'iso-mecanicos': ['js/iso-mecanicos.js'],
        'cadastro-mecanicos': ['js/cadastro-mecanicos.js'],
        'iso-manutencao': ['js/iso-manutencao.js'],
        'painel-mecanico': ['js/painel-mecanico.js'],
        'manutencao-mecanico': ['js/manutencao-mecanico.js'],
        'iso-organograma': ['js/iso-organograma.js'],
        'iso-swot': ['js/iso-swot.js'],
        'iso-avaliacao-colaboradores': ['js/iso-avaliacao-colaboradores.js'],
        'juridico-clientes': ['js/juridico-clientes.js'],
        'juridico-processos': ['js/juridico-processos.js'],
        'juridico-dashboard': ['js/juridico-dashboard.js'],
        'juridico-automacao': ['js/juridico-automacao.js'],
        'juridico-financeiro': ['js/juridico-financeiro.js'],
        'juridico-documentos': ['js/juridico-documentos.js'],
        'juridico-analise-cpf': ['js/juridico-analise-cpf.js'],
        'frota-dashboard': ['js/frota-controle.js'],
        'frota-veiculos': ['js/frota-controle.js'],
        'frota-motoristas': ['js/frota-controle.js'],
        'frota-utilizacao': ['js/frota-controle.js'],
        'frota-destinos': ['js/frota-controle.js'],
        'frota-tabelas-frete': ['js/frota-controle.js'],
        'estoque-epi': ['js/epi-controle.js'],
        'consumo-epi': ['js/epi-controle.js'],
        'epi-compras': ['js/epi-controle.js'],
        'cadastro-epis': ['js/epi-controle.js'],
        'entrega-epis': ['js/epi-controle.js'],
        'analise-epi': ['js/epi-controle.js'],
        'gestao-sumidos': ['js/gestao-sumidos.js'],
        'agenda': ['js/agenda.js'],
        'saude-psicossocial': ['js/saude-psicossocial.js'],
        'analise-pessoas': ['js/analise-pessoas.js'],
        'analise-rescisao': ['js/analise-rescisao.js'],
        'dashboard-atividades': ['js/dashboard-atividades.js'],
        'dashboard-faltas': ['js/dashboard-faltas.js'],
        'dashboard-manutencao': ['js/dashboard-manutencao.js'],
        'admin-usuarios': ['js/admin.js'],
        'treinamento': ['js/treinamento.js'],
        'producao-gestao': ['js/producao-gestao.js'],
        'producao-lancamento': ['js/producao-gestao.js'],
        'producao-bonus': ['js/producao-gestao.js'],
        'producao-produtos': ['js/producao-gestao.js'],
        'producao-leitura': ['js/producao-gestao.js'],
        'avaliacao-experiencia': ['js/avaliacao-experiencia.js'],
        'cid-manager': ['js/cid-manager.js'],
        'analise-atestados': ['js/analise-atestados.js'],
        'indicadores-direcao': ['js/indicadores-direcao.js'],
        'ponto-pf': ['js/ponto-pf.js', 'js/afd-parser.js'],
        'ponto-eletronico': ['js/ponto-eletronico.js', 'js/afd-parser.js'],
        'ocorrencias': ['js/ocorrencias.js'],
        'chamados-manutencao': ['js/chamados-manutencao.js'],
        'gestao-cipa': ['js/gestao-cipa.js'],
        'brigada-incendio': ['js/brigada-incendio.js'],
        'controle-extintores': ['js/controle-extintores.js'],
        'controle-reunioes': ['js/controle-reunioes.js'],
        'historico-colaborador': ['js/historico-colaborador.js'],
        'setor-macro': ['js/setor-macro.js']
    },

    /**
     * Load scripts for a specific section
     * @param {string} sectionName 
     */
    async loadForSection(sectionName) {
        const scripts = this.sectionScripts[sectionName] || [];
        const promises = scripts.map(src => this.loadScript(src));
        return Promise.all(promises);
    },

    /**
     * Load a single script
     * @param {string} src 
     */
    loadScript(src) {
        if (this.loadedScripts.has(src)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                this.loadedScripts.add(src);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.body.appendChild(script);
        });
    }
};

window.ScriptLoader = ScriptLoader;
