# Guia de Instalação no aaPanel (MySQL/MariaDB)

Este sistema foi preparado para rodar com **Node.js** (Backend) e **React** (Frontend), utilizando **MySQL** ou **MariaDB** como banco de dados.

## 1. Preparação no aaPanel

1.  **Instalar Node.js**: No "App Store" do aaPanel, instale o "Node.js Version Manager" e instale a versão **v18** ou superior.
2.  **Instalar Banco de Dados**: Instale o "MySQL" ou "MariaDB" (recomendado MariaDB 10.6+).
3.  **Criar Banco de Dados**:
    *   Vá em "Databases" > "Add Database".
    *   Nome: `snakebet` (ou outro de sua preferência).
    *   Usuário: `snakebet` (anote a senha).
    *   Importe o arquivo `database.sql` que está na raiz do projeto para criar as tabelas.

## 2. Configuração do Backend (Servidor)

1.  Navegue até a pasta `server` no Gerenciador de Arquivos.
2.  Crie um arquivo `.env` baseado no exemplo abaixo:

```env
PORT=5000
DB_HOST=localhost
DB_USER=snakebet
DB_PASSWORD=sua_senha_aqui
DB_NAME=snakebet
JWT_SECRET=sua_chave_secreta_super_segura
```

3.  Instale as dependências do servidor:
    *   Abra o terminal no aaPanel na pasta `server`.
    *   Execute: `npm install`

## 3. Construção do Frontend (Cliente)

1.  Na pasta raiz do projeto (onde está o `package.json` principal), execute o comando de build:
    *   `npm install` (se ainda não fez)
    *   `npm run build`
2.  Isso criará uma pasta `dist`.

## 4. Upload e Execução

1.  O servidor (`server/index.js`) está configurado para servir os arquivos estáticos da pasta `dist`.
2.  Certifique-se de que a estrutura de pastas no servidor fique assim:
    *   `/www/wwwroot/seusite.com/server/` (arquivos do backend)
    *   `/www/wwwroot/seusite.com/dist/` (arquivos do build do frontend)
    *   `/www/wwwroot/seusite.com/package.json` (opcional, mas bom ter)

3.  **Iniciando o Projeto (Node Project)**:
    *   No aaPanel, vá em "Website" > "Node Project" > "Add Node Project".
    *   **Run Directory**: `/www/wwwroot/seusite.com/server`
    *   **Startup File**: `index.js`
    *   **Port**: 5000 (ou a que definiu no .env)
    *   **Node Version**: v18+
    *   Clique em "Submit".

4.  **Mapeamento de Domínio**:
    *   Após criar o projeto Node, vá nas configurações dele e adicione seu domínio (ex: `snakebet.com`).
    *   O aaPanel fará o proxy reverso automaticamente.

## Observação Importante sobre o Frontend

O frontend já foi configurado para utilizar a API do MySQL. Ele tentará se conectar ao banco de dados primeiro. Se a conexão falhar (ex: rodando localmente sem o backend), ele usará o modo local (localStorage) como fallback.

Para rodar em produção no aaPanel:
1. Siga os passos acima para configurar o Banco de Dados e o Node.js Project.
2. Certifique-se de que a variável de ambiente `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` estejam corretas no arquivo `.env` dentro da pasta `server`.
3. O sistema usará automaticamente o MySQL para autenticação e saldo.

O servidor (`server/index.js`) já possui as rotas de API prontas e conectadas:
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/user/me`
- `POST /api/wallet/update`
- `POST /api/pagviva/deposit` (Proxy seguro)
- `POST /api/pagviva/status` (Proxy seguro)
