import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pedido, StatusPedido } from '../models';
import { PedidoNormalizer } from '../utils/pedido.normalizer';
import { createReconnectingWS } from '../utils/reconnecting-ws';

@Injectable({ providedIn: 'root' })
export class PedidosLiveService {
  private readonly platformId = inject(PLATFORM_ID);

  private wsUrl(lojaUuid: string, status: StatusPedido, token: string): string {
    const base = environment.apiUrl.replace(/^https/, 'wss').replace(/^http$/, 'ws');
    return `${base}/pedidos/por-loja/${lojaUuid}/ws?status=${status}&token=${encodeURIComponent(token)}`;
  }

  acompanharPorCodigo(codigo: string): Observable<Pedido> {
    const urlFn = () => {
      const base = environment.apiUrl.replace(/^https/, 'wss').replace(/^http$/, 'ws');
      return `${base}/pedidos/codigo/${encodeURIComponent(codigo)}/ws`;
    };

    return createReconnectingWS<Pedido>(
      urlFn,
      (data) => PedidoNormalizer.normalizarPedido(data),
      this.platformId,
      {
        logPrefix: `[WS código=${codigo}]`,
        filterFn: (data) => data && typeof data === 'object' && !Array.isArray(data),
      },
    );
  }

  conectar(lojaUuid: string, status: StatusPedido, token: string): Observable<Pedido[]> {
    const urlFn = () => this.wsUrl(lojaUuid, status, token);

    return createReconnectingWS<Pedido[]>(
      urlFn,
      (data) => PedidoNormalizer.normalizarPedidos(data),
      this.platformId,
      {
        logPrefix: `[WS loja=${lojaUuid}]`,
        filterFn: (data) => Array.isArray(data),
      },
    );
  }

  conectarMeusPedidos(token: string): Observable<Pedido[]> {
    const urlFn = () => {
      const base = environment.apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
      return `${base}/pedidos/meus/ws?token=${encodeURIComponent(token)}`;
    };

    return createReconnectingWS<Pedido[]>(
      urlFn,
      (data) => PedidoNormalizer.normalizarPedidos(data),
      this.platformId,
      {
        logPrefix: '[WS meus-pedidos]',
        filterFn: (data) => Array.isArray(data),
      },
    );
  }
}