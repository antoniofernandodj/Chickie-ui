import { Component, inject, signal, computed, effect, OnDestroy, PLATFORM_ID, untracked } from '@angular/core';
import { isPlatformBrowser, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { Pedido } from '../../core/models';
import { PedidoNormalizer } from '../../core/utils/pedido.normalizer';

@Component({
  selector: 'app-pdv-telao',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <div class="text-center mb-12">
        <h1 class="text-3xl font-black text-gray-500 tracking-widest uppercase">Seu Pedido</h1>
      </div>

      @if (ultimoPedido(); as p) {
        <div class="w-full max-w-2xl">
          <div class="text-center mb-10">
            @if (p.nome_requerente) {
              <p class="text-xl font-semibold text-purple-400 uppercase tracking-widest">Cliente</p>
              <p class="text-8xl font-black text-white mt-2 leading-none break-words">{{ p.nome_requerente }}</p>
            } @else if (p.numero_mesa) {
              <p class="text-xl font-semibold text-blue-400 uppercase tracking-widest">Mesa</p>
              <p class="text-9xl font-black text-white mt-2 leading-none">{{ p.numero_mesa }}</p>
            } @else {
              <p class="text-xl font-semibold text-orange-400 uppercase tracking-widest">Pedido</p>
              <p class="text-7xl font-black text-white mt-2 leading-none">#{{ p.codigo }}</p>
            }
          </div>

          <div class="flex items-center justify-center gap-6 mb-8">
            <span class="text-2xl font-mono text-gray-500">#{{ p.codigo }}</span>
            <span class="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
            <span class="text-2xl text-gray-500">{{ p.criado_em | date: 'HH:mm' }}</span>
          </div>

          <div class="bg-gray-800 rounded-3xl p-8 space-y-4">
            <h2 class="text-lg font-semibold text-gray-500 uppercase tracking-widest mb-6">Itens</h2>
            @for (item of p.itens; track item.uuid) {
              <div class="flex items-baseline gap-4 py-3 border-b border-gray-700 last:border-0">
                <span class="text-3xl font-black text-orange-400 shrink-0">{{ item.quantidade }}×</span>
                <span class="text-2xl font-semibold text-white">
                  @if (item.partes.length === 1) {
                    {{ item.partes[0].produto_nome }}
                  } @else {
                    Pizza ({{ item.partes.length }} sabores)
                  }
                </span>
              </div>
            }
          </div>

          <div class="mt-8 text-center">
            <span class="inline-block px-8 py-4 bg-orange-500 text-white text-xl font-black rounded-full uppercase tracking-wider">
              Em Preparo
            </span>
          </div>
        </div>
      } @else {
        <div class="text-center space-y-6">
          <div class="text-9xl opacity-10">🍕</div>
          <p class="text-3xl font-medium text-gray-600">Aguardando pedidos...</p>
        </div>
      }
    </div>
  `,
})
export class PdvTelaoComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly funcionarioService = inject(FuncionarioService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly ultimoPedido = signal<Pedido | null>(null);

  private sse: EventSource | null = null;

  private readonly _routeLojaUuid = toSignal<string | null>(
    this.route.paramMap.pipe(map(p => p.get('loja_uuid')))
  );

  private readonly _funcionario = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const routeUuid = params.get('loja_uuid');
        if (routeUuid || !this.auth.isFuncionario()) return of(null);
        return this.funcionarioService.getMe().pipe(catchError(() => of(null)));
      })
    )
  );

  readonly lojaUuid = computed(() => this._routeLojaUuid() || this._funcionario()?.loja_uuid || null);

  constructor() {
    effect(() => {
      const lojaUuid = this.lojaUuid();
      const token = this.auth.token();
      if (!lojaUuid || !token || !isPlatformBrowser(this.platformId)) return;
      untracked(() => this.conectar(lojaUuid, token));
    });
  }

  private conectar(lojaUuid: string, token: string) {
    this.sse?.close();

    const url = `${environment.apiUrl}/pedidos/por-loja/${lojaUuid}/sse?token=${encodeURIComponent(token)}`;
    this.sse = new EventSource(url);

    const extrairUltimoPdv = (pedidos: any[]) => {
      const pdvOrdenado = pedidos
        .filter(p => p.tipo_pedido === 'pdv')
        .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

      if (pdvOrdenado.length > 0) {
        this.ultimoPedido.set(PedidoNormalizer.normalizarPedido(pdvOrdenado[0]));
      }
    };

    this.sse.addEventListener('listar_itens', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        extrairUltimoPdv(parsed.itens || []);
      } catch {}
    });

    this.sse.addEventListener('item_adicionado', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.item?.tipo_pedido === 'pdv') {
          this.ultimoPedido.set(PedidoNormalizer.normalizarPedido(parsed.item));
        }
      } catch {}
    });

    this.sse.onerror = () => {
      this.sse?.close();
      setTimeout(() => {
        const uuid = this.lojaUuid();
        const tk = this.auth.token();
        if (uuid && tk) this.conectar(uuid, tk);
      }, 3000);
    };
  }

  ngOnDestroy() {
    this.sse?.close();
  }
}
