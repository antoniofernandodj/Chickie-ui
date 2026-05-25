import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of, Subscription, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { formatPhone } from '../../core/utils/phone-utils';
import { formatCpf, validarCpf } from '../../core/utils/cpf-utils';
import {
  EnderecoUsuario,
  Cupom,
  CreatePedidoRequest,
  CreatePagamentoResponse,
  EnderecoFormValue,
  Comanda,
} from '../../core/models';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { ComandaService } from '../../core/services/comanda.service';
import { PedidoService } from '../../core/services/pedido.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { PedidoLocalStorageService } from '../../core/services/pedido-local-storage.service';
import { PagamentoService } from '../../core/services/pagamento.service';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { EnderecoUsuarioService } from '../../core/services/endereco-usuario.service';
import { GuestEnderecoService, EnderecoGuestSalvo } from '../../core/services/guest-endereco.service';
import { MarketingService } from '../../core/services/marketing.service';
import { HorarioService } from '../../core/services/horario.service';
import { EnderecoFormComponent, UiButtonComponent, UiInputComponent, UiTextareaComponent, PushPermissaoModalComponent } from '../../shared/components';

type CheckoutStep = 'endereco' | 'pagamento' | 'resumo';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SlicePipe, EnderecoFormComponent, UiButtonComponent, UiInputComponent, UiTextareaComponent, PushPermissaoModalComponent],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  readonly cart               = inject(CartService);
  private auth                = inject(AuthService);
  private pedidoService       = inject(PedidoService);
  private comandaService      = inject(ComandaService);
  readonly push               = inject(PushNotificationService);
  private pedidoLocalStorage  = inject(PedidoLocalStorageService);
  private pagamentoService    = inject(PagamentoService);
  private pedidosLive         = inject(PedidosLiveService);
  private enderecoService     = inject(EnderecoUsuarioService);
  private guestEnderecoService = inject(GuestEnderecoService);
  private marketingService    = inject(MarketingService);
  private horarioService      = inject(HorarioService);
  private router              = inject(Router);

  readonly loja  = computed(() => this.cart.lojaAtual());
  readonly mesa  = computed(() => this.cart.mesa());
  readonly comandaAtiva = signal<Comanda | null>(null);

  private readonly _lojaStatus = toSignal(
    toObservable(this.loja).pipe(
      switchMap(loja =>
        loja
          ? this.horarioService.sseStatus(loja.uuid).pipe(catchError(() => of(null)))
          : of(null)
      )
    )
  );

  readonly lojaAberta = computed(() => this._lojaStatus()?.aberta ?? true);
  readonly itens = computed(() => this.cart.itens());

  readonly isAuthenticated = this.auth.isAuthenticated;

  // ── Steps ────────────────────────────────────────────────────────────────────
  readonly step = signal<CheckoutStep>('endereco');

  readonly stepIndex = computed(() => {
    if (this.mesa()) {
      return ({ endereco: 0, pagamento: 0, resumo: 1 } as Record<string, number>)[this.step()] ?? 0;
    }
    return ({ endereco: 0, pagamento: 1, resumo: 2 } as Record<string, number>)[this.step()] ?? 0;
  });

  // ── Endereço ─────────────────────────────────────────────────────────────────
  readonly enderecosUsuario      = signal<EnderecoUsuario[]>([]);
  readonly enderecosGuestSalvos  = signal<EnderecoGuestSalvo[]>([]);
  enderecoSelecionadoUuid: string | null = null;
  enderecoGuestSelecionadoId: string | null = null;

  enderecoForm: EnderecoFormValue = {
    logradouro:  '',
    numero:      '',
    complemento: '',
    bairro:      '',
    cidade:      '',
    estado:      '',
    cep:         '',
  };

  get enderecoValido(): boolean {
    const f = this.enderecoForm;
    return (
      f.logradouro?.trim() !== '' &&
      f.numero?.trim()     !== '' &&
      f.bairro?.trim()     !== '' &&
      f.cidade?.trim()     !== '' &&
      f.estado?.trim()     !== ''
    );
  }

  // ── Pagamento ─────────────────────────────────────────────────────────────────
  formaPagamento = 'PIX';
  contato        = '';
  observacoes    = '';
  codigoCupom    = '';

  readonly formasPagamento = [
    { valor: 'PIX',      emoji: '📱' },
    { valor: 'Cartão',   emoji: '💳' },
    { valor: 'Dinheiro', emoji: '💵' },
  ];

  readonly cupomValidado = signal<Cupom | null>(null);
  readonly validandoCupom = signal(false);
  readonly cupomErro      = signal<string | null>(null);

  // PIX pagador (usuário não autenticado)
  readonly pagadorNome         = signal('');
  readonly pagadorCpf          = signal('');
  readonly pagadorCpfFormatted = signal('');
  readonly pagadorErro         = signal('');

  get pagamentoValido(): boolean {
    if (this.mesa()) {
      return this.formaPagamento !== '';
    }
    const base = this.formaPagamento !== '' && this.contato.length === 11;
    if (this.formaPagamento === 'PIX' && !this.auth.isAuthenticated()) {
      return base && this.pagadorNome().trim().length > 0 && validarCpf(this.pagadorCpf());
    }
    return base;
  }

  // ── Totais ────────────────────────────────────────────────────────────────────
  readonly taxaEntrega = computed(() => {
    if (this.mesa()) return 0;
    return Number(this.loja()?.taxa_entrega ?? 0);
  });

  readonly desconto = computed(() => {
    const cupom = this.cupomValidado();
    const loja  = this.loja();
    if (!cupom || !loja) return 0;
    const sub = this.cart.subtotal();
    if (cupom.tipo_desconto === 'percentual')  return (sub * cupom.valor_desconto) / 100;
    if (cupom.tipo_desconto === 'valor_fixo')  return Math.min(cupom.valor_desconto, sub);
    if (cupom.tipo_desconto === 'frete_gratis') return this.taxaEntrega();
    return 0;
  });

  readonly total = computed(() => {
    if (this.mesa()) {
      return Number(this.comandaAtiva()?.total ?? 0) + this.cart.subtotal();
    }
    if (!this.loja()) return this.cart.subtotal();
    return this.cart.subtotal() + this.taxaEntrega() - this.desconto();
  });

  // ── Submit / PIX ──────────────────────────────────────────────────────────────
  readonly submitting    = signal(false);
  readonly codigoCriado  = signal<string | null>(null);
  readonly pagamentoPix  = signal<CreatePagamentoResponse | null>(null);
  readonly pixPago       = signal(false);
  readonly copiado       = signal(false);

  private pixWsSub: Subscription | null = null;
  private copiadoTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  itemLabel(item: ReturnType<typeof this.itens>[number]): string {
    if (item.partes.length === 1) return item.partes[0].produto.nome;
    return item.partes.map((p, i) => `${i + 1}/${item.partes.length} ${p.produto.nome}`).join(' + ');
  }

  itemPreco(item: ReturnType<typeof this.itens>[number]): number {
    if (!item.partes.length) return 0;
    const base   = Math.max(...item.partes.map(p => Number(p.produto.preco)));
    const extras = item.partes.reduce(
      (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return (base + extras) * item.quantidade;
  }

  adicionaisLabel(item: ReturnType<typeof this.itens>[number]): string {
    return item.partes.flatMap(p => p.adicionais).map(a => a.nome).join(', ');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    if (!this.loja() || this.itens().length === 0) {
      this.router.navigate(['/']);
      return;
    }

    this.push.carregarVapidKey();

    if (this.mesa()) {
      this.step.set('pagamento');
      const loja = this.loja();
      if (loja) {
        this.comandaService.buscarComandaAtiva(loja.uuid, this.mesa()!)
          .pipe(catchError(() => of(null)))
          .subscribe(c => this.comandaAtiva.set(c));
      }
      return;
    }

    if (this.auth.isAuthenticated()) {
      this.enderecoService
        .listar()
        .pipe(catchError(() => of([])))
        .subscribe(list => this.enderecosUsuario.set(list));

      const celular = this.auth.celularUsuario();
      if (celular) this.contato = celular;
    } else {
      this.enderecosGuestSalvos.set(this.guestEnderecoService.listar());
    }
  }

  ngOnDestroy(): void {
    if (this.copiadoTimer) clearTimeout(this.copiadoTimer);
    this.pixWsSub?.unsubscribe();
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  avancar(): void {
    console.debug('[LOG-TEST] Avançando checkout', { passoAtual: this.step() });
    if (this.step() === 'endereco' && this.enderecoValido) {
      if (!this.auth.isAuthenticated()) {
        console.log('[LOG-TEST] Salvando endereço de guest');
        this.guestEnderecoService.salvar(this.enderecoForm);
        this.enderecosGuestSalvos.set(this.guestEnderecoService.listar());
      }
      this.step.set('pagamento');
      return;
    }
    if (this.step() === 'pagamento' && this.pagamentoValido) { 
      console.log('[LOG-TEST] Pagamento validado, indo para resumo');
      this.step.set('resumo'); 
      return; 
    }
  }

  voltar(): void {
    console.debug('[LOG-TEST] Voltando checkout', { passoAtual: this.step() });
    if (this.step() === 'pagamento' && !this.mesa()) { this.step.set('endereco');  return; }
    if (this.step() === 'resumo')                    { this.step.set('pagamento'); return; }
  }

  irParaHome(): void {
    this.router.navigate(['/']);
  }

  // ── Address ───────────────────────────────────────────────────────────────────
  selecionarEndereco(end: EnderecoUsuario): void {
    this.enderecoSelecionadoUuid     = end.uuid;
    this.enderecoGuestSelecionadoId  = null;
    this.enderecoForm = {
      logradouro:  end.logradouro,
      numero:      end.numero,
      complemento: end.complemento ?? '',
      bairro:      end.bairro,
      cidade:      end.cidade,
      estado:      end.estado,
      cep:         end.cep ?? '',
    };
  }

  selecionarEnderecoGuest(end: EnderecoGuestSalvo): void {
    this.enderecoGuestSelecionadoId = end.id;
    this.enderecoSelecionadoUuid    = null;
    this.enderecoForm = {
      logradouro:  end.logradouro,
      numero:      end.numero,
      complemento: end.complemento,
      bairro:      end.bairro,
      cidade:      end.cidade,
      estado:      end.estado,
      cep:         end.cep,
    };
  }

  onEnderecoInputChange(): void {
    this.enderecoSelecionadoUuid    = null;
    this.enderecoGuestSelecionadoId = null;
  }

  // ── Contact ───────────────────────────────────────────────────────────────────
  onContatoInput(event: Event): void {
    const input  = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);
    input.value  = formatPhone(digits);
    this.contato = digits;
  }

  onPagadorCpfInput(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 11);
    this.pagadorCpf.set(digits);
    const formatted = formatCpf(digits);
    this.pagadorCpfFormatted.set(formatted);
    (event.target as HTMLInputElement).value = formatted;
  }

  // ── Cupom ─────────────────────────────────────────────────────────────────────
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
      .subscribe(cupom => {
        if (cupom) {
          this.cupomValidado.set(cupom);
          this.validandoCupom.set(false);
        }
      });
  }

  removerCupom(): void {
    this.cupomValidado.set(null);
    this.codigoCupom   = '';
    this.cupomErro.set(null);
  }

  // ── PIX ───────────────────────────────────────────────────────────────────────
  copiarPix(): void {
    const pix = this.pagamentoPix()?.pix_copia_cola;
    if (!pix) return;
    navigator.clipboard.writeText(pix).then(() => {
      this.copiado.set(true);
      if (this.copiadoTimer) clearTimeout(this.copiadoTimer);
      this.copiadoTimer = setTimeout(() => this.copiado.set(false), 2000);
    });
  }

  irParaDetalhe(): void {
    const codigo = this.codigoCriado();
    if (codigo) this.router.navigate(['/pedidos', codigo]);
  }

  private _iniciarWatchPix(codigo: string): void {
    this.pixWsSub?.unsubscribe();
    this.pixWsSub = this.pedidosLive.acompanharPorCodigo(codigo).subscribe(pedido => {
      if (pedido.pago) {
        this.pixPago.set(true);
        this.pixWsSub?.unsubscribe();
        this.pixWsSub = null;
      }
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  confirmarPedido(): void {
    const loja = this.loja();
    if (!loja || this.itens().length === 0) {
      console.warn('[LOG-TEST] Tentativa de confirmar pedido com carrinho vazio ou sem loja');
      return;
    }

    console.info(`[LOG-TEST] Iniciando confirmação de pedido para a loja: ${loja.nome}`, {
      formaPagamento: this.formaPagamento,
      itensCount: this.itens().length
    });

    if (this.auth.isAuthenticated()) {
      this.push.subscribe();
    }

    const mesa = this.mesa();
    const f = this.enderecoForm;
    const body: CreatePedidoRequest = {
      loja_uuid:       loja.uuid,
      taxa_entrega:    this.taxaEntrega(),
      forma_pagamento: this.formaPagamento,
      observacoes:     this.observacoes || null,
      contato:         this.contato || null,
      codigo_cupom:    this.cupomValidado()?.codigo ?? null,
      origem:          mesa ? 'mesa' : undefined,
      numero_mesa:     mesa ?? null,
      itens: this.itens().map(item => ({
        quantidade: item.quantidade,
        partes: item.partes.map(p => ({
          produto_uuid: p.produto.uuid,
          adicionais:   p.adicionais.map(a => a.uuid),
        })),
      })),
      endereco_entrega: mesa ? null : {
        logradouro:  f.logradouro,
        numero:      f.numero,
        complemento: f.complemento || null,
        bairro:      f.bairro,
        cidade:      f.cidade,
        estado:      f.estado,
        cep:         f.cep || null,
      },
    };

    const isAuth  = this.auth.isAuthenticated();
    const isPix   = this.formaPagamento === 'PIX';
    const pagador = isPix && !isAuth
      ? { nome: this.pagadorNome().trim(), cpf: this.pagadorCpf() }
      : undefined;

    console.log('[CHECKOUT] criar pedido — payload:', JSON.stringify(body, null, 2));

    this.submitting.set(true);

    this.pedidoService.criar(body).subscribe({
      next: res => {
        if (!isAuth) {
          this.push.subscribePorPedido(res.uuid);
        }

        this.pedidoService.buscarPorCodigo(res.codigo).pipe(catchError(() => of(null)))
          .subscribe(pedido => {
            if (pedido) this.pedidoLocalStorage.salvar(pedido);

            if (isPix) {
              this.pagamentoService.criar(res.uuid, pagador).subscribe({
                next: pix => {
                  this.submitting.set(false);
                  this.codigoCriado.set(res.codigo);
                  this.pagamentoPix.set(pix);
                  this.cart.limpar();
                  this._iniciarWatchPix(res.codigo);
                },
                error: () => {
                  toast.error('Pedido criado, mas falha ao gerar PIX. Pague na tela do pedido.');
                  this.submitting.set(false);
                  this.cart.limpar();
                  if (isAuth) this.router.navigate(['/pedidos', res.codigo]);
                  else this.codigoCriado.set(res.codigo);
                },
              });
            } else {
              this.submitting.set(false);
              this.cart.limpar();
              if (isAuth) {
                toast.success(`Pedido criado! Código: ${res.codigo}`);
                this.router.navigate(['/pedidos', res.codigo]);
              } else {
                this.codigoCriado.set(res.codigo);
              }
            }
          });
      },
      error: (err: { error?: string }) => {
        const msg = err?.error === 'Loja está fechada'
          ? 'A loja está fechada no momento.'
          : 'Erro ao criar pedido. Tente novamente.';
        toast.error(msg);
        this.submitting.set(false);
      },
    });
  }
}
