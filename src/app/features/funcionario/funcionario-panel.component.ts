import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, filter, map } from 'rxjs';
import { toast } from 'ngx-sonner';
import { PedidosLiveService } from '../../core/services/pedidos-live.service';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { AuthService } from '../../core/services/auth.service';
import { PedidoService } from '../../core/services/pedido.service';
import { Pedido, StatusPedido } from '../../core/models';

@Component({
  selector: 'app-funcionario-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './funcionario-panel.component.html',
})
export class FuncionarioPanelComponent {
  private route = inject(ActivatedRoute);
  private liveService = inject(PedidosLiveService);
  private funcionarioService = inject(FuncionarioService);
  private auth = inject(AuthService);
  private pedidoService = inject(PedidoService);

  readonly connectionStatus = this.liveService.connectionStatus;

  // Carrega dados do funcionário para obter loja_uuid
  readonly _funcionario = toSignal(
    this.funcionarioService.getMe().pipe(
      catchError(() => of(null))
    )
  );
  
  readonly _routeLojaUuid = toSignal(
    this.route.paramMap.pipe(map(params => params.get('loja_uuid')))
  );

  readonly lojaUuid = computed(() => this._routeLojaUuid() || this._funcionario()?.loja_uuid);
  readonly token = this.auth.token;

  // Streams de pedidos por status
  readonly confirmados = this.createStream('confirmado_pela_loja');
  readonly emPreparo = this.createStream('em_preparo');
  readonly prontos = this.createStream('pronto');

  private createStream(status: StatusPedido) {
    return toSignal(
      toObservable(this.lojaUuid).pipe(
        filter(uuid => !!uuid),
        switchMap(uuid => {
          const t = this.token();
          if (!t) return of([] as Pedido[]);
          return this.liveService.conectar(uuid!, status, t);
        }),
        catchError(() => of([] as Pedido[]))
      ),
      { initialValue: [] as Pedido[] }
    );
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
