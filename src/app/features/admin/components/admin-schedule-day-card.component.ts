import { Component, input, output } from '@angular/core';
import { HorarioFuncionamento } from '../../../core/models';
import { AdminScheduleActiveBtnComponent } from './admin-schedule-active-btn.component';
import { AdminScheduleDeleteBtnComponent } from './admin-schedule-delete-btn.component';

@Component({
  selector: 'admin-schedule-day-card',
  standalone: true,
  imports: [
    AdminScheduleActiveBtnComponent,
    AdminScheduleDeleteBtnComponent
  ],
  template: `
    <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div class="flex items-center justify-between gap-3">
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">
            {{ diaNome() }}
            @if (!horario().ativo) {
              <span class="ml-2 text-xs text-gray-500"> (Inativo) </span>
            }
          </p>
          <p class="text-xs text-gray-600 mt-1">
            {{ horario().abertura }} - {{ horario().fechamento }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1.5 rounded hover:bg-blue-50"
            (click)="editar.emit()"
          >
            Editar
          </button>
          <admin-schedule-active-btn
            [ativo]="horario().ativo"
            (toggle)="toggleAtivo.emit()"
          />
          <admin-schedule-delete-btn (delete)="deletar.emit()" />
        </div>
      </div>
    </div>
  `,
})
export class AdminScheduleDayCardComponent {
  horario = input.required<HorarioFuncionamento>();
  diaNome = input.required<string>();
  toggleAtivo = output<void>();
  deletar = output<void>();
  editar = output<void>();
}
