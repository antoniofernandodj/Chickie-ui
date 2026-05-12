import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButtonComponent, UiTextareaComponent } from '../../shared/components';

@Component({
  selector: 'app-avaliacao-produto-form',
  standalone: true,
  imports: [FormsModule, UiButtonComponent, UiTextareaComponent],
  template: `
    <div class="space-y-4">
      <p class="text-sm font-semibold text-gray-900">{{ produto().nome }}</p>

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
        <p class="text-sm text-gray-600">{{ notaLabels[nota - 1] }}</p>
      }

      <ui-textarea
        [(ngModel)]="descricao"
        label="Sua opinião *"
        [rows]="3"
        placeholder="O que você achou deste produto?"
      />

      <ui-textarea
        [(ngModel)]="comentario"
        label="Comentário adicional (opcional):"
        [rows]="2"
        placeholder="Algum detalhe extra?"
      />

      <div class="flex justify-end gap-3 pt-2">
        <ui-button
          variant="secondary"
          (click)="pular.emit()"
          >Pular</ui-button
        >
        <ui-button
          [disabled]="nota === 0 || !descricao.trim() || loading()"
          [loading]="loading()"
          (click)="onSalvar()"
        >
          Avaliar
        </ui-button>
      </div>
    </div>
  `,
})
export class AvaliacaoProdutoFormComponent {
  produto = input.required<{ uuid: string; nome: string }>();
  loading = input<boolean>(false);

  nota = 0;
  descricao = '';
  comentario = '';

  notaLabels = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];

  salvar = output<{ produto_uuid: string; nota: number; descricao: string; comentario: string | null }>();
  pular = output<void>();

  onSalvar(): void {
    if (this.nota === 0 || !this.descricao.trim()) return;
    this.salvar.emit({
      produto_uuid: this.produto().uuid,
      nota: this.nota,
      descricao: this.descricao.trim(),
      comentario: this.comentario.trim() || null,
    });
  }
}
