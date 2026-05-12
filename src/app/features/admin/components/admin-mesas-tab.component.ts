import {
  Component,
  inject,
  input,
  signal,
  effect,
  computed,
  ElementRef,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import QRCode from 'qrcode';
import { ConfigPedidoService } from '../../../core/services/config-pedido.service';
import { LojaService } from '../../../core/services/loja.service';
import { UiButtonComponent, UiInputComponent } from '../../../shared/components';

@Component({
  selector: 'admin-mesas-tab',
  standalone: true,
  imports: [
    FormsModule,
    UiButtonComponent,
    UiInputComponent
  ],
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
            <div
              class="animate-spin rounded-full h-7 w-7 border-b-2"
              style="border-color: var(--color-brand)"
            ></div>
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
        }
      </div>

      <!-- QR Codes grid -->
      @if (mesas().length > 0) {
        <div>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900">
              QR Codes — {{ mesas().length }} {{ mesas().length === 1 ? 'mesa' : 'mesas' }}
            </h3>
            <ui-button
              variant="secondary"
              size="sm"
              (click)="imprimirTodos()"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Imprimir todos
            </ui-button>
          </div>

          <div
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            @for (mesa of mesas(); track mesa) {
              <div
                class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col items-center gap-3"
              >
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mesa</p>
                <p class="text-2xl font-black text-gray-900 leading-none">{{ mesa }}</p>
                <canvas
                  #qrCanvas
                  [attr.data-mesa]="mesa"
                  class="rounded-lg"
                  width="160"
                  height="160"
                >
                </canvas>
                <ui-button
                  variant="secondary"
                  size="xs"
                  [fullWidth]="true"
                  (click)="baixar(mesa)"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
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
  `,
})
export class AdminMesasTabComponent {
  lojaUuid = input.required<string>();
  lojaSlug = input.required<string>();

  private configService = inject(ConfigPedidoService);

  readonly loading  = signal(true);
  readonly saving   = signal(false);
  quantidadeInput   = 0;

  readonly quantidade = signal(0);
  readonly mesas = computed(() =>
    Array.from({ length: this.quantidade() }, (_, i) => i + 1),
  );

  readonly qrCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('qrCanvas');

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      if (uuid) this.carregar();
    });

    effect(() => {
      const canvases = this.qrCanvases();
      const slug = this.lojaSlug();
      if (!canvases.length || !slug) return;
      this.renderizarQrCodes(canvases, slug);
    });
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

  salvar(): void {
    const qty = Math.max(0, Math.min(200, Number(this.quantidadeInput) || 0));
    this.saving.set(true);


    this.configService.getConfigPedido(this.lojaUuid()).subscribe({
      next: config => {
        if (config.tipo_calculo === "MaisCaro") { config.tipo_calculo = "mais_caro"; }
        if (config.tipo_calculo === "MediaPonderada") { config.tipo_calculo = "media_ponderada"; }
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

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>QR Codes — ${slug}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; padding: 24px; background: #fff; }
    h1 { font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #111; }
    .grid { display: flex; flex-wrap: wrap; gap: 16px; }
    .card {
      border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 16px; display: flex; flex-direction: column;
      align-items: center; gap: 10px; width: 200px;
      break-inside: avoid;
    }
    .label { font-size: 22px; font-weight: 900; color: #111; }
    img { width: 160px; height: 160px; border-radius: 8px; }
    .url { font-size: 9px; color: #6b7280; text-align: center; word-break: break-all; }
    @media print {
      body { padding: 8px; }
      h1 { display: none; }
    }
  </style>
</head>
<body>
  <h1>QR Codes — ${slug}</h1>
  <div class="grid">${cards}</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    win.document.close();
  }
}
