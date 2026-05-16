import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toast } from 'ngx-sonner';
import { ReservaMesaService } from '../../../core/services/reserva-mesa.service';
import { UiButtonComponent } from '../../../shared/components';
import { ReservaMesa, StatusReserva } from '../../../core/models';

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
  imports: [DatePipe, UiButtonComponent],
  template: `
    <div class="space-y-6">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Reservas de Mesas</h2>
          <p class="text-sm text-gray-500 mt-0.5">Gerencie e confirme as reservas do estabelecimento.</p>
        </div>
        <ui-button variant="secondary" size="sm" (click)="carregar()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Atualizar
        </ui-button>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2" style="border-color: var(--color-brand)"></div>
        </div>
      } @else if (reservas().length === 0) {
        <div class="text-center py-20 text-gray-400">
          <div class="text-5xl mb-3">📅</div>
          <p class="text-sm font-medium">Nenhuma reserva registrada ainda.</p>
        </div>
      } @else {

        <!-- Filtros rápidos por status -->
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

        <!-- Lista de reservas -->
        <div class="space-y-3">
          @for (r of reservasFiltradas(); track r.uuid) {
            @let cfg = statusCfg(r.status);
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div class="flex items-start justify-between gap-4">

                <!-- Info principal -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-bold text-gray-900">Mesa {{ r.numero_mesa }}</span>
                    <span class="text-gray-300">·</span>
                    <span class="text-sm text-gray-600">
                      {{ r.data_reserva | date:'dd/MM/yyyy':'':'pt-BR' }}
                      às {{ r.hora_reserva.slice(0, 5) }}
                    </span>
                    <span class="text-gray-300">·</span>
                    <span class="text-sm text-gray-600">{{ r.quantidade_pessoas }} pessoa{{ r.quantidade_pessoas !== 1 ? 's' : '' }}</span>
                  </div>

                  @if (r.observacoes) {
                    <p class="text-xs text-gray-400 mt-1.5 italic">{{ r.observacoes }}</p>
                  }

                  <p class="text-xs text-gray-400 mt-1">
                    Criado em {{ r.criado_em | date:'dd/MM/yyyy HH:mm':'':'pt-BR' }}
                  </p>
                </div>

                <!-- Status badge -->
                <span class="px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
                  [class]="cfg.bg + ' ' + cfg.text">
                  {{ cfg.label }}
                </span>
              </div>

              <!-- Ações -->
              @if (r.status === 'pendente') {
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <ui-button
                    size="xs"
                    [loading]="atualizando() === r.uuid + ':confirmada'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'confirmada')"
                  >
                    Confirmar
                  </ui-button>
                  <ui-button
                    variant="secondary"
                    size="xs"
                    [loading]="atualizando() === r.uuid + ':cancelada'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'cancelada')"
                  >
                    Cancelar
                  </ui-button>
                </div>
              }

              @if (r.status === 'confirmada') {
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <ui-button
                    size="xs"
                    [loading]="atualizando() === r.uuid + ':concluida'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'concluida')"
                  >
                    Check-in (Concluir)
                  </ui-button>
                  <ui-button
                    variant="secondary"
                    size="xs"
                    [loading]="atualizando() === r.uuid + ':nao_compareceu'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'nao_compareceu')"
                  >
                    Não compareceu
                  </ui-button>
                  <ui-button
                    variant="secondary"
                    size="xs"
                    [loading]="atualizando() === r.uuid + ':cancelada'"
                    [disabled]="!!atualizando()"
                    (click)="atualizar(r, 'cancelada')"
                  >
                    Cancelar
                  </ui-button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminReservasTabComponent {
  lojaUuid = input.required<string>();

  private reservaSvc = inject(ReservaMesaService);

  readonly loading    = signal(true);
  readonly reservas   = signal<ReservaMesa[]>([]);
  readonly atualizando = signal<string | null>(null);
  readonly filtroStatus = signal<StatusReserva | null>(null);

  readonly statusList: StatusReserva[] = [
    'pendente', 'confirmada', 'concluida', 'cancelada', 'nao_compareceu',
  ];

  readonly reservasFiltradas = () => {
    const s = this.filtroStatus();
    if (!s) return this.reservas();
    return this.reservas().filter(r => r.status === s);
  };

  statusCfg(s: StatusReserva) {
    return STATUS_CFG[s];
  }

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
      next: rs => {
        this.reservas.set(rs);
        this.loading.set(false);
      },
      error: () => {
        this.reservas.set([]);
        this.loading.set(false);
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
        toast.success(`Reserva atualizada para "${STATUS_CFG[status].label}".`);
      },
      error: err => {
        this.atualizando.set(null);
        toast.error(err?.error?.error ?? 'Erro ao atualizar reserva.');
      },
    });
  }
}
