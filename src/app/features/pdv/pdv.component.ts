import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, filter, tap, map } from 'rxjs';
import { toast } from 'ngx-sonner';

import { FuncionarioService } from '../../core/services/funcionario.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { LojaService } from '../../core/services/loja.service';
import { CartService } from '../../core/services/cart.service';
import { PedidoService } from '../../core/services/pedido.service';
import { AuthService } from '../../core/services/auth.service';

import { Produto, CategoriaProdutos, CreatePedidoRequest } from '../../core/models';
import { PdvItemModalComponent } from './pdv-item-modal.component';
import { UiButtonComponent, UiInputComponent } from '../../shared/components';
import { ContextMenuDirective } from '../../shared/directives/context-menu.directive';
import type { ContextMenuItem } from '../../core/services/context-menu.service';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PdvItemModalComponent, UiButtonComponent, UiInputComponent, ContextMenuDirective],
  templateUrl: './pdv.component.html',
})
export class PdvComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private funcionarioService = inject(FuncionarioService);
  private catalogoService = inject(CatalogoService);
  private lojaService = inject(LojaService);
  private cartService = inject(CartService);
  private pedidoService = inject(PedidoService);
  private auth = inject(AuthService);

  // --- Estado ---
  readonly loading = signal(true);
  readonly searchTerm = signal('');
  readonly categoriaSelecionada = signal<string | null>(null);
  readonly enviandoPedido = signal(false);

  // Novo fluxo de passos
  readonly pdvStep = signal<'inicio' | 'construcao' | 'identificacao' | 'finalizacao'>('inicio');
  readonly today = new Date();

  // Identificação do pedido PDV
  readonly numeroMesaPdv = signal('');
  readonly nomeRequerente = signal('');

  // --- Dados da Loja e Catálogo ---
  readonly _routeLojaUuid = toSignal<string | null>(
    this.route.paramMap.pipe(map(params => params.get('loja_uuid')))
  );

  readonly _funcionario = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const routeUuid = params.get('loja_uuid');
        // Se já temos a loja na rota (Admin) ou se não é funcionário, não chama /me
        if (routeUuid || !this.auth.isFuncionario()) {
          return of(null);
        }
        return this.funcionarioService.getMe().pipe(catchError(() => of(null)));
      })
    )
  );

  readonly lojaUuid = computed(() => this._routeLojaUuid() || this._funcionario()?.loja_uuid || null);

  readonly loja = toSignal(
    toObservable(this.lojaUuid).pipe(
      filter((uuid): uuid is string => !!uuid),
      switchMap(uuid => this.lojaService.buscarPorUuid(uuid).pipe(catchError(() => of(null))))
    )
  );

  readonly _categoriasRaw = toSignal(
    toObservable(this.lojaUuid).pipe(
      filter((uuid): uuid is string => !!uuid),
      switchMap(uuid => this.catalogoService.listarCategorias(uuid).pipe(catchError(() => of([]))))
    ),
    { initialValue: [] as CategoriaProdutos[] }
  );

  readonly categorias = computed(() => {
    const allCats = this._categoriasRaw();
    const allProds = this.produtos();
    return allCats.filter(cat => 
      allProds.some(p => p.categoria_uuid === cat.uuid)
    ).sort((a, b) => a.ordem - b.ordem);
  });

  readonly produtos = toSignal(
    toObservable(this.lojaUuid).pipe(
      filter((uuid): uuid is string => !!uuid),
      switchMap(uuid => this.catalogoService.listarProdutosPorLoja(uuid).pipe(
        tap(() => this.loading.set(false)),
        catchError(() => {
          this.loading.set(false);
          return of([]);
        })
      ))
    ),
    { initialValue: [] as Produto[] }
  );

  // --- Filtros ---
  readonly produtosFiltrados = computed(() => {
    let list = this.produtos();
    const search = this.searchTerm().toLowerCase().trim();
    const cat = this.categoriaSelecionada();

    if (search) {
      list = list.filter(p => p.nome.toLowerCase().includes(search));
    }

    if (cat) {
      list = list.filter(p => p.categoria_uuid === cat);
    }

    return list;
  });

  // --- Carrinho (Comanda) ---
  readonly itens = this.cartService.itens;
  readonly subtotal = this.cartService.subtotal;
  
  // Para controle de modal de customização de item
  readonly itemParaCustomizar = signal<{ produto: Produto, categoria: CategoriaProdutos } | null>(null);

  ngOnInit() {
    // Ao entrar no PDV, limpamos o carrinho se for de outra loja
    const lojaAtual = this.cartService.lojaAtual();
    const minhaLojaUuid = this.lojaUuid();
    if (lojaAtual && minhaLojaUuid && lojaAtual.uuid !== minhaLojaUuid) {
      this.cartService.limpar();
    }
  }

  iniciarPedido() {
    console.info('[OBSERVABILITY] PdvComponent - Starting new order');
    this.cartService.limpar();
    this.pdvStep.set('construcao');
  }

  selecionarCategoria(uuid: string | null) {
    console.debug(`[OBSERVABILITY] PdvComponent - Category selected: ${uuid}`);
    this.categoriaSelecionada.set(uuid);
  }

  adicionarAoCarrinho(produto: Produto) {
    console.info(`[OBSERVABILITY] PdvComponent - Adding product to PDV cart: ${produto.nome}`);
    const cat = this.categorias().find(c => c.uuid === produto.categoria_uuid);
    if (!cat) {
      console.warn(`[OBSERVABILITY] PdvComponent - Category not found for product: ${produto.nome} (Cat UUID: ${produto.categoria_uuid})`);
      return;
    }

    // Se for pizza_mode OU se não for drink_mode (para permitir adicionais), abrimos o modal.
    if (cat.pizza_mode || !cat.drink_mode) {
       console.debug(`[OBSERVABILITY] PdvComponent - Opening customization modal for product: ${produto.nome}`);
       this.itemParaCustomizar.set({ produto, categoria: cat });
       return;
    }

    // Bebidas e outros itens simples são adicionados diretamente
    console.debug(`[OBSERVABILITY] PdvComponent - Simple product, adding directly: ${produto.nome}`);
    this.cartService.incrementarProdutoSimples(produto, this.loja()!);
    toast.success(`${produto.nome} adicionado`);
  }

  onItemCustomizado(itemData: any) {
    console.info(`[OBSERVABILITY] PdvComponent - Item customized and added: ${itemData.partes[0]?.produto?.nome}`);
    this.cartService.adicionarComplexo({
      ...itemData,
      id: Date.now() // Gerar um ID temporário
    }, this.loja()!);
    
    this.itemParaCustomizar.set(null);
    toast.success('Item adicionado');
  }

  removerDoCarrinho(id: number) {
    console.info(`[OBSERVABILITY] PdvComponent - Removing item from cart. ID: ${id}`);
    this.cartService.removerItem(id);
  }

  itemMenuItems(id: number): ContextMenuItem[] {
    return [
      {
        icon: '🗑️',
        label: 'Remover da comanda',
        variant: 'danger',
        action: () => this.removerDoCarrinho(id),
      },
    ];
  }

  limparCarrinho() {
    console.info('[OBSERVABILITY] PdvComponent - Clearing cart');
    this.cartService.limpar();
    toast.info('Carrinho limpo');
  }

  avancarParaIdentificacao() {
    if (this.itens().length === 0) {
      console.warn('[OBSERVABILITY] PdvComponent - Attempted to advance with empty cart');
      toast.error('Carrinho vazio');
      return;
    }
    console.info('[OBSERVABILITY] PdvComponent - Advancing to identification step');
    this.numeroMesaPdv.set('');
    this.nomeRequerente.set('');
    this.pdvStep.set('identificacao');
  }

  avancarParaPagamento() {
    console.info('[OBSERVABILITY] PdvComponent - Advancing to payment step');
    this.pdvStep.set('finalizacao');
  }

  voltarParaConstrucao() {
    console.info('[OBSERVABILITY] PdvComponent - Returning to construction step');
    this.pdvStep.set('construcao');
  }

  voltarParaIdentificacao() {
    console.info('[OBSERVABILITY] PdvComponent - Returning to identification step');
    this.pdvStep.set('identificacao');
  }

  confirmarVenda(metodoPagamento: string) {
    const loja = this.loja();
    if (!loja) {
      console.error('[OBSERVABILITY] PdvComponent - Loja not loaded during sale confirmation');
      return;
    }

    console.info(`[OBSERVABILITY] PdvComponent - Confirming sale. Method: ${metodoPagamento}, Items: ${this.itens().length}`);
    this.enviandoPedido.set(true);

    const mesa = this.numeroMesaPdv().trim() || null;
    const requerente = this.nomeRequerente().trim() || null;

    const body: CreatePedidoRequest = {
      loja_uuid: loja.uuid,
      taxa_entrega: 0,
      forma_pagamento: metodoPagamento,
      observacoes: null,
      origem: 'pdv',
      numero_mesa: mesa,
      nome_requerente: requerente,
      itens: this.itens().map(item => ({
        quantidade: item.quantidade,
        partes: item.partes.map(p => ({
          produto_uuid: p.produto.uuid,
          posicao: p.posicao,
          adicionais: p.adicionais.map(a => a.uuid),
        })),
      })),
    };

    console.log('[PDV] criar pedido — payload:', JSON.stringify(body, null, 2));

    this.pedidoService.criar(body).subscribe({
      next: (res) => {
        console.info(`[OBSERVABILITY] PdvComponent - Sale confirmed. Order code: ${res.codigo}`);
        toast.success(`Venda #${res.codigo} realizada com sucesso!`);
        this.cartService.limpar();
        this.pdvStep.set('inicio');
        this.enviandoPedido.set(false);
      },
      error: (err) => {
        console.error('[OBSERVABILITY] PdvComponent - Failed to confirm sale', err);
        toast.error(err?.error?.error || 'Erro ao processar venda');
        this.enviandoPedido.set(false);
      }
    });
  }
}
