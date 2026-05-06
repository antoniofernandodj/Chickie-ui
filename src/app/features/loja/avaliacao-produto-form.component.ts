import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-avaliacao-produto-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-4">
      <p class="text-sm font-semibold text-gray-900">{{ produto().nome }}</p>

      <div class="flex gap-1">
        @for (star of [1,2,3,4,5]; track star) {
          <button (click)="nota = star"
                  class="w-10 h-10 transition-transform hover:scale-110 focus:outline-none">
            <svg class="w-10 h-10"
                 [class]="star <= nota ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'"
                 viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
        }
      </div>

      @if (nota > 0) {
        <p class="text-sm text-gray-600">{{ notaLabels[nota - 1] }}</p>
      }

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Sua opinião <span class="text-red-400">*</span>
        </label>
        <textarea
          [(ngModel)]="descricao"
          rows="3"
          placeholder="O que você achou deste produto?"
          class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
                 resize-none"
        ></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Comentário adicional (opcional):
        </label>
        <textarea
          [(ngModel)]="comentario"
          rows="2"
          placeholder="Algum detalhe extra?"
          class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
                 resize-none"
        ></textarea>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <button (click)="pular.emit()"
                class="px-5 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50">
          Pular
        </button>
        <button (click)="onSalvar()"
                [disabled]="nota === 0 || !descricao.trim() || loading()"
                class="px-6 py-2.5 rounded-xl font-semibold text-sm text-white
                       disabled:opacity-50 disabled:cursor-not-allowed"
                style="background:var(--color-brand)">
          @if (loading()) {
            <span class="flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Salvando...
            </span>
          } @else {
            Avaliar
          }
        </button>
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
