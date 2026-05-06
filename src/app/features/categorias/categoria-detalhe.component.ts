import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';
import { CatalogoService } from '../../core/services/catalogo.service';
import { LojaService } from '../../core/services/loja.service';
import { HorarioService } from '../../core/services/horario.service';
import { CategoriaCobertura, Loja, Produto } from '../../core/models';
import { UiEmptyStateComponent, UiLojaAbertaComponent } from '../../shared/components';

const EMOJI_MAP: [string, string][] = [
  ['pizza', '🍕'],
  ['hambúrguer', '🍔'], ['hamburguer', '🍔'], ['burger', '🍔'],
  ['bebida', '🥤'],
  ['sushi', '🍣'],
  ['japonês', '🍱'], ['japonesa', '🍱'],
  ['taco', '🌮'], ['mexicano', '🌮'], ['mexicana', '🌮'],
  ['sorvete', '🍦'],
  ['salada', '🥗'],
  ['frango', '🍗'],
  ['lanche', '🥪'], ['sanduíche', '🥪'], ['sanduiche', '🥪'],
  ['açaí', '🫐'], ['acai', '🫐'],
  ['doce', '🍰'], ['bolo', '🎂'], ['sobremesa', '🍮'],
  ['massa', '🍝'], ['macarrão', '🍝'],
  ['carne', '🥩'], ['churrasco', '🥩'],
  ['peixe', '🐟'], ['frutos do mar', '🦞'],
  ['vegano', '🥦'], ['vegetariano', '🥗'],
  ['árabe', '🧆'], ['arabe', '🧆'],
  ['chinês', '🥡'],
  ['café', '☕'], ['cafe', '☕'],
  ['padaria', '🥐'], ['pão', '🍞'],
];

export function categoriaEmoji(nome: string): string {
  const lower = nome.toLowerCase();
  const found = EMOJI_MAP.find(([k]) => lower.includes(k));
  return found ? found[1] : '🍽️';
}

interface LojaComProdutos {
  loja:        Loja;
  produtos:    Produto[];
  abertaAgora: boolean;
}

interface PageData {
  nome:  string;
  emoji: string;
  lojas: LojaComProdutos[];
}

@Component({
  selector: 'app-categoria-detalhe',
  imports: [RouterLink, DecimalPipe, UiEmptyStateComponent, UiLojaAbertaComponent],
  templateUrl: './categoria-detalhe.component.html',
})
export class CategoriaDetalheComponent {
  private readonly route           = inject(ActivatedRoute);
  private readonly catalogoService = inject(CatalogoService);
  private readonly lojaService     = inject(LojaService);
  private readonly horarioService  = inject(HorarioService);

  readonly skeletons = Array(6);

  readonly data = toSignal<PageData | null>(
    this.route.paramMap.pipe(
      map(p => p.get('uuid')!),
      distinctUntilChanged(),
      switchMap(uuid => this.load(uuid)),
    ),
  );

  readonly loading  = computed(() => this.data() === undefined);
  readonly hasError = computed(() => this.data() === null);

  private load(uuid: string) {
    return combineLatest([
      this.catalogoService.listarCategoriasComCobertura().pipe(
        catchError(() => of([] as CategoriaCobertura[])),
      ),
      this.catalogoService.listarProdutosPorCategoriaGlobal(uuid),
    ]).pipe(
      switchMap(([categorias, response]) => {
        const categoria = categorias.find(c => c.uuid === uuid);
        const nome  = categoria?.nome ?? '';
        const emoji = categoriaEmoji(nome);

        if (!response.lojas.length) return of({ nome, emoji, lojas: [] } as PageData);

        return forkJoin(
          response.lojas.map(l =>
            forkJoin({
              loja:   this.lojaService.buscarPorUuid(l.uuid),
              status: this.horarioService.verificarStatus(l.uuid).pipe(catchError(() => of(null))),
            }).pipe(
              map(({ loja, status }) => ({
                loja,
                produtos:    l.produtos,
                abertaAgora: status?.aberta ?? false,
              }) as LojaComProdutos),
              catchError(() => of(null)),
            ),
          ),
        ).pipe(
          map(results => ({
            nome,
            emoji,
            lojas: results.filter((r): r is LojaComProdutos => r !== null),
          }) as PageData),
        );
      }),
      catchError(() => of(null)),
    );
  }
}
