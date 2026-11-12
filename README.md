# Gestão de Associados — Frontend

Novo frontend do sistema de gestão de associados, em **Angular 21** (componentes standalone, signals, formulários reativos). O backend é o Spring Boot existente, com PostgreSQL.

> **Etapa atual:** login integrado, layout principal (menu lateral + barra superior), tela Início, listagem de Pessoas e cadastro de membro. Os demais módulos (Financeiro, Jurídico etc.) abrem uma página "em breve" até serem implementados.

## Como rodar

```bash
npm install
npm start          # http://localhost:4200
```

Em desenvolvimento, todas as chamadas ao backend usam o prefixo `/backend`, que o `proxy.conf.json` remove antes de encaminhar ao Spring Boot em `http://localhost:8081`. Por exemplo, `/backend/api/auth/login` vira `:8081/api/auth/login`, e `/backend/pessoas/listar/filtradas/paginada` vira `:8081/pessoas/listar/filtradas/paginada`. O prefixo evita conflito entre os caminhos do backend e as telas do Angular, que também usam `/pessoas`. Suba o backend antes de testar.

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
    │   ├── pessoas/           # lista única, aguardando deferimento (data/ = API)
    │   └── coming-soon/       # página provisória dos módulos ainda não construídos
    └── shared/
        ├── components/        # ícones, alertas, logomarca, paginação, busca, erro de carga
        ├── data/              # Pagina<T>, estado de carga, filtros na URL
        ├── pipes/             # cpf
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

- **Nomenclatura dos membros:** cada empresa chama os seus membros de um jeito, como "Associado" ou "Afiliado". O termo fica em `terminologia`, no `src/environments/environment.base.ts`. Todos os textos fixos usam esse termo, inclusive o nome do sistema ("Gestão de Associados" ou "Gestão de Afiliados"). Os nomes que vêm do banco, como os tipos de pessoa, já chegam com a nomenclatura de cada empresa.

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

A leitura do contrato de login está em `src/app/core/auth/services/auth-api.adapter.ts`. O prefixo do backend e o caminho do login estão em `src/environments/environment.base.ts`.

Em produção, o servidor web precisa encaminhar `/backend/*` ao Spring Boot removendo o prefixo, ou então `baseUrl` deve receber a URL completa da API, o que exige CORS no backend.

### Pendências

- Confirmar os campos do `LoginResponseDTO`. Hoje o adaptador procura o token em `token` ou `accessToken`, e o usuário no corpo ou no `sub` do JWT.
- O backend não tem endpoint de usuário atual nem de logout. Por isso, recarregar a página exige novo login, e "Sair" apenas descarta o token.
- Definir o endereço da API em produção.

### Estratégia de sessão

- O JWT fica **somente em memória**, nunca no `localStorage`, e é enviado como `Authorization: Bearer` apenas para a própria API.
- A expiração do JWT (`exp`) é respeitada: ao expirar, ou se a API responder 401, o usuário volta ao login com o aviso "sessão expirada".
- Os guards só controlam a navegação. **Toda permissão precisa ser validada também no backend.**

### Jurídico › Processos (`/juridico/processos`)

Código em `features/juridico/processos/`. Endpoints do `ProcessoJuridicoController` (PR #8), com respostas leves. As rotas antigas do `JuridicoController` continuam funcionando.

- **Lista:**
  - Chips por status com contagem.
  - Busca por número (com ou sem pontuação), descrição, assunto ou parte (nome/CPF).
  - Filtro por advogado responsável.
  - Marca "Parado" quando um processo em andamento está há mais de 180 dias sem movimentação.
- **Detalhe (`/juridico/processos/:id`):**
  - Dados do processo, partes (com link para o cadastro quando a parte é uma pessoa do sistema), audiências (a próxima fica em destaque) e linha do tempo das movimentações.
  - **Interpretação do advogado** em cada movimentação (`juridico/editar/movimentacao/{id}`).
  - **Atualizar do tribunal:** usa o serviço de consulta já existente e informa quantas movimentações e audiências novas entraram, ou avisa se o serviço não respondeu.
- **Novo/editar (`/novo`, `/:id/editar`):**
  - Número CNJ com máscara e conferência do dígito verificador (módulo 97); o número não muda na edição.
  - Status, data de distribuição, responsável (advogados), área, classe, assunto, foro, vara, juiz, valor da ação e observação.
  - Partes com tipo, busca de pessoa cadastrada (nome/CPF) ou preenchimento manual. O backend sincroniza as partes: atualiza, cria e remove.
  - Textos em maiúsculas.
- **Transferir responsável:** `POST juridico/processos/transferir-responsavel`, com a permissão `PROCESSO_EDITAR`.
  - Na lista, transfere todos os processos de um advogado para outro. "De" já vem preenchido com o filtro de responsável, e a tela mostra quantos processos serão transferidos.
  - No detalhe, transfere só aquele processo.
  - Substitui o antigo `GET juridico/processos/transferencia/{a}/{b}`.
- **Permissões:** `PROCESSO_NOVO_JURIDICO` para criar e `PROCESSO_EDITAR` para editar.
- **Testes:** `processos-api.spec.ts`.

### Painel financeiro (`/financeiro/painel`)

Código em `features/financeiro/dashboard/`. Endpoint `GET financeiro/dashboard?lancamentos=6|12|24` (`FinanceiroDashboardController`, PR #8).

- **Previsto para o próximo lançamento:** é o número principal. Soma os convênios ativos de associados ativos, as parcelas de acordos ativos e os planos de saúde (valor da faixa etária pela idade de hoje), com a mesma regra do `criarNovoLancamento`. Se houver um lançamento mensal aberto, mostra também o valor dele.
- **Indicadores:**
  - Total em débito (`EM ABERTO` + `NÃO DEBITADO`), com link para a lista filtrada.
  - Associados com débito e percentual dos ativos.
  - Recebido no mês.
- **Comparativo dos lançamentos:** colunas empilhadas por lançamento mensal, separadas em pago, em aberto, anistiado/renegociado e mês em andamento. Tem dica por coluna (mouse e teclado), legenda e "Ver tabela" com o % pago.
- **Listas:**
  - **Débitos por convênio:** planos de saúde aparecem como "PLANO DE SAÚDE · nome" e as parcelas de acordo têm linha própria.
  - **Idade dos débitos:** até 30, 60, 90, 180 dias e mais de 180.
  - **Planos de saúde:** vidas, previsto no mês e débito.
  - **Recebido no mês por forma de pagamento.**
  - **Previsto por convênio.**
  - **Os 10 maiores débitos:** cada nome abre a ficha financeira.
- **Gráficos:** as barras e as cores das séries (`--viz-serie-1..4`, validadas para daltonismo) ficam em `shared/components/charts/`.
- **Testes:** `dashboard-api.spec.ts`.

### Financeiro › Associados (`/financeiro/associados`)

Código em `features/financeiro/associados/`. Usa o `FinanceiroAssociadoController`, novo no PR #8 do `back-novo`.

- **Lista:** todos os associados com débitos pendentes e crédito. Pesquisa por nome ou CPF, filtros "Com débito", "Com crédito" e status, paginação no servidor. No topo ficam os totais de débitos pendentes e de créditos.
- **Ficha (`/financeiro/associados/:idAssociado`):**
  - **Débitos:** os pendentes (`EM ABERTO` e `NÃO DEBITADO`). Dá para **pagar** (forma de pagamento já vem com a do associado; observação opcional) e **anistiar** (motivo obrigatório, em maiúsculas), um por vez ou vários marcados. Depois do pagamento, a janela oferece o **recibo** em PDF de cada débito pago.
  - **Lançamento do mês:** o que está `EM TRANSAÇÃO ATUAL` e vira débito ao fechar o mês.
  - **Extrato:** filtro por período e situação, paginação, recibo dos pagos e **Imprimir extrato** (PDF do relatório `extrato_associado.jasper`).
  - **Convênios ativos** (total mensal dos fixos) e **acordos** (somente leitura).
  - **Crédito:** adicionar ou zerar. O crédito é abatido pelo fechamento do mês.
- **Permissões:** pagar exige `FINANCEIRO_BAIXAR_DEBITO`; anistiar exige `FINANCEIRO_ANISTIAR_DEBITO` (403 mostra mensagem).
- **Erros:** 400 e 404 mostram o texto do servidor.
- **Testes:** `financeiro-api.spec.ts`.

### Painel (`/painel`)

Indicadores dos associados, no menu logo abaixo de Início (e atalho na tela Início). Código em `features/painel/`. Endpoints do `DashboardController` (permissão `DASHBOARD_AFILIADO`), novos no PR #8 do `back-novo`:

- **`GET dashboard/associados/resumo?meses=6|12|24`:**
  - **Situação:** cada associado conta em uma situação só, e a soma dá o total. Aguardando deferimento é a restrição `AGUARDANDO ...`; desligado é status ou restrição `DESLIGADO`; ativo é status `ATIVO`; o resto conta como inativo (ex.: `ADESÃO INDEFERIDO`).
  - **Situação por vínculo:** tabela com ativos, inativos, desligados e aguardando para cada tipo de vínculo, com linha de total.
  - **Distribuições (só ativos):** por tipo de sócio, e **militares por unidade** e **por instituição** (só vínculo MILITAR). As 9 maiores aparecem; o resto vira "Outras".
  - **Evolução mensal:** primeiras adesões (sem pendentes ou indeferidas) e desligamentos efetivados. Gráfico de linhas com um eixo só, dica no mouse e nas setas do teclado, e botão "Ver tabela" com o saldo.
- **`GET dashboard/associados/aniversariantes?mes=1..12`:** associados ativos do mês, com idade que completam, vínculo e unidade (militar) ou instituição. Os de hoje ficam destacados; dá para navegar entre os meses.
- **Cores:** azul da marca e laranja, validadas para daltonismo. O texto nunca usa a cor da série.
- **Testes:** `painel-api.spec.ts`.

### Pessoas

Listagem integrada a `GET /pessoas/listar/filtradas/paginada` (`Page<PessoaDTO>`):

- **Parâmetros:** `filtro` e `idTipoPessoa` são enviados só quando preenchidos; `page`, que começa em 0, e `size` vão sempre.
- **Tamanho:** 7 por página, igual ao `@PageableDefault(size = 7)` do backend. Também há 15, 30 e 50.
- **Comportamento:** a pesquisa tem debounce. Mudar a pesquisa, o tipo ou o tamanho da página volta para a primeira página.
- **Resposta:** aceita `PageImpl` serializado ou `PagedModel`. Fora desse formato, a tela mostra "formato inesperado".
- **Arquivos:** o contrato está em `src/app/features/pessoas/data/pessoas-api.ts` e os modelos em `features/pessoas/models/`.
- **Testes:** `npm test` roda `pessoas-api.spec.ts`, que cobre os parâmetros e a leitura da resposta.

**Filtro por tipo:** as opções vêm de `GET /tipo/pessoas/listar` (`TipoPessoaController`), com `id` e `nome`. O seletor mostra o `nome` e envia o `id` em `idTipoPessoa`, sem nenhuma lista fixa no frontend. Pesquisa e tipo funcionam juntos, e limpar um não apaga o outro. O seletor tem estado de carregamento e mensagem de erro com "Tentar novamente".

Ainda são telas em construção: novo funcionário e edição de dependente e de funcionário.

### Aguardando deferimento (`/pessoas/aguardando-deferimento`)

Pedidos de **adesão** (cadastro novo ou reativação, restrição `AGUARDANDO ADESÃO`) e de **desligamento** (`AGUARDANDO DESLIGAMENTO`) que precisam ser analisados. Código em `features/pessoas/deferimento/`.

- **Lista:** `GET associado/aguardando/resumo` (`AguardandoDeferimentoDTO`, leve, sem foto). O tipo do pedido sai da restrição; a data mostrada é `ultimaAdesao` (adesão) ou `dataDesligamento` (desligamento). Filtro Todos / Adesão / Desligamento com contagem e busca local por nome ou CPF.
- **Deferir:** `POST associado/deferir/{idAssociado}`, com o usuário logado tirado do token pelo backend (`AFILIADO_DEFERIR`). Adesão → associado e dependentes ATIVOS; desligamento → INATIVO / DESLIGADO.
- **Indeferir:** `PUT associado/indeferir/{idAssociado}?motivo=` com motivo obrigatório em maiúsculas (`AFILIADO_INDEFERIR`). Adesão → `ADESÃO INDEFERIDO`; desligamento → pedido cancelado, associado e dependentes voltam a ATIVO.
- **Erros:** 400 mostra o texto do backend (sem o prefixo "Erro:"), 403 avisa que falta permissão.
- **Detalhe:** com pedido pendente, Desligar e Reativar dão lugar a "Ver pedido" e aparece um alerta com link para esta tela.
- **Testes:** `deferimento-api.spec.ts`.

### Cadastro de membro (`/pessoas/novo/membro`)

O cadastro é feito em 8 etapas, com revisão antes de salvar. Os arquivos ficam em `src/app/features/pessoas/cadastro-membro/`:

- `data/cadastro-api.ts`: todos os endpoints e as pendências.
- `form/membro-form.ts`: o estado do formulário.
- `form/membro-payload.ts`: monta o JSON de `AssociadoNovoDTO`.
- `data/cadastro-erro.ts`: interpreta as respostas de erro do salvamento.

**Endpoints usados:** `GET /sexo/todos`, `/estado/civil/todos`, `/estados/todos`, `/bancos/todos`, `/tipo/pix`, `/formas/pagamentos`, `/listar/tipo/vinculo`, `/instituicao/listar/por/vinculo/{id}`, `POST /unidade/listar`, `GET /graduacao/listar`, `/listar/quadros`, `/tipo/socios/todos`, `/convenios/fixos/nao/nativos/ativos`, `/tipo/pessoas/listar` e `/empresa/conveniada/todas/paginada`. A busca do membro indicador reaproveita `/pessoas/listar/filtradas/paginada`.

**Salvar:** `POST /associado/salvar/novo` (permissão `AFILIADO_CRIAR`), com o `AssociadoNovoDTO` como JSON no corpo e o token no `Authorization`.

| Resposta | O que a tela mostra |
|---|---|
| 201 + Associado | Tela "Cadastro salvo com sucesso" |
| 400 ("Erro: Dados inválidos ou duplicados.") | O texto do backend, sem o "Erro:", e a dica de conferir se o CPF já está cadastrado |
| 403 | Usuário sem permissão para cadastrar |
| 500 | Mensagem genérica. O texto da exceção que o backend devolve nunca é exibido |
| Backend fora do ar | Falha de conexão |

O botão fica bloqueado durante o envio para evitar cadastro duplicado.

**Payload:**
- Só são enviadas propriedades do DTO, e os opcionais vazios são omitidos.
- `id` nunca é enviado. `dataCadastro` é a **data de adesão** da etapa "Adesão e convênios" (começa com hoje, obrigatória), enviada como Instant com a hora atual; o backend grava em `pessoas.data_cadastro`, `primeiraAdesao`, `ultimaAdesao` e na adesão dos convênios. Na edição o campo não aparece e não é enviado.
- Relacionamentos vão como `{ "id": n }`, e as datas como `YYYY-MM-DD`.
- CPF, CEP e telefones vão só com dígitos.
- `telefones` vai como `[{ telefone, principal }]`, sem `pessoa`, e `convenios` como `[{ id }]`.

**Maiúsculas:** todos os cadastros são gravados em MAIÚSCULAS.

- **Na digitação:** o `app-text-field` converte enquanto se digita, nos campos de texto sem máscara. Para um campo ficar de fora, use `[maiusculas]="false"`.
- **No envio:** os montadores do JSON (`membro-payload.ts` e `dependente.adapter.ts`) aplicam `maiusculas()` de novo.
- **Exceções:** e-mail, chave Pix e datas ficam como foram digitados.

**Vínculo militar:** matrícula, unidade, graduação, quadro e data de incorporação só ficam habilitados quando o tipo de vínculo é **MILITAR**, comparado pelo nome que vem de `/listar/tipo/vinculo`, sem diferenciar maiúsculas e acentos. Ao trocar para outro vínculo, esses campos são limpos e não são enviados. A instituição vale para qualquer vínculo.

**Vínculo conveniado:** quando o tipo de vínculo é **CONVENIADO**, aparece o campo "Empresa conveniada" na etapa de dados funcionais, e ele passa a ser obrigatório. Nos demais vínculos o campo não aparece, e a empresa não é enviada.

**Validação:** CPF, nome, data de nascimento e sexo são obrigatórios, e a empresa conveniada também, quando o vínculo é CONVENIADO. Outras obrigatoriedades do backend não foram informadas e por isso não foram inventadas. Há validação de formato de CPF, e-mail, CEP, telefone e datas.

**⚠️ Pendências do backend:**

1. **Foto:** enviada como data URL (`FOTO_FORMATO = 'data-url'`). O backend corta o que vem antes da vírgula e decodifica o Base64, tanto no cadastro quanto na edição.
2. **`POST /unidade/listar`:** o corpo enviado é `{ "id": idInstituicao }`. Falta confirmar se é isso que o backend espera.
3. **Campos de rótulo:** `Sexo` usa `sexo` e `FormaPagamento` usa `forma`. As demais entidades usam `nome`, `descricao`, `tipo` ou `sigla`. Se nenhum desses existir e a entidade tiver um único campo de texto, ele é usado. Os nomes de campo ficam em `LABELS`, no `cadastro-api.ts`.
4. **Referências:** falta confirmar que o backend aceita `{ id }` nos relacionamentos e só dígitos em CPF, CEP e telefone.
5. **Tipo de conta:** é texto livre, porque não há lista de valores confirmada.
6. **Serviço de CEP:** não existe, então não há preenchimento automático do endereço.

### Editar associado (`/pessoas/:id/editar`)

O botão **Editar** do cadastro do associado abre o mesmo formulário do cadastro, já preenchido (PR #6 do `back-novo`).

- **Carregamento:** o id da Pessoa vira o id do Associado (`GET associado/pessoa/{id}`), e o formulário é preenchido com `GET associado/dados/editar/{idAssociado}` (`AssociadoNovoDTO`).
- **Ordem do preenchimento:** vínculo → instituição → unidade e demais campos, para as regras de MILITAR e CONVENIADO não apagarem o que veio do banco.
- **CPF:** fica travado; o backend não altera CPF.
- **Convênios:** ficam de fora; são geridos na aba Convênios.
- **Salvar:** envia `PUT associado/editar` com o mesmo JSON do cadastro mais o `id` do Associado, e sem `convenios`. As regras de maiúsculas e de obrigatórios são as mesmas do cadastro. Ao salvar, volta ao cadastro com o aviso "Cadastro de … atualizado.".
- **Foto:** vai a atual (ou a nova). Se for removida, vai `""`, que o backend entende como remover.
- **Sair sem salvar:** pede confirmação.
- **Arquivos:** `cadastro-membro/form/membro-edicao.ts`, com testes em `membro-edicao.spec.ts`.
- **Dependentes e funcionários:** ainda não têm edição; o botão não aparece para eles.

### Detalhe da pessoa (`/pessoas/:id`) — ⚠️ dados fictícios

Ao clicar no nome de uma pessoa na lista, abre o detalhe. É **uma tela só** para membro, funcionário e dependente, e o que muda entre eles fica em `detalhe/models/perfil-config.ts`:

| Perfil | Abas | Documentos | Desligar / Reativar |
|---|---|---|---|
| Membro | Dados, Convênios, Indicações, Dependentes, Arquivos | Declaração de vínculo, Ficha, Contrato de adesão, Contrato de desligamento | Sim |
| Funcionário | Dados, Arquivos | Declaração de vínculo, Ficha | Sim |
| Dependente | Dados (com link para o titular), Arquivos | Ficha | Não |

- **Ações:** Editar (por enquanto leva a "em construção"), Documentos (prévia e impressão), Desligar (pede data e motivo, campos `data_desligamento` e `motivo_desligamento` de `Associado`) e Reativar.
- **Regras de documentos:** a declaração de vínculo só fica disponível com status ativo, e o contrato de desligamento só depois do desligamento. ⚠️ A confirmar.
- **Aba na URL:** `?aba=convenios`, para o "voltar" do navegador funcionar.

**Ficha do associado (dados reais):** o adaptador `detalhe/data/associado.adapter.ts` lê a entidade `Associado`, com a `Pessoa` dentro, exatamente como o Jackson a serializa:

- **Campos com "_" do Lombok:** `data_incorporacao`, `nome_guerra`, `data_nascimento`, `data_cadastro` e `motivo_desligamento` são lidos com esse nome, e a forma camelCase também é aceita.
- **Datas:** `LocalDate` vem em texto ou como `[a, m, d]`; `Instant` vem em ISO ou em segundos.
- **Imagens:** `imgPerfil` e `qrcodeValidador` (`byte[]` em base64) viram a foto e o QR code da ficha. Só JPEG, PNG, GIF e WebP são aceitos.
- **Indicador:** o link usa o id da **Pessoa** do associado indicador, não o id do Associado.
- **Campos novos na tela e na ficha:** título de eleitor e carteira (impressa/entregue).
- **Testes:** `associado.adapter.spec.ts`.

**Convênios do associado (dados reais):** tabela `convenios_associados` (`ConvenioAssociado`), pelas rotas de `convenios/` (ajustes no PR #5 do `back-novo`).

- **Aba Convênios:** mostra os ativos (`GET convenios/associado/{idAssociado}`), com o total mensal dos fixos, e o histórico de desligados (`GET convenios/associado/removidos/{idAssociado}`).
- **Adicionar:** escolhe um dos convênios de `GET convenios/fixos/nao/nativos/ativos` que ainda não esteja ativo e envia `POST convenios/convenio/{idConvenio}/associado/{idAssociado}`.
- **Desligar:** `POST convenios/convenio/associado/{idConvenioAssociado}` marca como DESLIGADO e mantém o histórico. Convênios **nativos** (ex.: mensalidade) não têm o botão.
- **Arquivos:** `detalhe/data/convenio.adapter.ts` e `detalhe/abas/aba-convenios.ts`, com testes em `convenio.adapter.spec.ts`.

**Indicações (dados reais):** usam as rotas do PR #4 do `back-novo`.

- **Aba Indicações do associado:** `GET associado/indicados/{idAssociado}/resumo` (`IndicacaoDTO`). Mostra o total e quantas estão ativas (mesmo critério do `contarIndicacoesAtivas`), com nome, CPF, adesão e status. O nome abre o cadastro do indicado.
- **Campo "Indicado por" do cadastro:** `GET associado/indicadores?filtro=` traz só associados ATIVOS e usa o **id do Associado**, que é o que `AssociadoNovoDTO.associadoIndicador` espera. A busca anterior usava a lista de pessoas e enviava o id da Pessoa.
- **Arquivos:** `detalhe/data/indicacao.adapter.ts`, com testes em `indicacao.adapter.spec.ts`.

**Dependentes (dados reais):** usam o `DependenteController`, com os ajustes do PR #3 do `back-novo`.

- **Aba Dependentes do titular:** lista em `GET dependente/titular/{idPessoaTitular}`, com parentesco, CPF, nascimento, agregado e status. Cada nome abre o detalhe do dependente.
- **Incluir dependente:** formulário em janela que envia `POST dependente/novo` (`DependenteNovoDTO`). Nome, data de nascimento e sexo são obrigatórios; o CPF é opcional (por exemplo, criança sem CPF), mas é validado quando preenchido. Os textos vão em MAIÚSCULAS. O usuário escolhe **Dependente direto**, que exige o parentesco (lista de `dependente/parentesco`), ou **Agregado**, que exige o tipo de vínculo agregado (lista de `dependente/listar/tipos/agregado`). Só o campo do tipo escolhido é enviado, junto com `agregado: true/false`, e o backend valida a mesma regra (PR #3).
  - O `tipoPessoa` vai como o tipo "DEPENDENTE" de `/tipo/pessoas/listar`.
  - O `dataCadastro` não é enviado; o backend usa a data atual.
  - CPF duplicado mostra a mensagem do servidor.
- **Listas do formulário:** `dependente/parentesco`, `dependente/listar/tipos/agregado`, `/sexo/todos` e `/estado/civil/todos`.
- **Detalhe do dependente:** vem de `GET dependente/listar/dependente/pessoa/{idPessoa}`, com titular, parentesco, agregado e data de inclusão.
  - **Desligar e reativar:** usam `dependente/desligar/{id}` e `dependente/reativar/{id}`, só com confirmação, porque o backend não registra motivo para dependente.
- **Link sem o tipo da pessoa:** quando a tela não sabe o tipo, tenta associado e, se receber 404, dependente.
- **Arquivos:** `detalhe/data/dependente.adapter.ts`, com testes em `dependente.adapter.spec.ts`.

**Arquivos (dados reais):** a aba Arquivos usa o `ArquivoPessoaController` para qualquer pessoa real (associado, funcionário ou dependente); só as pessoas inventadas pela demonstração continuam de exemplo.

- **Rotas:** `GET files/pessoa/{idPessoa}` lista, `POST files/upload` envia (multipart com `pessoaId`, `arquivo`, `departamentoId` e `nome`), `GET files/api/file/{id}` baixa e `DELETE files/{id}` remove (PR #2 do `back-novo`).
- **Departamento:** a categoria do envio é o departamento, vindo de `GET departamento/todos`.
- **Limites:** PDF, PNG ou JPG de até 10 MB. O backend precisa de `spring.servlet.multipart.max-file-size=10MB`, também incluído no PR #2.
- **Arquivos:** `detalhe/data/arquivo.adapter.ts`, com testes em `arquivo.adapter.spec.ts`.

**Ficha em PDF:** "Ficha do associado", no menu Documentos, chama `POST /ficha/associado/3/{idAssociado}` (`ficha_associado.jasper`) e mostra o PDF com Imprimir e Baixar. O backend ignora o `idEmpresa` da rota e usa a empresa 3, que está fixa no `AssociadoReport`.

**Rota do detalhe:** `GET /associado/pessoa/{idPessoa}` (PR #1 do `back-novo`), configurada em `DETALHE_API`, no arquivo `detalhe/data/pessoa-detalhe-integrada.ts`. Ela recebe o **id da Pessoa**, o mesmo da lista.

- **Cadastro de associado:** vem do servidor, com o aviso "Integração parcial".
- **Desligar e reativar do associado:** `POST associado/desligar/{id}?motivo=&dataDesligamento=` (data do formulário enviada como Instant ao meio-dia UTC) e `POST associado/reativar/{id}?dataReinclusao=`. Os dois **viram pedidos** que só valem depois do deferimento; o 400 `{"error": ...}` (ex.: diretor ativo) aparece no diálogo.
- **Continuam de demonstração:** cadastro de funcionário e os demais documentos (declaração e contratos).
- **404:** a tela mostra "Cadastro não encontrado".
- **Formatos aceitos:** o adaptador lê as duas versões da entidade, com `Instant`/`LocalDate` ou com `Date`, foto em `imgPerfil` ou em `foto`, e `Conta` com `numero_conta`/`pix`/`operacao` ou com os nomes do DTO.

**A confirmar:**
- Os campos de `EnderecoPessoa` e `Conta`; hoje usamos os mesmos nomes do `AssociadoNovoDTO`.
- O campo de texto de `EstadoCivil`, `TipoVinculo`, `Unidade`, `Graduacao`, `Quadro`, `TipoSocio` e `TipoPix`.

**Para integrar o restante:** implemente os métodos de `PessoaDetalheFonte` em `PessoaDetalheIntegrada` à medida que os endpoints existirem e, no fim, apague `pessoa-detalhe.demo.ts`. Os documentos já aceitam PDF vindo da API, com as opções Imprimir e Baixar.

**Faltam do backend:** os endpoints acima, os campos do funcionário (cargo, setor e admissão são provisórios) e as categorias de arquivo (hoje: Documentos pessoais, Comprovantes, Contratos, Outros).

### Recuperação de senha

O link "Esqueci minha senha" não aparece porque ainda não existe fluxo real no backend. Ele será adicionado quando esse fluxo existir.
