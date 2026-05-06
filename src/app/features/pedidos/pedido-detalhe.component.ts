import { Component, inject, signal, computed, DestroyRef, LOCALE_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe, DatePipe } from '@angular/common';
import { switchMap, catchError, of, map, tap, startWith, takeWhile } from 'rxjs';
import { PedidoService } from '../../core/services/pedido.service';
import { PedidoLocalStorageService } from '../../core/services/pedido-local-storage.service';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { PagamentoService } from '../../core/services/pagamento.service';
import { AuthService } from '../../core/services/auth.service';
import { MarketingService } from '../../core/services/marketing.service';
import { Pedido, StatusPedido, CreatePagamentoResponse } from '../../core/models';
import { ChatPanelComponent } from '../../shared/components/chat-panel.component';
import { UiSkeletonComponent } from '../../shared/components';
import { AvaliarPedidoModalComponent } from './avaliar-pedido-modal.component';
import { AvaliacaoLojaFormComponent } from '../loja/avaliacao-loja-form.component';
import { AvaliacaoProdutoFormComponent } from '../loja/avaliacao-produto-form.component';
import { validarCpf, formatCpf } from '../../core/utils/cpf-utils';

type Steps = {
  status: StatusPedido;
  label: string;
  icon: string
}

const STEPS: Steps[] = [
  { status: 'criado',                        label: 'Pedido criado',    icon: '🕐' },
  { status: 'aguardando_confirmacao_de_loja', label: 'Aguardando loja',  icon: '⏳' },
  { status: 'confirmado_pela_loja',          label: 'Confirmado',       icon: '✅' },
  { status: 'em_preparo',                    label: 'Em preparo',       icon: '👨‍🍳' },
  { status: 'pronto',                        label: 'Pronto',           icon: '📦' },
  { status: 'saiu_para_entrega',             label: 'Saiu p/ entrega',  icon: '🛵' },
  { status: 'entregue',                      label: 'Entregue',         icon: '🎉' },
];

const ORDER: StatusPedido[] = STEPS.map((s) => s.status);
const STATUS_TERMINAL: StatusPedido[] = ['entregue', 'cancelado'];

@Component({
  selector: 'app-pedido-detalhe',
  standalone: true,
  imports: [RouterLink, DecimalPipe, ChatPanelComponent, DatePipe, UiSkeletonComponent, AvaliarPedidoModalComponent, AvaliacaoLojaFormComponent, AvaliacaoProdutoFormComponent],
  templateUrl: './pedido-detalhe.component.html',
})
export class PedidoDetalheComponent {
  private route              = inject(ActivatedRoute);
  private pedidoService      = inject(PedidoService);
  private pedidoLocalStorage = inject(PedidoLocalStorageService);
  private pedidosLiveService = inject(PedidosLiveService);
  private pagamentoService   = inject(PagamentoService);
  private authService        = inject(AuthService);
  private marketingService   = inject(MarketingService);
  private destroyRef         = inject(DestroyRef);
  private locale             = inject(LOCALE_ID);

  readonly steps = STEPS;

  // ── Pedido ────────────────────────────────────────────────────────────────

  private readonly _pedido = signal<Pedido | null | undefined>(undefined);
  readonly pedido = this._pedido.asReadonly();

  readonly loading     = computed(() => this._pedido() === undefined);
  readonly isCancelled = computed(() => this._pedido()?.status === 'cancelado');
  readonly podePagar   = computed(() => {
    const p = this._pedido();
    return !!p && !p.pago && !STATUS_TERMINAL.includes(p.status);
  });

  private currentIndex = computed(() =>
    ORDER.indexOf(this._pedido()?.status ?? 'criado'),
  );

  // ── Pagamento ─────────────────────────────────────────────────────────────

  readonly isAuthenticated        = this.authService.isAuthenticated;
  readonly pagando                = signal(false);
  readonly pagamento              = signal<CreatePagamentoResponse | null>(null);
  readonly pagadorNome            = signal('');
  readonly pagadorCpf             = signal('');          // apenas dígitos
  readonly pagadorCpfFormatted    = signal('');          // exibição mascarada
  readonly pagadorError           = signal('');
  readonly copiado                = signal(false);
  readonly chatAberto             = signal(false);
  readonly mostrarModalAvaliacao  = signal(false);
  readonly avaliacaoInline        = signal(false);
  readonly inlineStep             = signal<'loja' | 'produtos' | 'concluido'>('loja');
  readonly inlineLoadingLoja      = signal(false);
  readonly inlineLoadingProduto   = signal(false);
  readonly inlineProdutoIndex     = signal(0);
  readonly avaliacaoInline        = signal(false);
  readonly inlineStep             = signal<'loja' | 'produtos' | 'concluido'>('loja');
  readonly inlineLoadingLoja      = signal(false);
  readonly inlineLoadingProduto   = signal(false);
  readonly inlineProdutoIndex     = signal(0);

  private copiadoTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  constructor() {
    this.route.paramMap.pipe(
      map(p => p.get('uuid')?.trim() ?? p.get('codigo')?.trim() ?? ''),
      tap(() => {
        this._pedido.set(undefined);
        this.resetarPagamento();
      }),
      switchMap(identificador => {
        if (!identificador) return of(null);
        const obs = identificador.length === 36 && identificador.includes('-')
          ? this.pedidoService.buscar(identificador)
          : this.pedidoService.buscarPorCodigo(identificador);
        return obs.pipe(
          catchError(() => {
            const local = identificador.length === 36 && identificador.includes('-')
              ? this.pedidoLocalStorage.buscarPorUuid(identificador)
              : this.pedidoLocalStorage.buscarPorCodigo(identificador);
            return of(local ?? null);
          }),
        );
      }),
      switchMap(pedido => {
        if (pedido?.codigo && !STATUS_TERMINAL.includes(pedido.status)) {
          return this.pedidosLiveService.acompanharPorCodigo(pedido.codigo).pipe(
            startWith(pedido),
            takeWhile(p => !STATUS_TERMINAL.includes(p.status), true),
            catchError(() => of(pedido))
          );
        }
        return of(pedido);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(pedido => {
      if (pedido) {
        const foiPago = !this._pedido()?.pago && pedido.pago;
        const transitouEntregue = pedido.status === 'entregue' && this._pedido()?.status !== 'entregue';
        this._pedido.set(pedido);
        if (foiPago) this.pagamento.set(null);
        if (transitouEntregue && this.isAuthenticated() && !this.avaliacaoJaMostrada(pedido.uuid)) {
          this.mostrarModalAvaliacao.set(true);
          this.marcarAvaliacaoMostrada(pedido.uuid);
        }
      } else {
        this._pedido.set(null);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.copiadoTimer) clearTimeout(this.copiadoTimer);
    });
  }

  // ── Pagamento PIX ─────────────────────────────────────────────────────────

  pagar(): void {
    const pedido = this._pedido();
    if (!pedido) return;

    let pagador: { nome: string; cpf: string } | undefined;

    if (!this.authService.isAuthenticated()) {
      const nome = this.pagadorNome().trim();
      const cpf  = this.pagadorCpf();
      if (!nome)            { this.pagadorError.set('Nome é obrigatório.'); return; }
      if (!validarCpf(cpf)) { this.pagadorError.set('CPF inválido.'); return; }
      this.pagadorError.set('');
      pagador = { nome, cpf };
    }

    this.pagando.set(true);
    this.pagamentoService.criar(pedido.uuid, pagador).subscribe({
      next: (res) => {
        this.pagando.set(false);
        this.pagamento.set(res);
      },
      error: (err) => {
        this.pagando.set(false);
        this.pagadorError.set(err?.error?.error ?? 'Erro ao gerar cobrança PIX.');
      },
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
    const pix = this.pagamento()?.pix_copia_cola;
    if (!pix) return;
    navigator.clipboard.writeText(pix).then(() => {
      this.copiado.set(true);
      if (this.copiadoTimer) clearTimeout(this.copiadoTimer);
      this.copiadoTimer = setTimeout(() => this.copiado.set(false), 2000);
    });
  }

  private resetarPagamento(): void {
    this.pagamento.set(null);
    this.pagando.set(false);
    this.pagadorNome.set('');
    this.pagadorCpf.set('');
    this.pagadorCpfFormatted.set('');
    this.pagadorError.set('');
    this.copiado.set(false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getFormattedDate(date: string | null | undefined): string {
    if (!date) return '';
    try {
      const dp = new DatePipe(this.locale);
      const dataFormatada = dp.transform(date, 'dd/MM/yyyy');
      const horaFormatada = new Date(date).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
      return `${dataFormatada} às ${horaFormatada}`;
    } catch (e) {
      console.error('Erro ao formatar data:', e);
      return '';
    }
  }

  displayCode(): string {
    return this._pedido()?.codigo ?? '';
  }

  isActive(s: StatusPedido) { return this._pedido()?.status === s; }
  isDone  (s: StatusPedido) { return ORDER.indexOf(s) < this.currentIndex(); }

  totalItem(item: Pedido['itens'][number]): number {
    return item.partes.reduce(
      (acc, p) =>
        acc + p.preco_unitario + p.adicionais.reduce((a, ad) => a + ad.preco, 0),
      0,
    ) * item.quantidade;
  }

  // ── Modal de avaliação ────────────────────────────────────────────────────

  readonly produtosUnicos = computed(() => {
    const p = this._pedido();
    if (!p) return [] as { uuid: string; nome: string }[];
    const map = new Map<string, { uuid: string; nome: string }>();
    for (const item of p.itens) {
      for (const parte of item.partes) {
        if (!map.has(parte.produto_uuid)) {
          map.set(parte.produto_uuid, { uuid: parte.produto_uuid, nome: parte.produto_nome });
        }
      }
    }
    return [...map.values()];
  });

  readonly inlineProdutoAtual  = computed(() => this.produtosUnicos()[this.inlineProdutoIndex()] ?? null);
  readonly inlineTotalProdutos = computed(() => this.produtosUnicos().length);

  abrirAvaliacaoInline(): void {
    this.avaliacaoInline.set(true);
    this.inlineStep.set('loja');
  }

  onInlineAvaliarLoja(dados: { nota: number; comentario: string | null }): void {
    const p = this._pedido();
    if (!p) return;
    this.inlineLoadingLoja.set(true);
    this.marketingService.avaliarLoja(p.loja_uuid, dados).subscribe({
      next:  () => { this.inlineLoadingLoja.set(false); this.irParaInlineProdutos(); },
      error: () => { this.inlineLoadingLoja.set(false); this.irParaInlineProdutos(); },
    });
  }

  onInlinePularLoja(): void { this.irParaInlineProdutos(); }

  private irParaInlineProdutos(): void {
    if (this.produtosUnicos().length === 0) {
      this.inlineStep.set('concluido');
    } else {
      this.inlineProdutoIndex.set(0);
      this.inlineStep.set('produtos');
    }
  }

  onInlineAvaliarProduto(dados: { produto_uuid: string; nota: number; descricao: string; comentario: string | null }): void {
    const p = this._pedido();
    if (!p) return;
    this.inlineLoadingProduto.set(true);
    this.marketingService.avaliarProduto(p.loja_uuid, dados).subscribe({
      next:  () => { this.inlineLoadingProduto.set(false); this.avancarInlineProduto(); },
      error: () => { this.inlineLoadingProduto.set(false); this.avancarInlineProduto(); },
    });
  }

  onInlinePularProduto(): void { this.avancarInlineProduto(); }

  private avancarInlineProduto(): void {
    if (this.inlineProdutoIndex() + 1 >= this.inlineTotalProdutos()) {
      this.inlineStep.set('concluido');
    } else {
      this.inlineProdutoIndex.update(i => i + 1);
    }
  }

  readonly produtosUnicos = computed(() => {
    const p = this._pedido();
    if (!p) return [] as { uuid: string; nome: string }[];
    const map = new Map<string, { uuid: string; nome: string }>();
    for (const item of p.itens) {
      for (const parte of item.partes) {
        if (!map.has(parte.produto_uuid)) {
          map.set(parte.produto_uuid, { uuid: parte.produto_uuid, nome: parte.produto_nome });
        }
      }
    }
    return [...map.values()];
  });

  readonly inlineProdutoAtual  = computed(() => this.produtosUnicos()[this.inlineProdutoIndex()] ?? null);
  readonly inlineTotalProdutos = computed(() => this.produtosUnicos().length);

  abrirAvaliacaoInline(): void {
    this.avaliacaoInline.set(true);
    this.inlineStep.set('loja');
  }

  onInlineAvaliarLoja(dados: { nota: number; comentario: string | null }): void {
    const p = this._pedido();
    if (!p) return;
    this.inlineLoadingLoja.set(true);
    this.marketingService.avaliarLoja(p.loja_uuid, dados).subscribe({
      next:  () => { this.inlineLoadingLoja.set(false); this.irParaInlineProdutos(); },
      error: () => { this.inlineLoadingLoja.set(false); this.irParaInlineProdutos(); },
    });
  }

  onInlinePularLoja(): void { this.irParaInlineProdutos(); }

  private irParaInlineProdutos(): void {
    if (this.produtosUnicos().length === 0) {
      this.inlineStep.set('concluido');
    } else {
      this.inlineProdutoIndex.set(0);
      this.inlineStep.set('produtos');
    }
  }

  onInlineAvaliarProduto(dados: { produto_uuid: string; nota: number; descricao: string; comentario: string | null }): void {
    const p = this._pedido();
    if (!p) return;
    this.inlineLoadingProduto.set(true);
    this.marketingService.avaliarProduto(p.loja_uuid, dados).subscribe({
      next:  () => { this.inlineLoadingProduto.set(false); this.avancarInlineProduto(); },
      error: () => { this.inlineLoadingProduto.set(false); this.avancarInlineProduto(); },
    });
  }

  onInlinePularProduto(): void { this.avancarInlineProduto(); }

  private avancarInlineProduto(): void {
    if (this.inlineProdutoIndex() + 1 >= this.inlineTotalProdutos()) {
      this.inlineStep.set('concluido');
    } else {
      this.inlineProdutoIndex.update(i => i + 1);
    }
  }

  private avaliacaoJaMostrada(pedidoUuid: string): boolean {
    return localStorage.getItem(`avaliacao_modal_${pedidoUuid}`) !== null;
  }

  private marcarAvaliacaoMostrada(pedidoUuid: string): void {
    localStorage.setItem(`avaliacao_modal_${pedidoUuid}`, '1');
  }
}
