# Plano de Alterações - Nexter V3

## Task 1: Tabela de Atestados com Barra de Rolagem Fixa

### Problema:
- A tabela de atestados médicos aumenta a cada lançamento sem limite
- Necessário fixar com barra de rolagem lateral

### Solução:
- Adicionar estilo CSS para scrollbar fixa com cores personalizadas
- Adicionar header fixo (sticky) para melhor experiência

### Arquivos a editar:
- `index.html` - Seção #atestados

---

## Task 2: Correção de Dízimas Periódicas nos Cards de Atestados

### Problema:
- Os cards de métricas estão trazendo valores em dízimas periódicas (ex: 1.333333333)

### Solução:
- Garantir que todos os valores sejam formatados com 2 casas decimais
- Aplicar formatação consistente em todas as métricas

### Arquivos a editar:
- `js/atestados.js` - Função `atualizarMetricasAtestados`

---

## Task 3: QR Code - Validação de Usuário para Abrir Chamado

### Problema:
- Qualquer pessoa pode abrir chamado pelo QR Code (usando autenticação anônima)
- Necessário que o usuário esteja cadastrado no sistema

### Solução:
- Modificar `manutencao-mobile.js` para verificar se o usuário está logado e é um usuário válido do sistema
- Verificar se o usuário existe na coleção `usuarios` ou `funcionarios` do Firestore
- Se não for usuário cadastrado, mostrar mensagem de erro e negar abertura do chamado

### Arquivos a editar:
- `js/manutencao-mobile.js` - Função `autenticarUsuario()` e `enviarChamado()`

---

## Resumo dos Arquivos para Edição:

1. **index.html** - Tabela de atestados (scrollbar)
2. **js/atestados.js** - Correção decimais (atualizarMetricasAtestados)
3. **js/manutencao-mobile.js** - Validação QR Code

---

## Histórico de Atualizações:

### 2026-01-xx - Melhorias Aplicadas
- Task 1: Adicionado CSS personalizado para scrollbar da tabela de atestados
- Task 2: Garantida formatação consistente de decimais em todas as métricas
- Task 3: Adicionada validação adicional na coleção 'funcionários' além de 'usuarios' (permitindo que funcionários cadastrados possam abrir chamados via QR Code)

