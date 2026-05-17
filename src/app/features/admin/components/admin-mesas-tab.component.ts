import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
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
import { ReservaMesaService } from '../../../core/services/reserva-mesa.service';
import { UiButtonComponent, UiInputComponent } from '../../../shared/components';
import { Comanda, Mesa, NovaMesa, ReservaMesa } from '../../../core/models';

interface LinhaForm {
  capacidade: number;
  localizacao: string;
}

@Component({
  selector: 'admin-mesas-tab',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, UiButtonComponent, UiInputComponent],
  providers: [MesasLiveService],
  template: `
    <div class="space-y-8">

      <!-- ── Mesas cadastradas ──────────────────────────────────────── -->
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2" style="border-color: var(--color-brand)"></div>
        </div>
      } @else if (mesas().length === 0 && linhasForm().length === 0) {
        <div class="text-center py-16 text-gray-400">
          <div class="text-5xl mb-3">🪑</div>
          <p class="text-sm font-medium">Nenhuma mesa cadastrada ainda.</p>
          <p class="text-xs mt-1">Use o formulário abaixo para adicionar mesas.</p>
        </div>
      } @else if (mesas().length > 0) {
        <div>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900">
              {{ mesas().length }} {{ mesas().length === 1 ? 'mesa cadastrada' : 'mesas cadastradas' }}
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
            @for (mesa of mesas(); track mesa.numero; let last = $last) {
              @let comandas = mesasOcupadas().get(mesa.numero.toString()) ?? [];
              <div
                class="relative bg-white rounded-2xl shadow-sm border p-4 flex flex-col items-center gap-2 transition-all group"
                [class]="comandas.length > 0 ? 'border-green-400 ring-2 ring-green-300' : 'border-gray-100'"
              >
                <!-- Delete button on last mesa hover (só se sem comanda ativa e sem reserva) -->
                @if (last && comandas.length === 0 && !mesasComReservaSet().has(mesa.numero)) {
                  <button
                    class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs
                           flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                           hover:bg-red-600 shadow-md"
                    [disabled]="deletando()"
                    (click)="deletarUltima(mesa)"
                    title="Remover mesa {{ mesa.numero }}"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                }

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
                  width="120"
                  height="120"
                ></canvas>

                <div class="w-full text-center space-y-1">
                  <p class="text-xs text-gray-400">{{ mesa.capacidade }} pessoa{{ mesa.capacidade !== 1 ? 's' : '' }}</p>
                  @if (mesa.localizacao) {
                    <p class="text-xs text-gray-400 truncate">{{ mesa.localizacao }}</p>
                  }
                </div>

                @if (comandas.length > 0) {
                  <div class="w-full text-center space-y-1">
                    <p class="text-xs text-gray-500">
                      {{ totalMesa(comandas) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                    </p>
                    <ui-button variant="primary" size="xs" [fullWidth]="true"
                      (click)="abrirModal(mesa.numero.toString())">
                      Ver Comanda{{ comandas.length > 1 ? 's' : '' }}
                    </ui-button>
                  </div>
                }

                <ui-button variant="secondary" size="xs" [fullWidth]="true" (click)="baixar(mesa.numero)">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  PNG
                </ui-button>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── Formulário para adicionar novas mesas ─────────────────── -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-base font-semibold text-gray-900">Adicionar novas mesas</h3>
            <p class="text-xs text-gray-400 mt-0.5">
              Os números são atribuídos automaticamente a partir da mesa {{ proximoNumero() }}.
            </p>
          </div>
          <ui-button size="sm" (click)="adicionarLinha()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            Adicionar mesa
          </ui-button>
        </div>

        @if (linhasForm().length === 0) {
          <p class="text-sm text-gray-400 text-center py-6">
            Clique em "Adicionar mesa" para começar.
          </p>
        } @else {
          <!-- Header das colunas -->
          <div class="grid grid-cols-[3rem_1fr_1fr_2rem] gap-3 mb-2 px-1">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mesa</p>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Capacidade</p>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Localização</p>
            <span></span>
          </div>

          <div class="space-y-2">
            @for (linha of linhasForm(); track $index; let i = $index) {
              <div class="grid grid-cols-[3rem_1fr_1fr_2rem] gap-3 items-center">
                <!-- Número (readonly) -->
                <div class="h-10 bg-gray-50 rounded-xl flex items-center justify-center text-sm font-black text-gray-700 border border-gray-200">
                  {{ proximoNumero() + i }}
                </div>

                <!-- Capacidade -->
                <input
                  type="number"
                  [min]="1"
                  [max]="99"
                  class="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-800
                         focus:outline-none focus:ring-2 focus:border-transparent"
                  style="focus-ring-color: var(--color-brand)"
                  placeholder="Ex: 4"
                  [(ngModel)]="linha.capacidade"
                />

                <!-- Localização -->
                <input
                  type="text"
                  class="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800
                         focus:outline-none focus:ring-2 focus:border-transparent"
                  placeholder="Ex: Varanda"
                  [(ngModel)]="linha.localizacao"
                />

                <!-- Remover linha -->
                <button
                  class="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400
                         hover:bg-red-50 hover:text-red-500 transition-colors"
                  (click)="removerLinha(i)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            }
          </div>

          <div class="mt-5 flex items-center justify-between">
            <p class="text-xs text-gray-400">
              {{ linhasForm().length }} {{ linhasForm().length === 1 ? 'mesa' : 'mesas' }} a criar
            </p>
            <div class="flex gap-2">
              <ui-button variant="secondary" size="sm" (click)="limparForm()">
                Cancelar
              </ui-button>
              <ui-button
                size="sm"
                [loading]="saving()"
                [disabled]="saving() || linhasForm().length === 0"
                (click)="salvar()"
              >
                Salvar {{ linhasForm().length }} mesa{{ linhasForm().length !== 1 ? 's' : '' }}
              </ui-button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ── Modal Comandas ───────────────────────────────────────────── -->
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
                    </div>
                  }
                  @if (comanda.pedidos.length === 0) {
                    <p class="text-sm text-gray-400 text-center py-2">Nenhum pedido</p>
                  }
                </div>
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

  private mesaSvc       = inject(MesaService);
  private comandaSvc    = inject(ComandaService);
  private auth          = inject(AuthService);
  private mesasLive     = inject(MesasLiveService);
  private reservaMesaSvc = inject(ReservaMesaService);
  private destroyRef    = inject(DestroyRef);

  readonly loading  = signal(true);
  readonly saving   = signal(false);
  readonly deletando = signal(false);

  readonly mesas       = signal<Mesa[]>([]);
  readonly reservas    = signal<ReservaMesa[]>([]);
  readonly linhasForm  = signal<LinhaForm[]>([]);

  readonly mesasComReservaSet = computed(() => {
    const set = new Set<number>();
    for (const r of this.reservas()) {
      if (r.status === 'pendente' || r.status === 'confirmada') {
        set.add(r.numero_mesa);
      }
    }
    return set;
  });
  readonly proximoNumero = computed(() => {
    const m = this.mesas();
    return m.length > 0 ? m[m.length - 1].numero + 1 : 1;
  });

  readonly qrCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('qrCanvas');

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

  readonly modalMesa        = signal<string | null>(null);
  readonly modalComandas    = computed(() => {
    const mesa = this.modalMesa();
    if (!mesa) return [];
    return this.mesasOcupadas().get(mesa) ?? [];
  });
  readonly formaPagamento   = signal('');
  readonly fechandoComandaUuid = signal<string | null>(null);
  readonly _fechandoUuid    = signal<string | null>(null);

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
    const uuid = this.lojaUuid();
    this.mesaSvc.listar(uuid).subscribe({
      next: mesas => {
        this.mesas.set(mesas);
        this.loading.set(false);
      },
      error: () => {
        this.mesas.set([]);
        this.loading.set(false);
      },
    });
    this.reservaMesaSvc.listar(uuid).subscribe({
      next: reservas => this.reservas.set(reservas),
      error: () => this.reservas.set([]),
    });
  }

  adicionarLinha(): void {
    this.linhasForm.update(ls => [...ls, { capacidade: 4, localizacao: '' }]);
  }

  removerLinha(i: number): void {
    this.linhasForm.update(ls => ls.filter((_, idx) => idx !== i));
  }

  limparForm(): void {
    this.linhasForm.set([]);
  }

  salvar(): void {
    const linhas = this.linhasForm();
    if (!linhas.length) return;

    const payload: NovaMesa[] = linhas.map(l => ({
      capacidade:  Math.max(1, Number(l.capacidade) || 4),
      localizacao: l.localizacao?.trim() || null,
    }));

    this.saving.set(true);
    this.mesaSvc.criar(this.lojaUuid(), payload).subscribe({
      next: novas => {
        this.mesas.update(ms => [...ms, ...novas]);
        this.linhasForm.set([]);
        this.saving.set(false);
        toast.success(`${novas.length} ${novas.length === 1 ? 'mesa criada' : 'mesas criadas'}!`);
      },
      error: err => {
        this.saving.set(false);
        toast.error(err?.error?.error ?? 'Erro ao criar mesas.');
      },
    });
  }

  deletarUltima(mesa: Mesa): void {
    if (this.deletando()) return;
    this.deletando.set(true);
    this.mesaSvc.deletar(this.lojaUuid(), mesa.numero).subscribe({
      next: () => {
        this.mesas.update(ms => ms.filter(m => m.numero !== mesa.numero));
        this.deletando.set(false);
        toast.success(`Mesa ${mesa.numero} removida.`);
      },
      error: err => {
        this.deletando.set(false);
        toast.error(err?.error?.error ?? 'Erro ao remover mesa.');
      },
    });
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
    return item.partes.reduce((s, p) => s + p.preco_unitario, 0) * item.quantidade;
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
        width: 120,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      });
    });
  }

  baixar(numero: number): void {
    const ref = this.qrCanvases().find(
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
    const imagens = this.qrCanvases().map(ref => ({
      mesa: Number(ref.nativeElement.getAttribute('data-mesa')),
      src:  ref.nativeElement.toDataURL('image/png'),
    }));

    const win = window.open('', '_blank');
    if (!win) return;

    const cards = imagens.map(({ mesa, src }) => `
      <div class="card">
        <div class="label">Mesa ${mesa}</div>
        <img src="${src}" alt="QR Code Mesa ${mesa}"/>
        <div class="url">${window.location.origin}/loja/${slug}/mesa/${mesa}</div>
      </div>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>QR Codes — ${slug}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:24px;background:#fff}
      h1{font-size:18px;font-weight:bold;margin-bottom:20px;color:#111}
      .grid{display:flex;flex-wrap:wrap;gap:16px}
      .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px;width:180px;break-inside:avoid}
      .label{font-size:22px;font-weight:900;color:#111}img{width:120px;height:120px;border-radius:8px}
      .url{font-size:9px;color:#6b7280;text-align:center;word-break:break-all}
      @media print{body{padding:8px}h1{display:none}}</style>
      </head><body>
      <h1>QR Codes — ${slug}</h1>
      <div class="grid">${cards}</div>
      <script>window.onload=()=>{window.print()}<\/script>
      </body></html>`);
    win.document.close();
  }
}
