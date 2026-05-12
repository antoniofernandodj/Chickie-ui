import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { LojaService } from '../../core/services/loja.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { PedidoLocalStorageService } from '../../core/services/pedido-local-storage.service';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, switchMap, Subject } from 'rxjs';
import { CategoriaCobertura } from '../../core/models';
import { FormsModule } from '@angular/forms';
import { UiEmptyStateComponent, UiModalComponent, UiButtonComponent, UiInputComponent } from '../../shared/components';
import { categoriaEmoji } from '../categorias/categoria-detalhe.component';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    DecimalPipe,
    FormsModule,
    UiEmptyStateComponent,
    UiModalComponent,
    UiButtonComponent,
    UiInputComponent
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private lojaService        = inject(LojaService);
  private catalogoService    = inject(CatalogoService);
  private pedidoLocalStorage = inject(PedidoLocalStorageService);

  readonly skeletons    = Array(8);
  readonly search       = signal('');
  readonly apenasAberta = signal(false);
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    console.info('[LOG-TEST] Home inicializada');
  }

  readonly lojas = toSignal(
    combineLatest([
      this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()),
      toObservable(this.apenasAberta),
    ]).pipe(
      switchMap(([termo, aberta]) => {
        this.search.set(termo);
        if (!termo.trim()) return of([]);
        return this.lojaService
          .pesquisar(termo, aberta ? true : undefined)
          .pipe(catchError(() => of([])));
      }),
    ),
    { initialValue: null }
  );

  readonly categorias = toSignal(
    this.catalogoService.listarCategoriasComCobertura().pipe(
      map(cats => cats.filter(c => c.tem_produto)),
      catchError(() => of([] as CategoriaCobertura[])),
    ),
    { initialValue: null }
  );

  readonly loading       = computed(() => this.search().trim() !== '' && this.lojas() === null);
  readonly pedidosLocais = computed(() => this.pedidoLocalStorage.pedidos());
  readonly confirmandoRemocao = signal<string | null>(null);

  getCategoriaEmoji(nome: string): string { return categoriaEmoji(nome); }

  onSearchInput(value: string) { this.searchSubject.next(value); }

  toggleApenasAberta(): void { this.apenasAberta.update(v => !v); }

  abrirConfirmacaoRemocao(uuid: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.confirmandoRemocao.set(uuid);
  }

  confirmarRemocao(): void {
    const uuid = this.confirmandoRemocao();
    if (uuid) this.pedidoLocalStorage.remover(uuid);
    this.confirmandoRemocao.set(null);
  }

  cancelarRemocao(): void {
    this.confirmandoRemocao.set(null);
  }
}
