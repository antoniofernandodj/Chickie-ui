import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnDestroy,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { toast } from 'ngx-sonner';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { ConfigPedidoService } from '../../core/services/config-pedido.service';
import { ComandaService } from '../../core/services/comanda.service';
import { UiButtonComponent } from '../../shared/components';
import { Comanda } from '../../core/models';

@Component({
  selector: 'app-funcionario-mesas',
  standalone: true,
  imports: [CurrencyPipe, UiButtonComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">Mesas</h1>
          <p class="text-sm text-gray-500 mt-1">Visão das mesas e comandas ativas</p>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2" style="border-color: var(--color-brand)"></div>
          </div>
        } @else if (mesas().length === 0) {
          <div class="text-center py-20 text-gray-400">
            <div class="text-5xl mb-3">🪑</div>
            <p class="text-sm">Nenhuma mesa configurada.</p>
          </div>
        } @else {
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            @for (mesa of mesas(); track mesa) {
              @let comandas = mesasOcupadas().get(mesa.toString()) ?? [];
              <div
                class="bg-white rounded-2xl shadow-sm border p-4 flex flex-col items-center gap-3 transition-all"
                [class]="comandas.length > 0 ? 'border-green-400 ring-2 ring-green-300 cursor-pointer' : 'border-gray-100'"
                (click)="comandas.length > 0 ? abrirModal(mesa.toString()) : null"
              >
                <div class="flex items-center gap-1.5 w-full justify-between">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesa</p>
                  @if (comandas.length > 0) {
                    <span class="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                      🟢 {{ comandas.length > 1 ? comandas.length + ' cmd' : 'Aberta' }}
                    </span>
                  }
                </div>
                <p class="text-2xl font-black text-gray-900 leading-none">{{ mesa }}</p>
                @if (comandas.length > 0) {
                  <div class="w-full text-center">
                    <p class="text-xs text-gray-500">
                      {{ totalMesa(comandas) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                    <ui-button variant="primary" size="xs" [fullWidth]="true"
                      (click)="$event.stopPropagation(); abrirModal(mesa.toString())">
                      Ver Comanda{{ comandas.length > 1 ? 's' : '' }}
                    </ui-button>
                  </div>
                } @else {
                  <p class="text-xs text-gray-400">Livre</p>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Modal (read-only) -->
    @if (modalMesa()) {
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style="background: rgba(0,0,0,0.5)"
        (click)="fecharModal()"
      >
        <div
          class="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <h3 class="text-lg font-black text-gray-900">Mesa {{ modalMesa() }}</h3>
            <button
              (click)="fecharModal()"
              class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
            >✕</button>
          </div>

          @if (modalCarregando()) {
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2" style="border-color: var(--color-brand)"></div>
            </div>
          } @else {
            <div class="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              @for (comanda of modalComandas(); track comanda.uuid) {
                <div class="border border-gray-200 rounded-2xl overflow-hidden">
                  <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p class="text-sm font-bold text-gray-800">
                      {{ comanda.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                    <span class="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-semibold">Aberta</span>
                  </div>
                  <div class="px-4 py-3 space-y-3">
                    @for (pedido of comanda.pedidos; track pedido.uuid) {
                      <div>
                        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                          Pedido #{{ pedido.codigo }}
                        </p>
                        @for (item of pedido.itens; track item.uuid) {
                          <div class="flex justify-between items-baseline py-0.5">
                            <span class="text-sm text-gray-700">
                              {{ item.quantidade }}× {{ item.partes[0]?.produto_nome ?? '—' }}
                              @if (item.partes.length > 1) {
                                <span class="text-gray-400"> +{{ item.partes.length - 1 }}</span>
                              }
                            </span>
                            <span class="text-sm font-medium text-gray-900 ml-4 shrink-0">
                              {{ precoItem(item) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                            </span>
                          </div>
                        }
                        @if (pedido.itens.length === 0) {
                          <p class="text-xs text-gray-400">Nenhum item</p>
                        }
                      </div>
                    }
                    @if (comanda.pedidos.length === 0) {
                      <p class="text-sm text-gray-400 text-center py-2">Nenhum pedido ainda</p>
                    }
                  </div>
                  <!-- Fechar esta comanda -->
                  <div class="px-4 pb-4 pt-2 space-y-2 border-t border-gray-100">
                    <p class="text-xs font-semibold text-gray-600">Pagamento desta comanda</p>
                    <div class="flex gap-2">
                      @for (forma of ['Dinheiro', 'Cartão', 'PIX']; track forma) {
                        <button
                          class="flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                          [class]="formaPagamento() === forma && fechandoComandaUuid() === comanda.uuid
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'"
                          (click)="formaPagamento.set(forma); fechandoComandaUuid.set(comanda.uuid)"
                        >{{ forma === 'Dinheiro' ? '💵' : forma === 'Cartão' ? '💳' : '📱' }} {{ forma }}</button>
                      }
                    </div>
                    <ui-button
                      [fullWidth]="true"
                      size="sm"
                      [disabled]="fechandoComandaUuid() !== comanda.uuid || !formaPagamento() || !!_fechandoUuid()"
                      [loading]="_fechandoUuid() === comanda.uuid"
                      (click)="fecharComanda(comanda)"
                    >
                      Fechar e Registrar Pagamento
                    </ui-button>
                  </div>
                </div>
              }
              @if (modalComandas().length === 0) {
                <p class="text-sm text-gray-400 text-center py-4">Nenhuma comanda ativa</p>
              }
            </div>
          }

          <div class="px-6 py-4 border-t border-gray-100">
            <ui-button variant="secondary" [fullWidth]="true" (click)="fecharModal()">Fechar</ui-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FuncionarioMesasComponent implements OnDestroy {
  private funcionarioSvc = inject(FuncionarioService);
  private configSvc      = inject(ConfigPedidoService);
  private comandaSvc     = inject(ComandaService);

  readonly loading = signal(true);

  readonly _funcionario = toSignal(
    this.funcionarioSvc.getMe().pipe(catchError(() => of(null)))
  );
  readonly lojaUuid = computed(() => this._funcionario()?.loja_uuid ?? null);

  readonly quantidade    = signal(0);
  readonly mesas         = computed(() => Array.from({ length: this.quantidade() }, (_, i) => i + 1));
  readonly comandasAtivas = signal<Comanda[]>([]);
  readonly mesasOcupadas  = computed(() => {
    const map = new Map<string, Comanda[]>();
    for (const c of this.comandasAtivas()) {
      const list = map.get(c.numero_mesa) ?? [];
      list.push(c);
      map.set(c.numero_mesa, list);
    }
    return map;
  });

  readonly modalMesa          = signal<string | null>(null);
  readonly modalComandas      = signal<Comanda[]>([]);
  readonly modalCarregando    = signal(false);
  readonly formaPagamento     = signal('');
  readonly fechandoComandaUuid = signal<string | null>(null);
  readonly _fechandoUuid      = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      if (!uuid) return;
      this.configSvc.getConfigPedido(uuid).subscribe({
        next: cfg => {
          this.quantidade.set(cfg.quantidade_mesas ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      this._carregarComandas(uuid);
      if (this.pollingInterval) clearInterval(this.pollingInterval);
      this.pollingInterval = setInterval(() => this._carregarComandas(uuid), 30_000);
    });
  }

  ngOnDestroy(): void {
    if (this.pollingInterval !== null) clearInterval(this.pollingInterval);
  }

  private _carregarComandas(uuid: string): void {
    this.comandaSvc.listarComandasAtivas(uuid).subscribe({
      next: cs => this.comandasAtivas.set(cs),
      error: () => {},
    });
  }

  totalMesa(comandas: Comanda[]): number {
    return comandas.reduce((s, c) => s + Number(c.total), 0);
  }

  abrirModal(numeroMesa: string): void {
    const uuid = this.lojaUuid();
    if (!uuid) return;
    this.modalMesa.set(numeroMesa);
    this.modalComandas.set([]);
    this.modalCarregando.set(true);
    this.comandaSvc.listarComandasAtivasPorMesa(uuid, numeroMesa).subscribe({
      next: cs => {
        this.modalComandas.set(cs);
        this.modalCarregando.set(false);
      },
      error: () => {
        this.modalComandas.set(this.mesasOcupadas().get(numeroMesa) ?? []);
        this.modalCarregando.set(false);
      },
    });
  }

  fecharModal(): void {
    this.modalMesa.set(null);
    this.modalComandas.set([]);
    this.formaPagamento.set('');
    this.fechandoComandaUuid.set(null);
  }

  fecharComanda(comanda: Comanda): void {
    const forma = this.formaPagamento();
    if (!forma || this._fechandoUuid()) return;

    this._fechandoUuid.set(comanda.uuid);
    this.comandaSvc.fecharComanda(comanda.uuid, { forma_pagamento: forma }).subscribe({
      next: () => {
        toast.success(`Comanda da Mesa ${comanda.numero_mesa} fechada!`);
        this._fechandoUuid.set(null);
        this.formaPagamento.set('');
        this.fechandoComandaUuid.set(null);
        const uuid = this.lojaUuid();
        if (uuid) this._carregarComandas(uuid);
        if (this.modalMesa()) this.abrirModal(this.modalMesa()!);
      },
      error: () => {
        toast.error('Erro ao fechar a comanda.');
        this._fechandoUuid.set(null);
      },
    });
  }

  precoItem(item: { quantidade: number; partes: { preco_unitario: number }[] }): number {
    return item.partes.reduce((s, p) => s + p.preco_unitario, 0) * item.quantidade;
  }
}
