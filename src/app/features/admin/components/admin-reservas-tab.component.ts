import { Component, effect, inject, input, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ReservaMesaService } from '../../../core/services/reserva-mesa.service';
import { MesaService } from '../../../core/services/mesa.service';
import { UiButtonComponent } from '../../../shared/components';
import { Mesa, ReservaMesa, StatusReserva } from '../../../core/models';

const STATUS_CFG: Record<StatusReserva, { label: string; bg: string; text: string }> = {
  pendente:       { label: 'Pendente',       bg: 'bg-yellow-100', text: 'text-yellow-800' },
  confirmada:     { label: 'Confirmada',      bg: 'bg-blue-100',   text: 'text-blue-800'   },
  cancelada:      { label: 'Cancelada',       bg: 'bg-red-100',    text: 'text-red-800'    },
  concluida:      { label: 'Concluída',       bg: 'bg-green-100',  text: 'text-green-800'  },
  nao_compareceu: { label: 'Não compareceu',  bg: 'bg-gray-100',   text: 'text-gray-600'   },
};

@Component({
  selector: 'admin-reservas-tab',
  standalone: true,
  imports: [DatePipe, FormsModule, UiButtonComponent],
  template: `
    <div class="space-y-6">

      <!-- ── Header ──────────────────────────────────────────────── -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Reservas de Mesas</h2>
          <p class="text-sm text-gray-500 mt-0.5">Confirme, cancele ou registre novas reservas.</p>
        </div>
        <div class="flex gap-2">
          <ui-button variant="secondary" size="sm" (click)="carregar()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Atualizar
          </ui-button>
          <ui-button size="sm" (click)="abrirFormNova()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            Nova reserva
          </ui-button>
        </div>
      </div>

      <!-- ── Filtros ──────────────────────────────────────────────── -->
      @if (reservas().length > 0) {
        <div class="flex gap-2 flex-wrap">
          <button
            class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
            [class]="filtroStatus() === null
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'"
            (click)="filtroStatus.set(null)"
          >
            Todas ({{ reservas().length }})
          </button>
          @for (s of statusList; track s) {
            @let cfg = statusCfg(s);
            @let count = contarStatus(s);
            @if (count > 0) {
              <button
                class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                [class]="filtroStatus() === s
                  ? cfg.bg + ' ' + cfg.text + ' border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'"
                (click)="filtroStatus.set(s)"
              >
                {{ cfg.label }} ({{ count }})
              </button>
            }
          }
        </div>
      }

      <!-- ── Loading ─────────────────────────────────────────────── -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2" style="border-color: var(--color-brand)"></div>
        </div>

      } @else if (reservas().length === 0) {
        <div class="text-center py-20 text-gray-400">
          <div class="text-5xl mb-3">📅</div>
          <p class="text-sm font-medium">Nenhuma reserva registrada ainda.</p>
          <p class="text-xs mt-1">Clique em "Nova reserva" para criar a primeira.</p>
        </div>

      } @else {

        <!-- ── Lista ──────────────────────────────────────────────── -->
        <div class="space-y-3">
          @for (r of reservasFiltradas(); track r.uuid) {
            @let cfg = statusCfg(r.status);
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-bold text-gray-900">Mesa {{ r.numero_mesa }}</span>
                    <span class="text-gray-300">·</span>
                    <span class="text-sm text-gray-600">
                      {{ r.data_reserva | date:'dd/MM/yyyy':'':'pt-BR' }}
                      às {{ r.hora_reserva.slice(0, 5) }}
                    </span>
                    <span class="text-gray-300">·</span>
                    <span class="text-sm text-gray-600">
                      {{ r.quantidade_pessoas }} pessoa{{ r.quantidade_pessoas !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  @if (r.nomes_pessoas?.length) {
                    <p class="text-xs text-gray-500 mt-1.5">
                      {{ r.nomes_pessoas!.join(', ') }}
                    </p>
                  }
                  @if (r.observacoes) {
                    <p class="text-xs text-gray-400 mt-1 italic">{{ r.observacoes }}</p>
                  }
                  <p class="text-xs text-gray-400 mt-1">
                    Criado em {{ r.criado_em | date:'dd/MM/yyyy HH:mm':'':'pt-BR' }}
                  </p>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
                  [class]="cfg.bg + ' ' + cfg.text">
                  {{ cfg.label }}
                </span>
              </div>

              <!-- Ações por status -->
              @if (r.status === 'pendente') {
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <ui-button size="xs"
                    [loading]="atualizando() === r.uuid + ':confirmada'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'confirmada')">
                    Confirmar
                  </ui-button>
                  <ui-button variant="secondary" size="xs"
                    [loading]="atualizando() === r.uuid + ':cancelada'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'cancelada')">
                    Cancelar
                  </ui-button>
                </div>
              }
              @if (r.status === 'confirmada') {
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <ui-button size="xs"
                    [loading]="atualizando() === r.uuid + ':concluida'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'concluida')">
                    Check-in
                  </ui-button>
                  <ui-button variant="secondary" size="xs"
                    [loading]="atualizando() === r.uuid + ':nao_compareceu'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'nao_compareceu')">
                    Não compareceu
                  </ui-button>
                  <ui-button variant="secondary" size="xs"
                    [loading]="atualizando() === r.uuid + ':cancelada'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'cancelada')">
                    Cancelar
                  </ui-button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Modal: Nova Reserva ─────────────────────────────────────── -->
    @if (formAberto()) {
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style="background: rgba(0,0,0,0.5)"
        (click)="fecharForm()"
      >
        <div
          class="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <h3 class="text-lg font-black text-gray-900">Nova Reserva</h3>
            <button
              (click)="fecharForm()"
              class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
            >✕</button>
          </div>

          <!-- Form -->
          <div class="px-6 py-5 space-y-4">

            <!-- Mesa -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mesa</label>
              @if (loadingMesas()) {
                <p class="text-sm text-gray-400">Carregando mesas...</p>
              } @else if (mesas().length === 0) {
                <p class="text-sm text-red-500">Nenhuma mesa cadastrada. Cadastre mesas primeiro.</p>
              } @else {
                <select
                  class="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-800
                         focus:outline-none focus:ring-2 bg-white"
                  [(ngModel)]="form.numero_mesa"
                >
                  <option [ngValue]="null" disabled>Selecione uma mesa</option>
                  @for (m of mesas(); track m.numero) {
                    <option [ngValue]="m.numero">
                      Mesa {{ m.numero }}
                      @if (m.localizacao) { — {{ m.localizacao }} }
                      ({{ m.capacidade }} pessoas)
                    </option>
                  }
                </select>
              }
            </div>

            <!-- Data e Hora -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Data</label>
                <input
                  type="date"
                  class="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800
                         focus:outline-none focus:ring-2"
                  [(ngModel)]="form.data_reserva"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Horário</label>
                <input
                  type="time"
                  class="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800
                         focus:outline-none focus:ring-2"
                  [(ngModel)]="form.hora_reserva"
                />
              </div>
            </div>

            <!-- Pessoas -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Quantidade de pessoas</label>
              <input
                type="number"
                [min]="1"
                [max]="99"
                class="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800
                       focus:outline-none focus:ring-2"
                placeholder="Ex: 4"
                [(ngModel)]="form.quantidade_pessoas"
              />
            </div>

            <!-- Nomes dos participantes -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Participantes <span class="font-normal text-gray-400">(opcional)</span>
                </label>
                <button
                  type="button"
                  class="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                  style="color: var(--color-brand)"
                  (click)="adicionarNome()"
                >+ Adicionar nome</button>
              </div>
              @if (form.nomes_pessoas.length === 0) {
                <p class="text-xs text-gray-400">Nenhum participante adicionado.</p>
              } @else {
                <div class="space-y-2">
                  @for (nome of form.nomes_pessoas; track $index; let i = $index) {
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        class="flex-1 h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-800
                               focus:outline-none focus:ring-2"
                        [placeholder]="'Nome ' + (i + 1)"
                        [(ngModel)]="form.nomes_pessoas[i]"
                      />
                      <button
                        type="button"
                        class="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400
                               hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                        (click)="removerNome(i)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Observações -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Observações <span class="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                class="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800
                       focus:outline-none focus:ring-2 resize-none"
                rows="2"
                placeholder="Ex: Aniversário, cadeirante, bebê..."
                [(ngModel)]="form.observacoes"
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-6 flex gap-3">
            <ui-button variant="secondary" [fullWidth]="true" (click)="fecharForm()">
              Cancelar
            </ui-button>
            <ui-button
              [fullWidth]="true"
              [loading]="criando()"
              [disabled]="!formValido || criando()"
              (click)="criar()"
            >
              Criar reserva
            </ui-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminReservasTabComponent {
  lojaUuid = input.required<string>();

  private reservaSvc = inject(ReservaMesaService);
  private mesaSvc    = inject(MesaService);

  readonly loading      = signal(true);
  readonly loadingMesas = signal(false);
  readonly reservas     = signal<ReservaMesa[]>([]);
  readonly mesas        = signal<Mesa[]>([]);
  readonly atualizando  = signal<string | null>(null);
  readonly criando      = signal(false);
  readonly filtroStatus = signal<StatusReserva | null>(null);
  readonly formAberto   = signal(false);

  form = {
    numero_mesa:        null as number | null,
    data_reserva:       '',
    hora_reserva:       '',
    quantidade_pessoas: 2,
    nomes_pessoas:      [] as string[],
    observacoes:        '',
  };

  get formValido(): boolean {
    return (
      this.form.numero_mesa !== null &&
      !!this.form.data_reserva &&
      !!this.form.hora_reserva &&
      this.form.quantidade_pessoas >= 1
    );
  }

  readonly statusList: StatusReserva[] = [
    'pendente', 'confirmada', 'concluida', 'cancelada', 'nao_compareceu',
  ];

  readonly reservasFiltradas = computed(() => {
    const s = this.filtroStatus();
    if (!s) return this.reservas();
    return this.reservas().filter(r => r.status === s);
  });

  statusCfg(s: StatusReserva) { return STATUS_CFG[s]; }

  contarStatus(s: StatusReserva): number {
    return this.reservas().filter(r => r.status === s).length;
  }

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      if (!uuid) return;
      this.carregar();
    });
  }

  carregar(): void {
    this.loading.set(true);
    this.reservaSvc.listar(this.lojaUuid()).subscribe({
      next: rs => { this.reservas.set(rs); this.loading.set(false); },
      error: () => { this.reservas.set([]); this.loading.set(false); },
    });
  }

  adicionarNome(): void {
    this.form.nomes_pessoas = [...this.form.nomes_pessoas, ''];
  }

  removerNome(i: number): void {
    this.form.nomes_pessoas = this.form.nomes_pessoas.filter((_, idx) => idx !== i);
  }

  abrirFormNova(): void {
    this.form = {
      numero_mesa: null,
      data_reserva: new Date().toISOString().slice(0, 10),
      hora_reserva: '19:00',
      quantidade_pessoas: 2,
      nomes_pessoas: [],
      observacoes: '',
    };
    this.formAberto.set(true);

    if (this.mesas().length === 0) {
      this.loadingMesas.set(true);
      this.mesaSvc.listar(this.lojaUuid()).subscribe({
        next: ms => { this.mesas.set(ms); this.loadingMesas.set(false); },
        error: () => this.loadingMesas.set(false),
      });
    }
  }

  fecharForm(): void {
    if (this.criando()) return;
    this.formAberto.set(false);
  }

  criar(): void {
    if (!this.formValido || this.criando()) return;
    this.criando.set(true);

    const nomes = this.form.nomes_pessoas.map(n => n.trim()).filter(Boolean);
    this.reservaSvc.criar(this.lojaUuid(), {
      numero_mesa:        this.form.numero_mesa!,
      data_reserva:       this.form.data_reserva,
      hora_reserva:       this.form.hora_reserva + ':00',
      quantidade_pessoas: this.form.quantidade_pessoas,
      nomes_pessoas:      nomes.length ? nomes : null,
      observacoes:        this.form.observacoes?.trim() || null,
    }).subscribe({
      next: nova => {
        this.reservas.update(rs => [nova, ...rs]);
        this.criando.set(false);
        this.formAberto.set(false);
        toast.success(`Reserva criada para a Mesa ${nova.numero_mesa}!`);
      },
      error: err => {
        this.criando.set(false);
        toast.error(err?.error?.error ?? 'Erro ao criar reserva.');
      },
    });
  }

  atualizar(r: ReservaMesa, status: StatusReserva): void {
    const key = `${r.uuid}:${status}`;
    this.atualizando.set(key);
    this.reservaSvc.atualizarStatus(r.uuid, status).subscribe({
      next: () => {
        this.reservas.update(rs =>
          rs.map(x => x.uuid === r.uuid ? { ...x, status } : x)
        );
        this.atualizando.set(null);
        toast.success(`Reserva atualizada: ${STATUS_CFG[status].label}`);
      },
      error: err => {
        this.atualizando.set(null);
        toast.error(err?.error?.error ?? 'Erro ao atualizar reserva.');
      },
    });
  }
}
