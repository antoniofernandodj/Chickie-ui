import {
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  effect,
  computed,
  ElementRef,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, filter, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import QRCode from 'qrcode';
import { MesaService } from '../../../core/services/mesa.service';
import { ComandaService } from '../../../core/services/comanda.service';
import { AuthService } from '../../../core/services/auth.service';
import { MesasLiveService } from '../../../core/services/mesas-live.service';
import { UiButtonComponent, UiInputComponent } from '../../../shared/components';
import { Comanda, Mesa } from '../../../core/models';


@Component({
  selector: 'admin-mesas-tab',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, UiButtonComponent, UiInputComponent],
  providers: [MesasLiveService],
  template: `
    <div class="space-y-6">

      <!-- Config card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-sm">
        <h3 class="text-base font-semibold text-gray-900 mb-1">Configuração de Mesas</h3>
        <p class="text-sm text-gray-500 mb-5">
          Defina quantas mesas o estabelecimento possui. Um QR Code único será gerado para cada uma.
          Você pode aumentar ou reduzir — mas não é possível remover mesas com comandas abertas.
        </p>

        @if (loading()) {
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-7 w-7 border-b-2" style="border-color: var(--color-brand)"></div>
          </div>
        } @else {
          <div class="flex gap-3 items-end">
            <div class="flex-1">
              <ui-input
                type="number"
                label="Total de mesas"
                [(ngModel)]="totalInput"
                [min]="0"
                [max]="500"
              />
            </div>
            <ui-button
              size="sm"
              [loading]="saving()"
              [disabled]="saving()"
              (click)="salvar()"
            >
              Salvar
            </ui-button>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            Atual: {{ mesas().length }} mesa{{ mesas().length !== 1 ? 's' : '' }}
          </p>
        }
      </div>

      <!-- QR Codes grid -->
      @if (mesas().length > 0) {
        <div>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900">
              QR Codes — {{ mesas().length }} {{ mesas().length === 1 ? 'mesa' : 'mesas' }}
            </h3>
            <ui-button variant="secondary" size="sm" (click)="imprimirTodos()">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              Imprimir todos
            </ui-button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            @for (mesa of mesas(); track mesa.numero) {
              @let comandas = mesasOcupadas().get(mesa.numero.toString()) ?? [];
              <div
                class="bg-white rounded-2xl shadow-sm border p-4 flex flex-col items-center gap-3 transition-all"
                [class]="comandas.length > 0 ? 'border-green-400 ring-2 ring-green-300' : 'border-gray-100'"
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
                <canvas
                  #qrCanvas
                  [attr.data-mesa]="mesa.numero"
                  class="rounded-lg"
                  width="160"
                  height="160"
                ></canvas>
                @if (mesa.localizacao) {
                  <p class="text-xs text-gray-400 text-center">{{ mesa.localizacao }}</p>
                }
                @if (comandas.length > 0) {
                  <div class="w-full text-center">
                    <p class="text-xs text-gray-500">
                      {{ totalMesa(comandas) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                    <ui-button
                      variant="primary"
                      size="xs"
                      [fullWidth]="true"
                      (click)="abrirModal(mesa.numero.toString())"
                    >
                      Ver Comanda{{ comandas.length > 1 ? 's' : '' }}
                    </ui-button>
                  </div>
                }
                <ui-button variant="secondary" size="xs" [fullWidth]="true" (click)="baixar(mesa.numero)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Baixar PNG
                </ui-button>
              </div>
            }
          </div>
        </div>
      } @else if (!loading()) {
        <div class="text-center py-16 text-gray-400">
          <div class="text-5xl mb-3">🪑</div>
          <p class="text-sm">Nenhuma mesa cadastrada ainda.</p>
          <p class="text-xs mt-1">Defina a quantidade acima e salve para gerar os QR Codes.</p>
        </div>
      }
    </div>

    <!-- ── Modal Comandas ────────────────────────────────────────────── -->
    @if (modalMesa()) {
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style="background: rgba(0,0,0,0.5)"
        (click)="fecharModal()"
      >
        <div
          class="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <h3 class="text-lg font-black text-gray-900">Mesa {{ modalMesa() }}</h3>
            <button
              (click)="fecharModal()"
              class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >✕</button>
          </div>

          <!-- Comandas list -->
          <div class="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              @for (comanda of modalComandas(); track comanda.uuid) {
                <div class="border border-gray-200 rounded-2xl overflow-hidden">
                  <!-- Comanda header -->
                  <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div>
                      <p class="text-sm font-bold text-gray-900">
                        {{ $index + 1 }}{{ comanda.nome ? ' - ' + comanda.nome : '' }}
                      </p>
                      <p class="text-xs text-gray-500">
                        Total: {{ comanda.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                      </p>
                    </div>
                    <span class="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-semibold">Aberta</span>
                  </div>
                  <!-- Pedidos -->
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
                      <p class="text-sm text-gray-400 text-center py-2">Nenhum pedido</p>
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
export class AdminMesasTabComponent {
  lojaUuid = input.required<string>();
  lojaSlug = input.required<string>();

  private mesaSvc      = inject(MesaService);
  private comandaSvc   = inject(ComandaService);
  private auth         = inject(AuthService);
  private mesasLive    = inject(MesasLiveService);
  private destroyRef   = inject(DestroyRef);

  readonly loading  = signal(true);
  readonly saving   = signal(false);
  totalInput        = 0;

  readonly mesas = signal<Mesa[]>([]);

  readonly qrCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('qrCanvas');

  readonly comandasAtivas  = signal<Comanda[]>([]);
  readonly mesasOcupadas   = computed(() => {
    const map = new Map<string, Comanda[]>();
    for (const c of this.comandasAtivas()) {
      const list = map.get(c.numero_mesa) ?? [];
      list.push(c);
      map.set(c.numero_mesa, list);
    }
    return map;
  });

  readonly modalMesa        = signal<string | null>(null);
  readonly modalComandas    = computed(() => {
    const mesa = this.modalMesa();
    if (!mesa) return [];
    return this.mesasOcupadas().get(mesa) ?? [];
  });
  readonly formaPagamento   = signal('');
  readonly fechandoComandaUuid = signal<string | null>(null);

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      if (!uuid) return;
      this.carregar();
    });

    effect(() => {
      const canvases = this.qrCanvases();
      const slug = this.lojaSlug();
      if (!canvases.length || !slug) return;
      this.renderizarQrCodes(canvases, slug);
    });

    combineLatest([
      toObservable(this.lojaUuid),
      toObservable(this.auth.token),
    ]).pipe(
      filter(([uuid, token]) => !!uuid && !!token),
      switchMap(([uuid, token]) => this.mesasLive.conectar(uuid, token!)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(cs => this.comandasAtivas.set(cs));
  }

  private carregar(): void {
    this.loading.set(true);
    this.mesaSvc.listar(this.lojaUuid()).subscribe({
      next: mesas => {
        this.mesas.set(mesas);
        this.totalInput = mesas.length;
        this.loading.set(false);
      },
      error: () => {
        this.mesas.set([]);
        this.totalInput = 0;
        this.loading.set(false);
      },
    });
  }

  salvar(): void {
    const total = Math.max(0, Math.min(500, Number(this.totalInput) || 0));
    this.saving.set(true);

    this.mesaSvc.bulkSet(this.lojaUuid(), total).subscribe({
      next: mesas => {
        this.mesas.set(mesas);
        this.totalInput = mesas.length;
        this.saving.set(false);
        toast.success(`${mesas.length} ${mesas.length === 1 ? 'mesa configurada' : 'mesas configuradas'}!`);
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.error ?? 'Erro ao salvar mesas.';
        toast.error(msg);
      },
    });
  }

  readonly _fechandoUuid = signal<string | null>(null);

  totalMesa(comandas: Comanda[]): number {
    return comandas.reduce((s, c) => s + Number(c.total), 0);
  }

  abrirModal(numeroMesa: string): void {
    this.modalMesa.set(numeroMesa);
    this.formaPagamento.set('');
    this.fechandoComandaUuid.set(null);
  }

  fecharModal(): void {
    if (this._fechandoUuid()) return;
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
        if (this.modalComandas().length === 0) this.fecharModal();
      },
      error: () => {
        toast.error('Erro ao fechar a comanda.');
        this._fechandoUuid.set(null);
      },
    });
  }

  precoItem(item: { quantidade: number; partes: { preco_unitario: number }[] }): number {
    const base = item.partes.reduce((s, p) => s + p.preco_unitario, 0);
    return base * item.quantidade;
  }

  private renderizarQrCodes(
    canvases: readonly ElementRef<HTMLCanvasElement>[],
    slug: string,
  ): void {
    canvases.forEach(ref => {
      const canvas = ref.nativeElement;
      const numero = Number(canvas.getAttribute('data-mesa'));
      if (!numero) return;
      const url = `${window.location.origin}/loja/${slug}/mesa/${numero}`;
      QRCode.toCanvas(canvas, url, {
        width: 160,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      });
    });
  }

  baixar(numero: number): void {
    const canvases = this.qrCanvases();
    const ref = canvases.find(
      c => Number(c.nativeElement.getAttribute('data-mesa')) === numero,
    );
    if (!ref) return;
    const link = document.createElement('a');
    link.download = `mesa-${numero}-qrcode.png`;
    link.href = ref.nativeElement.toDataURL('image/png');
    link.click();
  }

  imprimirTodos(): void {
    const slug = this.lojaSlug();
    const canvases = this.qrCanvases();
    const imagens = canvases.map(ref => {
      const mesa = Number(ref.nativeElement.getAttribute('data-mesa'));
      return { mesa, src: ref.nativeElement.toDataURL('image/png') };
    });

    const win = window.open('', '_blank');
    if (!win) return;

    const cards = imagens.map(({ mesa, src }) => `
      <div class="card">
        <div class="label">Mesa ${mesa}</div>
        <img src="${src}" alt="QR Code Mesa ${mesa}"/>
        <div class="url">${window.location.origin}/loja/${slug}/mesa/${mesa}</div>
      </div>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>QR Codes — ${slug}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: sans-serif; padding: 24px; background: #fff; }
          h1 { font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #111; }
          .grid { display: flex; flex-wrap: wrap; gap: 16px; }
          .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 200px; break-inside: avoid; }
          .label { font-size: 22px; font-weight: 900; color: #111; }
          img { width: 160px; height: 160px; border-radius: 8px; }
          .url { font-size: 9px; color: #6b7280; text-align: center; word-break: break-all; }
          @media print { body { padding: 8px; } h1 { display: none; } }
        </style>
      </head>
      <body>
        <h1>QR Codes — ${slug}</h1>
        <div class="grid">${cards}</div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>`
    );
    win.document.close();
  }
}
