import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'admin-rating-distribution',
  standalone: true,
  template: `
    @for (nota of [5, 4, 3, 2, 1]; track nota) {
      <div class="flex items-center gap-3 mb-2">
        <span class="text-sm text-gray-600 w-10 font-medium">{{ nota }} ★</span>
        <div class="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            class="bg-yellow-400 h-full rounded-full transition-all"
            [style.width]="pct(nota) + '%'"
          ></div>
        </div>
        <span class="text-sm text-gray-500 w-8 text-right font-medium">{{
          distribuicao()[nota - 1]
        }}</span>
      </div>
    }
  `,
})
export class AdminRatingDistributionComponent {
  distribuicao = input.required<number[]>();
  total        = input.required<number>();

  pct(nota: number): number {
    return this.total() > 0 ? (this.distribuicao()[nota - 1] / this.total()) * 100 : 0;
  }
}
