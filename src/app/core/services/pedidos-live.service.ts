import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Observable, EMPTY, filter, map, switchMap, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { Pedido, StatusPedido } from '../models';
import { PedidoNormalizer } from '../utils/pedido.normalizer';
import { SseStatus, PEDIDO_SSE_EVENTS } from '../utils/reconnecting-sse';
import { PedidoService } from './pedido.service';

const MAX_DELTAS_BEFORE_RECONCILE = 50;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const POLLING_FALLBACK_INTERVAL_MS = 5_000;
const POLLING_FALLBACK_DURATION_MS = 60_000;

type SseEventName = (typeof PEDIDO_SSE_EVENTS)[number];

const STATUS_TERMINAL = new Set(['entregue', 'cancelado']);

@Injectable({ providedIn: 'root' })
export class PedidosLiveService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pedidoService = inject(PedidoService);

  /** Status da última conexão SSE ativa (signal para uso em templates). */
  readonly connectionStatus = signal<SseStatus>('CLOSED');

  private get baseUrl(): string {
    return environment.apiUrl;
  }

  // ── Métodos públicos (mesma API de antes) ─────────────────────────────────

  acompanharPorCodigo(codigo: string): Observable<Pedido> {
    return this.criarStream(
      () => `${this.baseUrl}/pedidos/codigo/${encodeURIComponent(codigo)}/sse`,
      () => this.pedidoService.buscarPorCodigo(codigo).pipe(map(p => [p])),
      `[SSE código=${codigo}]`,
    ).pipe(
      map(pedidos => pedidos[0]),
      filter((p): p is Pedido => p !== undefined),
    );
  }

  conectar(lojaUuid: string, status: StatusPedido, token: string): Observable<Pedido[]> {
    return this.criarStream(
      () => `${this.baseUrl}/pedidos/por-loja/${lojaUuid}/sse?status=${status}&token=${encodeURIComponent(token)}`,
      () => this.pedidoService.listarPorLoja(lojaUuid, status).pipe(map(p => p)),
      `[SSE loja=${lojaUuid}]`,
    );
  }

  conectarMeusPedidos(token: string): Observable<Pedido[]> {
    return this.criarStream(
      () => `${this.baseUrl}/pedidos/meus/sse?token=${encodeURIComponent(token)}`,
      () => this.pedidoService.listar(),
      '[SSE meus-pedidos]',
    );
  }

  // ── Stream interno ────────────────────────────────────────────────────────

  private criarStream(
    urlFn: () => string,
    fallbackFn: () => Observable<Pedido[]>,
    logPrefix: string,
  ): Observable<Pedido[]> {
    if (!isPlatformBrowser(this.platformId)) return EMPTY;

    return new Observable<Pedido[]>(observer => {
      let active = true;
      let sse: EventSource | null = null;
      let lastEventId = '';
      let retryDelay = 2000;
      let consecutiveFailures = 0;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let pollingInterval: ReturnType<typeof setInterval> | null = null;
      let pollingTimeout: ReturnType<typeof setTimeout> | null = null;

      const state = new Map<string, Pedido>();
      let lastProcessedId = 0;
      let deltaCount = 0;
      let lastReconcileTime = Date.now();

      const emitState = (): void => {
        observer.next([...state.values()]);
      };

      const applyEvent = (eventName: SseEventName, data: string, id: string): void => {
        const numId = parseInt(id, 10);
        // Descarta eventos já processados (idempotência)
        if (numId > 0 && numId <= lastProcessedId) return;
        if (numId > 0) lastProcessedId = numId;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          switch (eventName) {
            case 'listar_itens': {
              state.clear();
              deltaCount = 0;
              lastReconcileTime = Date.now();
              const itens = (parsed['itens'] as unknown[]) ?? [];
              for (const p of itens) {
                const pedido = PedidoNormalizer.normalizarPedido(p);
                state.set(pedido.uuid, pedido);
              }
              break;
            }
            case 'item_adicionado':
            case 'item_atualizado': {
              const raw = parsed['item'] ?? parsed;
              const pedido = PedidoNormalizer.normalizarPedido(raw);
              state.set(pedido.uuid, pedido);
              deltaCount++;
              break;
            }
            case 'item_removido': {
              const uuid = parsed['uuid'] as string;
              if (uuid) { state.delete(uuid); deltaCount++; }
              break;
            }
          }
          emitState();

          // Reconciliação: solicita novo snapshot (reconnect força ListarItens)
          if (deltaCount >= MAX_DELTAS_BEFORE_RECONCILE ||
              Date.now() - lastReconcileTime >= RECONCILE_INTERVAL_MS) {
            console.log(`${logPrefix} reconciliação por ${deltaCount >= MAX_DELTAS_BEFORE_RECONCILE ? 'deltas' : 'tempo'}`);
            reconnectSse();
          }
        } catch {
          console.error(`${logPrefix} erro ao processar evento ${eventName}`);
        }
      };

      const connectSse = (): void => {
        if (!active) return;
        this.connectionStatus.set('CONNECTING');
        const url = urlFn();
        console.log(`${logPrefix} conectando`);

        sse = new EventSource(url);

        sse.onopen = (): void => {
          console.log(`${logPrefix} conectado`);
          this.connectionStatus.set('OPEN');
          retryDelay = 2000;
          consecutiveFailures = 0;
        };

        for (const evt of PEDIDO_SSE_EVENTS) {
          sse.addEventListener(evt, (e: Event) => {
            const me = e as MessageEvent;
            if (me.lastEventId) lastEventId = me.lastEventId;
            applyEvent(evt, me.data, me.lastEventId ?? lastEventId);
          });
        }

        sse.onerror = (): void => {
          sse?.close();
          sse = null;
          this.connectionStatus.set('CLOSED');
          if (!active) return;

          consecutiveFailures++;
          console.warn(`${logPrefix} falha ${consecutiveFailures}`);

          if (consecutiveFailures >= 3) {
            startPollingFallback();
          } else {
            retryTimer = setTimeout(() => {
              retryDelay = Math.min(retryDelay * 1.5, 30_000);
              connectSse();
            }, retryDelay);
          }
        };
      };

      const reconnectSse = (): void => {
        sse?.close();
        sse = null;
        connectSse();
      };

      const startPollingFallback = (): void => {
        console.warn(`${logPrefix} 3 falhas SSE — ativando polling por ${POLLING_FALLBACK_DURATION_MS / 1000}s`);

        const pollOnce = (): void => {
          fallbackFn().subscribe({
            next: (pedidos) => {
              state.clear();
              for (const p of pedidos) state.set(p.uuid, p);
              emitState();
            },
            error: (err) => console.error(`${logPrefix} erro no fallback REST:`, err),
          });
        };

        pollOnce();
        pollingInterval = setInterval(pollOnce, POLLING_FALLBACK_INTERVAL_MS);

        pollingTimeout = setTimeout(() => {
          clearInterval(pollingInterval!);
          pollingInterval = null;
          consecutiveFailures = 0;
          console.log(`${logPrefix} fim do fallback — retentando SSE`);
          connectSse();
        }, POLLING_FALLBACK_DURATION_MS);
      };

      const cleanup = (): void => {
        sse?.close();
        sse = null;
        if (retryTimer) clearTimeout(retryTimer);
        if (pollingInterval) clearInterval(pollingInterval);
        if (pollingTimeout) clearTimeout(pollingTimeout);
        this.connectionStatus.set('CLOSED');
      };

      connectSse();

      return (): void => {
        active = false;
        cleanup();
      };
    });
  }
}
