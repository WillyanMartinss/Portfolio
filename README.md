# Willyan Martins Portfólio

Projeto de portfólio profissional moderno, com visual premium, painel administrativo para edição, modo claro/escuro, hero section, projetos, habilidades, currículo e login protegido.

Repositório: https://github.com/WillyanMartinss/Portfolio

## Visão geral

Este projeto foi pensado como um site de apresentação pessoal com foco em:

- aparência premium e futurista
- layout responsivo para desktop e mobile
- modo claro e escuro
- painel administrativo para alterar textos, projetos e dados do perfil
- persistência de dados em banco
- compatibilidade com deploy em Vercel
- login com autenticação por token e sessão

## Funcionalidades principais

### 1. Página pública do portfólio
A página principal exibe:

- apresentação pessoal
- área de perfil/hero
- habilidades técnicas
- projetos em destaque
- currículo resumido
- links para redes sociais e contato
- botão de WhatsApp para orçamento
- modo claro/escuro
- cursor personalizado com feedback visual
- animações leves e premium

### 2. Painel administrativo
O site possui um painel restrito para edição do conteúdo, permitindo alterar:

- nome e dados do perfil
- imagem/logo do perfil
- texto de apresentação
- habilidades
- projetos
- currículo
- dados de conta de administrador

### 3. Sistema de login
O acesso ao painel é protegido por autenticação.


O login chama a API `/api/login` e gera um token de sessão para uso no painel administrativo.

### 4. Persistência de dados
O projeto salva informações em banco para não depender apenas de arquivos estáticos.

- Desenvolvimento local: SQLite
- Produção no Vercel: PostgreSQL

Isso é importante porque o Vercel usa um ambiente efêmero e o SQLite local não é confiável para produção.

## Como o sistema funciona

### Fluxo da página pública
- O cliente acessa a página principal
- O frontend chama `/api/site`
- O servidor retorna os dados do site em JSON
- A interface renderiza perfil, projetos, habilitades e currículo

### Fluxo do login
1. O usuário entra com usuário e senha no painel
2. O backend compara os dados com a tabela `admin`
3. Se corretos, gera um token aleatório
4. O token é salvo na tabela `sessions`
5. O frontend usa esse token no cabeçalho `Authorization: Bearer ...`

### Fluxo da edição administrativa
1. Usuário autenticado acessa rotas do tipo `/api/admin/...`
2. O backend valida a sessão
3. Os novos dados são persistidos
4. A página pública reflete os valores atualizados

## Tecnologias utilizadas

- Node.js
- Express
- PostgreSQL
- SQLite
- JavaScript no frontend
- HTML + CSS
- Vercel para deploy

## Estrutura do projeto

```bash
.
├── index.html
├── login.js
├── server.js
├── data.js
├── _lib.js
├── package.json
├── README.md
├── .env.example
├── .gitignore
├── portfolio.db
├── vercel.json
└── node_modules/
```

### Arquivos principais

- `index.html`: estrutura da página pública e elementos visuais
- `login.js`: lógica do login e painel admin
- `server.js`: servidor Express e APIs
- `data.js`: dados iniciais e utilitários do site
- `_lib.js`: suporte geral da aplicação
- `vercel.json`: configuração para deploy na Vercel
- `.env.example`: exemplo de variáveis de ambiente

## API principal

### Rotas públicas

- `GET /api/health` → verifica se a API está funcionando
- `GET /api/site` → retorna os dados do portfólio
- `POST /api/login` → autentica usuário e gera token

### Rotas administrativas

- `GET /api/admin/site` → retorna dados do site para edição
- `POST /api/admin/site` → salva dados do site
- `POST /api/admin/account` → atualiza usuário/senha do administrador
- `DELETE /api/admin/logout` → encerra sessão

## Banco de dados

### SQLite (local)
Usado em ambiente de desenvolvimento e testes locais.

### PostgreSQL (produção)
Usado em produção no Vercel.

As tabelas principais são:

- `site_data`: armazena o conteúdo do portfólio em JSON
- `admin`: guarda usuário e hash da senha
- `sessions`: guarda tokens ativos de sessão

## Variáveis de ambiente

Crie um arquivo `.env` local ou configure no painel da Vercel com:

```env
POSTGRES_URL="postgres://user:password@host:5432/dbname"

SESSION_SECRET="troque-por-um-segredo-forte"
```

> Em produção no Vercel, o recomendado é usar `DATABASE_URL` ou `POSTGRES_URL` conforme o provedor escolhido.

## Como rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Inicie o servidor:

```bash
npm start
```

3. Acesse:

```bash
http://localhost:8000
```

Se o banco não estiver configurado em variáveis, o sistema usa SQLite local automaticamente.

## Deploy na Vercel

1. Suba o projeto para um repositório do GitHub
2. Abra a Vercel e importe o projeto
3. Configure as variáveis de ambiente:
   - `DATABASE_URL` ou `POSTGRES_URL`
   - `ADMIN_USER`
   - `ADMIN_PASS`
   - `SESSION_SECRET`
4. Faça o deploy
5. Acesse o site e faça login no painel

## Observações importantes

- O SQLite é útil para desenvolvimento, mas não é recomendado para persistência real em produção na Vercel
- O painel administrativo está protegido por autenticação ativa
- A senha do admin padrão é sensível e deve ser trocada em produção
- O projeto está preparado para uma base profissional e futurista de apresentação de portfólio

## Segurança

Algumas boas práticas para produção:

- alterar a senha padrão do admin
- usar uma `SESSION_SECRET` forte
- manter o banco em serviço dedicado (Neon, Supabase, Railway, Render, Postgres da Vercel etc.)
- não versionar arquivos `.env` ou senhas em repositório público

## Licença

Este projeto foi desenvolvido para uso pessoal/profissional do autor e pode ser adaptado conforme a necessidade do cliente ou do portfólio.

## Autor

Willyan Martins

Site: https://github.com/WillyanMartinss/Portfolio
