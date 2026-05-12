import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Produto } from '../../../core/models';
import { AdminToggleAvailableBtnComponent } from './admin-toggle-available-btn.component';
import { AdminEditBtnComponent } from './admin-edit-btn.component';
import { AdminRemoveBtnComponent } from './admin-remove-btn.component';

@Component({
  selector: 'admin-product-card',
  standalone: true,
  imports: [DecimalPipe, AdminToggleAvailableBtnComponent, AdminEditBtnComponent, AdminRemoveBtnComponent],
  template: `
    <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group">
      @if (produto().imagem_url) {
        <img
          [src]="produto().imagem_url"
          class="w-10 h-10 rounded-lg object-cover shrink-0"
        />
      } @else {
        <div
          class="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 shrink-0"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      }
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">
          {{ produto().nome }}
          @if (produto().destaque) {
            <span class="ml-1 text-xs"> ⭐ </span>
          }
        </p>
        @if (produto().descricao) {
          <p class="text-xs text-gray-500 truncate">{{ produto().descricao }}</p>
        }
      </div>
      <div class="text-right shrink-0 ml-2">
        <p class="text-sm font-semibold text-gray-900">R$ {{ produto().preco | number: '1.2-2' }}</p>
        <p class="text-xs text-gray-400">{{ produto().tempo_preparo_min }} min</p>
      </div>
      <div class="shrink-0">
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          [class.bg-green-100]="produto().disponivel"
          [class.text-green-700]="produto().disponivel"
          [class.bg-red-100]="!produto().disponivel"
          [class.text-red-700]="!produto().disponivel"
        >
          {{ produto().disponivel ? 'Disponível' : 'Indisponível' }}
        </span>
      </div>
      <div class="flex gap-1 shrink-0 ml-2">
        <admin-toggle-available-btn
          [available]="produto().disponivel"
          (toggle)="toggleDisponivel.emit()"
        />
        <admin-edit-btn (edit)="editar.emit()" />
        <admin-remove-btn (remove)="remover.emit()" />
      </div>
    </div>
  `,
})
export class AdminProductCardComponent {
  produto = input.required<Produto>();
  toggleDisponivel = output<void>();
  editar = output<void>();
  remover = output<void>();
}
