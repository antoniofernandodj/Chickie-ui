import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
    return this.http.post<CreatePedidoResponse>(`${this.base}/criar`, body);
  }

  listar(): Observable<Pedido[]> {
    return this.http.get<any[]>(`${this.base}/meus`).pipe(
      map((lista) => PedidoNormalizer.normalizarPedidos(lista)),
    );
  }

  avancar(uuid: string, isRetirada: boolean): Observable<StatusPedidoResponse> {
    return this.http.post<StatusPedidoResponse>(
      `${this.base}/${uuid}/avancar`,
      { is_retirada: isRetirada },
    );
  }

  cancelar(uuid: string): Observable<{ uuid: string; status: StatusPedido }> {
    return this.http.post<{ uuid: string; status: StatusPedido }>(
      `${this.base}/${uuid}/cancelar`,
      {},
    );
  }

  buscar(uuid: string): Observable<Pedido> {
    return this.http.get<any>(`${this.base}/${uuid}`).pipe(
      map((p) => PedidoNormalizer.normalizarPedido(p)),
    );
  }

  buscarPorCodigo(codigo: string): Observable<Pedido> {
    return this.http.get<any>(`${this.base}/codigo/${codigo}`).pipe(
      map((p) => PedidoNormalizer.normalizarPedido(p)),
    );
  }

  listarPorLoja(lojaUuid: string, status: StatusPedido = 'criado'): Observable<Pedido[]> {
    return this.http.get<any[]>(`${this.base}/por-loja/${lojaUuid}`, { params: { status } }).pipe(
      map((lista) => PedidoNormalizer.normalizarPedidos(lista)),
    );
  }

  buscarComEntrega(uuid: string): Observable<PedidoComEntrega> {
    return this.http.get<PedidoComEntrega>(`${this.base}/${uuid}/com-entrega`);
  }

  atualizarStatus(
    uuid: string,
    body: UpdateStatusPedidoRequest,
  ): Observable<StatusPedidoResponse> {
    return this.http.put<StatusPedidoResponse>(
      `${this.base}/${uuid}/status`,
      body,
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