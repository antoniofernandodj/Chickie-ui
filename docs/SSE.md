# SSE — Server-Sent Events no Chickie UI

Documentação da arquitetura de streaming em tempo real do frontend.

---

## Visão Geral

O frontend usa **SSE (Server-Sent Events)** para receber atualizações de pedidos em tempo real. SSE é unidirecional (servidor → cliente), corre sobre HTTP comum e funciona transparentemente através de proxies — ao contrário de WebSocket.

Os endpoints backend correspondentes são:

| Stream | Endpoint |
|--------|----------|
| Pedidos de uma loja (admin) | `GET /api/pedidos/por-loja/{uuid}/sse` |
| Acompanhar pedido por código | `GET /api/pedidos/codigo/{codigo}/sse` |
| Meus pedidos (cliente) | `GET /api/pedidos/meus/sse` |

---

## Camadas de Abstração

```
reconnecting-sse.ts          ← primitiva genérica de conexão SSE
        ↓
PedidosLiveService           ← estado de pedidos como Observable<Pedido[]>
        ↓
Componentes Angular           ← consomem o Observable e gerenciam o ciclo de vida
```

---

## 1. `reconnecting-sse.ts` — Primitiva de Conexão

`src/app/core/utils/reconnecting-sse.ts`

Fábrica genérica que encapsula um `EventSource` em um `Observable<SseRawEvent>`.

### Responsabilidades

- Abre o `EventSource` e registra listeners para os event-types especificados
- Reconecta com **backoff exponencial** (`2s → 3s → ... → 30s`) em caso de erro
- Mantém o `lastEventId` acumulado localmente (o browser também o envia via `Last-Event-ID` header nativo)
- É **SSR-safe**: retorna `EMPTY` fora do browser (`isPlatformBrowser`)
- No teardown do Observable (unsubscribe), fecha o `EventSource` e limpa o timer de retry

### Tipos exportados

```typescript
export type SseStatus = 'CONNECTING' | 'OPEN' | 'CLOSED';

export interface SseRawEvent {
  event: string;    // nome do event-type SSE
  data: string;     // payload JSON bruto
  lastEventId: string;
}

export const PEDIDO_SSE_EVENTS = [
  'listar_itens',
  'item_adicionado',
  'item_atualizado',
  'item_removido',
] as const;
```

### Assinatura

```typescript
function createReconnectingSSE(
  urlFn: (lastEventId: string) => string,  // factory da URL, recebe lastEventId
  events: readonly string[],               // event-types a escutar
  platformId: object,
  onStatus: (status: SseStatus) => void,
  opts?: Partial<ReconnectingSseOptions>,
): Observable<SseRawEvent>
```

### Ciclo de vida interno

```
subscribe()
  → connect()
      → new EventSource(url)
      → onopen: status = OPEN, reset retryDelay
      → addEventListener(event) × N
      → onerror: close, status = CLOSED
                 setTimeout(connect, retryDelay)
                 retryDelay = min(retryDelay * 1.5, 30_000)

unsubscribe()  ← teardown retornado pelo Observable
  → active = false
  → clearTimeout(retryTimer)
  → sse.close()
  → status = CLOSED
```

---

## 2. `PedidosLiveService` — Estado de Pedidos

`src/app/core/services/pedidos-live.service.ts`

Serviço `providedIn: 'root'` que transforma o stream bruto de eventos SSE em `Observable<Pedido[]>` com estado local como `Map<string, Pedido>`.

### Signal público

```typescript
readonly connectionStatus = signal<SseStatus>('CLOSED');
```

Pode ser usado em templates para exibir indicadores visuais de conexão.

### Métodos públicos

| Método | Stream | Auth |
|--------|--------|------|
| `conectar(lojaUuid, status, token)` | Pedidos de uma loja filtrados por status | Token via query string |
| `conectarMeusPedidos(token)` | Pedidos do usuário autenticado | Token via query string |
| `acompanharPorCodigo(codigo)` | Pedido único por código (poll contínuo) | Público |

Todos retornam `Observable<Pedido[]>` (exceto `acompanharPorCodigo` que retorna `Observable<Pedido>`).

### Lógica interna — `criarStream()`

O método privado `criarStream()` é compartilhado pelos três métodos públicos e implementa toda a lógica de estado.

#### Estado local por stream

```typescript
const state = new Map<string, Pedido>();  // chave: pedido.uuid
let lastProcessedId = 0;                  // idempotência de eventos
let deltaCount = 0;                       // contador para reconciliação
let lastReconcileTime = Date.now();       // clock para reconciliação temporal
```

#### Processamento de eventos

| Event-type SSE | Ação no estado |
|----------------|----------------|
| `listar_itens` | `state.clear()` + repopula com todos os pedidos; reseta `deltaCount` |
| `item_adicionado` | `state.set(pedido.uuid, pedido)` |
| `item_atualizado` | `state.set(pedido.uuid, pedido)` |
| `item_removido` | `state.delete(uuid)` |

Após cada evento, emite `[...state.values()]` para o subscriber.

#### Idempotência

Cada evento SSE carrega um `id:` numérico crescente. O serviço descarta eventos com `id <= lastProcessedId`, garantindo que a repetição de eventos (por replay do `Last-Event-ID`) não duplique atualizações.

#### Reconciliação periódica

Para evitar drift de estado ao longo do tempo, o serviço força um snapshot completo se:
- `deltaCount >= 50` (muitas alterações incrementais), **ou**
- `Date.now() - lastReconcileTime >= 5 * 60 * 1000` (5 minutos desde o último snapshot)

A reconciliação é feita reconectando o `EventSource`, o que força o backend a enviar um evento `listar_itens` com o estado atual.

#### Fallback para REST

Se o SSE falhar **3 vezes consecutivas**:
1. Ativa polling REST (`fallbackFn`) a cada **5 segundos**
2. Após **60 segundos** de polling, tenta reconectar SSE novamente
3. Se o SSE voltar a funcionar, as falhas consecutivas são zeradas

```
SSE falha 3x
  → poll REST a cada 5s ─────────────────────────────────┐
  ← 60s ────────────────────────────────────────────────→│
  → tenta SSE novamente                                  │
```

#### Teardown completo

Ao fazer `unsubscribe()`:

```typescript
active = false;
sse?.close();
clearTimeout(retryTimer);
clearInterval(pollingInterval);
clearTimeout(pollingTimeout);
connectionStatus.set('CLOSED');
```

Nenhum timer ou conexão fica ativo após o unsubscribe.

---

## 3. Consumo nos Componentes

### Padrão 1 — `takeUntilDestroyed` (mais simples)

Usado em componentes onde o stream tem o mesmo tempo de vida do componente.

```typescript
// pedidos.component.ts (meus pedidos — cliente)
private destroyRef = inject(DestroyRef);

this.pedidosLive.conectarMeusPedidos(token).pipe(
  takeUntilDestroyed(this.destroyRef),
).subscribe(pedidos => { ... });
```

O `takeUntilDestroyed` completa o Observable automaticamente quando o `DestroyRef` dispara (destruição do componente), o que aciona o teardown do `criarStream()`.

### Padrão 2 — `Subscription` manual com `destroyRef.onDestroy`

Usado quando é necessário controle explícito (ex.: reconectar ao mudar filtro).

```typescript
// admin.component.ts (pedidos da loja — admin)
private wsSubscription: Subscription | null = null;

private conectarWsPedidos(): void {
  this.wsSubscription?.unsubscribe();  // fecha conexão anterior antes de abrir nova
  this.wsSubscription = this.pedidosLiveService
    .conectar(loja.uuid, this.pedidoFiltroStatus(), token)
    .subscribe(pedidos => { ... });
}

private desconectarWsPedidos(): void {
  this.wsSubscription?.unsubscribe();
  this.wsSubscription = null;
}

// Garante cleanup na destruição do componente
this.destroyRef.onDestroy(() => this.desconectarWsPedidos());
```

Ao trocar o filtro de status (aba "em preparo" → "prontos"), `conectarWsPedidos()` faz `unsubscribe()` da subscription anterior antes de criar a nova — sem leak entre trocas de aba.

### Padrão 3 — `ngOnDestroy` clássico

Usado em componentes com ciclo de vida mais controlado (modais, checkout).

```typescript
// checkout.component.ts / criar-pedido-modal.component.ts
private pixWsSub: Subscription | null = null;

ngOnDestroy(): void {
  this.pixWsSub?.unsubscribe();
}

// Ao iniciar acompanhamento de pedido:
this.pixWsSub?.unsubscribe();  // cancela eventual stream anterior
this.pixWsSub = this.pedidosLive.acompanharPorCodigo(codigo).subscribe(pedido => {
  if (pedido.status === 'entregue' || pedido.status === 'cancelado') {
    this.pixWsSub?.unsubscribe();  // auto-cancela em status terminal
    this.pixWsSub = null;
  }
});
```

---

## 4. Mapa de Componentes

| Componente | Método do serviço | Padrão de teardown |
|------------|-------------------|--------------------|
| `admin.component.ts` | `conectar(lojaUuid, status, token)` | `Subscription` manual + `destroyRef.onDestroy` |
| `pedidos.component.ts` | `conectarMeusPedidos(token)` | `takeUntilDestroyed` |
| `pedido-detalhe.component.ts` | `acompanharPorCodigo(codigo)` | `takeUntilDestroyed` |
| `checkout.component.ts` | `acompanharPorCodigo(codigo)` | `ngOnDestroy` |
| `criar-pedido-modal.component.ts` | `acompanharPorCodigo(codigo)` | `ngOnDestroy` |

---

## 5. Fluxo Completo — Do Backend ao Template

```
Backend (Rust/Axum)
  → publica SsePayload no broadcast channel da chave
  → poller 1s detecta mudança e publica evento delta

EventSource (browser)
  → recebe text/event-stream
  → dispara addEventListener(eventName)

createReconnectingSSE()
  → observer.next({ event, data, lastEventId })

PedidosLiveService.criarStream()
  → applyEvent(): atualiza Map<uuid, Pedido>
  → observer.next([...state.values()])

Componente
  → recebe Pedido[]
  → atualiza signal/variável local
  → template re-renderiza
```

---

## 6. Garantias de Ausência de Leak

- Todo `EventSource.close()` é chamado no teardown do Observable
- Todos os `setTimeout`/`setInterval` são limpos no teardown
- O poller backend encerra a goroutine quando `receiver_count == 0` (detectado em até 1s após o último cliente desconectar)
- Trocas de filtro/rota sempre fazem `unsubscribe()` da subscription anterior antes de criar a nova
- Status terminal do pedido (`entregue`, `cancelado`) auto-cancela streams de acompanhamento individual
