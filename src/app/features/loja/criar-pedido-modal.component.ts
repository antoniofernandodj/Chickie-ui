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
import { DatePipe, DecimalPipe } from '@angular/common';
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
  Comanda,
  CreatePedidoRequest,
  CreatePagamentoResponse,
  EnderecoFormValue,
  MontagemCompleta,
  EtapaComOpcoes,
  OpcaoMontagem,
  SelecaoOpcaoRequest,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService, CartItem, CartParte } from '../../core/services/cart.service';
import { PedidoService } from '../../core/services/pedido.service';
import { PedidoLocalStorageService } from '../../core/services/pedido-local-storage.service';
import { PagamentoService } from '../../core/services/pagamento.service';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { EnderecoUsuarioService } from '../../core/services/endereco-usuario.service';
import { GuestEnderecoService, EnderecoGuestSalvo } from '../../core/services/guest-endereco.service';
import { GuestContatoService, ContatoGuestSalvo } from '../../core/services/guest-contato.service';
import { ConfigPedidoService } from '../../core/services/config-pedido.service';
import { MarketingService } from '../../core/services/marketing.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { MontagemService } from '../../core/services/montagem.service';
import { ComandaService } from '../../core/services/comanda.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { EnderecoFormComponent, UiButtonComponent, UiInputComponent, UiTextareaComponent, PushPermissaoModalComponent } from '../../shared/components';

// ─── Local types ──────────────────────────────────────────────────────────────

interface CategoriaStep {
  tipo:     'categoria';
  categoria: CategoriaProdutos;
  produtos:  Produto[];
}

interface FixedStep {
  tipo: 'endereco' | 'pagamento' | 'resumo' | 'comanda-choice' | 'tipo-consumo';
}

type Step = CategoriaStep | FixedStep;

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-criar-pedido-modal',
  imports: [FormsModule, DatePipe, DecimalPipe, EnderecoFormComponent, UiButtonComponent, UiInputComponent, UiTextareaComponent, PushPermissaoModalComponent],
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
  private guestContatoService = inject(GuestContatoService);
  private configService = inject(ConfigPedidoService);
  private marketingService = inject(MarketingService);
  private catalogoService = inject(CatalogoService);
  private montagemService = inject(MontagemService);
  private comandaService = inject(ComandaService);
  readonly push = inject(PushNotificationService);
  private router = inject(Router);

  readonly mesa = computed(() => this.cartService.mesa());

  // Comandas ativas na mesa (pode haver várias)
  readonly comandasAtivas = signal<Comanda[]>([]);
  // null = não escolheu, 'nova' = nova comanda, string = uuid da comanda escolhida
  readonly comandaEscolhida = signal<string | 'nova' | null>(null);
  readonly novaComandaNome  = signal('');

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
    if (s.tipo === 'comanda-choice') return 'Comanda';
    if (s.tipo === 'tipo-consumo') return 'Tipo de Consumo';
    return 'Resumo do Pedido';
  }

  get stepSubtitle(): string {
    const s = this.currentStep;
    if (!s) return '';
    if (s.tipo === 'categoria') {
      const cs = s as CategoriaStep;
      if (cs.categoria.drink_mode) return `${cs.produtos.length} ${cs.produtos.length === 1 ? 'bebida disponível' : 'bebidas disponíveis'}`;
      if (cs.categoria.pizza_mode) return `Até ${this.maxPartes()} sabores por pizza`;
      if (cs.categoria.montagem_mode) return `${cs.produtos.length} ${cs.produtos.length === 1 ? 'opção disponível' : 'opções disponíveis'} — monte o seu prato`;
      return `${cs.produtos.length} ${cs.produtos.length === 1 ? 'item disponível' : 'itens disponíveis'}`;
    }
    if (s.tipo === 'endereco') return 'Onde você quer receber?';
    if (s.tipo === 'pagamento') return 'Como você vai pagar?';
    if (s.tipo === 'comanda-choice') return 'Nova comanda ou adicionar à existente?';
    if (s.tipo === 'tipo-consumo') return 'O pedido é para comer aqui ou para viagem?';
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

  // Pizza: adicionais por produto uuid da parte (chave: produto.uuid)
  readonly pizzaAdicionaisPorProduto = signal<Record<string, Adicional[]>>({});
  // Pizza: qual parte está com painel de adicionais aberto (produto uuid)
  readonly pizzaParteExpandida = signal<string | null>(null);

  // Não-pizza: qual item do cart está com painel de adicionais aberto
  readonly itemExpandidoId = signal<number | null>(null);

  // ── Pizza builder ───────────────────────────────────────────────────────────
  readonly pizzaPartes = signal<CartParte[]>([]);

  // ── Montagem builder ────────────────────────────────────────────────────────
  // Produto selecionado para montar
  readonly montagemProduto    = signal<Produto | null>(null);
  // Configuração carregada do servidor
  readonly montagemCompleta   = signal<MontagemCompleta | null>(null);
  // Carregando configuração
  readonly montagemCarregando = signal(false);
  // Etapa atual no wizard de montagem (índice em montagemCompleta.etapas)
  readonly montagemEtapaIdx   = signal(0);
  // Seleções: etapa_uuid → OpcaoMontagem[]  (com quantity para QuantidadePorOpcao)
  readonly montagemSelecoes   = signal<Record<string, { opcao: OpcaoMontagem; qty: number }[]>>({});

  get montagemEtapaAtual(): EtapaComOpcoes | null {
    const mc = this.montagemCompleta();
    if (!mc) return null;
    return mc.etapas[this.montagemEtapaIdx()] ?? null;
  }

  get montagemTotalEtapas(): number {
    return this.montagemCompleta()?.etapas.length ?? 0;
  }

  get montagemPrecoTotal(): number {
    const mc = this.montagemCompleta();
    if (!mc) return 0;
    let total = Number(mc.montagem.preco_base);
    const sel = this.montagemSelecoes();
    for (const etapaUuid of Object.keys(sel)) {
      for (const item of sel[etapaUuid]) {
        if (!item.opcao.gratis) {
          total += Number(item.opcao.preco_extra) * item.qty;
        }
      }
    }
    return total;
  }

  get montagemEtapaValida(): boolean {
    const etapa = this.montagemEtapaAtual;
    if (!etapa) return true;
    const sel = this.montagemSelecoes()[etapa.uuid] ?? [];
    const totalQty = sel.reduce((s, i) => s + i.qty, 0);
    return totalQty >= etapa.min_selecoes;
  }

  // ── Endereço ────────────────────────────────────────────────────────────────
  readonly enderecosUsuario = signal<EnderecoUsuario[]>([]);
  readonly enderecosGuestSalvos = signal<EnderecoGuestSalvo[]>([]);
  readonly contatosGuestSalvos  = signal<ContatoGuestSalvo[]>([]);
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

  selecionarContatoGuest(contato: ContatoGuestSalvo): void {
    this.contato = contato.numero;
  }

  // ── Tipo de consumo (mesa/pdv) ───────────────────────────────────────────────
  readonly paraViagem = signal<boolean | null>(null);

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
    const taxaEntrega = this.cartService.mesa() ? 0 : Number(this.loja.taxa_entrega);
    return this.subtotal + taxaEntrega - this.desconto;
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  get canAdvance(): boolean {
    const s = this.currentStep;
    if (!s) return false;
    if (s.tipo === 'categoria') return true;
    if (s.tipo === 'endereco') return this.enderecoValido;
    if (s.tipo === 'comanda-choice') {
      const escolha = this.comandaEscolhida();
      if (escolha === null) return false;
      if (escolha === 'nova') return this.novaComandaNome().trim().length > 0;
      return true;
    }
    if (s.tipo === 'tipo-consumo') return this.paraViagem() !== null;
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

    // Pre-preenche contato com celular do usuário quando ele estiver disponível
    effect(() => {
      const celular = this.auth.celularUsuario();
      if (celular && this.auth.isAuthenticated() && !this.contato) {
        this.contato = celular;
      }
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

    this.push.carregarVapidKey();

    const mesa = this.cartService.mesa();
    if (mesa) {
      this.comandaService.listarComandasAtivasPorMesa(this.loja.uuid, mesa)
        .pipe(catchError(() => of([])))
        .subscribe(cs => {
          this.comandasAtivas.set(cs);
          this.buildSteps();
        });
    } else {
      this.buildSteps();
    }

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
      this.contatosGuestSalvos.set(this.guestContatoService.listar());
    }
  }

  private buildSteps(): void {
    const disponiveis = this.produtos.filter((p) => p.disponivel);
    const catSteps: CategoriaStep[] = [...this.categorias]
      .sort((a, b) => a.ordem - b.ordem)
      .map((cat) => ({
        tipo: 'categoria' as const,
        categoria: cat,
        produtos: disponiveis.filter((p) => {
          if (p.categoria_uuid !== cat.uuid) return false;
          // Ocultar produtos de categoria montagem_mode sem montagem configurada
          if (cat.montagem_mode && !p.tem_montagem) return false;
          return true;
        }),
      }))
      .filter((s) => s.produtos.length > 0);

    const isMesa = !!this.cartService.mesa();
    const temComandaAtiva = this.comandasAtivas().length > 0;
    this.steps = [
      ...catSteps,
      ...(isMesa ? [] : [{ tipo: 'endereco' as const }]),
      ...(isMesa ? [] : [{ tipo: 'pagamento' as const }]),
      ...(isMesa && temComandaAtiva ? [{ tipo: 'comanda-choice' as const }] : []),
      ...(isMesa ? [{ tipo: 'tipo-consumo' as const }] : []),
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
    this.pizzaAdicionaisPorProduto.set({});
    this.pizzaParteExpandida.set(null);
    this.itemExpandidoId.set(null);
    this.cancelarMontagem();
    if (this.currentStepIndex() < this.steps.length - 1) {
      this.currentStepIndex.update((i) => i + 1);
    }
  }

  voltar(): void {
    this.pizzaPartes.set([]);
    this.pizzaAdicionaisPorProduto.set({});
    this.pizzaParteExpandida.set(null);
    this.itemExpandidoId.set(null);
    this.cancelarMontagem();
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
    }
  }

  irParaStep(index: number): void {
    if (index < this.currentStepIndex()) {
      this.pizzaPartes.set([]);
      this.pizzaAdicionaisPorProduto.set({});
      this.pizzaParteExpandida.set(null);
      this.itemExpandidoId.set(null);
      this.cancelarMontagem();
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
          partes: [{ produto, adicionais: [] }],
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
      const filtered = partes.filter((_, i) => i !== idx);
      this.pizzaAdicionaisPorProduto.update((map) => {
        const newMap = { ...map };
        delete newMap[produto.uuid];
        return newMap;
      });
      this.pizzaPartes.set(filtered);
      if (this.pizzaParteExpandida() === produto.uuid) this.pizzaParteExpandida.set(null);
    } else if (partes.length < this.maxPartes()) {
      this.pizzaPartes.set([...partes, { produto, adicionais: [] }]);
    }
  }

  isPizzaParteSelected(produtoUuid: string): boolean {
    return this.pizzaPartes().some((p) => p.produto.uuid === produtoUuid);
  }

  getPizzaPartePosicao(produtoUuid: string): number {
    const idx = this.pizzaPartes().findIndex((p) => p.produto.uuid === produtoUuid);
    return idx >= 0 ? idx + 1 : 0;
  }

  adicionarPizza(): void {
    const partes = this.pizzaPartes();
    if (partes.length === 0) return;
    const adMap = this.pizzaAdicionaisPorProduto();
    this.cart.update((c) => [
      ...c,
      {
        id: this.nextId++,
        categoria_uuid: partes[0].produto.categoria_uuid,
        partes: partes.map((p) => ({ produto: p.produto, adicionais: adMap[p.produto.uuid] ?? [] })),
        quantidade: 1,
      },
    ]);
    this.pizzaPartes.set([]);
    this.pizzaAdicionaisPorProduto.set({});
    this.pizzaParteExpandida.set(null);
  }

  removerCartItem(id: number): void {
    this.cart.update((c) => c.filter((i) => i.id !== id));
  }

  // ── Montagem builder methods ──────────────────────────────────────────────

  iniciarMontagem(produto: Produto): void {
    this.montagemProduto.set(produto);
    this.montagemCompleta.set(null);
    this.montagemCarregando.set(true);
    this.montagemEtapaIdx.set(0);
    this.montagemSelecoes.set({});
    this.montagemService.buscarPorProduto(produto.uuid).pipe(
      catchError(() => of(null)),
    ).subscribe(mc => {
      this.montagemCarregando.set(false);
      this.montagemCompleta.set(mc);
    });
  }

  cancelarMontagem(): void {
    this.montagemProduto.set(null);
    this.montagemCompleta.set(null);
    this.montagemCarregando.set(false);
    this.montagemEtapaIdx.set(0);
    this.montagemSelecoes.set({});
  }

  montagemToggleOpcao(opcao: OpcaoMontagem): void {
    const etapa = this.montagemEtapaAtual;
    if (!etapa) return;
    this.montagemSelecoes.update(sel => {
      const current = sel[etapa.uuid] ?? [];
      const idx = current.findIndex(i => i.opcao.uuid === opcao.uuid);
      if (idx >= 0) {
        return { ...sel, [etapa.uuid]: current.filter((_, i) => i !== idx) };
      }
      // EscolhaUnica: substitui
      if (etapa.tipo === 'escolha_unica') {
        return { ...sel, [etapa.uuid]: [{ opcao, qty: 1 }] };
      }
      // Respeita max_selecoes
      const max = etapa.max_selecoes;
      if (max !== null && current.length >= max) return sel;
      return { ...sel, [etapa.uuid]: [...current, { opcao, qty: 1 }] };
    });
  }

  montagemSetQtd(opcao: OpcaoMontagem, qty: number): void {
    const etapa = this.montagemEtapaAtual;
    if (!etapa) return;
    if (qty < 1) { this.montagemToggleOpcao(opcao); return; }
    this.montagemSelecoes.update(sel => {
      const current = sel[etapa.uuid] ?? [];
      const idx = current.findIndex(i => i.opcao.uuid === opcao.uuid);
      if (idx < 0) return sel;
      const updated = [...current];
      const max = opcao.max_quantidade;
      updated[idx] = { opcao, qty: max !== null ? Math.min(qty, max) : qty };
      return { ...sel, [etapa.uuid]: updated };
    });
  }

  montagemOpcaoQtd(opcao: OpcaoMontagem): number {
    const etapa = this.montagemEtapaAtual;
    if (!etapa) return 0;
    return (this.montagemSelecoes()[etapa.uuid] ?? []).find(i => i.opcao.uuid === opcao.uuid)?.qty ?? 0;
  }

  montagemOpcaoSelecionada(opcao: OpcaoMontagem): boolean {
    const etapa = this.montagemEtapaAtual;
    if (!etapa) return false;
    return (this.montagemSelecoes()[etapa.uuid] ?? []).some(i => i.opcao.uuid === opcao.uuid);
  }

  montagemAvancarEtapa(): void {
    if (!this.montagemEtapaValida) return;
    if (this.montagemEtapaIdx() < this.montagemTotalEtapas - 1) {
      this.montagemEtapaIdx.update(i => i + 1);
    } else {
      this.montagemAdicionarAoCarrinho();
    }
  }

  montagemVoltarEtapa(): void {
    if (this.montagemEtapaIdx() > 0) {
      this.montagemEtapaIdx.update(i => i - 1);
    }
  }

  private montagemAdicionarAoCarrinho(): void {
    const produto = this.montagemProduto();
    const mc = this.montagemCompleta();
    if (!produto || !mc) return;

    // Build selecoes flat list
    const todasSelecoes: SelecaoOpcaoRequest[] = [];
    for (const etapa of mc.etapas) {
      const sels = this.montagemSelecoes()[etapa.uuid] ?? [];
      for (const { opcao, qty } of sels) {
        todasSelecoes.push({ opcao_uuid: opcao.uuid, quantidade: qty });
      }
    }

    this.cart.update(c => [
      ...c,
      {
        id: this.nextId++,
        categoria_uuid: produto.categoria_uuid,
        partes: [{
          produto,
          adicionais: [],
          montagem: { selecoes: todasSelecoes },
        }],
        quantidade: 1,
      },
    ]);
    this.cancelarMontagem();
  }

  // ── Adicionais — pizza builder ────────────────────────────────────────────────
  expandirAdicionaisPizzaParte(produtoUuid: string): void {
    this.pizzaParteExpandida.update((p) => (p === produtoUuid ? null : produtoUuid));
  }

  toggleAdicionalPizzaParte(produtoUuid: string, adicional: Adicional): void {
    this.pizzaAdicionaisPorProduto.update((map) => {
      const current = map[produtoUuid] ?? [];
      const idx = current.findIndex((a) => a.uuid === adicional.uuid);
      return {
        ...map,
        [produtoUuid]: idx >= 0 ? current.filter((_, i) => i !== idx) : [...current, adicional],
      };
    });
  }

  isAdicionalSelectedForParte(produtoUuid: string, uuid: string): boolean {
    return (this.pizzaAdicionaisPorProduto()[produtoUuid] ?? []).some((a) => a.uuid === uuid);
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
    // For montagem items, price will be recalculated server-side; show produto.preco as estimate
    const precoBase = Math.max(...item.partes.map((p) => Number(p.produto.preco)));
    const precoAdicionais = item.partes.reduce(
      (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return precoBase + precoAdicionais;
  }

  itemLabel(item: CartItem): string {
    if (item.partes.length === 1) return item.partes[0].produto.nome;
    return item.partes.map((p, i) => `${i + 1}/${item.partes.length} ${p.produto.nome}`).join(' + ');
  }

  adicionaisLabel(parte: CartParte): string {
    return parte.adicionais.map((a) => a.nome).join(', ');
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
    const mesa = this.cartService.mesa();
    if (!mesa && !this.enderecoValido) {
      toast.error('Preencha o endereço de entrega.');
      return;
    }
    if (!mesa && this.contato.length !== 11) {
      toast.error('Informe o celular de contato.');
      return;
    }

    const isAuth = this.auth.isAuthenticated();
    if (isAuth) {
      this.push.subscribe();
    }

    const f = this.enderecoForm;
    const body: CreatePedidoRequest = {
      loja_uuid: this.loja.uuid,
      taxa_entrega: mesa ? 0 : Number(this.loja.taxa_entrega),
      forma_pagamento: mesa ? '' : this.formaPagamento,
      observacoes: this.observacoes || null,
      contato: mesa ? null : (this.contato || null),
      codigo_cupom: this.cupomValidado()?.codigo ?? null,
      origem: mesa ? 'mesa' : undefined,
      numero_mesa: mesa ?? undefined,
      comanda_uuid: mesa && this.comandaEscolhida() !== 'nova' && this.comandaEscolhida() !== null
        ? this.comandaEscolhida()!
        : undefined,
      nome_comanda: mesa && this.comandaEscolhida() === 'nova'
        ? (this.novaComandaNome().trim() || null)
        : undefined,
      para_viagem: mesa ? this.paraViagem() : null,
      itens: this.cart().map((item) => ({
        quantidade: item.quantidade,
        partes: item.partes.map((p) => ({
          produto_uuid: p.produto.uuid,
          adicionais: p.adicionais.map((a) => a.uuid),
          montagem: p.montagem ?? null,
        })),
      })),
      endereco_entrega: mesa ? null : {
        logradouro: f.logradouro,
        numero: f.numero,
        complemento: f.complemento || null,
        bairro: f.bairro,
        cidade: f.cidade,
        estado: f.estado,
        cep: f.cep || null,
      },
    };

    const isPix  = !mesa && this.formaPagamento === 'PIX';
    const pagador = isPix && !isAuth
      ? { nome: this.pagadorNome().trim(), cpf: this.pagadorCpf() }
      : undefined;

    this.submitting.set(true);
    this.pedidoService.criar(body).subscribe({
      next: (res) => {
        if (!isAuth) {
          this.push.subscribePorPedido(res.uuid);
          // Salva contato para sugestão no próximo atendimento
          if (this.contato.length === 11) {
            this.guestContatoService.salvar(this.contato);
          }
        }

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
