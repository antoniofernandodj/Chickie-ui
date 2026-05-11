import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CreatePedidoRequest,
  CreatePedidoResponse,
  Pedido,
  PaginatedResponse,
  PedidoComEntrega,
  StatusPedido,
  StatusPedidoResponse,
  UpdateStatusPedidoRequest,
} from '../models';
import { PedidoNormalizer } from '../utils/pedido.normalizer';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/pedidos`;

  criar(body: CreatePedidoRequest): Observable<CreatePedidoResponse> {
    console.info(`[OBSERVABILITY] PedidoService - Creating order for loja: ${body.loja_uuid}. Items: ${body.itens.length}`);
    return this.http.post<CreatePedidoResponse>(`${this.base}/criar`, body).pipe(
      tap({
        next: (res) => console.info(`[OBSERVABILITY] PedidoService - Order created successfully. Code: ${res.codigo}, UUID: ${res.uuid}`),
        error: (err) => console.error('[OBSERVABILITY] PedidoService - Failed to create order.', err)
      })
    );
  }

  listar(): Observable<Pedido[]> {
    console.debug('[OBSERVABILITY] PedidoService - Fetching user orders.');
    return this.http.get<any[]>(`${this.base}/meus`).pipe(
      map((lista) => PedidoNormalizer.normalizarPedidos(lista)),
    );
  }

  avancar(uuid: string, isRetirada: boolean): Observable<StatusPedidoResponse> {
    console.info(`[OBSERVABILITY] PedidoService - Advancing order status. UUID: ${uuid}`);
    return this.http.post<StatusPedidoResponse>(
      `${this.base}/${uuid}/avancar`,
      { is_retirada: isRetirada },
    ).pipe(
      tap({
        next: (res) => console.info(`[OBSERVABILITY] PedidoService - Order advanced. New status: ${res.status}`),
        error: (err) => console.error(`[OBSERVABILITY] PedidoService - Failed to advance order. UUID: ${uuid}`, err)
      })
    );
  }

  cancelar(uuid: string): Observable<{ uuid: string; status: StatusPedido }> {
    console.warn(`[OBSERVABILITY] PedidoService - Cancelling order. UUID: ${uuid}`);
    return this.http.post<{ uuid: string; status: StatusPedido }>(
      `${this.base}/${uuid}/cancelar`,
      {},
    ).pipe(
      tap({
        next: () => console.info(`[OBSERVABILITY] PedidoService - Order cancelled. UUID: ${uuid}`),
        error: (err) => console.error(`[OBSERVABILITY] PedidoService - Failed to cancel order. UUID: ${uuid}`, err)
      })
    );
  }

  buscar(uuid: string): Observable<Pedido> {
    console.debug(`[OBSERVABILITY] PedidoService - Fetching order by UUID: ${uuid}`);
    return this.http.get<any>(`${this.base}/${uuid}`).pipe(
      map((p) => PedidoNormalizer.normalizarPedido(p)),
    );
  }

  buscarPorCodigo(codigo: string): Observable<Pedido> {
    console.debug(`[OBSERVABILITY] PedidoService - Fetching order by code: ${codigo}`);
    return this.http.get<any>(`${this.base}/codigo/${codigo}`).pipe(
      map((p) => PedidoNormalizer.normalizarPedido(p)),
    );
  }

  listarPorLoja(lojaUuid: string, status: StatusPedido = 'criado'): Observable<Pedido[]> {
    console.debug(`[OBSERVABILITY] PedidoService - Fetching orders for loja: ${lojaUuid}, status: ${status}`);
    return this.http.get<any[]>(`${this.base}/por-loja/${lojaUuid}`, { params: { status } }).pipe(
      map((lista) => PedidoNormalizer.normalizarPedidos(lista)),
    );
  }

  buscarComEntrega(uuid: string): Observable<PedidoComEntrega> {
    console.debug(`[OBSERVABILITY] PedidoService - Fetching order with delivery data. UUID: ${uuid}`);
    return this.http.get<PedidoComEntrega>(`${this.base}/${uuid}/com-entrega`);
  }

  atualizarStatus(
    uuid: string,
    body: UpdateStatusPedidoRequest,
  ): Observable<StatusPedidoResponse> {
    console.info(`[OBSERVABILITY] PedidoService - Manually updating order status. UUID: ${uuid}, New Status: ${body.novo_status}`);
    return this.http.put<StatusPedidoResponse>(
      `${this.base}/${uuid}/status`,
      body,
    ).pipe(
      tap({
        next: (res) => console.info(`[OBSERVABILITY] PedidoService - Order status updated. UUID: ${uuid}, Status: ${res.status}`),
        error: (err) => console.error(`[OBSERVABILITY] PedidoService - Failed to update order status. UUID: ${uuid}`, err)
      })
    );
  }

  listarHistoricoCancelados(
    lojaUuid: string,
    page = 1,
    perPage = 20,
  ): Observable<PaginatedResponse<Pedido>> {
    return this.http
      .get<PaginatedResponse<any>>(
        `${this.base}/por-loja/${lojaUuid}/historico/cancelados`,
        { params: { page, per_page: perPage } },
      )
      .pipe(
        map((res) => ({
          ...res,
          data: PedidoNormalizer.normalizarPedidos(res.data),
        })),
      );
  }

  listarHistoricoEntregues(
    lojaUuid: string,
    page = 1,
    perPage = 20,
  ): Observable<PaginatedResponse<Pedido>> {
    return this.http
      .get<PaginatedResponse<any>>(
        `${this.base}/por-loja/${lojaUuid}/historico/entregues`,
        { params: { page, per_page: perPage } },
      )
      .pipe(
        map((res) => ({
          ...res,
          data: PedidoNormalizer.normalizarPedidos(res.data),
        })),
      );
  }
}