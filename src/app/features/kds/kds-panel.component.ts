import { Component, inject, computed, signal, effect, untracked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiButtonComponent } from '../../shared/components';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, filter, map } from 'rxjs';
import { toast } from 'ngx-sonner';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { AuthService } from '../../core/services/auth.service';
import { PedidoService } from '../../core/services/pedido.service';
import { Pedido, StatusPedido } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-kds-panel',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  templateUrl: './kds-panel.component.html',
})
export class KdsPanelComponent {
  private route = inject(ActivatedRoute);
  private liveService = inject(PedidosLiveService);
  private funcionarioService = inject(FuncionarioService);
  private auth = inject(AuthService);
  private pedidoService = inject(PedidoService);

  readonly connectionStatus = this.liveService.connectionStatus;

  // --- Tela Cheia ---
  readonly isFullscreen = signal(false);

  // --- Detalhes do Pedido ---
  readonly selectedPedido = signal<Pedido | null>(null);

  // --- Áudio e Silenciamento ---
  private readonly MUTE_KEY = 'chickie_kds_muted';
  readonly isMuted = signal(localStorage.getItem(this.MUTE_KEY) === 'true');
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audio: HTMLAudioElement | null = null;

  readonly _routeLojaUuid = toSignal<string | null>(
    this.route.paramMap.pipe(map(params => params.get('loja_uuid')))
  );

  // Carrega dados do funcionário apenas se necessário (não admin)
  readonly _funcionario = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const routeUuid = params.get('loja_uuid');
        if (routeUuid || !this.auth.isFuncionario()) {
          return of(null);
        }
        return this.funcionarioService.getMe().pipe(catchError(() => of(null)));
      })
    )
  );
  
  readonly lojaUuid = computed(() => this._routeLojaUuid() || this._funcionario()?.loja_uuid || null);
  readonly token = this.auth.token;

  // Stream KDS completo (uma única conexão SSE)
  private readonly kdsStream = toSignal(
    toObservable(this.lojaUuid).pipe(
      filter((uuid): uuid is string => !!uuid),
      switchMap(uuid => {
        const t = this.token();
        if (!t) return of(null);
        return this.liveService.conectarKds(uuid, t);
      }),
      catchError(() => of(null))
    )
  );

  readonly confirmados = computed(() => this.kdsStream()?.confirmados || []);
  readonly emPreparo = computed(() => this.kdsStream()?.em_preparo || []);
  readonly prontos = computed(() => this.kdsStream()?.prontos || []);

  constructor() {
    console.info('[OBSERVABILITY] KdsPanelComponent - Initializing KDS panel');
    // Efeito para detectar mudanças nos pedidos e tocar som
    effect(() => {
      const c = this.confirmados();
      const e = this.emPreparo();
      const p = this.prontos();

      console.debug(`[OBSERVABILITY] KdsPanelComponent - Orders updated. Confirmados: ${c.length}, Em Preparo: ${e.length}, Prontos: ${p.length}`);

      // Sempre que qualquer lista mudar e houver itens, tentamos tocar o som
      if (c.length > 0 || e.length > 0 || p.length > 0) {
        untracked(() => this.notificarSom());
      }
    });

    // Fecha o modal ao receber qualquer atualização do stream (dados podem ter mudado)
    effect(() => {
      this.kdsStream();
      untracked(() => {
        if (this.selectedPedido() !== null) {
          console.debug('[OBSERVABILITY] KdsPanelComponent - Closing details modal due to stream update');
          this.selectedPedido.set(null);
        }
      });
    });
  }


  
  toggleMute() {
    this.isMuted.update(m => {
      const newVal = !m;
      console.info(`[OBSERVABILITY] KdsPanelComponent - Toggling mute. Now: ${newVal}`);
      localStorage.setItem(this.MUTE_KEY, String(newVal));
      return newVal;
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      console.info('[OBSERVABILITY] KdsPanelComponent - Entering fullscreen');
      document.documentElement.requestFullscreen().then(() => {
        this.isFullscreen.set(true);
      }).catch(err => {
        console.error('[OBSERVABILITY] KdsPanelComponent - Error entering fullscreen', err);
        toast.error(`Erro ao entrar em tela cheia: ${err.message}`);
      });
    } else {
      console.info('[OBSERVABILITY] KdsPanelComponent - Exiting fullscreen');
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          this.isFullscreen.set(false);
        });
      }
    }
  }

  abrirDetalhes(pedido: Pedido) {
    console.debug(`[OBSERVABILITY] KdsPanelComponent - Opening details for order #${pedido.codigo}`);
    this.selectedPedido.set(pedido);
  }

  fecharDetalhes() {
    console.debug('[OBSERVABILITY] KdsPanelComponent - Closing details');
    this.selectedPedido.set(null);
  }

  async notificarSom(force = false) {
    if (this.isMuted() && !force) return;
    
    try {
      // Inicializar contexto de áudio na primeira interação do usuário
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Carregar buffer de áudio se necessário
      if (!this.audioBuffer) {
        const response = await fetch(environment.NOTIFICATION_PATH);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      }
      
      // Criar e tocar o áudio
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      
    } catch (err) {
      // Fallback para áudio HTML5 se o Web Audio API falhar
      try {
        if (!this.audio) {
          this.audio = new Audio(environment.NOTIFICATION_PATH);
        }
        await this.audio.play();
      } catch (html5Err) {
        console.warn('[KDS] Bloqueio de áudio pelo navegador:', html5Err);
        if (force) {
          toast.error('O áudio foi bloqueado pelo navegador. Clique na tela e tente novamente.');
        }
      }
    }
  }

  avancar(pedido: Pedido) {
    console.info(`[OBSERVABILITY] KdsPanelComponent - Advancing status for order #${pedido.codigo}. Current: ${pedido.status}`);
    // Restrição: KDS só controla estados até "pronto".
    if (pedido.status === 'pronto') {
      console.warn('[OBSERVABILITY] KdsPanelComponent - Cannot advance order beyond "pronto"');
      toast.error('O Painel de Cozinha não pode despachar pedidos prontos.');
      return;
    }
    
    this.pedidoService.avancar(pedido.uuid, false).subscribe({
      next: (res) => {
        console.info(`[OBSERVABILITY] KdsPanelComponent - Order #${pedido.codigo} advanced. New status: ${res.status}`);
        toast.success(`Pedido #${pedido.codigo} atualizado!`);
      },
      error: (err) => {
        console.error(`[OBSERVABILITY] KdsPanelComponent - Error advancing order #${pedido.codigo}`, err);
        toast.error(err?.error?.error || 'Erro ao atualizar pedido');
      }
    });
  }

  getStatusLabel(status: StatusPedido): string {
    switch (status) {
      case 'confirmado_pela_loja': return 'Confirmado';
      case 'em_preparo': return 'Em Preparo';
      case 'pronto': return 'Pronto';
      default: return status;
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.isFullscreen.set(!!document.fullscreenElement);
  }
}