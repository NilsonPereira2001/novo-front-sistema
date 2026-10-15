# Gestão de Associados — Frontend

Novo frontend do sistema de gestão de associados, em **Angular 21** (componentes standalone, signals, formulários reativos). O backend é o Spring Boot existente, com PostgreSQL.

> **Etapa atual:** login integrado, layout principal (menu lateral + barra superior) e tela Início. Os módulos (Pessoas, Financeiro, jurídico etc.) abrem uma página "em breve" até serem implementados.

## Como rodar

```bash
npm install
npm start          # http://localhost:4200
```

Em desenvolvimento, as chamadas para `/api` são redirecionadas pelo `proxy.conf.json` para o Spring Boot em `http://localhost:8081`, mantendo o prefixo `/api`. Suba o backend antes de testar o login.

```bash
npm run build      # build de produção
npm test           # testes unitários (Vitest)
```

## Estrutura

```
src/
├── environments/              # URL da API, endpoints de auth e identidade visual
├── styles/                    # tokens (cores, fontes), base e formulários globais
└── app/
    ├── core/
    │   ├── auth/
    │   │   ├── guards/        # authGuard (área protegida), guestGuard (login)
    │   │   ├── interceptors/  # cookies/Bearer na API, 401 → sessão expirada
    │   │   ├── models/        # tipos de sessão, usuário e erros
    │   │   └── services/      # AuthService, adaptador do contrato, lembrar usuário
    │   ├── config/            # token BRANDING (marca da contratante e da plataforma)
    │   └── navigation/        # menu do sistema: fonte única para sidebar, rotas e atalhos
    ├── layout/
    │   ├── auth-layout/       # tela dividida: identidade + formulário
    │   └── main-layout/       # área autenticada: sidebar/ + topbar/ + conteúdo
    ├── features/
    │   ├── auth/login/        # tela de login
    │   ├── auth/access-denied/
    │   ├── home/              # tela Início
    │   └── coming-soon/       # página provisória dos módulos ainda não construídos
    └── shared/
        ├── components/        # ícones, alertas, logomarca da contratante
        └── validators/
```

## Menu e novos módulos

O menu fica em `src/app/core/navigation/navigation.ts`. Cada item tem rótulo, rota, ícone, descrição e `available`.

Para implementar um módulo:

1. Crie a feature em `src/app/features/<modulo>/`.
2. Declare a rota real em `app.routes.ts`, como filha do layout principal.
3. Marque o item como `available: true` no menu. Enquanto estiver `false`, a rota abre a página "em breve".

Para restringir um item a certos perfis, use `roles: ['ADMIN']`. Isso só esconde o item no menu: a permissão continua sendo validada pelo backend.

## Identidade visual

- Cores, fontes, raios, sombras e medidas do layout: `src/styles/_tokens.scss`.
- Padrões de página reaproveitáveis (cabeçalho, cartões, etiquetas): `src/styles/_layout.scss`.
- Nome do sistema, empresa contratante e assinatura da WorkTec: `branding` em `src/environments/environment.base.ts`.
- Logomarca da contratante: coloque o arquivo em `public/branding/` e informe o caminho em `branding.tenant.logoUrl`. Sem logo, aparece um símbolo provisório.

## Integração com o backend

Login: `POST /api/auth/login` (`AuthProfController`), com `username` e `password` enviados como `application/x-www-form-urlencoded` no corpo da requisição.

| Resposta | O que a tela mostra |
|---|---|
| 200 + JWT | Entra e vai para `/inicio` |
| 401 | Usuário ou senha incorretos |
| 403 | Usuário inativo ou bloqueado |
| 500 / backend fora do ar | Servidor indisponível |

Toda a leitura do contrato está em `src/app/core/auth/services/auth-api.adapter.ts`, e os endpoints estão em `src/environments/environment.base.ts`.

### Pendências

- Confirmar os campos do `LoginResponseDTO`. Hoje o adaptador procura o token em `token` ou `accessToken`, e o usuário no corpo ou no `sub` do JWT.
- O backend não tem endpoint de usuário atual nem de logout. Por isso, recarregar a página exige novo login, e "Sair" apenas descarta o token.
- Definir o endereço da API em produção.

### Estratégia de sessão

- O JWT fica **somente em memória**, nunca no `localStorage`, e é enviado como `Authorization: Bearer` apenas para a própria API.
- A expiração do JWT (`exp`) é respeitada: ao expirar, ou se a API responder 401, o usuário volta ao login com o aviso "sessão expirada".
- Os guards só controlam a navegação. **Toda permissão precisa ser validada também no backend.**

### Recuperação de senha

O link "Esqueci minha senha" não aparece porque ainda não existe fluxo real no backend. Ele será adicionado quando esse fluxo existir.
