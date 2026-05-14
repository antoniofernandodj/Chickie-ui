import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Comanda } from '../models';
import { COMANDA_SSE_EVENTS, SseStatus, createReconnectingSSE } from '../utils/reconnecting-sse';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MesasLiveService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly connectionStatus = signal<SseStatus>('CLOSED');

  private get baseUrl(): string {
    return environment.apiUrl;
  }

  conectar(lojaUuid: string, token: string): Observable<Comanda[]> {
    const state = new Map<string, Comanda>();

    return createReconnectingSSE(
      () => `${this.baseUrl}/comandas/por-loja/${lojaUuid}/sse?token=${encodeURIComponent(token)}`,
      COMANDA_SSE_EVENTS,
      this.platformId,
      status => this.connectionStatus.set(status),
      { logPrefix: `[MesasSSE loja=${lojaUuid}]` },
    ).pipe(
      map(raw => {
        const payload = JSON.parse(raw.data);

        switch (raw.event) {
          case 'listar_comandas': {
            state.clear();
            for (const c of (payload.comandas as Comanda[])) {
              state.set(c.uuid, c);
            }
            break;
          }
          case 'comanda_atualizada': {
            const c = payload.comanda as Comanda;
            state.set(c.uuid, c);
            break;
          }
          case 'comanda_fechada': {
            state.delete(payload.uuid as string);
            break;
          }
        }

        return Array.from(state.values());
      }),
    );
  }
}
