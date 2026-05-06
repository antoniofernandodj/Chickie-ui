import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { DecimalPipe, DatePipe } from '@angular/common';
import { switchMap, catchError, of, map, tap, distinctUntilChanged } from 'rxjs';
import { LojaService } from '../../core/services/loja.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { HorarioService } from '../../core/services/horario.service';
import { FavoritosService } from '../../core/services/favoritos.service';
import { MarketingService } from '../../core/services/marketing.service';
import { AuthService } from '../../core/services/auth.service';
import { Produto, CategoriaProdutos, HorarioFuncionamento, AvaliacaoDeLoja, AvaliarLojaRequest } from '../../core/models';
import { AvaliacaoLojaFormComponent } from './avaliacao-loja-form.component';
import { CriarPedidoModalComponent } from './criar-pedido-modal.component';
import { UiEmptyStateComponent, UiLojaAbertaComponent } from '../../shared/components';

@Component({
  selector: 'app-loja-detalhe',
  imports: [RouterLink, DecimalPipe, DatePipe, AvaliacaoLojaFormComponent, CriarPedidoModalComponent, UiEmptyStateComponent, UiLojaAbertaComponent],
  templateUrl: './loja-detalhe.component.html',
})
export class LojaDetalheComponent {
  private route = inject(ActivatedRoute);
  private lojaService = inject(LojaService);
  private catalogoService = inject(CatalogoService);
  private horarioService = inject(HorarioService);
  private favService = inject(FavoritosService);
  private marketingService = inject(MarketingService);
  readonly auth = inject(AuthService);

  readonly skeletons = Array(6);
  readonly favorita  = signal(false);
  readonly mostrandoModalPedido = signal(false);

  // ── Avaliação de Loja ──────────────────────────────────────────────────────
  readonly avaliacaoDoUsuario = signal<AvaliacaoDeLoja | null>(null);
  readonly avaliacaoLoading = signal(false);
  readonly mostrandoFormulario = signal(false);

  readonly loja = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug')!),
      switchMap((slug) =>
        this.lojaService.buscarPorSlug(slug).pipe(
          tap((loja) => {
            if (this.auth.isAuthenticated()) {
              this.favService.verificar(loja.uuid).subscribe({
                next: (res) => this.favorita.set(res.favorita ?? false),
                error: () => this.favorita.set(false),
              });

              // Carregar avaliação do usuário
              this.carregarAvaliacaoDoUsuario(loja.uuid);
            }
          }),
          catchError(() => of(null)),
        ),
      ),
    ),
  );

  readonly lojaLoading = computed(() => this.loja() === undefined);

  // Horários de funcionamento
  readonly _horarios = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug')!),
      switchMap((slug) =>
        this.lojaService.buscarPorSlug(slug).pipe(
          switchMap((loja) =>
            this.horarioService.listarPorLoja(loja.uuid).pipe(
              catchError(() => of([])),
            ),
          ),
          catchError(() => of([])),
        ),
      ),
    ),
  );

  readonly horarios = computed(() => this._horarios() ?? []);
  readonly diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Verificar se a loja está aberta agora via API (horário de Brasília delegado ao backend)
  readonly _lojaStatus = toSignal(
    toObservable(this.loja).pipe(
      distinctUntilChanged((a, b) => a?.uuid === b?.uuid),
      switchMap(loja =>
        loja
          ? this.horarioService.verificarStatus(loja.uuid).pipe(catchError(() => of(null)))
          : of(null)
      )
    )
  );

  readonly lojaAbertaAgora = computed(() => this._lojaStatus()?.aberta ?? false);

  // Catálogo: Categorias e Produtos
  readonly _categorias = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug')!),
      switchMap((slug) =>
        this.lojaService.buscarPorSlug(slug).pipe(
          switchMap((loja) =>
            this.catalogoService.listarCategorias(loja.uuid).pipe(
              catchError(() => of([])),
            ),
          ),
          catchError(() => of([])),
        ),
      ),
    ),
  );

  readonly categorias = computed(() => (this._categorias() ?? []).sort((a, b) => a.ordem - b.ordem));

  readonly _produtos = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug')!),
      switchMap((slug) =>
        this.lojaService.buscarPorSlug(slug).pipe(
          switchMap((loja) =>
            this.catalogoService.listarProdutosPorLoja(loja.uuid).pipe(
              catchError(() => of([])),
            ),
          ),
          catchError(() => of([])),
        ),
      ),
    ),
  );

  readonly produtosLoading = computed(() => this._produtos() === undefined);
  readonly produtos = computed(() => this._produtos() ?? []);
  readonly destaques = computed(() => this.produtos().filter((p) => p.destaque && p.disponivel));
  readonly disponiveis = computed(() => this.produtos().filter((p) => p.disponivel));

  // Agrupar produtos por categoria
  readonly produtosPorCategoria = computed(() => {
    const cats = this.categorias();
    const prods = this.produtos().filter((p) => p.disponivel);
    
    console.log('📊 Categorias:', cats);
    console.log('📦 Produtos disponíveis:', prods);
    
    const grouped = cats
      .map((cat) => {
        const catProds = prods.filter((p) => p.categoria_uuid === cat.uuid);
        console.log(`📂 Categoria ${cat.nome} (${cat.uuid}): ${catProds.length} produtos`, catProds);
        return {
          categoria: cat,
          produtos: catProds,
        };
      })
      .filter((group) => group.produtos.length > 0);
    
    console.log('📊 Grupos finais:', grouped);
    return grouped;
  });

  toggleFav() {
    const l = this.loja();
    if (!l) return;
    if (this.favorita()) {
      this.favService.remover(l.uuid)
        .subscribe(() => this.favorita.set(false));
    } else {
      this.favService.adicionar(l.uuid)
        .subscribe(() => this.favorita.set(true));
    }
  }

  abrirModalPedido(): void {
    this.mostrandoModalPedido.set(true);
  }

  fecharModalPedido(): void {
    this.mostrandoModalPedido.set(false);
  }

  selecionarProduto(_p: Produto): void {
    this.abrirModalPedido();
  }

  formatarDia(dia: number): string {
    return this.diasSemana[dia] || '';
  }

  // ── Avaliação de Loja ──────────────────────────────────────────────────────

  private carregarAvaliacaoDoUsuario(lojaUuid: string): void {
    // Verificar se o usuário já tem uma avaliação salva localmente
    const key = `avaliacao_loja_${lojaUuid}`;
    const avaliacaoLocal = localStorage.getItem(key);

    if (avaliacaoLocal) {
      try {
        const avaliacao: AvaliacaoDeLoja = JSON.parse(avaliacaoLocal);
        // Buscar a avaliação atualizada por UUID
        this.marketingService.buscarAvaliacaoLoja(avaliacao.uuid).subscribe({
          next: (avaliacao) => {
            this.avaliacaoDoUsuario.set(avaliacao);
          },
          error: () => {
            // Se não encontrou, limpar localStorage
            localStorage.removeItem(key);
            this.avaliacaoDoUsuario.set(null);
          },
        });
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
  }

  salvarAvaliacao(nota: number, comentario: string | null): void {
    const loja = this.loja();
    if (!loja) return;

    this.avaliacaoLoading.set(true);

    const body: AvaliarLojaRequest = { nota, comentario };

    this.marketingService
      .upsertAvaliacaoLoja(loja.uuid, body, this.avaliacaoDoUsuario() ?? undefined)
      .subscribe({
        next: (avaliacao) => {
          this.avaliacaoDoUsuario.set(avaliacao);
          this.avaliacaoLoading.set(false);
          this.mostrandoFormulario.set(false);

          // Salvar no localStorage para recuperação futura
          const key = `avaliacao_loja_${loja.uuid}`;
          localStorage.setItem(key, JSON.stringify({ uuid: avaliacao.uuid }));
        },
        error: (err) => {
          console.error('Erro ao salvar avaliação:', err);
          this.avaliacaoLoading.set(false);
        },
      });
  }

  abrirFormularioAvaliacao(): void {
    this.mostrandoFormulario.set(true);
  }

  fecharFormularioAvaliacao(): void {
    this.mostrandoFormulario.set(false);
  }

  // Helper para converter nota (pode ser string ou number)
  toNumber(value: number | string): number {
    return typeof value === 'string' ? parseFloat(value) : value;
  }
}
