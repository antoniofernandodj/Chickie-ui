import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { Pedido } from '../models';
import { PedidoNormalizer } from '../utils/pedido.normalizer';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'chickie_pedidos_locais';

@Injectable({ providedIn: 'root' })
export class PedidoLocalStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http       = inject(HttpClient);
  private readonly base       = `${environment.apiUrl}/pedidos`;

  private readonly _pedidos = signal<Pedido[]>(this.load());
  readonly pedidos = this._pedidos.asReadonly();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    const locais = this._pedidos();
    if (locais.length === 0) return;
    forkJoin(
      locais.map(p =>
        this.http.get<any>(`${this.base}/codigo/${p.codigo}`).pipe(
          catchError((err) => {
            if (err.status === 404) this.remover(p.uuid);
            return of(null);
          }),
        )
      )
    ).subscribe((frescos) => {
      frescos
        .filter(Boolean)
        .map(raw => PedidoNormalizer.normalizarPedido(raw))
        .forEach(p => this.salvar(p));
    });
  }

  private load(): Pedido[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const pedidos = JSON.parse(raw) as any[];
      return Array.isArray(pedidos)
        ? PedidoNormalizer.normalizarPedidos(pedidos)
            .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
        : [];
    } catch {
      return [];
    }
  }

  private persist(pedidos: Pedido[]): void {
    const ordenados = [...pedidos].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    );
    this._pedidos.set(ordenados);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ordenados));
    }
  }

  salvar(pedido: Pedido): void {
    const pedidos = this._pedidos();
    const proximo = pedidos.filter((p) => p.uuid !== pedido.uuid && p.codigo !== pedido.codigo);
    this.persist([pedido, ...proximo]);
  }

  listar(): Pedido[] {
    return this._pedidos();
  }

  buscarPorUuid(uuid: string): Pedido | null {
    return this._pedidos().find((p) => p.uuid === uuid) ?? null;
  }

  buscarPorCodigo(codigo: string): Pedido | null {
    const alvo = codigo.trim().toUpperCase();
    return this._pedidos().find((p) => p.codigo?.toUpperCase() === alvo) ?? null;
  }

  remover(uuid: string): void {
    this.persist(this._pedidos().filter((p) => p.uuid !== uuid));
  }
}
