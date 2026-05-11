import { Component, inject, computed, signal, effect, untracked } from '@angular/core';
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
  selector: 'app-funcionario-panel',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  templateUrl: './funcionario-panel.component.html',
})
export class FuncionarioPanelComponent {
  private route = inject(ActivatedRoute);
  private liveService = inject(PedidosLiveService);
  private funcionarioService = inject(FuncionarioService);
  private auth = inject(AuthService);
  private pedidoService = inject(PedidoService);

  readonly connectionStatus = this.liveService.connectionStatus;

  // --- Áudio e Silenciamento ---
  private readonly MUTE_KEY = 'chickie_kds_muted';
  readonly isMuted = signal(localStorage.getItem(this.MUTE_KEY) === 'true');
  private audio = new Audio(environment.NOTIFICATION_PATH);

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

  // Streams de pedidos por status
  readonly confirmados = this.createStream('confirmado_pela_loja');
  readonly emPreparo = this.createStream('em_preparo');
  readonly prontos = this.createStream('pronto');

  constructor() {
    console.info('[OBSERVABILITY] FuncionarioPanelComponent - Initializing employee panel');
    // Efeito para detectar mudanças nos pedidos e tocar som
    effect(() => {
      const c = this.confirmados();
      const e = this.emPreparo();
      const p = this.prontos();
      
      console.debug(`[OBSERVABILITY] FuncionarioPanelComponent - Orders updated. Confirmados: ${c.length}, Em Preparo: ${e.length}, Prontos: ${p.length}`);

      // Sempre que qualquer lista mudar e houver itens, tentamos tocar o som
      if (c.length > 0 || e.length > 0 || p.length > 0) {
        untracked(() => this.notificarSom());
      }
    });
  }

  private createStream(status: StatusPedido) {
    return toSignal(
      toObservable(this.lojaUuid).pipe(
        filter((uuid): uuid is string => !!uuid),
        switchMap(uuid => {
          const t = this.token();
          if (!t) return of([] as Pedido[]);
          return this.liveService.conectar(uuid, status, t);
        }),
        catchError(() => of([] as Pedido[]))
      ),
      { initialValue: [] as Pedido[] }
    );
  }
  
  toggleMute() {
    this.isMuted.update(m => {
      const newVal = !m;
      localStorage.setItem(this.MUTE_KEY, String(newVal));
      return newVal;
    });
  }

  notificarSom(force = false) {
    if (this.isMuted() && !force) return;
    
    this.audio.play().catch(err => {
      // Navegadores bloqueiam áudio sem interação prévia.
      console.warn('[KDS] Bloqueio de áudio pelo navegador:', err);
      if (force) {
        toast.error('O áudio foi bloqueado pelo navegador. Clique na tela e tente novamente.');
      }
    });
  }

  avancar(pedido: Pedido) {
    // Restrição: KDS só controla estados até "pronto".
    if (pedido.status === 'pronto') {
      toast.error('O Painel de Cozinha não pode despachar pedidos prontos.');
      return;
    }
    
    this.pedidoService.avancar(pedido.uuid, false).subscribe({
      next: () => {
        toast.success(`Pedido #${pedido.codigo} atualizado!`);
      },
      error: (err) => {
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
}
