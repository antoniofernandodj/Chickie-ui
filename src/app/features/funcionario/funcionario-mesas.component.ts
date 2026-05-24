import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, filter, of, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { MesaService } from '../../core/services/mesa.service';
import { ComandaService } from '../../core/services/comanda.service';
import { AuthService } from '../../core/services/auth.service';
import { MesasLiveService } from '../../core/services/mesas-live.service';
import { UiButtonComponent } from '../../shared/components';
import { Comanda, Mesa } from '../../core/models';

@Component({
  selector: 'app-funcionario-mesas',
  standalone: true,
  imports: [CurrencyPipe, UiButtonComponent],
  providers: [MesasLiveService],
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
            @for (mesa of mesas(); track mesa.numero) {
              @let comandas = mesasOcupadas().get(mesa.numero.toString()) ?? [];
              <div
                class="bg-white rounded-2xl shadow-sm border p-4 flex flex-col items-center gap-3 transition-all"
                [class]="comandas.length > 0 ? 'border-green-400 ring-2 ring-green-300 cursor-pointer' : 'border-gray-100'"
                (click)="comandas.length > 0 ? abrirModal(mesa.numero.toString()) : null"
              >
                <div class="flex items-center gap-1.5 w-full justify-between">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesa</p>
                  @if (comandas.length > 0) {
                    <span class="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                      🟢 {{ comandas.length > 1 ? comandas.length + ' cmd' : 'Aberta' }}
                    </span>
                  }
                </div>
                <p class="text-2xl font-black text-gray-900 leading-none">{{ mesa.numero }}</p>
                @if (comandas.length > 0) {
                  <div class="w-full text-center">
                    <p class="text-xs text-gray-500">
                      {{ totalMesa(comandas) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                    <ui-button variant="primary" size="xs" [fullWidth]="true"
                      (click)="$event.stopPropagation(); abrirModal(mesa.numero.toString())">
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

          <div class="overflow-y-auto flex-1 px-6 py-4 space-y-6">
            @for (comanda of modalComandas(); track comanda.uuid) {
              <div class="border border-gray-200 rounded-2xl overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div>
                    <p class="text-sm font-bold text-gray-900">
                      {{ $index + 1 }}{{ comanda.nome ? ' - ' + comanda.nome : '' }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ comanda.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
                      title="Imprimir comanda"
                      (click)="imprimirComanda(comanda)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                      </svg>
                    </button>
                    <span class="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-semibold">Aberta</span>
                  </div>
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

          <div class="px-6 py-4 border-t border-gray-100">
            <ui-button variant="secondary" [fullWidth]="true" (click)="fecharModal()">Fechar</ui-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FuncionarioMesasComponent {
  private funcionarioSvc = inject(FuncionarioService);
  private mesaSvc        = inject(MesaService);
  private comandaSvc     = inject(ComandaService);
  private auth           = inject(AuthService);
  private mesasLive      = inject(MesasLiveService);
  private destroyRef     = inject(DestroyRef);

  readonly loading = signal(true);

  readonly _funcionario = toSignal(
    this.funcionarioSvc.getMe().pipe(catchError(() => of(null)))
  );
  readonly lojaUuid = computed(() => this._funcionario()?.loja_uuid ?? null);

  readonly mesas          = signal<Mesa[]>([]);
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
  readonly modalComandas      = computed(() => {
    const mesa = this.modalMesa();
    if (!mesa) return [];
    return this.mesasOcupadas().get(mesa) ?? [];
  });
  readonly formaPagamento     = signal('');
  readonly fechandoComandaUuid = signal<string | null>(null);
  readonly _fechandoUuid      = signal<string | null>(null);

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      if (!uuid) return;
      this.mesaSvc.listar(uuid).subscribe({
        next: mesas => {
          this.mesas.set(mesas);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });

    combineLatest([
      toObservable(this.lojaUuid),
      toObservable(this.auth.token),
    ]).pipe(
      filter(([uuid, token]) => !!uuid && !!token),
      switchMap(([uuid, token]) => this.mesasLive.conectar(uuid!, token!)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(cs => this.comandasAtivas.set(cs));
  }

  totalMesa(comandas: Comanda[]): number {
    return comandas.reduce((s, c) => s + Number(c.total), 0);
  }

  abrirModal(numeroMesa: string): void {
    this.modalMesa.set(numeroMesa);
    this.formaPagamento.set('');
    this.fechandoComandaUuid.set(null);
  }

  fecharModal(): void {
    this.modalMesa.set(null);
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
        // SSE vai remover a comanda automaticamente via comanda_fechada
        // Se o modal ficou vazio, fecha
        if (this.modalComandas().length === 0) this.fecharModal();
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

  imprimirComanda(comanda: Comanda): void {
    const fmt = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const dataAbertura = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(comanda.criado_em));

    const pedidosHtml = comanda.pedidos.map(pedido => {
      const itensHtml = pedido.itens.map(item => {
        const nome = item.partes.length > 1
          ? item.partes.map(p => p.produto_nome).join(' / ')
          : (item.partes[0]?.produto_nome ?? '—');
        const preco = this.precoItem(item);
        const adicionais = item.partes.flatMap(p => p.adicionais);
        let html = `<div class="item">
          <span class="item-name">${item.quantidade}× ${nome}</span>
          <span class="item-price">${fmt(preco)}</span>
        </div>`;
        if (item.observacoes) {
          html += `<div class="obs">Obs: ${item.observacoes}</div>`;
        }
        if (adicionais.length) {
          html += adicionais.map(a => `<div class="adicional">+ ${a.nome}</div>`).join('');
        }
        return html;
      }).join('');
      const totalPedido = pedido.itens.reduce((s, it) => s + this.precoItem(it), 0);
      return `<div class="pedido">
        <div class="pedido-header">Pedido #${pedido.codigo}</div>
        ${itensHtml}
        <div class="pedido-total">Subtotal: ${fmt(totalPedido)}</div>
      </div>`;
    }).join('');

    const nomeComanda = comanda.nome ? ` — ${comanda.nome}` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Comanda — Mesa ${comanda.numero_mesa}${nomeComanda}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Courier New',monospace;font-size:12px;padding:12px;max-width:300px;margin:0 auto}
        .header{text-align:center;border-bottom:2px dashed #000;padding-bottom:10px;margin-bottom:10px}
        .title{font-size:18px;font-weight:900;letter-spacing:2px}
        .sub{font-size:13px;font-weight:bold;margin-top:4px}
        .meta{font-size:10px;color:#555;margin-top:2px}
        .pedido{border-bottom:1px dashed #bbb;padding:6px 0;margin-bottom:6px}
        .pedido-header{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:4px}
        .item{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
        .item-name{flex:1}
        .item-price{white-space:nowrap;margin-left:8px;font-weight:600}
        .obs{font-size:10px;color:#777;margin-left:12px;margin-bottom:2px}
        .adicional{font-size:10px;color:#555;margin-left:12px}
        .pedido-total{text-align:right;font-size:11px;color:#555;margin-top:4px}
        .total-line{border-top:2px dashed #000;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;font-weight:900;font-size:15px}
        .footer{text-align:center;margin-top:12px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px}
        @media print{body{padding:4px}}
      </style>
      </head><body>
      <div class="header">
        <div class="title">COMANDA</div>
        <div class="sub">Mesa ${comanda.numero_mesa}${nomeComanda}</div>
        <div class="meta">Aberta em: ${dataAbertura}</div>
      </div>
      ${pedidosHtml || '<p style="text-align:center;color:#888;font-size:11px">Nenhum pedido</p>'}
      <div class="total-line">
        <span>TOTAL</span>
        <span>${fmt(Number(comanda.total))}</span>
      </div>
      <div class="footer">Obrigado pela preferência!</div>
      <script>window.onload=()=>{window.print()}<\/script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }
}
