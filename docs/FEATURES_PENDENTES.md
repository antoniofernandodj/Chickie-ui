# Análise de Features Pendentes — chickie-ui

> Roadmap técnico baseado em inventário completo do código atual (Angular, signals, SSR, WebSockets, JWT). Os nomes de componentes, serviços e rotas seguem as convenções já estabelecidas no repositório (`src/app/features/*`, `src/app/core/services/*`, guards em `src/app/core/guards/*`).
>
> Última atualização: 2026-04-29

---

## 1. Fluxo do Entregador

O modelo `Entregador` já existe (`models/index.ts`) e o admin consegue criar/editar/togglar disponibilidade via `AdminService.adicionarEntregador` / `toggleDisponibilidadeEntregador`, mas não há **nenhuma superfície de UI dedicada ao usuário entregador**. O role `entregador` é cidadão de segunda classe — pode logar (auth funciona), mas cai na home de cliente.

### 1.1 Painel do Entregador (Home do Entregador)
- **Por que**: o entregador é o "operador móvel" do delivery; sem app dedicado ele não tem como ver corridas, aceitar/recusar, marcar entregue. É o gargalo entre `pronto` e `entregue` no fluxo de status.
- **O que construir**:
  - Rota `/entregador` (lazy-loaded), guardada por novo `entregadorGuard` em `src/app/core/guards/entregador.guard.ts` (espelho do `ownerGuard` checando `auth.userClass() === 'entregador'`).
  - `EntregadorPanelComponent` (`src/app/features/entregador/entregador-panel.component.ts`) com tabs `UiTabBarComponent`: "Entregas Ativas", "Disponíveis", "Histórico".
  - `EntregadorService` em `src/app/core/services/entregador.service.ts` com: `listarMinhasEntregas()`, `aceitarPedido(uuid)`, `marcarRetirado(uuid)`, `marcarEntregue(uuid)`, `meusGanhos(periodo)` — endpoints novos no backend (ex: `GET /api/entregador/me/pedidos`, `POST /api/pedidos/:uuid/aceitar-entrega`).
  - Redirect pós-login: `LoginComponent` precisa rotear conforme `userClass` (hoje sempre vai pra `/`).
- **Prioridade**: **Alta** — sem isso o ciclo `saiu_para_entrega → entregue` depende do admin/funcionário fazer manualmente, o que é incoerente com um "clone iFood".
- **Dependências**: backend precisa expor endpoints de assignment de entregador a pedido; novo campo `entregador_uuid` em `Pedido` (não existe no model atual).

### 1.2 Toggle de Disponibilidade do Entregador (self-service)
- **Por que**: hoje só o admin liga/desliga `disponivel` via `AdminService.toggleDisponibilidadeEntregador`. O próprio entregador deve "entrar em serviço" como em qualquer app de delivery.
- **O que construir**: switch no header do `EntregadorPanelComponent` chamando endpoint `PUT /api/entregadores/me/disponibilidade`. Persistir estado no signal `disponivel` exibindo banner laranja "Você está offline".
- **Prioridade**: **Alta** (parte do 1.1).
- **Dependências**: 1.1.

### 1.3 Geolocalização ao vivo do Entregador (rastreamento real)
- **Por que**: a página `/pedidos/:uuid` mostra steps mas só no nível de status. iFood/Rappi mostram **mapa com pin do entregador**. O model `EnderecoEntrega` já tem `latitude`/`longitude` e `Entregador` tem placa/veículo — falta o pulse de posição.
- **O que construir**:
  - Novo serviço `EntregadorLocationService` que usa `navigator.geolocation.watchPosition` no browser e publica via WebSocket `/api/entregador/location/ws`.
  - `MapaEntregaComponent` (Leaflet ou Google Maps) reutilizado em `pedido-detalhe.component.html` (cliente vendo entrega) e em `admin.component.html` (admin acompanhando frota).
  - Estender `PedidosLiveService` com `acompanharEntregadorPorPedido(uuid): Observable<{lat,lng,timestamp}>`.
- **Prioridade**: **Média** — alto wow-factor mas exige infra de mapa + permissões de geolocation.
- **Dependências**: 1.1, biblioteca de mapas, backend de pub/sub de coordenadas.

### 1.4 Histórico de Ganhos / Comissões do Entregador
- **Por que**: motorista precisa saber quanto ganhou no dia/semana. Modelo de negócios crítico.
- **O que construir**: aba "Ganhos" no `EntregadorPanelComponent` com agregações por período. Endpoint `GET /api/entregador/me/ganhos?de=...&ate=...`.
- **Prioridade**: **Baixa** — depende de regras de comissão (não há campo `comissao_entregador` nos models hoje).
- **Dependências**: 1.1, definição de modelo financeiro.

---

## 2. Fluxo do Cliente Logado

### 2.1 Live tracking integrado em `/pedidos` (lista)
- **Por que**: `PedidosLiveService.acompanharPorCodigo()` existe e funciona em `/pedidos/:uuid`, mas em `pedidos.component.ts` a lista é fetchada **uma vez** via `pedidoService.listar()` dentro de `afterNextRender`, sem WebSocket. O usuário precisa entrar pedido a pedido para ver mudanças.
- **O que construir**:
  - Novo método em `PedidosLiveService.conectarMeusPedidos(token): Observable<Pedido[]>` apontando para `wss://.../api/pedidos/meus/ws` (endpoint a ser criado no backend, espelhando `por-loja/.../ws`).
  - Em `PedidosComponent`, substituir o `pedidoService.listar()` por subscription ao WS (com fallback HTTP no SSR/erro). Usar `takeUntilDestroyed(destroyRef)`.
  - Badge animado "ao vivo" (verde pulsante) em cada card cujo status seja não-terminal.
- **Prioridade**: **Alta** — é UX crítica e a infra (WS + normalizador) já existe.
- **Dependências**: endpoint `/pedidos/meus/ws` no backend.


### 2.3 Repetir Pedido (Re-order)
- **Por que**: feature de retenção. Cliente que pediu sushi terça quer pedir de novo na sexta com 1 clique.
- **O que construir**: botão "Pedir novamente" no card de `pedidos.component.html`, que chama nova action `CartService.carregarDePedido(pedido)` populando o carrinho com os mesmos itens (verificando `disponivel` no catálogo atual).
- **Prioridade**: **Média**.
- **Dependências**: 2.2.

### 2.4 Avaliação Pós-Entrega (push-to-rate)
- **Por que**: `AvaliacaoLojaForm` existe mas não é triggerado automaticamente. Hoje o usuário só avalia se voltar manualmente à página da loja.
- **O que construir**:
  - Detectar transição `entregue` no live tracking → exibir modal `AvaliarPedidoModalComponent` em `pedido-detalhe.component.html`.
  - Suportar avaliação de **produto** também (`AvaliacaoDeProduto` já modelado em `models/index.ts`, mas sem UI).
- **Prioridade**: **Média** — alto valor para o negócio (review velocity).
- **Dependências**: nenhuma; modelos prontos.

### 2.5 Endereço selecionável no Checkout (vincular `EnderecoUsuario`)
- **Por que**: o cliente cadastra endereços em `/perfil` via `EnderecoUsuarioService`, mas no `criar-pedido-modal` o endereço é digitado **do zero a cada compra**. Inconsistência grosseira.
- **O que construir**: dropdown no modal/checkout listando `EnderecoUsuarioService.listar()` + opção "Novo endereço". Calcular taxa de entrega via raio (`Loja.raio_entrega_km`) — atualmente fixa.
- **Prioridade**: **Alta** — fricção enorme no checkout.
- **Dependências**: 2.2 ajuda mas não bloqueia.

### 2.6 Histórico/Comprovantes de Pagamento
- **Por que**: `PagamentoService` existe e cria PIX, mas não há listagem de pagamentos passados, comprovantes, status `pago/pendente/expirado`.
- **O que construir**:
  - `PagamentoService.listarMeus()` (endpoint novo `GET /api/pagamentos/meus`).
  - Aba "Pagamentos" em `/perfil` com lista de transações + link para baixar comprovante (PDF).
- **Prioridade**: **Média** — exigência fiscal/UX.
- **Dependências**: backend.

### 2.7 Cancelamento pelo cliente
- **Por que**: `PedidoService.cancelar(uuid)` existe e o admin usa, mas o cliente não tem botão de cancelar em `pedido-detalhe.component.ts` — apenas pagamento. Em status iniciais (`criado`, `aguardando_confirmacao_de_loja`) o cliente deveria poder cancelar.
- **O que construir**: botão "Cancelar pedido" condicional ao `status` em `pedido-detalhe.component.html`, com `UiModalComponent` de confirmação.
- **Prioridade**: **Alta** — sem isso o cliente fica refém de pedidos errados.
- **Dependências**: regra de negócio sobre janelas de cancelamento.

### 2.8 Múltiplas formas de pagamento
- **Por que**: hoje só PIX (`PagamentoService.criar` retorna `qr_code_image` e `pix_copia_cola`). Cartão de crédito, débito na entrega, dinheiro com troco — todos ausentes.
- **O que construir**:
  - Estender `forma_pagamento` em `CreatePedidoRequest` (string livre hoje).
  - `CartaoCreditoFormComponent` (tokenização via Asaas — `asaas_customer_id` já existe em `Usuario`).
  - Campo "troco para" quando dinheiro.
- **Prioridade**: **Alta** — limitação séria do MVP.
- **Dependências**: integração Asaas card flow (parcial — customer_id já existe).

---

## 3. Fluxo do Funcionário

O role `funcionario` está modelado (`Funcionario` em `models/index.ts`), o admin cadastra via `AdminService.adicionarFuncionario`, mas **nenhuma rota o aceita** — sem guard, sem painel.

### 3.1 Painel do Funcionário (KDS — Kitchen Display System)
- **Por que**: funcionário de cozinha precisa ver pedidos `confirmado_pela_loja` → `em_preparo` → `pronto`. Hoje só o admin (em `/admin/:loja_uuid` aba "pedidos") tem essa visão, com permissão excessiva (vê cupons, equipe, finanças).
- **O que construir**:
  - Rota `/funcionario` com `funcionarioGuard` (verificando `userClass === 'funcionario'`).
  - `FuncionarioPanelComponent` (`src/app/features/funcionario/funcionario-panel.component.ts`) reutilizando `PedidosLiveService.conectar()` (já parametrizável por status). Layout em colunas tipo Trello: "Confirmados | Em preparo | Prontos".
  - Determinar `loja_uuid` do funcionário via `GET /api/funcionarios/me` (endpoint novo) — hoje o JWT não carrega esse vínculo na UI.
  - Botões para avançar status reutilizando `PedidoService.avancar()`.
- **Prioridade**: **Alta** — sem isso o admin acumula trabalho operacional.
- **Dependências**: endpoint `/funcionarios/me`, `funcionarioGuard`.

### 3.2 Impressão automática / Bipe de novo pedido
- **Por que**: cozinha real precisa de áudio + impressão térmica.
- **O que construir**:
  - Som configurável quando `PedidosLiveService.conectar()` recebe novo pedido com `status === 'aguardando_confirmacao_de_loja'`.
  - Integração com impressora ESC/POS via Web USB ou ponte local — exposta como `PrintService`.
- **Prioridade**: **Média**.
- **Dependências**: 3.1.

---

## 4. Operações & Admin

### 4.1 Dashboard com métricas (admin)
- **Por que**: o admin tem 10 abas operacionais mas **nenhuma de overview**. Faturamento do dia, pedidos por hora, ticket médio, top produtos — tudo ausente.
- **O que construir**:
  - Nova primeira aba `dashboard` em `admin.component.ts`.
  - `DashboardLojaComponent` consumindo endpoints `GET /api/admin/lojas/:uuid/metricas?periodo=hoje|semana|mes`.
  - Charts via `ng2-charts`/Chart.js (não está no `package.json` ainda).
- **Prioridade**: **Alta** — diferenciador de produto SaaS.
- **Dependências**: endpoints de agregação no backend.

### 4.2 Gestão de Estoque
- **Por que**: `Produto` tem flag `disponivel: boolean` (toggle on/off) mas não há quantidade. Em delivery real, "acabou o açaí" é diário.
- **O que construir**: campo `estoque?: number` em `Produto`, badge "X restantes" em `loja-detalhe.component.html`, decremento automático na criação de pedido (backend).
- **Prioridade**: **Média**.
- **Dependências**: alteração de schema no backend.

### 4.3 Notificações Push (Web Push API)
- **Por que**: ausente. Cliente só descobre que o pedido saiu olhando a tela.
- **O que construir**:
  - `ngsw-config.json` já existe (PWA setup parcial). Adicionar `SwPush` do `@angular/service-worker`.
  - Service `PushNotificationService` cuidando de subscribe/unsubscribe/VAPID.
  - Backend endpoint `POST /api/usuarios/me/push-subscription` para guardar endpoint do navegador.
  - Triggers nos status: `confirmado_pela_loja`, `saiu_para_entrega`, `entregue`.
- **Prioridade**: **Alta** — recurso PWA-flagship.
- **Dependências**: VAPID keys, alteração no backend.

### 4.5 Bloquear/Banir Cliente (admin)
- **Por que**: a loja precisa se proteger de clientes problemáticos.
- **O que construir**: aba "Clientes" no admin listando `Cliente` (model existe) com toggle `bloqueado`. Endpoint `PATCH /api/clientes/:uuid/bloqueado`.
- **Prioridade**: **Baixa**.
- **Dependências**: backend.

### 4.6 Exportar relatórios (CSV/PDF)
- **Por que**: contabilidade da loja precisa.
- **O que construir**: botão "Exportar" nas abas de pedidos/cupons/avaliações, gerando CSV via biblioteca `papaparse`.
- **Prioridade**: **Baixa**.
- **Dependências**: nenhuma.

---

## 5. UX & Produto

### 5.1 Filtros de busca avançada na Home
- **Por que**: `home.component.ts` só faz `lojaService.pesquisar(termo)` — busca textual. Sem filtros de categoria, preço médio, tempo de entrega, "abertas agora", taxa grátis, distância.
- **O que construir**:
  - `LojaService.filtrar(params)` aceitando `categoria_uuid?`, `tempo_max?`, `taxa_max?`, `aberta_agora?`, `lat?,lng?,raio?`.
  - `FiltrosBarraComponent` no topo da home com chips/bottom-sheet mobile.
  - Endpoint `GET /api/lojas/buscar?...`.
- **Prioridade**: **Alta** — descoberta é o motor do app.
- **Dependências**: backend.

### 5.3 Geolocalização do Cliente / "Lojas perto de você"
- **Por que**: ordem de exibição hoje não considera distância. `EnderecoEntrega` já tem `lat/lng`, `Loja.raio_entrega_km` existe — falta consumir.
- **O que construir**: `GeolocationService` que pede `navigator.geolocation`, salva em signal global, usa coordenadas em `LojaService.filtrar`. Adicionar campo "endereço de entrega ativo" no `HeaderComponent`.
- **Prioridade**: **Alta** — UX padrão.
- **Dependências**: 5.1.

### 5.7 Onboarding/Tutorial (primeiro acesso)
- **Por que**: `Usuario.passou_pelo_primeiro_acesso: boolean` existe no model mas a UI nunca consulta. É um hook de onboarding desperdiçado.
- **O que construir**: `OnboardingTourComponent` (overlay tipo Shepherd.js) disparado quando `passou_pelo_primeiro_acesso === false`, terminando com PUT para marcar `true`.
- **Prioridade**: **Baixa**.
- **Dependências**: endpoint para flipar a flag.

### 5.8 Recuperação de senha ("Esqueci minha senha")
- **Por que**: ausente nas rotas (`/auth/login`, `/auth/signup`, `/auth/verificar-email`, `/auth/confirmar-email` — sem reset). Bloqueia usuários reais constantemente.
- **O que construir**:
  - Rotas `/auth/esqueci-senha` (formulário de email) e `/auth/redefinir-senha?token=...`.
  - Métodos `AuthService.solicitarRedefinicao(email)` e `redefinirSenha(token, senha)`.
- **Prioridade**: **Alta** — bloqueador real para usuários.
- **Dependências**: backend de envio de email + token de reset.

## 6. Infra & Qualidade

### 6.1 Guards de role granulares
- **Por que**: hoje só existem `authGuard` e `ownerGuard`. `entregadorGuard`, `funcionarioGuard`, `adminGuard` (loja-específico) são todos ausentes. `/admin/:loja_uuid` está atrás apenas de `authGuard`, então qualquer usuário autenticado pode tentar acessar.
- **O que construir**:
  - `entregador.guard.ts`, `funcionario.guard.ts`, `admin.guard.ts` em `src/app/core/guards/`.
  - `admin-loja.guard.ts` que valida se o admin logado é dono daquela `loja_uuid` (consulta `AdminService.listarMinhasLojas`).
- **Prioridade**: **Alta** — segurança/UX.
- **Dependências**: nenhuma.

### 6.3 PWA / Offline-first
- **Por que**: `ngsw-config.json` está no projeto mas o service worker pode não estar registrado em `app.config.ts`. Deveria cachear catálogo da loja para revisita.
- **O que construir**: verificar/ativar `provideServiceWorker('ngsw-worker.js')`, estratégia `freshness` para listas, `performance` para imagens.
- **Prioridade**: **Média**.
- **Dependências**: nenhuma.

### 6.4 Testes (apenas `app.spec.ts` existe)
- **Por que**: 78+ arquivos de feature, 1 arquivo de teste. Refatorar é arriscado.
- **O que construir**:
  - Specs unitários de serviços críticos: `AuthService`, `PedidoService`, `PedidosLiveService` (mockar WebSocket), `CartService` (após criar).
  - Testes E2E com Playwright cobrindo: signup → login → criar pedido → acompanhar.
- **Prioridade**: **Média** (Alta para times maiores).
- **Dependências**: instalar Playwright/Cypress.

### 6.5 i18n / Localização
- **Por que**: textos hardcoded em PT-BR (toasts, labels, datas via `LOCALE_ID`). Crescimento internacional bloqueado.
- **O que construir**: `@angular/localize` + extração de strings para `messages.pt-BR.xlf`.
- **Prioridade**: **Baixa**.
- **Dependências**: nenhuma.

### 6.6 Observability (logs estruturados, Sentry)
- **Por que**: `console.log` espalhado em `pedidos-live.service.ts`, `auth.service.ts`. Sem rastreamento de erros em produção.
- **O que construir**: integrar Sentry (`@sentry/angular`), adicionar `LoggerService` envolvendo console com levels e trace id.
- **Prioridade**: **Média**.
- **Dependências**: conta Sentry.


### 6.8 Header reativo a role
- **Por que**: `header.component.ts` mostra os mesmos links para todos. Entregador não deveria ver "Favoritos"; admin deveria ver atalho para "Painel".
- **O que construir**: branches em `header.component.html` baseados em `auth.userClass()` (signal já existe e é reativo).
- **Prioridade**: **Média**.
- **Dependências**: 1.1, 3.1.


---

## Sumário de Prioridades

### Sprint 1 — Crítico (destrava operação)
1. Painel do Entregador (1.1) + Toggle disponibilidade (1.2) + `entregadorGuard` (6.1)
2. Painel do Funcionário / KDS (3.1) + `funcionarioGuard` (6.1)
3. Live tracking em `/pedidos` — lista (2.1)
4. Cancelamento pelo cliente (2.7)
5. Endereço selecionável no checkout (2.5) + Lookup CEP (5.4)
6. Recuperação de senha (5.8)
7. Loja fechada bloqueia pedido (5.9)
8. `adminLojaGuard` (6.1)

### Sprint 2 — Alto valor / UX
1. Múltiplas formas de pagamento (2.8)
3. Filtros de busca (5.1) + Geolocalização (5.3)
4. Notificações Push (4.3)
5. Dashboard admin (4.1)
6. Header reativo a role (6.8)
7. `EnderecoFormComponent` compartilhado (6.9)

### Sprint 3 — Crescimento / Qualidade
1. Mapa ao vivo do entregador (1.3)
2. Avaliação pós-entrega automática (2.4)
3. Repetir pedido (2.3)
4. Histórico de pagamentos (2.6)
6. Gestão de estoque (4.2)
7. Testes E2E (6.4)
8. PWA + Sentry (6.3, 6.6)
9. Distribuição de estrelas real (5.5)

### Backlog (Nice-to-have)
- Chat (4.4)
- Banir cliente (4.5)
- Export CSV (4.6)
- Dark mode (5.6)
- Onboarding (5.7)
- i18n (6.5)
- Histórico de ganhos do entregador (1.4)
- Impressão térmica (3.2)

---

## Observações arquiteturais transversais

- **Padrão signals + `toSignal`/`toObservable`** já está consolidado — manter em todas as features novas.
- **`createReconnectingWS<T>`** é o helper genérico de WebSocket com reconexão — usar para novos WS (entregador, chat, push).
- **`PedidoNormalizer`** centraliza normalização de tipos numéricos — reutilizar em novos serviços de pedido.
- **Modais ad-hoc** (`UiModalComponent` + signal `confirm`) estão repetidos em vários lugares. Considerar `DialogService` (CDK Overlay) ao escalar.
- O **role `cliente`** nunca é checado explicitamente — qualquer usuário autenticado é tratado como cliente. OK por ora, mas criar `clienteGuard` se surgir feature exclusiva (ex: programa de fidelidade).
