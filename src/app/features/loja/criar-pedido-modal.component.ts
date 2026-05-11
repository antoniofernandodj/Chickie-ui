import {
  Component,
  inject,
  signal,
  computed,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { formatPhone } from '../../core/utils/phone-utils';
import { formatCpf, validarCpf } from '../../core/utils/cpf-utils';
import { catchError, of, Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import {
  Loja,
  Produto,
  Adicional,
  CategoriaProdutos,
  EnderecoUsuario,
  Cupom,
  Pedido,
  CreatePedidoRequest,
  CreatePagamentoResponse,
  EnderecoFormValue,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService, CartItem, CartParte } from '../../core/services/cart.service';
import { PedidoService } from '../../core/services/pedido.service';
import { PedidoLocalStorageService } from '../../core/services/pedido-local-storage.service';
import { PagamentoService } from '../../core/services/pagamento.service';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { EnderecoUsuarioService } from '../../core/services/endereco-usuario.service';
import { GuestEnderecoService, EnderecoGuestSalvo } from '../../core/services/guest-endereco.service';
import { ConfigPedidoService } from '../../core/services/config-pedido.service';
import { MarketingService } from '../../core/services/marketing.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { EnderecoFormComponent, UiButtonComponent, UiInputComponent, UiTextareaComponent } from '../../shared/components';

// ─── Local types ──────────────────────────────────────────────────────────────

interface CategoriaStep {
  tipo:     'categoria';
  categoria: CategoriaProdutos;
  produtos:  Produto[];
}

interface FixedStep {
  tipo: 'endereco' | 'pagamento' | 'resumo';
}

type Step = CategoriaStep | FixedStep;

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-criar-pedido-modal',
  imports: [FormsModule, DecimalPipe, EnderecoFormComponent, UiButtonComponent, UiInputComponent, UiTextareaComponent],
  templateUrl: './criar-pedido-modal.component.html',
})
export class CriarPedidoModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) loja!: Loja;
  @Input({ required: true }) produtos!: Produto[];
  @Input({ required: true }) categorias!: CategoriaProdutos[];
  @Output() fechar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private cartService = inject(CartService);
  private pedidoService = inject(PedidoService);
  private pedidoLocalStorage = inject(PedidoLocalStorageService);
  private pagamentoService = inject(PagamentoService);
  private pedidosLive = inject(PedidosLiveService);
  private enderecoService = inject(EnderecoUsuarioService);
  private guestEnderecoService = inject(GuestEnderecoService);
  private configService = inject(ConfigPedidoService);
  private marketingService = inject(MarketingService);
  private catalogoService = inject(CatalogoService);
  private router = inject(Router);

  // ── Steps ──────────────────────────────────────────────────────────────────
  steps: Step[] = [];

  readonly currentStepIndex = signal(0);

  get currentStep(): Step {
    return this.steps[this.currentStepIndex()];
  }

  get currentCategoriaStep(): CategoriaStep | null {
    const s = this.currentStep;
    return s?.tipo === 'categoria' ? (s as CategoriaStep) : null;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex() === this.steps.length - 1;
  }

  get stepTitle(): string {
    const s = this.currentStep;
    if (!s) return '';
    if (s.tipo === 'categoria') return (s as CategoriaStep).categoria.nome;
    if (s.tipo === 'endereco') return 'Endereço de Entrega';
    if (s.tipo === 'pagamento') return 'Pagamento';
    return 'Resumo do Pedido';
  }

  get stepSubtitle(): string {
    const s = this.currentStep;
    if (!s) return '';
    if (s.tipo === 'categoria') {
      const cs = s as CategoriaStep;
      if (cs.categoria.drink_mode) return `${cs.produtos.length} ${cs.produtos.length === 1 ? 'bebida disponível' : 'bebidas disponíveis'}`;
      return cs.categoria.pizza_mode
        ? `Até ${this.maxPartes()} sabores por pizza`
        : `${cs.produtos.length} ${cs.produtos.length === 1 ? 'item disponível' : 'itens disponíveis'}`;
    }
    if (s.tipo === 'endereco') return 'Onde você quer receber?';
    if (s.tipo === 'pagamento') return 'Como você vai pagar?';
    return 'Confira antes de confirmar';
  }

  get stepNumber(): string {
    return `Passo ${this.currentStepIndex() + 1} de ${this.steps.length}`;
  }

  // ── Config ──────────────────────────────────────────────────────────────────
  readonly maxPartes = signal(2);

  // ── Cart ────────────────────────────────────────────────────────────────────
  readonly cart = signal<CartItem[]>([]);
  private nextId = 0;

  readonly cartItemCount = computed(() =>
    this.cart().reduce((s, i) => s + i.quantidade, 0),
  );

  get cartItemsForCurrentCategory(): CartItem[] {
    const s = this.currentCategoriaStep;
    if (!s) return [];
    return this.cart().filter((i) => i.categoria_uuid === s.categoria.uuid);
  }

  // ── Adicionais ──────────────────────────────────────────────────────────────
  readonly adicionaisDisponiveis = signal<Adicional[]>([]);

  // Pizza: adicionais por posicao da parte (chave: posicao)
  readonly pizzaAdicionaisPorPosicao = signal<Record<number, Adicional[]>>({});
  // Pizza: qual parte está com painel de adicionais aberto
  readonly pizzaParteExpandida = signal<number | null>(null);

  // Não-pizza: qual item do cart está com painel de adicionais aberto
  readonly itemExpandidoId = signal<number | null>(null);

  // ── Pizza builder ───────────────────────────────────────────────────────────
  readonly pizzaPartes = signal<CartParte[]>([]);

  // ── Endereço ────────────────────────────────────────────────────────────────
  readonly enderecosUsuario = signal<EnderecoUsuario[]>([]);
  readonly enderecosGuestSalvos = signal<EnderecoGuestSalvo[]>([]);
  enderecoSelecionadoUuid: string | null = null;
  enderecoGuestSelecionadoId: string | null = null;

  enderecoForm: EnderecoFormValue = {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  };

  get enderecoValido(): boolean {
    const f = this.enderecoForm;
    return (
      f.logradouro?.trim() !== '' &&
      f.numero?.trim() !== '' &&
      f.bairro?.trim() !== '' &&
      f.cidade?.trim() !== '' &&
      f.estado?.trim() !== ''
    );
  }

  // ── Pagamento ───────────────────────────────────────────────────────────────
  formaPagamento = 'PIX';
  observacoes = '';
  contato = '';
  codigoCupom = '';

  onContatoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = formatPhone(digits);
    this.contato = digits;
  }

  readonly cupomValidado = signal<Cupom | null>(null);
  readonly validandoCupom = signal(false);
  readonly cupomErro = signal<string | null>(null);

  // ── Submit / PIX ────────────────────────────────────────────────────────────
  readonly submitting    = signal(false);
  readonly codigoCriado  = signal<string | null>(null);
  readonly pagamentoPix  = signal<CreatePagamentoResponse | null>(null);
  readonly pixPago       = signal(false);

  // Dados do pagador para usuários anônimos que escolhem PIX
  readonly pagadorNome         = signal('');
  readonly pagadorCpf          = signal('');         // apenas dígitos
  readonly pagadorCpfFormatted = signal('');         // exibição mascarada
  readonly pagadorErro         = signal('');
  readonly copiado             = signal(false);
  private copiadoTimer: ReturnType<typeof setTimeout> | null = null;
  private pixWsSub: Subscription | null = null;

  readonly isAuthenticated = this.auth.isAuthenticated;

  // ── Computed totals ─────────────────────────────────────────────────────────
  get subtotal(): number {
    return this.cart().reduce((total, item) => {
      const precoBase = Math.max(...item.partes.map((p) => Number(p.produto.preco)));
      const precoAdicionais = item.partes.reduce(
        (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
      );
      return total + (precoBase + precoAdicionais) * item.quantidade;
    }, 0);
  }

  get desconto(): number {
    const cupom = this.cupomValidado();
    if (!cupom) return 0;
    const sub = this.subtotal;
    if (cupom.tipo_desconto === 'percentual') return (sub * cupom.valor_desconto) / 100;
    if (cupom.tipo_desconto === 'valor_fixo') return Math.min(cupom.valor_desconto, sub);
    if (cupom.tipo_desconto === 'frete_gratis') return Number(this.loja.taxa_entrega);
    return 0;
  }

  get total(): number {
    return this.subtotal + Number(this.loja.taxa_entrega) - this.desconto;
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  get canAdvance(): boolean {
    const s = this.currentStep;
    if (!s) return false;
    if (s.tipo === 'categoria') return true;
    if (s.tipo === 'endereco') return this.enderecoValido;
    if (s.tipo === 'pagamento') {
      const base = this.formaPagamento !== '' && this.contato.length === 11;
      if (this.formaPagamento === 'PIX' && !this.auth.isAuthenticated()) {
        return base
          && this.pagadorNome().trim().length > 0
          && validarCpf(this.pagadorCpf());
      }
      return base;
    }
    return this.cart().length > 0;
  }

  constructor() {
    // Sync cart to CartService on every mutation
    effect(() => {
      const items = this.cart();
      if (this.loja) this.cartService.sincronizar(this.loja, items);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Restore cart from CartService if same loja
    const savedLoja = this.cartService.lojaAtual();
    if (savedLoja?.uuid === this.loja.uuid) {
      const savedItems = this.cartService.itens();
      if (savedItems.length > 0) {
        this.cart.set(savedItems);
        this.nextId = savedItems.reduce((max, i) => Math.max(max, i.id), -1) + 1;
      }
    }

    this.buildSteps();

    this.configService
      .getConfigPedido(this.loja.uuid)
      .pipe(catchError(() => of(null)))
      .subscribe((cfg) => {
        if (cfg) this.maxPartes.set(cfg.max_partes);
      });

    this.catalogoService
      .listarAdicionaisDisponiveis(this.loja.uuid)
      .pipe(catchError(() => of([])))
      .subscribe((list) => this.adicionaisDisponiveis.set(list));

    if (this.auth.isAuthenticated()) {
      this.enderecoService
        .listar()
        .pipe(catchError(() => of([])))
        .subscribe((list) => this.enderecosUsuario.set(list));
    } else {
      this.enderecosGuestSalvos.set(this.guestEnderecoService.listar());
    }
  }

  private buildSteps(): void {
    const disponiveis = this.produtos.filter((p) => p.disponivel);
    const catSteps: CategoriaStep[] = [...this.categorias]
      .sort((a, b) => a.ordem - b.ordem)
      .map((cat) => ({
        tipo: 'categoria' as const,
        categoria: cat,
        produtos: disponiveis.filter((p) => p.categoria_uuid === cat.uuid),
      }))
      .filter((s) => s.produtos.length > 0);

    this.steps = [
      ...catSteps,
      { tipo: 'endereco' },
      { tipo: 'pagamento' },
      { tipo: 'resumo' },
    ];
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  avancar(): void {
    if (!this.canAdvance) return;

    if (this.currentStep.tipo === 'endereco' && !this.auth.isAuthenticated()) {
      this.guestEnderecoService.salvar(this.enderecoForm);
      this.enderecosGuestSalvos.set(this.guestEnderecoService.listar());
    }

    this.pizzaPartes.set([]);
    this.pizzaAdicionaisPorPosicao.set({});
    this.pizzaParteExpandida.set(null);
    this.itemExpandidoId.set(null);
    if (this.currentStepIndex() < this.steps.length - 1) {
      this.currentStepIndex.update((i) => i + 1);
    }
  }

  voltar(): void {
    this.pizzaPartes.set([]);
    this.pizzaAdicionaisPorPosicao.set({});
    this.pizzaParteExpandida.set(null);
    this.itemExpandidoId.set(null);
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
    }
  }

  irParaStep(index: number): void {
    if (index < this.currentStepIndex()) {
      this.pizzaPartes.set([]);
      this.pizzaAdicionaisPorPosicao.set({});
      this.pizzaParteExpandida.set(null);
      this.itemExpandidoId.set(null);
      this.currentStepIndex.set(index);
    }
  }

  // ── Non-pizza cart ────────────────────────────────────────────────────────────
  getQuantidadeProduto(produtoUuid: string): number {
    return this.cart()
      .filter((i) => i.partes.length === 1 && i.partes[0].produto.uuid === produtoUuid)
      .reduce((s, i) => s + i.quantidade, 0);
  }

  incrementarProduto(produto: Produto): void {
    const existing = this.cart().find(
      (i) => i.partes.length === 1 && i.partes[0].produto.uuid === produto.uuid,
    );
    if (existing) {
      this.cart.update((c) =>
        c.map((i) => (i.id === existing.id ? { ...i, quantidade: i.quantidade + 1 } : i)),
      );
    } else {
      this.cart.update((c) => [
        ...c,
        {
          id: this.nextId++,
          categoria_uuid: produto.categoria_uuid,
          partes: [{ produto, posicao: 1, adicionais: [] }],
          quantidade: 1,
        },
      ]);
    }
  }

  decrementarProduto(produto: Produto): void {
    const existing = this.cart().find(
      (i) => i.partes.length === 1 && i.partes[0].produto.uuid === produto.uuid,
    );
    if (!existing) return;
    if (existing.quantidade <= 1) {
      this.cart.update((c) => c.filter((i) => i.id !== existing.id));
    } else {
      this.cart.update((c) =>
        c.map((i) => (i.id === existing.id ? { ...i, quantidade: i.quantidade - 1 } : i)),
      );
    }
  }

  // ── Pizza builder ─────────────────────────────────────────────────────────────
  togglePizzaParte(produto: Produto): void {
    const partes = this.pizzaPartes();
    const idx = partes.findIndex((p) => p.produto.uuid === produto.uuid);
    if (idx >= 0) {
      const filtered = partes
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, posicao: i + 1 }));
      // limpa adicionais da posicao removida e reindexar
      const adMap = this.pizzaAdicionaisPorPosicao();
      const newMap: Record<number, Adicional[]> = {};
      filtered.forEach((p, i) => {
        const oldPosicao = partes.find(pp => pp.produto.uuid === p.produto.uuid)?.posicao;
        if (oldPosicao != null && adMap[oldPosicao]) newMap[i + 1] = adMap[oldPosicao];
      });
      this.pizzaAdicionaisPorPosicao.set(newMap);
      this.pizzaPartes.set(filtered);
      if (this.pizzaParteExpandida() === idx + 1) this.pizzaParteExpandida.set(null);
    } else if (partes.length < this.maxPartes()) {
      this.pizzaPartes.set([...partes, { produto, posicao: partes.length + 1, adicionais: [] }]);
    }
  }

  isPizzaParteSelected(produtoUuid: string): boolean {
    return this.pizzaPartes().some((p) => p.produto.uuid === produtoUuid);
  }

  getPizzaPartePosicao(produtoUuid: string): number {
    return this.pizzaPartes().find((p) => p.produto.uuid === produtoUuid)?.posicao ?? 0;
  }

  adicionarPizza(): void {
    const partes = this.pizzaPartes();
    if (partes.length === 0) return;
    const adMap = this.pizzaAdicionaisPorPosicao();
    this.cart.update((c) => [
      ...c,
      {
        id: this.nextId++,
        categoria_uuid: partes[0].produto.categoria_uuid,
        partes: partes.map((p) => ({ ...p, adicionais: adMap[p.posicao] ?? [] })),
        quantidade: 1,
      },
    ]);
    this.pizzaPartes.set([]);
    this.pizzaAdicionaisPorPosicao.set({});
    this.pizzaParteExpandida.set(null);
  }

  removerCartItem(id: number): void {
    this.cart.update((c) => c.filter((i) => i.id !== id));
  }

  // ── Adicionais — pizza builder ────────────────────────────────────────────────
  expandirAdicionaisPizzaParte(posicao: number): void {
    this.pizzaParteExpandida.update((p) => (p === posicao ? null : posicao));
  }

  toggleAdicionalPizzaParte(posicao: number, adicional: Adicional): void {
    this.pizzaAdicionaisPorPosicao.update((map) => {
      const current = map[posicao] ?? [];
      const idx = current.findIndex((a) => a.uuid === adicional.uuid);
      return {
        ...map,
        [posicao]: idx >= 0 ? current.filter((_, i) => i !== idx) : [...current, adicional],
      };
    });
  }

  isAdicionalSelectedForParte(posicao: number, uuid: string): boolean {
    return (this.pizzaAdicionaisPorPosicao()[posicao] ?? []).some((a) => a.uuid === uuid);
  }

  // ── Adicionais — cart items (não-pizza) ───────────────────────────────────────
  expandirAdicionaisItem(itemId: number): void {
    this.itemExpandidoId.update((id) => (id === itemId ? null : itemId));
  }

  toggleAdicionalItem(itemId: number, adicional: Adicional): void {
    this.cart.update((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const parte = item.partes[0];
        const adicionais = parte.adicionais;
        const idx = adicionais.findIndex((a) => a.uuid === adicional.uuid);
        return {
          ...item,
          partes: [{
            ...parte,
            adicionais: idx >= 0
              ? adicionais.filter((_, i) => i !== idx)
              : [...adicionais, adicional],
          }],
        };
      }),
    );
  }

  isAdicionalSelectedForItem(itemId: number, adicionalUuid: string): boolean {
    return this.cart().find((i) => i.id === itemId)?.partes[0]?.adicionais
      .some((a) => a.uuid === adicionalUuid) ?? false;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  itemPreco(item: CartItem): number {
    if (item.partes.length === 0) return 0;
    const precoBase = Math.max(...item.partes.map((p) => Number(p.produto.preco)));
    const precoAdicionais = item.partes.reduce(
      (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return precoBase + precoAdicionais;
  }

  itemLabel(item: CartItem): string {
    if (item.partes.length === 1) return item.partes[0].produto.nome;
    return item.partes.map((p) => `${p.posicao}/${item.partes.length} ${p.produto.nome}`).join(' + ');
  }

  adicionaisLabel(parte: CartParte): string {
    return parte.adicionais.map((a) => a.nome).join(', ');
  }

  pizzaBuilderPreco(): number {
    const partes = this.pizzaPartes();
    if (partes.length === 0) return 0;
    const precoBase = Math.max(...partes.map((p) => Number(p.produto.preco)));
    const adMap = this.pizzaAdicionaisPorPosicao();
    const precoAdicionais = partes.reduce(
      (s, p) => s + (adMap[p.posicao] ?? []).reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return precoBase + precoAdicionais;
  }

  pizzaBuilderLabel(): string {
    const partes = this.pizzaPartes();
    if (partes.length === 0) return '';
    return partes.map((p) => p.produto.nome).join(' + ');
  }

  isStepCompleted(index: number): boolean {
    return index < this.currentStepIndex();
  }

  readonly formasPagamento = [
    { valor: 'PIX', emoji: '📱' },
    { valor: 'Cartão', emoji: '💳' },
    { valor: 'Dinheiro', emoji: '💵' },
  ];

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.fechar.emit();
    }
  }

  // ── Address ───────────────────────────────────────────────────────────────────
  selecionarEndereco(end: EnderecoUsuario): void {
    this.enderecoSelecionadoUuid = end.uuid;
    this.enderecoGuestSelecionadoId = null;
    this.enderecoForm = {
      logradouro: end.logradouro,
      numero: end.numero,
      complemento: end.complemento ?? '',
      bairro: end.bairro,
      cidade: end.cidade,
      estado: end.estado,
      cep: end.cep ?? '',
    };
  }

  selecionarEnderecoGuest(end: EnderecoGuestSalvo): void {
    this.enderecoGuestSelecionadoId = end.id;
    this.enderecoSelecionadoUuid = null;
    this.enderecoForm = {
      logradouro: end.logradouro,
      numero: end.numero,
      complemento: end.complemento ?? '',
      bairro: end.bairro,
      cidade: end.cidade,
      estado: end.estado,
      cep: end.cep ?? '',
    };
  }

  onEnderecoInputChange(): void {
    this.enderecoSelecionadoUuid = null;
    this.enderecoGuestSelecionadoId = null;
  }

  // ── Cupom ──────────────────────────────────────────────────────────────────────
  validarCupom(): void {
    const codigo = this.codigoCupom.trim();
    if (!codigo) return;
    this.validandoCupom.set(true);
    this.cupomErro.set(null);
    this.marketingService
      .validarCupom(codigo)
      .pipe(
        catchError(() => {
          this.cupomErro.set('Cupom inválido ou expirado.');
          this.validandoCupom.set(false);
          this.cupomValidado.set(null);
          return of(null);
        }),
      )
      .subscribe((cupom) => {
        if (cupom) {
          this.cupomValidado.set(cupom);
          this.validandoCupom.set(false);
        }
      });
  }

  removerCupom(): void {
    this.cupomValidado.set(null);
    this.codigoCupom = '';
    this.cupomErro.set(null);
  }

  ngOnDestroy(): void {
    if (this.copiadoTimer) clearTimeout(this.copiadoTimer);
    this.pixWsSub?.unsubscribe();
  }

  private _iniciarWatchPix(codigo: string): void {
    this.pixWsSub?.unsubscribe();
    this.pixWsSub = this.pedidosLive.acompanharPorCodigo(codigo).subscribe((pedido) => {
      if (pedido.pago) {
        this.pixPago.set(true);
        this.pixWsSub?.unsubscribe();
        this.pixWsSub = null;
      }
    });
  }

  onPagadorCpfInput(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 11);
    this.pagadorCpf.set(digits);
    const formatted = formatCpf(digits);
    this.pagadorCpfFormatted.set(formatted);
    (event.target as HTMLInputElement).value = formatted;
  }

  copiarPix(): void {
    const pix = this.pagamentoPix()?.pix_copia_cola;
    if (!pix) return;
    navigator.clipboard.writeText(pix).then(() => {
      this.copiado.set(true);
      if (this.copiadoTimer) clearTimeout(this.copiadoTimer);
      this.copiadoTimer = setTimeout(() => this.copiado.set(false), 2000);
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  confirmarPedido(): void {
    if (this.cart().length === 0) {
      toast.error('Adicione pelo menos um item ao pedido.');
      return;
    }
    if (!this.enderecoValido) {
      toast.error('Preencha o endereço de entrega.');
      return;
    }
    if (this.contato.length !== 11) {
      toast.error('Informe o celular de contato.');
      return;
    }

    const f = this.enderecoForm;
    const body: CreatePedidoRequest = {
      loja_uuid: this.loja.uuid,
      taxa_entrega: Number(this.loja.taxa_entrega),
      forma_pagamento: this.formaPagamento,
      observacoes: this.observacoes || null,
      contato: this.contato || null,
      codigo_cupom: this.cupomValidado()?.codigo ?? null,
      itens: this.cart().map((item) => ({
        quantidade: item.quantidade,
        partes: item.partes.map((p) => ({
          produto_uuid: p.produto.uuid,
          posicao: p.posicao,
          adicionais: p.adicionais.map((a) => a.uuid),
        })),
      })),
      endereco_entrega: {
        logradouro: f.logradouro,
        numero: f.numero,
        complemento: f.complemento || null,
        bairro: f.bairro,
        cidade: f.cidade,
        estado: f.estado,
        cep: f.cep || null,
      },
    };

    const isAuth = this.auth.isAuthenticated();
    const isPix  = this.formaPagamento === 'PIX';
    const pagador = isPix && !isAuth
      ? { nome: this.pagadorNome().trim(), cpf: this.pagadorCpf() }
      : undefined;

    this.submitting.set(true);
    this.pedidoService.criar(body).subscribe({
      next: (res) => {
        // Tenta buscar pedido completo para salvar em localStorage; ignora erro
        this.pedidoService.buscarPorCodigo(res.codigo).pipe(catchError(() => of(null)))
          .subscribe((pedido) => {
            if (pedido) this.pedidoLocalStorage.salvar(pedido);

            if (isPix) {
              // Cria cobrança PIX antes de navegar
              this.pagamentoService.criar(res.uuid, pagador).subscribe({
                next: (pix) => {
                  this.submitting.set(false);
                  this.codigoCriado.set(res.codigo);
                  this.pagamentoPix.set(pix);
                  this.cart.set([]);
                  this.cartService.limpar();
                  this._iniciarWatchPix(res.codigo);
                },
                error: () => {
                  // PIX falhou: navega normalmente, usuário pode pagar depois
                  toast.error('Pedido criado, mas falha ao gerar PIX. Pague na tela do pedido.');
                  this.submitting.set(false);
                  this.cart.set([]);
                  this.cartService.limpar();
                  this._navegarAposCriar(isAuth, res.codigo);
                },
              });
            } else {
              this.submitting.set(false);
              this.cart.set([]);
              this.cartService.limpar();
              this._navegarAposCriar(isAuth, res.codigo);
            }
          });
      },
      error: () => {
        toast.error('Erro ao criar pedido. Tente novamente.');
        this.submitting.set(false);
      },
    });
  }

  private _navegarAposCriar(isAuth: boolean, codigo: string): void {
    if (isAuth) {
      toast.success(`Pedido criado! Código: ${codigo}`);
      this.router.navigate(['/pedidos', codigo]);
    } else {
      this.codigoCriado.set(codigo);
    }
  }

  irParaDetalhe(): void {
    const codigo = this.codigoCriado();
    if (codigo) {
      this.fechar.emit();
      this.router.navigate(['/pedidos', codigo]);
    }
  }

  irParaPedidos(): void {
    this.fechar.emit();
    this.router.navigate(['/pedidos']);
  }
}
