import { Observable, EMPTY } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export type SseStatus = 'CONNECTING' | 'OPEN' | 'CLOSED';

export interface SseRawEvent {
  event: string;
  data: string;
  lastEventId: string;
}

export interface ReconnectingSseOptions {
  logPrefix: string;
  baseDelay: number;
  maxDelay: number;
}

const SSE_DEFAULTS: ReconnectingSseOptions = {
  logPrefix: '[SSE]',
  baseDelay: 2000,
  maxDelay: 30_000,
};

const PEDIDO_SSE_EVENTS = [
  'listar_itens',
  'item_adicionado',
  'item_atualizado',
  'item_removido',
  'kds_snapshot',
] as const;

export type PedidoSseEvent = (typeof PEDIDO_SSE_EVENTS)[number];

/**
 * Cria um Observable de eventos SSE com reconexão automática e backoff exponencial.
 * O browser gerencia o Last-Event-ID header nativamente no EventSource.
 *
 * @param urlFn    - factory chamada a cada (re)conexão; recebe o lastEventId acumulado
 * @param events   - lista de event-types a escutar
 * @param platformId - para SSR safety (retorna EMPTY fora do browser)
 * @param onStatus - callback de mudança de estado da conexão
 * @param opts     - opções opcionais (prefix de log, delays)
 */
export function createReconnectingSSE(
  urlFn: (lastEventId: string) => string,
  events: readonly string[],
  platformId: object,
  onStatus: (status: SseStatus) => void,
  opts?: Partial<ReconnectingSseOptions>,
): Observable<SseRawEvent> {
  if (!isPlatformBrowser(platformId)) return EMPTY;

  const { logPrefix, baseDelay, maxDelay } = { ...SSE_DEFAULTS, ...opts };

  return new Observable<SseRawEvent>(observer => {
    let active = true;
    let sse: EventSource | null = null;
    let lastEventId = '';
    let retryDelay = baseDelay;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      if (!active) return;
      onStatus('CONNECTING');
      const url = urlFn(lastEventId);
      console.log(`${logPrefix} conectando`);
      sse = new EventSource(url);

      sse.onopen = (): void => {
        console.log(`${logPrefix} conectado`);
        onStatus('OPEN');
        retryDelay = baseDelay;
      };

      for (const eventName of events) {
        sse.addEventListener(eventName, (e: Event) => {
          const me = e as MessageEvent;
          if (me.lastEventId) lastEventId = me.lastEventId;
          observer.next({ event: eventName, data: me.data, lastEventId: me.lastEventId ?? lastEventId });
        });
      }

      sse.onerror = (): void => {
        sse?.close();
        sse = null;
        onStatus('CLOSED');
        if (!active) return;
        console.warn(`${logPrefix} erro — reconectando em ${retryDelay}ms`);
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, maxDelay);
          connect();
        }, retryDelay);
      };
    };

    connect();

    return (): void => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      sse?.close();
      onStatus('CLOSED');
    };
  });
}

export { PEDIDO_SSE_EVENTS };
