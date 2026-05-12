import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButtonComponent, UiTextareaComponent } from '../../shared/components';

@Component({
  selector: 'app-avaliacao-loja-form',
  imports: [FormsModule, UiButtonComponent, UiTextareaComponent],
  template: `
    <div class="space-y-4">
      <div class="flex items-start justify-between">
        <h3 class="text-sm font-semibold text-gray-900">
          {{ avaliacaoExistente() ? 'Editar sua avaliação' : 'Sua nota:' }}
        </h3>
        @if (avaliacaoExistente()) {
          <ui-button
            variant="ghost"
            size="xs"
            (click)="cancelar.emit()"
            >Cancelar</ui-button
          >
        }
      </div>

      <!-- Seleção de Nota -->
      <div class="flex gap-1">
        @for (star of [1, 2, 3, 4, 5]; track star) {
          <div
            (click)="nota = star"
            (keydown.enter)="nota = star"
            role="button"
            tabindex="0"
            class="w-10 h-10 transition-transform hover:scale-110 cursor-pointer"
          >
            <svg
              class="w-10 h-10"
              [class]="star <= nota ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
          </div>
        }
      </div>

      @if (nota > 0) {
        <p class="text-sm text-gray-600">
          {{ notaLabels[nota - 1] }}
        </p>
      }

      <!-- Comentário -->
      <ui-textarea
        [(ngModel)]="comentario"
        label="Seu comentário (opcional):"
        [rows]="4"
        placeholder="Conte sua experiência com esta loja..."
      />

      <!-- Botão Salvar -->
      <div class="flex justify-end gap-3 pt-2">
        @if (avaliacaoExistente()) {
          <ui-button
            variant="secondary"
            (click)="cancelar.emit()"
            >Cancelar</ui-button
          >
        }
        <ui-button
          [disabled]="nota === 0 || loading()"
          [loading]="loading()"
          (click)="onSalvar()"
        >
          {{ avaliacaoExistente() ? 'Atualizar' : 'Salvar' }}
        </ui-button>
      </div>
    </div>
  `,
})
export class AvaliacaoLojaFormComponent {
  avaliacaoExistente = input<boolean>(false);
  loading = input<boolean>(false);

  nota = 0;
  comentario = '';

  notaLabels = [
    'Muito ruim',
    'Ruim',
    'Regular',
    'Bom',
    'Excelente',
  ];

  salvar = output<{ nota: number; comentario: string | null }>();
  cancelar = output<void>();

  onSalvar(): void {
    this.salvar.emit({ nota: this.nota, comentario: this.comentario || null });
  }
}
