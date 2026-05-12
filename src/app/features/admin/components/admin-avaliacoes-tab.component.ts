import { Component, inject, input, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminRatingDistributionComponent } from './admin-rating-distribution.component';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MarketingService } from '../../../core/services/marketing.service';
import { LojaService } from '../../../core/services/loja.service';
import { AvaliacaoDeLoja } from '../../../core/models';

@Component({
  selector: 'admin-avaliacoes-tab',
  standalone: true,
  imports: [DatePipe, AdminRatingDistributionComponent],
  template: `
    <!-- Resumo da Nota Média -->
    @if (avaliacoesLoading()) {
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 skeleton h-40"></div>
    } @else if (notaMedia() !== null) {
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h3 class="text-base font-semibold text-gray-900 mb-4">📊 Resumo das Avaliações</h3>
        <div class="flex items-start gap-8">
          <div class="text-center">
            <div
              class="text-5xl font-bold"
              style="color: var(--color-brand)"
            >
              {{ notaMedia() }}
            </div>
            <div class="flex gap-0.5 mt-2 justify-center">
              @for (star of [1, 2, 3, 4, 5]; track star) {
                <svg
                  class="w-6 h-6"
                  [class]="
                    star <= toNumber(notaMedia() ?? 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  "
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                  />
                </svg>
              }
            </div>
            <div class="text-sm text-gray-500 mt-1">{{ avaliacoes().length }} avaliação(ões)</div>
          </div>

          <!-- Distribuição de Notas -->
          @if (distribuicaoNotas()) {
            <admin-rating-distribution
              [distribuicao]="distribuicaoNotas()!"
              [total]="avaliacoes().length"
            />
          }
        </div>
      </div>
    } @else {
      <div class="text-center py-10 bg-white rounded-2xl border border-gray-100 mb-8">
        <div class="text-4xl mb-2">⭐</div>
        <p class="text-gray-500 text-sm">Nenhuma avaliação cadastrada para esta loja.</p>
      </div>
    }

    <!-- Lista de Avaliações -->
    @if (avaliacoes().length > 0) {
      <h3 class="text-base font-semibold text-gray-900 mb-4">💬 Todas as Avaliações</h3>
      <div class="space-y-4">
        @for (avaliacao of avaliacoes(); track avaliacao.uuid) {
          <div
            class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start gap-4 mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <div>
                    <span class="text-sm font-medium text-gray-900">
                      {{ avaliacao.usuario_nome || 'Usuário não informado' }}
                    </span>
                    @if (avaliacao.usuario_email) {
                      <span class="text-xs text-gray-500 ml-2"> ({{ avaliacao.usuario_email }}) </span>
                    }
                  </div>
                  <span class="text-xs text-gray-400">
                    {{ avaliacao.criado_em | date: 'dd/MM/yyyy HH:mm' }}
                  </span>
                </div>
                <div class="flex gap-0.5">
                  @for (star of [1, 2, 3, 4, 5]; track star) {
                    <svg
                      class="w-4 h-4"
                      [class]="
                        star <= toNumber(avaliacao.nota)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-gray-200 text-gray-200'
                      "
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                      />
                    </svg>
                  }
                  <span class="text-sm font-semibold text-gray-700 ml-1">
                    {{ avaliacao.nota }}
                  </span>
                </div>
              </div>
            </div>

            @if (avaliacao.comentario) {
              <p class="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4">
                {{ avaliacao.comentario }}
              </p>
            }
          </div>
        }
      </div>
    }
  `,
})
export class AdminAvaliacoesTabComponent {
  lojaUuid = input.required<string>();

  private marketingService = inject(MarketingService);
  private lojaService = inject(LojaService);

  private readonly refreshAvaliacoesTrigger = new BehaviorSubject<void>(undefined);

  private readonly _avaliacoes = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshAvaliacoesTrigger]).pipe(
      switchMap(([uuid]) =>
        this.marketingService.listarAvaliacoesLoja(uuid).pipe(catchError(() => of([] as AvaliacaoDeLoja[]))),
      ),
    ),
    { initialValue: [] as AvaliacaoDeLoja[] },
  );
  readonly avaliacoesLoading = computed(() => this._avaliacoes() === undefined);
  readonly avaliacoes = computed(() => this._avaliacoes() ?? []);

  private readonly _notaMedia = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshAvaliacoesTrigger]).pipe(
      switchMap(([uuid]) =>
        this.lojaService.buscarNotaMedia(uuid).pipe(
          map(r => r.nota_media),
          catchError(() => of(null as number | null)),
        ),
      ),
    ),
    { initialValue: null as number | null },
  );
  readonly notaMedia = computed(() => this._notaMedia());

  readonly distribuicaoNotas = computed(() => {
    const avaliacoes = this.avaliacoes();
    if (!avaliacoes || avaliacoes.length === 0) return null;
    const distribuicao = [0, 0, 0, 0, 0];
    avaliacoes.forEach((a) => {
      const nota = Math.round(this.toNumber(a.nota));
      const idx = nota - 1;
      if (idx >= 0 && idx < 5) distribuicao[idx]++;
    });
    return distribuicao;
  });

  constructor() {
    this.refreshAvaliacoesTrigger.next();
  }

  toNumber(value: number | string): number {
    return typeof value === 'string' ? parseFloat(value) : value;
  }
}
