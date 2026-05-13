import {
  Component,
  inject,
  input,
  signal,
  effect,
  computed,
  ElementRef,
  viewChildren,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { toast } from 'ngx-sonner';
import QRCode from 'qrcode';
import { ConfigPedidoService } from '../../../core/services/config-pedido.service';
import { ComandaService } from '../../../core/services/comanda.service';
import { UiButtonComponent, UiInputComponent } from '../../../shared/components';
import { Comanda } from '../../../core/models';

@Component({
  selector: 'admin-mesas-tab',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, UiButtonComponent, UiInputComponent],
  template: `
    <div class="space-y-6">

      <!-- Config card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-sm">
        <h3 class="text-base font-semibold text-gray-900 mb-1">Configuração de Mesas</h3>
        <p class="text-sm text-gray-500 mb-5">
          Defina quantas mesas o estabelecimento possui. Um QR Code único será gerado para cada uma.
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
                label="Quantidade de mesas"
                [(ngModel)]="quantidadeInput"
                [min]="0"
                [max]="200"
                [attr.disabled]="temComandasAtivas() ? true : null"
              />
            </div>
            <ui-button
              size="sm"
              [loading]="saving()"
              [disabled]="saving() || temComandasAtivas()"
              (click)="salvar()"
            >
              Salvar
            </ui-button>
          </div>

          @if (temComandasAtivas()) {
            <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <p class="font-semibold mb-1">⚠️ Não é possível alterar a quantidade de mesas enquanto há comandas abertas.</p>
              <p>Feche todas as comandas antes de modificar a configuração.</p>
              <p class="mt-1">Mesas com comanda ativa:
                <strong>{{ mesasComComandasStr() }}</strong>
              </p>
            </div>
          }
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
            @for (mesa of mesas(); track mesa) {
              @let comanda = mesasOcupadas().get(mesa.toString());
              <div
                class="bg-white rounded-2xl shadow-sm border p-4 flex flex-col items-center gap-3 transition-all"
                [class]="comanda ? 'border-green-400 ring-2 ring-green-300' : 'border-gray-100'"
              >
                <div class="flex items-center gap-1.5 w-full justify-between">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesa</p>
                  @if (comanda) {
                    <span class="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">🟢 Aberta</span>
                  }
                </div>
                <p class="text-2xl font-black text-gray-900 leading-none">{{ mesa }}</p>
                <canvas
                  #qrCanvas
                  [attr.data-mesa]="mesa"
                  class="rounded-lg"
                  width="160"
                  height="160"
                ></canvas>
                @if (comanda) {
                  <div class="w-full text-center">
                    <p class="text-xs text-gray-500">
                      {{ comanda.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                    <ui-button
                      variant="primary"
                      size="xs"
                      [fullWidth]="true"
                      (click)="abrirModal(comanda)"
                    >
                      Ver Comanda
                    </ui-button>
                  </div>
                }
                <ui-button variant="secondary" size="xs" [fullWidth]="true" (click)="baixar(mesa)">
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

    <!-- ── Modal Comanda ──────────────────────────────────────────────── -->
    @if (comandaModal()) {
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style="background: rgba(0,0,0,0.5)"
        (click)="fecharModal()"
      >
        <div
          class="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <h3 class="text-lg font-black text-gray-900">
              Comanda — Mesa {{ comandaModal()!.numero_mesa }}
            </h3>
            <button
              (click)="fecharModal()"
              class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >✕</button>
          </div>

          <!-- Items -->
          <div class="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            @for (pedido of comandaModal()!.pedidos; track pedido.uuid) {
              <div>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Pedido #{{ pedido.codigo }}
                </p>
                @for (item of pedido.itens; track item.uuid) {
                  <div class="flex justify-between items-baseline py-1">
                    <span class="text-sm text-gray-700">
                      {{ item.quantidade }}× {{ item.partes[0]?.produto_nome ?? '—' }}
                      @if (item.partes.length > 1) {
                        <span class="text-gray-400"> + {{ item.partes.length - 1 }} parte{{ item.partes.length > 2 ? 's' : '' }}</span>
                      }
                    </span>
                    <span class="text-sm font-medium text-gray-900 ml-4 shrink-0">
                      {{ precoItem(item) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </span>
                  </div>
                }
              </div>
            }
            <div class="border-t border-gray-200 pt-3 flex justify-between items-baseline">
              <span class="font-semibold text-gray-700">Total</span>
              <span class="text-xl font-black text-gray-900">
                {{ comandaModal()!.total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
              </span>
            </div>
          </div>

          <!-- Footer — pagamento -->
          <div class="px-6 pb-6 pt-4 border-t border-gray-100 space-y-3">
            <p class="text-sm font-semibold text-gray-700">Como o cliente vai pagar?</p>
            <div class="flex gap-2">
              @for (forma of ['Dinheiro', 'Cartão', 'PIX']; track forma) {
                <button
                  class="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                  [class]="formaPagamento() === forma
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'"
                  (click)="formaPagamento.set(forma)"
                >
                  {{ forma === 'Dinheiro' ? '💵' : forma === 'Cartão' ? '💳' : '📱' }}
                  {{ forma }}
                </button>
              }
            </div>
            <ui-button
              [fullWidth]="true"
              [disabled]="!formaPagamento() || fechandoComanda()"
              [loading]="fechandoComanda()"
              (click)="fecharComanda()"
            >
              Fechar Comanda e Registrar Pagamento
            </ui-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminMesasTabComponent implements OnDestroy {
  lojaUuid = input.required<string>();
  lojaSlug = input.required<string>();

  private configService  = inject(ConfigPedidoService);
  private comandaSvc     = inject(ComandaService);

  readonly loading  = signal(true);
  readonly saving   = signal(false);
  quantidadeInput   = 0;

  readonly quantidade = signal(0);
  readonly mesas = computed(() =>
    Array.from({ length: this.quantidade() }, (_, i) => i + 1),
  );

  readonly qrCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('qrCanvas');

  readonly comandasAtivas  = signal<Comanda[]>([]);
  readonly mesasOcupadas   = computed(() =>
    new Map(this.comandasAtivas().map(c => [c.numero_mesa, c]))
  );
  readonly temComandasAtivas = computed(() => this.comandasAtivas().length > 0);
  readonly mesasComComandasStr = computed(() =>
    this.comandasAtivas().map(c => c.numero_mesa).join(', ')
  );

  readonly comandaModal   = signal<Comanda | null>(null);
  readonly formaPagamento = signal('');
  readonly fechandoComanda = signal(false);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      if (!uuid) return;
      this.carregar();
      this.carregarComandas();
      this.pollingInterval = setInterval(() => this.carregarComandas(), 30_000);
    });

    effect(() => {
      const canvases = this.qrCanvases();
      const slug = this.lojaSlug();
      if (!canvases.length || !slug) return;
      this.renderizarQrCodes(canvases, slug);
    });
  }

  ngOnDestroy(): void {
    if (this.pollingInterval !== null) clearInterval(this.pollingInterval);
  }

  private carregar(): void {
    this.loading.set(true);
    this.configService.getConfigPedido(this.lojaUuid()).subscribe({
      next: config => {
        this.quantidade.set(config.quantidade_mesas ?? 0);
        this.quantidadeInput = config.quantidade_mesas ?? 0;
        this.loading.set(false);
      },
      error: () => {
        this.quantidade.set(0);
        this.quantidadeInput = 0;
        this.loading.set(false);
      },
    });
  }

  private carregarComandas(): void {
    const uuid = this.lojaUuid();
    if (!uuid) return;
    this.comandaSvc.listarComandasAtivas(uuid).subscribe({
      next: cs => this.comandasAtivas.set(cs),
      error: () => {},
    });
  }

  salvar(): void {
    if (this.temComandasAtivas()) return;
    const qty = Math.max(0, Math.min(200, Number(this.quantidadeInput) || 0));
    this.saving.set(true);

    this.configService.getConfigPedido(this.lojaUuid()).subscribe({
      next: config => {
        if (config.tipo_calculo === 'MaisCaro') config.tipo_calculo = 'mais_caro';
        if (config.tipo_calculo === 'MediaPonderada') config.tipo_calculo = 'media_ponderada';
        this.configService.saveConfigPedido(this.lojaUuid(), {
          max_partes:       config.max_partes,
          tipo_calculo:     config.tipo_calculo,
          quantidade_mesas: qty,
        }).subscribe({
          next: () => {
            this.quantidade.set(qty);
            this.saving.set(false);
            toast.success(`${qty} ${qty === 1 ? 'mesa configurada' : 'mesas configuradas'}!`);
          },
          error: () => {
            this.saving.set(false);
            toast.error('Erro ao salvar configuração de mesas.');
          },
        });
      },
      error: () => {
        this.saving.set(false);
        toast.error('Erro ao carregar configuração atual.');
      },
    });
  }

  abrirModal(comanda: Comanda): void {
    // Busca comanda com pedidos hidratados
    this.comandaSvc.buscarComandaAtiva(comanda.loja_uuid, comanda.numero_mesa).subscribe({
      next: c => {
        this.comandaModal.set(c ?? comanda);
        this.formaPagamento.set('');
      },
      error: () => {
        this.comandaModal.set(comanda);
        this.formaPagamento.set('');
      },
    });
  }

  fecharModal(): void {
    if (this.fechandoComanda()) return;
    this.comandaModal.set(null);
    this.formaPagamento.set('');
  }

  fecharComanda(): void {
    const comanda = this.comandaModal();
    const forma   = this.formaPagamento();
    if (!comanda || !forma) return;

    this.fechandoComanda.set(true);
    this.comandaSvc.fecharComanda(comanda.uuid, { forma_pagamento: forma }).subscribe({
      next: () => {
        toast.success(`Comanda da Mesa ${comanda.numero_mesa} fechada!`);
        this.fechandoComanda.set(false);
        this.comandaModal.set(null);
        this.formaPagamento.set('');
        this.carregarComandas();
      },
      error: () => {
        toast.error('Erro ao fechar a comanda.');
        this.fechandoComanda.set(false);
      },
    });
  }

  precoItem(item: { quantidade: number; partes: { preco_unitario: number }[] }): number {
    const base = item.partes.reduce((s, p) => s + p.preco_unitario, 0);
    return base * item.quantidade;
  }

  private mesaUrl(numero: number): string {
    return `${window.location.origin}/loja/${this.lojaSlug()}/mesa/${numero}`;
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

  baixar(mesa: number): void {
    const canvases = this.qrCanvases();
    const ref = canvases.find(
      c => Number(c.nativeElement.getAttribute('data-mesa')) === mesa,
    );
    if (!ref) return;
    const link = document.createElement('a');
    link.download = `mesa-${mesa}-qrcode.png`;
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
