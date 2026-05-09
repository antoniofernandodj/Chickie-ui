import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, filter, tap, map } from 'rxjs';
import { toast } from 'ngx-sonner';

import { FuncionarioService } from '../../core/services/funcionario.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { LojaService } from '../../core/services/loja.service';
import { CartService, CartItem, CartParte } from '../../core/services/cart.service';
import { PedidoService } from '../../core/services/pedido.service';
import { AuthService } from '../../core/services/auth.service';

import { Produto, CategoriaProdutos, Loja, Adicional, CreatePedidoRequest } from '../../core/models';
import { CriarPedidoModalComponent } from '../loja/criar-pedido-modal.component';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [CommonModule, FormsModule, CriarPedidoModalComponent],
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
  readonly mostrandoCheckout = signal(false);
  readonly enviandoPedido = signal(false);

  // --- Dados da Loja e Catálogo ---
  readonly _funcionario = toSignal(
    this.funcionarioService.getMe().pipe(catchError(() => of(null)))
  );

  readonly _routeLojaUuid = toSignal<string | null>(
    this.route.paramMap.pipe(map(params => params.get('loja_uuid')))
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
  
  // Para controle de modal de adicionais
  readonly produtoParaAdicionais = signal<Produto | null>(null);

  ngOnInit() {
    // Ao entrar no PDV, limpamos o carrinho se for de outra loja
    const lojaAtual = this.cartService.lojaAtual();
    const minhaLojaUuid = this.lojaUuid();
    if (lojaAtual && minhaLojaUuid && lojaAtual.uuid !== minhaLojaUuid) {
      this.cartService.limpar();
    }
  }

  selecionarCategoria(uuid: string | null) {
    this.categoriaSelecionada.set(uuid);
  }

  adicionarAoCarrinho(produto: Produto) {
    // Se o produto for de uma categoria que permite múltiplos sabores (pizza) 
    // ou se o usuário quiser adicionar customizações, abrimos o modal.
    // Para simplificar no PDV, se clicar direto, adicionamos o item simples.
    // Mas se a categoria for pizza_mode, PRECISA abrir o modal.
    
    const cat = this.categorias().find(c => c.uuid === produto.categoria_uuid);
    if (cat?.pizza_mode) {
       this.produtoParaAdicionais.set(produto);
       return;
    }

    this.cartService.incrementarProdutoSimples(produto, this.loja()!);
    toast.success(`${produto.nome} adicionado`);
  }

  removerDoCarrinho(id: number) {
    this.cartService.removerItem(id);
  }

  limparCarrinho() {
    this.cartService.limpar();
    toast.info('Carrinho limpo');
  }

  finalizarVenda() {
    if (this.itens().length === 0) {
      toast.error('Carrinho vazio');
      return;
    }
    this.mostrandoCheckout.set(true);
  }

  confirmarVenda(metodoPagamento: string) {
    const loja = this.loja();
    if (!loja) return;

    this.enviandoPedido.set(true);

    const body: CreatePedidoRequest = {
      loja_uuid: loja.uuid,
      taxa_entrega: 0, // PDV presencial geralmente não tem taxa de entrega
      forma_pagamento: metodoPagamento,
      observacoes: 'Venda PDV',
      itens: this.itens().map(item => ({
        quantidade: item.quantidade,
        partes: item.partes.map(p => ({
          produto_uuid: p.produto.uuid,
          posicao: p.posicao,
          adicionais: p.adicionais.map(a => ({ adicional_uuid: a.uuid }))
        }))
      })),
      endereco_entrega: {
        logradouro: 'Retirada no Balcão',
        numero: 'S/N',
        bairro: 'Centro',
        cidade: 'Loja',
        estado: 'ST',
        cep: '00000-000'
      }
    };

    this.pedidoService.criar(body).subscribe({
      next: (res) => {
        toast.success(`Venda #${res.codigo} realizada com sucesso!`);
        this.cartService.limpar();
        this.mostrandoCheckout.set(false);
        this.enviandoPedido.set(false);
      },
      error: (err) => {
        toast.error(err?.error?.error || 'Erro ao processar venda');
        this.enviandoPedido.set(false);
      }
    });
  }
}
