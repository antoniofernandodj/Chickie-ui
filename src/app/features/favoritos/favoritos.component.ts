import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { switchMap, catchError, of, forkJoin } from 'rxjs';
import { FavoritosService } from '../../core/services/favoritos.service';
import { LojaService } from '../../core/services/loja.service';
import { Loja } from '../../core/models';
import { UiEmptyStateComponent, UiSkeletonComponent, UiButtonComponent } from '../../shared/components';

@Component({
  selector: 'app-favoritos',
  imports: [
    RouterLink,
    DecimalPipe,
    UiEmptyStateComponent,
    UiSkeletonComponent,
    UiButtonComponent
  ],
  templateUrl: './favoritos.component.html',
})
export class FavoritosComponent {
  private favService  = inject(FavoritosService);
  private lojaService = inject(LojaService);

  private readonly _data = toSignal(
    this.favService.listarMinhas().pipe(
      switchMap((favs) => {
        if (favs.length === 0) return of([] as Loja[]);
        return forkJoin(
          favs.map((f) =>
            this.lojaService.buscarPorUuid(f.loja_uuid).pipe(catchError(() => of(null))),
          ),
        ).pipe(
          switchMap((lojas) => of(lojas.filter((l): l is Loja => l !== null))),
        );
      }),
      catchError(() => of([] as Loja[])),
    ),
    { initialValue: [] as Loja[] },
  );

  readonly loading = computed(() => this._data() === undefined);
  readonly favoritas = computed(() => this._data() ?? []);

  remover(lojaUuid: string) {
    this.favService.remover(lojaUuid).subscribe({
      next: () => {
        // Trigger re-fetch by re-subscribing: simplest approach
        // Since we use toSignal with initialValue, we need a refresh mechanism
        location.reload();
      },
    });
  }
}
