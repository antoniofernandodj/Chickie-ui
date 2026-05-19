# Plano de Implementação — Comanda Aberta (Mesa)

## Visão Geral

Uma **Comanda** é a sessão de uma mesa — começa quando o primeiro pedido é feito e encerra quando o cliente paga. Cada rodada de itens cria um `Pedido` normal vinculado à comanda via `comanda_uuid`. O `Pedido` continua com seu ciclo de cozinha inalterado. Fechar a comanda é uma operação exclusiva na entidade `Comanda`.

```
Mesa 3 escaneia QR
    │
    └─► Comanda (aberta)
            ├── Pedido #1 [confirmado → em preparo → pronto]  ← rodada 1
            ├── Pedido #2 [confirmado → em preparo → pronto]  ← rodada 2
            └── Pedido #3 [confirmado → em preparo → pronto]  ← rodada 3
                    │
                    └─► Comanda (fechada) ← fechar comanda + forma_pagamento
```

---

## 1. Backend — Banco de Dados

### Migration `0024_create_comandas.sql`
```sql
CREATE TABLE comandas (
    uuid         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_uuid    UUID        NOT NULL REFERENCES lojas(uuid),
    numero_mesa  TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'aberta',
    forma_pagamento TEXT,
    total        NUMERIC(10,2) NOT NULL DEFAULT 0,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fechado_em   TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comandas_loja_status ON comandas(loja_uuid, status);
CREATE INDEX idx_comandas_loja_mesa   ON comandas(loja_uuid, numero_mesa, status);
```

### Migration `0025_add_comanda_uuid_pedidos.sql`
```sql
ALTER TABLE pedidos ADD COLUMN comanda_uuid UUID REFERENCES comandas(uuid);
CREATE INDEX idx_pedidos_comanda_uuid ON pedidos(comanda_uuid);
```

Nenhum `pedido_finalizado`. Nenhum `adicionado_em` no JSONB. A comanda controla a sessão; o pedido continua limpo.

---

## 2. Backend — Modelos (`crates/core/src/models/`)

### Novo arquivo: `comanda.rs`
```rust
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
pub enum EstadoDeComanda {
    Aberta,
    Fechada,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Comanda {
    pub uuid: Uuid,
    pub loja_uuid: Uuid,
    pub numero_mesa: String,
    pub status: EstadoDeComanda,
    pub forma_pagamento: Option<String>,
    pub total: Decimal,
    pub criado_em: DateTime<Utc>,
    pub fechado_em: Option<DateTime<Utc>>,
    pub atualizado_em: DateTime<Utc>,
    // Não vem do banco — populado sob demanda:
    #[sqlx(skip)]
    pub pedidos: Vec<super::Pedido>,
}

impl Comanda {
    pub fn new(loja_uuid: Uuid, numero_mesa: String) -> Self {
        Self {
            uuid: Uuid::new_v4(),
            loja_uuid,
            numero_mesa,
            status: EstadoDeComanda::Aberta,
            forma_pagamento: None,
            total: Decimal::ZERO,
            criado_em: Utc::now(),
            fechado_em: None,
            atualizado_em: Utc::now(),
            pedidos: vec![],
        }
    }
}
```

Exportar em `models/mod.rs`: `pub mod comanda; pub use comanda::{Comanda, EstadoDeComanda};`

### `pedido.rs` — adicionar campo
```rust
pub struct Pedido {
    // ... campos existentes ...
    pub comanda_uuid: Option<Uuid>,  // NOVO
}
```
`Pedido::new()` não muda a assinatura — `comanda_uuid` começa `None` e é definido depois de criar/encontrar a comanda.

---

## 3. Backend — Repositories

### Novo port: `ComandaRepositoryPort`
```rust
#[async_trait]
pub trait ComandaRepositoryPort: Send + Sync {
    async fn criar(&self, comanda: &Comanda) -> Result<Comanda, Box<dyn Error>>;
    async fn buscar_ativa_por_mesa(
        &self, loja_uuid: Uuid, numero_mesa: &str,
    ) -> Result<Option<Comanda>, Box<dyn Error>>;
    async fn listar_ativas_por_loja(
        &self, loja_uuid: Uuid,
    ) -> Result<Vec<Comanda>, Box<dyn Error>>;
    async fn atualizar_total(
        &self, uuid: Uuid, novo_total: Decimal,
    ) -> Result<(), Box<dyn Error>>;
    async fn fechar(
        &self, uuid: Uuid, forma_pagamento: &str,
    ) -> Result<Comanda, Box<dyn Error>>;
}
```

### `ComandaRepository` (implementação sqlx)

**`criar`:**
```sql
INSERT INTO comandas (uuid, loja_uuid, numero_mesa, status, total, criado_em, atualizado_em)
VALUES ($1, $2, $3, 'aberta', $4, $5, $5)
RETURNING *
```

**`buscar_ativa_por_mesa`:**
```sql
SELECT * FROM comandas
WHERE loja_uuid = $1 AND numero_mesa = $2 AND status = 'aberta'
ORDER BY criado_em DESC
LIMIT 1
```

**`listar_ativas_por_loja`:**
```sql
SELECT * FROM comandas
WHERE loja_uuid = $1 AND status = 'aberta'
ORDER BY criado_em ASC
```

**`atualizar_total`:**
```sql
UPDATE comandas
SET total = $1, atualizado_em = NOW()
WHERE uuid = $2
```

**`fechar`:**
```sql
UPDATE comandas
SET status = 'fechada',
    forma_pagamento = $1,
    fechado_em = NOW(),
    atualizado_em = NOW()
WHERE uuid = $2
RETURNING *
```

### `PedidoRepository` — mudanças

No INSERT existente: adicionar `comanda_uuid` como parâmetro `$21`:
```sql
INSERT INTO pedidos (..., comanda_uuid) VALUES (..., $21)
```
`.bind(&pedido.comanda_uuid)`

Novo método **`buscar_por_comanda`**:
```sql
SELECT p.*, e.* FROM pedidos p
LEFT JOIN enderecos_entrega e ON e.pedido_uuid = p.uuid
WHERE p.comanda_uuid = $1
ORDER BY p.criado_em ASC
```

---

## 4. Backend — Usecases (`crates/core/src/usecases/`)

### `criar_pedido` — integração com comanda

Quando `tipo_pedido == "mesa"` e `numero_mesa` está presente, após montar o `Pedido`:

```rust
// Encontra ou cria comanda ativa para a mesa
if pedido.tipo_pedido == "mesa" {
    if let Some(ref mesa) = pedido.numero_mesa {
        let comanda = match self.comanda_repo
            .buscar_ativa_por_mesa(self.loja_uuid, mesa).await?
        {
            Some(c) => c,
            None => self.comanda_repo
                .criar(&Comanda::new(self.loja_uuid, mesa.clone())).await?,
        };
        pedido.comanda_uuid = Some(comanda.uuid);
    }
}
```

Após salvar o pedido, atualizar o total da comanda:
```rust
if let Some(comanda_uuid) = pedido.comanda_uuid {
    let total_novo = self.comanda_repo
        .calcular_total_por_comanda(comanda_uuid).await?;
    // ou: comanda_anterior.total + pedido.total
    self.comanda_repo.atualizar_total(comanda_uuid, total_novo).await?;
}
```

### Novo usecase: `ComandaUsecase`

```rust
pub struct ComandaUsecase {
    pub comanda_repo: Arc<dyn ComandaRepositoryPort>,
    pub pedido_repo: Arc<dyn PedidoRepositoryPort>,
    pub loja_uuid: Uuid,
}

impl ComandaUsecase {
    pub async fn buscar_ativa(&self, numero_mesa: &str) -> Result<Option<Comanda>, String>
    pub async fn listar_ativas(&self) -> Result<Vec<Comanda>, String>
    // fechar: busca pedidos da comanda, agrega total final, atualiza comanda
    pub async fn fechar(&self, uuid: Uuid, forma_pagamento: &str) -> Result<Comanda, String>
    // hidratar: popula comanda.pedidos a partir do pedido_repo
    async fn hidratar_pedidos(&self, comanda: Comanda) -> Result<Comanda, String>
}
```

`fechar` não toca nos `Pedido`s — eles seguem seu ciclo normal de cozinha. Só fecha a comanda.

---

## 5. Backend — Handlers & Rotas

### Novos handlers

| Arquivo | Rota | Auth |
|---|---|---|
| `buscar_comanda_ativa.rs` | `GET /comandas/por-loja/:loja_uuid/mesa/:numero/ativa` | pública |
| `listar_comandas_ativas.rs` | `GET /comandas/por-loja/:loja_uuid/ativas` | funcionário |
| `fechar_comanda.rs` | `POST /comandas/:uuid/fechar` | funcionário |

**`GET .../mesa/:numero/ativa`** → retorna `200 + Comanda` (com `pedidos` hidratados) ou `404`

**`GET .../ativas`** → retorna `200 + Vec<Comanda>` (sem hidratar pedidos — apenas resumo)

**`POST /comandas/:uuid/fechar`**
```json
Request: { "forma_pagamento": "Dinheiro" }
Response 200: Comanda (fechada)
```

### Registro em `routers/pedido.rs` (ou novo `routers/comanda.rs`)
```
GET  /comandas/por-loja/:loja_uuid/mesa/:numero/ativa  → buscar_comanda_ativa
GET  /comandas/por-loja/:loja_uuid/ativas               → listar_comandas_ativas
POST /comandas/:uuid/fechar                             → fechar_comanda
```

---

## 6. Frontend — Tipos (`src/app/core/models/index.ts`)

```typescript
export type EstadoDeComanda = 'aberta' | 'fechada';

export interface Comanda {
  uuid: string;
  loja_uuid: string;
  numero_mesa: string;
  status: EstadoDeComanda;
  forma_pagamento: string | null;
  total: number;
  criado_em: string;
  fechado_em: string | null;
  atualizado_em: string;
  pedidos: Pedido[];  // populado pelo endpoint /ativa
}

export interface FecharComandaRequest {
  forma_pagamento: string;
}
```

Em `Pedido`:
```typescript
export interface Pedido {
  // ... campos existentes ...
  comanda_uuid: string | null;  // NOVO
}
```

---

## 7. Frontend — ComandaService (`src/app/core/services/comanda.service.ts`)

Novo serviço (não misturar com `PedidoService`):

```typescript
@Injectable({ providedIn: 'root' })
export class ComandaService {
  private readonly http = inject(HttpClient);

  buscarComandaAtiva(lojaUuid: string, numeroMesa: string): Observable<Comanda | null> {
    return this.http
      .get<Comanda>(`/api/comandas/por-loja/${lojaUuid}/mesa/${numeroMesa}/ativa`)
      .pipe(catchError(err => err.status === 404 ? of(null) : throwError(() => err)));
  }

  listarComandasAtivas(lojaUuid: string): Observable<Comanda[]> {
    return this.http.get<Comanda[]>(`/api/comandas/por-loja/${lojaUuid}/ativas`);
  }

  fecharComanda(uuid: string, body: FecharComandaRequest): Observable<Comanda> {
    return this.http.post<Comanda>(`/api/comandas/${uuid}/fechar`, body);
  }
}
```

---

## 8. Frontend — Fluxo Cliente (`loja-detalhe.component.ts`)

No componente que o cliente usa ao escanear o QR da mesa:

```typescript
readonly comandaAtiva = signal<Comanda | null>(null);

// No effect que já reage ao numero_mesa:
effect(() => {
  const numero = this.numeroMesa();
  const loja   = this.loja();
  this.cart.definirMesa(numero ?? null);

  if (numero && loja) {
    this.comandaSvc.buscarComandaAtiva(loja.uuid, numero).subscribe(
      c => this.comandaAtiva.set(c)
    );
  } else {
    this.comandaAtiva.set(null);
  }
});
```

### Template — banner de comanda ativa

Exibido **acima** do catálogo quando `comandaAtiva()` não é null:

```
┌──────────────────────────────────────────────────────┐
│ 🍽️  Comanda da Mesa 3 — aberta                       │
│                                                      │
│  Pedido #A1B2 — 2× Margherita, 1× Coca-Cola          │
│  Pedido #C3D4 — 1× Tiramisu                          │
│  ────────────────────────────────────────────────    │
│  Total até agora: R$ 70,00                           │
│                                                      │
│  Adicione mais itens pelo cardápio abaixo ↓           │
└──────────────────────────────────────────────────────┘
```

Ao confirmar um pedido com mesa ativa: o backend encontra a comanda existente e vincula o novo pedido — sem mudança no `CriarPedidoModalComponent`. O frontend apenas envia o pedido normalmente com `numero_mesa`; o backend resolve a comanda.

---

## 9. Frontend — KDS (`kds-panel.component`)

Nenhuma mudança estrutural necessária. Os cards já mostram `numero_mesa` e `nome_requerente`. Cada rodada aparece como ticket separado — comportamento correto para a cozinha.

Opcional: badge de comanda (`#uuid_curto`) no card de pedido mesa, para o cozinheiro saber que é parte de uma comanda. Baixa prioridade.

---

## 10. Frontend — Admin Pedidos Tab (`admin-pedidos-tab.component.ts`)

Para pedidos com `tipo_pedido === 'mesa'`:

- Header do card: mostrar `comanda_uuid` resumido (ex: `Comanda ...abc123`) como badge roxo
- Nenhum botão "Fechar Comanda" aqui — o fechamento é feito na tela de mesas (seção 12)

O card continua mostrando o pedido individualmente como hoje.

---

## 11. Backend — Resumo de total da comanda

O `total` em `Comanda` é mantido atualizado na tabela. Duas estratégias possíveis:

**Estratégia A (escolhida):** ao adicionar cada novo pedido, somar `comanda.total += pedido.total` e chamar `atualizar_total`. Simples, sem JOIN.

**Estratégia B:** calcular via `SELECT SUM(total) FROM pedidos WHERE comanda_uuid = $1`. Mais robusto mas exige query extra.

Usar **A** por ora. Se houver drift (cancelamento de pedido), adicionar recálculo no handler de cancelamento.

---

## 12. Frontend — Tela de Mesas Admin (`admin-mesas-tab.component.ts`)

### Busca de comandas ativas

```typescript
readonly comandasAtivas = signal<Comanda[]>([]);
readonly mesasOcupadas = computed(() =>
  new Map(this.comandasAtivas().map(c => [c.numero_mesa, c]))
);

// Carrega ao iniciar e a cada 30s
ngOnInit() {
  this.carregarComandas();
  this.intervalo = setInterval(() => this.carregarComandas(), 30_000);
}
ngOnDestroy() { clearInterval(this.intervalo); }

private carregarComandas() {
  this.comandaSvc.listarComandasAtivas(this.lojaUuid()).subscribe(
    cs => this.comandasAtivas.set(cs)
  );
}
```

### Visual dos cards de mesa

**Mesa livre:**
```
┌──────────────────────┐
│  Mesa      3         │
│  [QR Code]           │
│  [Baixar PNG]        │
└──────────────────────┘
```

**Mesa ocupada** (borda verde):
```
┌──────────────────────┐  ← ring-2 ring-green-500
│  Mesa 3   🟢 Aberta  │
│  [QR Code]           │
│  R$ 70,00 · 3 itens  │
│  [Ver Comanda]       │
│  [Baixar PNG]        │
└──────────────────────┘
```

### Modal "Ver Comanda — Mesa 3"

```
┌──────────────────────────────────────────────────┐
│  Comanda — Mesa 3                           [✕]  │
├──────────────────────────────────────────────────┤
│  Pedido #A1B2  (14:32)                            │
│    2× Margherita ........................ R$ 44,00│
│    1× Coca-Cola ......................... R$ 8,00 │
│                                                  │
│  Pedido #C3D4  (15:10)                            │
│    1× Tiramisu .......................... R$ 18,00│
│  ──────────────────────────────────────────────  │
│  Total                                  R$ 70,00 │
├──────────────────────────────────────────────────┤
│  Forma de pagamento:                             │
│  [💵 Dinheiro]  [💳 Cartão]  [📱 PIX]           │
│                                                  │
│  [Fechar Comanda e Registrar Pagamento]          │
└──────────────────────────────────────────────────┘
```

Ao clicar em "Fechar Comanda": chama `comandaSvc.fecharComanda(uuid, { forma_pagamento })`.
Após sucesso: fecha modal, recarrega `comandasAtivas` imediatamente.

### Bloqueio de edição de mesas

Quando `comandasAtivas().length > 0`:
- Input de quantidade: `[disabled]="true"`
- Botão "Salvar": `[disabled]="true"`
- Aviso abaixo do formulário:

> ⚠️ Não é possível alterar a quantidade de mesas enquanto há comandas abertas.  
> Feche todas as comandas antes de modificar a configuração.  
> Mesas com comanda ativa: **3, 5, 7**

---

## Resumo de Arquivos Alterados

### Backend
| Arquivo | Tipo de mudança |
|---|---|
| `migrations/0024_create_comandas.sql` | NOVO |
| `migrations/0025_add_comanda_uuid_pedidos.sql` | NOVO |
| `crates/core/src/models/comanda.rs` | NOVO |
| `crates/core/src/models/mod.rs` | Exportar `Comanda`, `EstadoDeComanda` |
| `crates/core/src/models/pedido.rs` | `comanda_uuid: Option<Uuid>` |
| `crates/core/src/ports/mod.rs` | `ComandaRepositoryPort` |
| `crates/core/src/repositories/comanda_repository.rs` | NOVO |
| `crates/core/src/repositories/pedido_repository.rs` | INSERT + `buscar_por_comanda` |
| `crates/core/src/usecases/pedido.rs` | find-or-create comanda no `criar_pedido` |
| `crates/core/src/usecases/comanda.rs` | NOVO — `ComandaUsecase` |
| `crates/api/src/handlers/comanda/buscar_comanda_ativa.rs` | NOVO |
| `crates/api/src/handlers/comanda/listar_comandas_ativas.rs` | NOVO |
| `crates/api/src/handlers/comanda/fechar_comanda.rs` | NOVO |
| `crates/api/src/handlers/comanda/mod.rs` | NOVO |
| `crates/api/src/handlers/routers/comanda.rs` | NOVO |
| `crates/api/src/handlers/routers/mod.rs` | Registrar router de comanda |

### Frontend
| Arquivo | Tipo de mudança |
|---|---|
| `src/app/core/models/index.ts` | `Comanda`, `EstadoDeComanda`, `FecharComandaRequest`, `comanda_uuid` em `Pedido` |
| `src/app/core/services/comanda.service.ts` | NOVO |
| `src/app/features/loja/loja-detalhe.component.ts` | Buscar comanda ativa no effect |
| `src/app/features/loja/loja-detalhe.component.html` | Banner de comanda aberta |
| `src/app/features/admin/components/admin-mesas-tab.component.ts` | Comandas ativas + modal + bloqueio |

---

## Checklist de Implementação

- [x] **1.** Migrations `0024_create_comandas.sql` e `0025_add_comanda_uuid_pedidos.sql`
- [x] **2.** Modelo `Comanda` + `EstadoDeComanda` + campo `comanda_uuid` em `Pedido`
- [x] **3.** `ComandaRepositoryPort` + `ComandaRepository` (sqlx)
- [x] **4.** Atualizar INSERT em `PedidoRepository` + método `buscar_por_comanda`
- [x] **5.** `ComandaUsecase` + integração em `PedidoUsecase.criar_pedido`
- [x] **6.** Handlers de comanda + rotas (`buscar_ativa`, `listar_ativas`, `fechar`)
- [x] **7.** `cargo check` — validar backend completo
- [x] **8.** Tipos TypeScript (`Comanda`, `FecharComandaRequest`, `comanda_uuid` em `Pedido`) + `ComandaService`
- [x] **9.** `LojaDetalheComponent` — busca comanda ativa no effect + banner no template
- [x] **10.** `AdminMesasTabComponent` — indicativo de ocupação + modal de comanda + bloqueio de edição
- [x] **11.** `ng build` — validar frontend completo
