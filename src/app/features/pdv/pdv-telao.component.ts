import {
  Component, inject, signal, computed, effect, OnDestroy, PLATFORM_ID, untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { Pedido, KdsPayload } from '../../core/models';

function labelPedido(p: Pedido): string {
  if (p.nome_requerente) return p.nome_requerente;
  if (p.numero_mesa)    return `Mesa ${p.numero_mesa}`;
  return `#${p.codigo}`;
}

function subLabelPedido(p: Pedido): string | null {
  if (p.nome_requerente || p.numero_mesa) return `#${p.codigo}`;
  return null;
}

@Component({
  selector: 'app-pdv-telao',
  standalone: true,
  imports: [],
  template: `
    <div class="min-h-screen bg-gray-950 text-white flex flex-col select-none overflow-hidden">

      <!-- ── ZONA PRINCIPAL: PRONTOS ────────────────────────────────── -->
      <div class="flex-1 flex flex-col items-center justify-center p-8 relative">

        <!-- Cabeçalho de seção -->
        <div class="mb-8 text-center">
          @if (prontos().length > 0) {
            <p class="text-2xl font-black tracking-widest uppercase text-green-400 animate-pulse">
              Pronto para Retirada
            </p>
          } @else {
            <p class="text-xl font-semibold tracking-widest uppercase text-gray-700">
              Aguardando pedidos...
            </p>
          }
        </div>

        <!-- Cards de pedidos prontos -->
        @if (prontos().length > 0) {
          <div class="flex flex-wrap justify-center gap-6 w-full max-w-5xl">
            @for (p of prontos(); track p.uuid) {
              <div
                class="relative flex flex-col items-center justify-center rounded-3xl px-10 py-8 min-w-[220px]"
                style="
                  background: linear-gradient(135deg, #052e16 0%, #14532d 100%);
                  box-shadow: 0 0 40px 8px rgba(34,197,94,0.35), 0 0 0 2px rgba(34,197,94,0.5);
                  animation: pronto-pulse 2s ease-in-out infinite;
                "
              >
                <span class="text-5xl mb-3">✅</span>
                <p
                  class="font-black text-green-300 text-center leading-tight"
                  [style.font-size]="labelFontSize(label(p))"
                >
                  {{ label(p) }}
                </p>
                @if (subLabel(p)) {
                  <p class="text-lg font-mono text-green-600 mt-2">{{ subLabel(p) }}</p>
                }
              </div>
            }
          </div>
        } @else if (emPreparo().length === 0) {
          <div class="text-8xl opacity-10 mt-4">🍕</div>
        }
      </div>

      <!-- ── FAIXA INFERIOR: EM PREPARO ────────────────────────────── -->
      <div
        class="shrink-0 border-t border-gray-800 px-6 py-4"
        style="background: #0f172a"
      >
        <div class="flex items-center gap-4 overflow-hidden">
          <div class="shrink-0 flex items-center gap-2">
            <span class="text-lg">🔥</span>
            <span class="text-xs font-black tracking-widest uppercase text-orange-400">Em Preparo</span>
          </div>

          @if (emPreparo().length > 0) {
            <div class="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
              @for (p of emPreparo(); track p.uuid) {
                <div
                  class="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border border-orange-800 bg-orange-950"
                >
                  <span class="text-sm font-bold text-orange-300 whitespace-nowrap">{{ label(p) }}</span>
                  @if (subLabel(p)) {
                    <span class="text-xs font-mono text-orange-600">{{ subLabel(p) }}</span>
                  }
                </div>
              }
            </div>
          } @else {
            <span class="text-sm text-gray-700 italic">Nenhum pedido em preparo</span>
          }
        </div>
      </div>

    </div>

    <!-- Animação CSS inline -->
    <style>
      @keyframes pronto-pulse {
        0%, 100% { box-shadow: 0 0 40px 8px rgba(34,197,94,0.35), 0 0 0 2px rgba(34,197,94,0.5); }
        50%       { box-shadow: 0 0 60px 16px rgba(34,197,94,0.55), 0 0 0 3px rgba(134,239,172,0.7); }
      }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
  `,
})
export class PdvTelaoComponent implements OnDestroy {
  private readonly route            = inject(ActivatedRoute);
  private readonly auth             = inject(AuthService);
  private readonly funcionarioSvc   = inject(FuncionarioService);
  private readonly pedidosLive      = inject(PedidosLiveService);
  private readonly platformId       = inject(PLATFORM_ID);

  private kdsSubscription: ReturnType<typeof setTimeout> | null = null;
  private kdsUnsub: (() => void) | null = null;

  private readonly _kds = signal<KdsPayload>({ confirmados: [], em_preparo: [], prontos: [] });

  readonly prontos   = computed(() => this._kds().prontos);
  readonly emPreparo = computed(() => this._kds().em_preparo);

  readonly label    = (p: Pedido) => labelPedido(p);
  readonly subLabel = (p: Pedido) => subLabelPedido(p);

  labelFontSize(text: string): string {
    if (text.length <= 8)  return 'clamp(2.5rem, 5vw, 4rem)';
    if (text.length <= 15) return 'clamp(1.8rem, 3.5vw, 2.8rem)';
    return 'clamp(1.3rem, 2.5vw, 2rem)';
  }

  private readonly _routeLojaUuid = toSignal<string | null>(
    this.route.paramMap.pipe(map(p => p.get('loja_uuid')))
  );

  private readonly _funcionario = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        if (params.get('loja_uuid') || !this.auth.isFuncionario()) return of(null);
        return this.funcionarioSvc.getMe().pipe(catchError(() => of(null)));
      })
    )
  );

  readonly lojaUuid = computed(() =>
    this._routeLojaUuid() || this._funcionario()?.loja_uuid || null
  );

  constructor() {
    effect(() => {
      const lojaUuid = this.lojaUuid();
      const token    = this.auth.token();
      if (!lojaUuid || !token || !isPlatformBrowser(this.platformId)) return;
      untracked(() => this.conectar(lojaUuid, token));
    });
  }

  private conectar(lojaUuid: string, token: string) {
    if (this.kdsUnsub) {
      this.kdsUnsub();
      this.kdsUnsub = null;
    }

    const sub = this.pedidosLive.conectarKds(lojaUuid, token).subscribe({
      next: (payload) => this._kds.set(payload),
    });

    this.kdsUnsub = () => sub.unsubscribe();
  }

  ngOnDestroy() {
    this.kdsUnsub?.();
  }
}
