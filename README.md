# Nexter - Sistema de Gestão de RH

Um sistema web completo para gestão de Recursos Humanos, focado em controle de funcionários, movimentações (admissões e demissões), saúde ocupacional e análises estratégicas com IA simulada.

![Dashboard](https://img.shields.io/badge/UI-Bootstrap_5-7952B3?style=for-the-badge&logo=bootstrap)
![Database](https://img.shields.io/badge/Database-Firebase-FFCA28?style=for-the-badge&logo=firebase)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=for-the-badge&logo=javascript)

---

## 🚀 Funcionalidades

- **Dashboard Interativo:** Visão geral com indicadores chave (total de funcionários, admissões/demissões no mês, taxa de rotatividade).
- **Gestão de Empresas e Setores:** Cadastro centralizado de unidades de negócio e seus respectivos setores.
- **Cadastro de Funcionários:** Gerenciamento completo do ciclo de vida do colaborador.
- **Controle de Movimentações:** Registro de admissões e demissões, com atualização automática do status do funcionário.
- **Entrevista Demissional:** Coleta de feedback estruturado no momento do desligamento.
- **Saúde Ocupacional:** Módulos para gestão de **Atestados** e **Afastamentos**.
- **Controle de Ponto:** Lançamento e relatório de **Faltas Diárias**.
- **Alteração de Função:** Registro e impressão de termos para alterações temporárias de função.
- **Painel Financeiro:** Lançamento e acompanhamento de despesas relacionadas à folha de pagamento.
- **Análise de Rescisões:** Dashboard para análise dos dados coletados nas entrevistas demissionais.
- **Controle de Acesso por Usuário:** Sistema de permissões que permite ao administrador definir o que cada usuário pode ver e fazer, incluindo restrição por setor.
- **Relatórios e Análise com IA:** Geração de relatórios dinâmicos e insights simulados por IA sobre as movimentações.

## Requisitos

- Um projeto no **Firebase** (com Firestore e Authentication ativados).
- Navegador web moderno (Chrome, Firefox, Edge).
- Servidor web local para desenvolvimento (como a extensão "Live Server" do VS Code).

## Configuração

1.  **Clone o repositório:**
    ```bash
    git clone [URL_DO_SEU_REPOSITORIO]
    ```

2.  **Configure o Firebase:**
    - Crie um arquivo chamado `firebase-config.js` dentro da pasta `js/`.
    - Cole o código abaixo no arquivo e substitua os placeholders pelas suas credenciais do Firebase, que você pode encontrar no console do seu projeto.

    ```javascript
    // js/firebase-config.js
    const firebaseConfig = {
        apiKey: "SUA_API_KEY",
        authDomain: "SEU_AUTH_DOMAIN",
        projectId: "SEU_PROJECT_ID",
        storageBucket: "SEU_STORAGE_BUCKET",
        messagingSenderId: "SEU_MESSAGING_SENDER_ID",
        appId: "SEU_APP_ID"
    };

    // Inicializa o Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const db = firebase.firestore();
    const auth = firebase.auth();
    ```

3.  **Primeiro Acesso (Administrador):**
    - Abra o arquivo `index.html` em seu navegador.
    - Faça login pela primeira vez com sua conta do Google ou e-mail/senha.
    - Acesse o console do **Firestore** no seu projeto Firebase, encontre a coleção `usuarios`, localize seu usuário e defina o campo `permissoes.isAdmin` como `true`.
    - Recarregue a página. O menu "Admin - Usuários" deverá aparecer.

## ⚠️ Regras de Segurança

Para um ambiente de produção, é fundamental proteger seu banco de dados. Substitua as regras de segurança padrão do Firestore por regras mais restritivas. Um bom ponto de partida é exigir que o usuário esteja autenticado para qualquer operação:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Exige que o usuário esteja logado para ler ou escrever qualquer dado.
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
" " 
