# Gestão de Associados — Frontend

Novo frontend do sistema de gestão de associados, em **Angular 21** (componentes standalone, signals, formulários reativos). O backend é o Spring Boot existente, com PostgreSQL.

> **Etapa atual:** fundação da aplicação e tela de login. Os demais módulos (pessoas, financeiro, jurídico etc.) ainda não foram implementados.

## Como rodar

```bash
npm install
npm start          # http://localhost:4200
```

Em desenvolvimento, as chamadas para `/api` são redirecionadas pelo `proxy.conf.json` para `http://localhost:8080` (Spring Boot). Ajuste o `target` se o backend estiver em outra porta, e remova o `pathRewrite` se o backend já usar o prefixo `/api`.

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
    │   └── config/            # token BRANDING (marca da contratante e da plataforma)
    ├── layout/
    │   ├── auth-layout/       # tela dividida: identidade + formulário
    │   └── main-layout/       # estrutura mínima da área autenticada
    ├── features/
    │   ├── auth/login/        # tela de login
    │   ├── auth/access-denied/
    │   └── home/              # página inicial provisória (sem dashboard)
    └── shared/
        ├── components/        # ícones, alertas, logomarca da contratante
        └── validators/
```

## Identidade visual

- Cores, fontes, raios e sombras: `src/styles/_tokens.scss`.
- Nome do sistema, empresa contratante e assinatura da WorkTec: `branding` em `src/environments/environment.ts`.
- Logomarca da contratante: coloque o arquivo em `public/branding/` e informe o caminho em `branding.tenant.logoUrl`. Sem logo, aparece um símbolo provisório.

## ⚠️ Pendências antes da integração real

O contrato de autenticação do backend ainda **não foi confirmado**. Tudo o que depende dele está isolado em dois lugares:

1. `src/environments/environment.ts` → `api.auth`
   - `loginPath` — caminho do endpoint de login (provisório: `/auth/login`)
   - `sessionPath` — endpoint que devolve o usuário logado (para manter a sessão ao recarregar)
   - `logoutPath` — endpoint de logout, se existir
   - `withCredentials` — `true` se o backend usa cookie HttpOnly ou sessão
2. `src/app/core/auth/services/auth-api.adapter.ts`
   - nomes dos campos enviados no login;
   - onde ficam o token, o nome, o id e os perfis do usuário na resposta.

Também é preciso confirmar no Spring:

- **CORS** liberando a origem do frontend com `allowCredentials=true`, se for usar cookies fora do proxy;
- **Status HTTP** para credenciais inválidas (401 ou 400) e para usuário sem permissão (403).

### Estratégia de sessão

- **Preferida:** cookie `HttpOnly`, `Secure` e `SameSite` emitido pelo backend. O frontend nunca lê o token.
- **Se o backend devolver JWT no corpo:** o token fica **somente em memória**, nunca no `localStorage`. Ao recarregar a página é preciso entrar de novo, a menos que exista `sessionPath` ou refresh token em cookie.
- A expiração do JWT (`exp`) é respeitada: ao expirar, o usuário volta ao login com o aviso "sessão expirada".
- Os guards só controlam a navegação. **Toda permissão precisa ser validada também no backend.**

### Recuperação de senha

O link "Esqueci minha senha" não aparece porque ainda não existe fluxo real no backend. Ele será adicionado quando esse fluxo existir.
