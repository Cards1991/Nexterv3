# Plano de Implementação - Novos Sistemas de Segurança do Trabalho

## 📋 Tarefas a Executar

### 1. CORRIGIR ERRO - Dashboard Análise de Atestados
- **Arquivo**: `js/analise-atestados.js`
- **Problema**: TypeError ao definir textContent em elemento null
- **Solução**: Adicionar verificação de nulidade mais robusta na função atualizarKPIs
- **Status**: PENDENTE

### 2. CRIAR Sistema CIPA (Comissão Interna de Prevenção de Acidentes)
- Módulo 1 - Gestão dos Membros (cadastro completo com alertas de mandato)
- Módulo 2 - Processo Eleitoral (controle de大选)
- Módulo 3 - Treinamento CIPA (controle de cursos e alertas de reciclagem)
- Módulo 4 - Reuniões Mensais (cadastro e dashboard)
- Módulo 5 - Plano de Ação (Kanban com indicadores)
- **Arquivos**: `js/gestao-cipa.js`, `views/gestao-cipa.html`
- **Status**: PENDENTE

### 3. CRIAR Sistema Brigada de Incêndio
- Módulo 1 - Cadastro de Brigadistas (com alertas de validade)
- Módulo 2 - Simulados (controle e evolução)
- Módulo 3 - Escala da Brigada (alertas de mínimo legal)
- Módulo 4 - Registro de Ocorrências
- **Arquivos**: `js/brigada-incendio.js`, `views/brigada-incendio.html`
- **Status**: PENDENTE

### 4. CRIAR Sistema Controle de Extintores
- Módulo 1 - Cadastro de Extintores
- Módulo 2 - Inspeção Mensal (checklist digital)
- Módulo 3 - Controle de Recarga (alertas)
- Módulo 4 - Mapa de Localização
- **Arquivos**: `js/extintores.js`, `views/extintores.html`
- **Status**: PENDENTE

### 5. ATUALIZAR Menu Sidebar
- **Arquivo**: `views/sidebar.html`
- Adicionar novo item "Segurança do Trabalho" com submenu
- Adicionar: CIPA, Brigada de Incêndio, Extintores
- **Status**: PENDENTE

### 6. ATUALIZAR app.js - TODAS_SECOES
- **Arquivo**: `js/app.js`
- Adicionar: gestao-cipa, brigada-incendio, controle-extintores
- **Status**: PENDENTE

### 7. ATUALIZAR index.html
- **Arquivo**: `index.html`
- Adicionar script dos novos módulos
- **Status**: PENDENTE

