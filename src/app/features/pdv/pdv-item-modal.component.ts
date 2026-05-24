import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Produto, CategoriaProdutos, Adicional, Loja } from '../../core/models';
import { CartService, CartParte } from '../../core/services/cart.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ConfigPedidoService } from '../../core/services/config-pedido.service';
import { UiButtonComponent } from '../../shared/components';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-pdv-item-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, UiButtonComponent],
  template: `
    <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        (click)="fechar.emit()"
      ></div>

      <div
        class="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        style="max-height: 90vh"
      >
        <!-- Header -->
        <div
          class="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10"
        >
          <div>
            <h3 class="text-xl font-black text-gray-900">{{ produto.nome }}</h3>
            <p class="text-sm text-gray-500">
              {{ categoria.pizza_mode ? 'Monte sua pizza' : 'Personalize seu item' }}
            </p>
          </div>
          <ui-button
            variant="ghost"
            size="xs"
            (click)="fechar.emit()"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </ui-button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- SEÇÃO PIZZA: SABORES -->
          @if (categoria.pizza_mode) {
            <section>
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-bold text-gray-900">
                  Sabores ({{ pizzaPartes().length }}/{{ maxPartes() }})
                </h4>
                <span class="text-sm text-orange-600 font-bold"
                  >R$ {{ pizzaBuilderPreco() | number: '1.2-2' }}</span
                >
              </div>

              <div class="grid grid-cols-2 gap-3">
                @for (p of todosProdutosDaCategoria; track p.uuid) {
                  @let isSelected = isPizzaParteSelected(p.uuid);
                  @let isFull = !isSelected && pizzaPartes().length >= maxPartes();
                  <div
                    role="button"
                    tabindex="0"
                    (click)="!isFull && togglePizzaParte(p)"
                    (keydown.enter)="!isFull && togglePizzaParte(p)"
                    class="relative p-3 rounded-2xl border-2 text-left transition-all"
                    [class]="
                      isSelected
                        ? 'bg-orange-50 border-orange-500 cursor-pointer'
                        : isFull
                          ? 'border-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-white bg-gray-50 hover:border-gray-200 cursor-pointer'
                    "
                  >
                    <div class="font-bold text-xs truncate">{{ p.nome }}</div>
                    <div class="text-[10px] text-gray-500 mt-1">R$ {{ p.preco | number: '1.2-2' }}</div>

                    @if (isSelected) {
                      <span
                        class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold"
                      >
                        {{ getPizzaPartePosicao(p.uuid) }}
                      </span>
                    }
                  </div>
                }
              </div>
            </section>

            <!-- SEÇÃO PIZZA: ADICIONAIS POR PARTE -->
            @if (pizzaPartes().length > 0) {
              <section class="space-y-3">
                <h4 class="font-bold text-gray-900">Adicionais por sabor</h4>
                @for (parte of pizzaPartes(); track parte.produto.uuid; let i = $index) {
                  <div class="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                    <ui-button
                      variant="flat"
                      [fullWidth]="true"
                      (click)="
                        pizzaParteExpandida.set(
                          pizzaParteExpandida() === parte.produto.uuid ? null : parte.produto.uuid
                        )
                      "
                    >
                      <div class="flex items-center justify-between w-full">
                        <div class="flex items-center gap-2">
                          <span
                            class="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold"
                          >
                            {{ i + 1 }}
                          </span>
                          <span class="font-bold text-sm text-gray-700">{{ parte.produto.nome }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          @if ((pizzaAdicionaisPorProduto()[parte.produto.uuid]?.length ?? 0) > 0) {
                            <span
                              class="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold"
                            >
                              +{{ pizzaAdicionaisPorProduto()[parte.produto.uuid].length }}
                            </span>
                          }
                          <svg
                            class="w-4 h-4 text-gray-400 transition-transform"
                            [class.rotate-180]="pizzaParteExpandida() === parte.produto.uuid"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </ui-button>

                    @if (pizzaParteExpandida() === parte.produto.uuid) {
                      <div class="p-4 bg-white border-t border-gray-100">
                        <div class="flex flex-wrap gap-2">
                          @for (ad of adicionaisDisponiveis(); track ad.uuid) {
                            <ui-button
                              [variant]="
                                isAdicionalSelectedForParte(parte.produto.uuid, ad.uuid)
                                  ? 'primary'
                                  : 'secondary'
                              "
                              size="xs"
                              (click)="toggleAdicionalPizzaParte(parte.produto.uuid, ad)"
                              >{{ ad.nome }} (+R$ {{ ad.preco | number: '1.2-2' }})</ui-button
                            >
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </section>
            }
          } @else {
            <!-- SEÇÃO NORMAL: ADICIONAIS -->
            <section>
              <h4 class="font-bold text-gray-900 mb-4">Adicionais</h4>
              <div class="flex flex-wrap gap-2">
                @for (ad of adicionaisDisponiveis(); track ad.uuid) {
                  <ui-button
                    [variant]="isAdicionalSimplesSelected(ad.uuid) ? 'primary' : 'secondary'"
                    size="sm"
                    (click)="toggleAdicionalSimples(ad)"
                  >
                    <span class="flex flex-col items-start">
                      <span>{{ ad.nome }}</span>
                      <span class="text-[10px] opacity-60">+ R$ {{ ad.preco | number: '1.2-2' }}</span>
                    </span>
                  </ui-button>
                }
                @if (adicionaisDisponiveis().length === 0) {
                  <p class="text-sm text-gray-400 italic">
                    Nenhum adicional disponível para este item.
                  </p>
                }
              </div>
            </section>
          }
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div class="text-left">
            <div class="text-xs text-gray-500 uppercase font-black">Preço Total</div>
            <div class="text-2xl font-black text-gray-900">R$ {{ totalItem() | number: '1.2-2' }}</div>
          </div>

          <ui-button
            [disabled]="categoria.pizza_mode && pizzaPartes().length === 0"
            (click)="adicionar()"
          >
            Adicionar ao Pedido
          </ui-button>
        </div>
      </div>
    </div>
  `,
})
export class PdvItemModalComponent implements OnInit {
  @Input({ required: true }) produto!: Produto;
  @Input({ required: true }) categoria!: CategoriaProdutos;
  @Input({ required: true }) loja!: Loja;
  @Input({ required: true }) todosProdutosDaCategoria!: Produto[];
  @Output() fechar = new EventEmitter<void>();
  @Output() adicionarItem = new EventEmitter<any>();

  private cartService = inject(CartService);
  private catalogoService = inject(CatalogoService);
  private configService = inject(ConfigPedidoService);

  readonly adicionaisDisponiveis = signal<Adicional[]>([]);
  readonly maxPartes = signal(2);

  // Pizza states
  readonly pizzaPartes = signal<CartParte[]>([]);
  readonly pizzaAdicionaisPorProduto = signal<Record<string, Adicional[]>>({});
  readonly pizzaParteExpandida = signal<string | null>(null);

  // Normal states
  readonly adicionaisSelecionados = signal<Adicional[]>([]);

  ngOnInit() {
    this.catalogoService
      .listarAdicionaisDisponiveis(this.loja.uuid)
      .pipe(catchError(() => of([])))
      .subscribe((list) => this.adicionaisDisponiveis.set(list));

    this.configService
      .getConfigPedido(this.loja.uuid)
      .pipe(catchError(() => of(null)))
      .subscribe((cfg) => {
        if (cfg) this.maxPartes.set(cfg.max_partes);
      });

    // Se for pizza, já começa com o sabor clicado selecionado
    if (this.categoria.pizza_mode) {
      this.pizzaPartes.set([{ produto: this.produto, adicionais: [] }]);
    }
  }

  // --- Pizza Logic ---
  togglePizzaParte(p: Produto) {
    const partes = this.pizzaPartes();
    const idx = partes.findIndex((item) => item.produto.uuid === p.uuid);

    if (idx >= 0) {
      // Remove — preserve adicionais keyed by uuid
      const filtered = partes.filter((_, i) => i !== idx);
      this.pizzaPartes.set(filtered);
    } else if (partes.length < this.maxPartes()) {
      // Add
      this.pizzaPartes.set([...partes, { produto: p, adicionais: [] }]);
    }
  }

  isPizzaParteSelected(uuid: string) {
    return this.pizzaPartes().some((p) => p.produto.uuid === uuid);
  }

  getPizzaPartePosicao(uuid: string) {
    const idx = this.pizzaPartes().findIndex((p) => p.produto.uuid === uuid);
    return idx >= 0 ? idx + 1 : 0;
  }

  toggleAdicionalPizzaParte(produtoUuid: string, ad: Adicional) {
    this.pizzaAdicionaisPorProduto.update((map) => {
      const current = map[produtoUuid] ?? [];
      const idx = current.findIndex((a) => a.uuid === ad.uuid);
      return {
        ...map,
        [produtoUuid]: idx >= 0 ? current.filter((_, i) => i !== idx) : [...current, ad],
      };
    });
  }

  isAdicionalSelectedForParte(produtoUuid: string, uuid: string) {
    return (this.pizzaAdicionaisPorProduto()[produtoUuid] ?? []).some((a) => a.uuid === uuid);
  }

  pizzaBuilderPreco(): number {
    const partes = this.pizzaPartes();
    if (partes.length === 0) return 0;
    const precoBase = Math.max(...partes.map((p) => Number(p.produto.preco)));
    const adMap = this.pizzaAdicionaisPorProduto();
    const precoAdicionais = partes.reduce(
      (s, p) => s + (adMap[p.produto.uuid] ?? []).reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return precoBase + precoAdicionais;
  }

  // --- Normal Logic ---
  toggleAdicionalSimples(ad: Adicional) {
    this.adicionaisSelecionados.update(list => {
      const idx = list.findIndex(a => a.uuid === ad.uuid);
      return idx >= 0 ? list.filter((_, i) => i !== idx) : [...list, ad];
    });
  }

  isAdicionalSimplesSelected(uuid: string) {
    return this.adicionaisSelecionados().some(a => a.uuid === uuid);
  }

  // --- Global ---
  totalItem(): number {
    if (this.categoria.pizza_mode) return this.pizzaBuilderPreco();
    
    const precoBase = Number(this.produto.preco);
    const precoAdicionais = this.adicionaisSelecionados().reduce((s, a) => s + Number(a.preco), 0);
    return precoBase + precoAdicionais;
  }

  adicionar() {
    if (this.categoria.pizza_mode) {
      const partes = this.pizzaPartes();
      const adMap = this.pizzaAdicionaisPorProduto();

      const item = {
        categoria_uuid: this.categoria.uuid,
        partes: partes.map(p => ({
          produto: p.produto,
          adicionais: adMap[p.produto.uuid] ?? [],
        })),
        quantidade: 1,
      };
      this.adicionarItem.emit(item);
    } else {
      const item = {
        categoria_uuid: this.categoria.uuid,
        partes: [{
          produto: this.produto,
          adicionais: this.adicionaisSelecionados(),
        }],
        quantidade: 1,
      };
      this.adicionarItem.emit(item);
    }
  }
}
