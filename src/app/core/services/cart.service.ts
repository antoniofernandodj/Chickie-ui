import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Loja, Produto, Adicional, Pedido, SelecaoOpcaoRequest } from '../models';

export interface CartParte {
  produto:    Produto;
  adicionais: Adicional[];
  montagem?:  { selecoes: SelecaoOpcaoRequest[] } | null;
}

export interface CartItem {
  id:             number;
  categoria_uuid: string;
  partes:         CartParte[];
  quantidade:     number;
}

const KEY = 'chickie_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly lojaAtual  = signal<Loja | null>(null);
  readonly itens      = signal<CartItem[]>([]);
  readonly mesa       = signal<string | null>(null);
  readonly drawerOpen = signal(false);

  readonly subtotal = computed(() =>
    this.itens().reduce((total, item) => {
      const base   = Math.max(...item.partes.map(p => Number(p.produto.preco)));
      const extras = item.partes.reduce(
        (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
      );
      return total + (base + extras) * item.quantidade;
    }, 0),
  );

  readonly totalItens = computed(() =>
    this.itens().reduce((s, i) => s + i.quantidade, 0),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) this._load();
  }

  sincronizar(loja: Loja, itens: CartItem[]): void {
    this.lojaAtual.set(loja);
    this.itens.set([...itens]);
    this._save();
  }

  incrementarProdutoSimples(produto: Produto, loja: Loja): void {
    console.info(`[OBSERVABILITY] CartService - Adding simple product: ${produto.nome} (UUID: ${produto.uuid}) from loja: ${loja.nome}`);
    // Se mudar de loja, limpa o carrinho
    const atual = this.lojaAtual();
    if (atual && atual.uuid !== loja.uuid) {
      console.warn(`[OBSERVABILITY] CartService - Loja changed (from ${atual.uuid} to ${loja.uuid}). Clearing cart.`);
      this.limpar();
    }
    
    this.lojaAtual.set(loja);
    
    const existing = this.itens().find(
      (i) => i.partes.length === 1 && i.partes[0].produto.uuid === produto.uuid && i.partes[0].adicionais.length === 0,
    );
    
    if (existing) {
      console.debug(`[OBSERVABILITY] CartService - Product already in cart. Incrementing quantity for item ID: ${existing.id}`);
      this.incrementar(existing.id);
    } else {
      console.debug('[OBSERVABILITY] CartService - New product for cart. Adding item.');
      this.itens.update((c) => [
        ...c,
        {
          id: Date.now(),
          categoria_uuid: produto.categoria_uuid,
          partes: [{ produto, adicionais: [] }],
          quantidade: 1,
        },
      ]);
      this._save();
    }
  }

  adicionarComplexo(item: CartItem, loja: Loja): void {
    console.info(`[OBSERVABILITY] CartService - Adding complex item. Main product: ${item.partes[0]?.produto?.nome} from loja: ${loja.nome}`);
    const atual = this.lojaAtual();
    if (atual && atual.uuid !== loja.uuid) {
      console.warn(`[OBSERVABILITY] CartService - Loja changed (from ${atual.uuid} to ${loja.uuid}). Clearing cart.`);
      this.limpar();
    }
    this.lojaAtual.set(loja);
    this.itens.update((c) => [...c, item]);
    this._save();
  }

  incrementar(id: number): void {
    console.debug(`[OBSERVABILITY] CartService - Incrementing item ID: ${id}`);
    this.itens.update(c =>
      c.map(i => i.id === id ? { ...i, quantidade: i.quantidade + 1 } : i),
    );
    this._save();
  }

  decrementar(id: number): void {
    console.debug(`[OBSERVABILITY] CartService - Decrementing item ID: ${id}`);
    this.itens.update(c => {
      const item = c.find(i => i.id === id);
      if (!item) return c;
      return item.quantidade <= 1
        ? c.filter(i => i.id !== id)
        : c.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i);
    });
    this._save();
  }

  removerItem(id: number): void {
    console.info(`[OBSERVABILITY] CartService - Removing item ID: ${id}`);
    this.itens.update(c => c.filter(i => i.id !== id));
    this._save();
  }

  definirMesa(numero: string | null): void {
    this.mesa.set(numero);
    this._save();
  }

  limpar(): void {
    console.info('[OBSERVABILITY] CartService - Clearing entire cart.');
    this.lojaAtual.set(null);
    this.itens.set([]);
    this.mesa.set(null);
    if (isPlatformBrowser(this.platformId)) localStorage.removeItem(KEY);
  }

  carregarDePedido(
    pedido: Pedido,
    loja: Loja,
    produtos: Produto[],
    adicionaisDisponiveis: Adicional[],
  ): { carregados: number; ignorados: string[] } {
    const produtoMap = new Map(produtos.filter(p => p.disponivel).map(p => [p.uuid, p]));
    const adicionalMap = new Map(
      adicionaisDisponiveis.map(a => [a.nome.toLowerCase().trim(), a]),
    );

    let nextId = Date.now();
    const cartItems: CartItem[] = [];
    const ignorados: string[] = [];

    for (const item of pedido.itens) {
      const partes: CartParte[] = [];

      for (const parte of item.partes) {
        const produto = produtoMap.get(parte.produto_uuid);
        if (!produto) {
          ignorados.push(parte.produto_nome);
          continue;
        }
        const adicionais = parte.adicionais
          .map(a => adicionalMap.get(a.nome.toLowerCase().trim()))
          .filter((a): a is Adicional => a !== undefined);

        partes.push({ produto, adicionais });
      }

      if (partes.length > 0) {
        cartItems.push({
          id: nextId++,
          categoria_uuid: partes[0].produto.categoria_uuid,
          partes,
          quantidade: item.quantidade,
        });
      }
    }

    if (cartItems.length > 0) {
      this.sincronizar(loja, cartItems);
    }

    return { carregados: cartItems.length, ignorados };
  }

  openDrawer()  { this.drawerOpen.set(true); }
  closeDrawer() { this.drawerOpen.set(false); }
  toggleDrawer(){ this.drawerOpen.update(v => !v); }

  private _save(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const loja  = this.lojaAtual();
    const itens = this.itens();
    const mesa  = this.mesa();
    if (!loja || itens.length === 0) { localStorage.removeItem(KEY); return; }
    localStorage.setItem(KEY, JSON.stringify({ loja, itens, mesa }));
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const { loja, itens, mesa } = JSON.parse(raw);
      this.lojaAtual.set(loja);
      this.itens.set(itens);
      if (mesa) this.mesa.set(mesa);
    } catch {
      localStorage.removeItem(KEY);
    }
  }
}
