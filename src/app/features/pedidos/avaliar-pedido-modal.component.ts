import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Pedido } from '../../core/models';
import { MarketingService } from '../../core/services/marketing.service';
import { UiModalComponent, UiButtonComponent } from '../../shared/components';
import { AvaliacaoLojaFormComponent } from '../loja/avaliacao-loja-form.component';
import { AvaliacaoProdutoFormComponent } from '../loja/avaliacao-produto-form.component';

type Step = 'loja' | 'produtos' | 'concluido';

@Component({
  selector: 'app-avaliar-pedido-modal',
  standalone: true,
  imports: [UiModalComponent, UiButtonComponent, AvaliacaoLojaFormComponent, AvaliacaoProdutoFormComponent],
  template: `
    <ui-modal [title]="modalTitle()" size="md" (close)="fechar.emit()">
      <div class="p-5">
        @switch (step()) {
          @case ('loja') {
            <p class="text-sm text-gray-500 mb-5">
              Seu pedido foi entregue! Como foi a experiência com a loja?
            </p>
            <app-avaliacao-loja-form
              [loading]="loadingLoja()"
              (salvar)="onAvaliarLoja($event)"
            />
            <ui-button variant="ghost" [fullWidth]="true" class="mt-3 block" (click)="onPularLoja()">
              Pular avaliação da loja
            </ui-button>
          }
          @case ('produtos') {
            @if (produtoAtual(); as produto) {
              <p class="text-xs text-gray-400 mb-4">
                Produto {{ produtoIndex() + 1 }} de {{ totalProdutos() }}
              </p>
              @for (p of [produto]; track p.uuid) {
                <app-avaliacao-produto-form
                  [produto]="p"
                  [loading]="loadingProduto()"
                  (salvar)="onAvaliarProduto($event)"
                  (pular)="onPularProduto()"
                />
              }
            }
          }
          @case ('concluido') {
            <div class="text-center py-6">
              <div class="text-5xl mb-4">⭐</div>
              <h3 class="text-lg font-bold text-gray-900 mb-2">Obrigado pela avaliação!</h3>
              <p class="text-sm text-gray-500 mb-6">
                Sua opinião ajuda outros clientes e melhora nosso serviço.
              </p>
              <ui-button size="lg" (click)="fechar.emit()">Fechar</ui-button>
            </div>
          }
        }
      </div>
    </ui-modal>
  `,
})
export class AvaliarPedidoModalComponent {
  pedido = input.required<Pedido>();
  fechar = output<void>();

  private marketingService = inject(MarketingService);

  readonly step           = signal<Step>('loja');
  readonly loadingLoja    = signal(false);
  readonly loadingProduto = signal(false);
  readonly produtoIndex   = signal(0);

  readonly produtosUnicos = computed(() => {
    const map = new Map<string, { uuid: string; nome: string }>();
    for (const item of this.pedido().itens) {
      for (const parte of item.partes) {
        if (!map.has(parte.produto_uuid)) {
          map.set(parte.produto_uuid, { uuid: parte.produto_uuid, nome: parte.produto_nome });
        }
      }
    }
    return [...map.values()];
  });

  readonly produtoAtual  = computed(() => this.produtosUnicos()[this.produtoIndex()] ?? null);
  readonly totalProdutos = computed(() => this.produtosUnicos().length);

  readonly modalTitle = computed(() => {
    switch (this.step()) {
      case 'loja':      return 'Avalie a loja';
      case 'produtos':  return 'Avalie os produtos';
      case 'concluido': return 'Avaliação enviada';
    }
  });

  onAvaliarLoja(dados: { nota: number; comentario: string | null }): void {
    this.loadingLoja.set(true);
    this.marketingService.avaliarLoja(this.pedido().loja_uuid, dados).subscribe({
      next:  () => { this.loadingLoja.set(false); this.irParaProdutos(); },
      error: () => { this.loadingLoja.set(false); this.irParaProdutos(); },
    });
  }

  onPularLoja(): void { this.irParaProdutos(); }

  private irParaProdutos(): void {
    if (this.produtosUnicos().length === 0) {
      this.step.set('concluido');
    } else {
      this.produtoIndex.set(0);
      this.step.set('produtos');
    }
  }

  onAvaliarProduto(dados: { produto_uuid: string; nota: number; descricao: string; comentario: string | null }): void {
    this.loadingProduto.set(true);
    this.marketingService.avaliarProduto(this.pedido().loja_uuid, dados).subscribe({
      next:  () => { this.loadingProduto.set(false); this.avancarProduto(); },
      error: () => { this.loadingProduto.set(false); this.avancarProduto(); },
    });
  }

  onPularProduto(): void { this.avancarProduto(); }

  private avancarProduto(): void {
    if (this.produtoIndex() + 1 >= this.totalProdutos()) {
      this.step.set('concluido');
    } else {
      this.produtoIndex.update(i => i + 1);
    }
  }
}
