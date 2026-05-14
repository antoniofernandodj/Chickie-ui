import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { FuncionarioService } from '../../core/services/funcionario.service';
import { AdminPedidosTabComponent } from '../admin/components/admin-pedidos-tab.component';
import { StatusPedido } from '../../core/models';

@Component({
  selector: 'app-funcionario-pedidos',
  standalone: true,
  imports: [AdminPedidosTabComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">Pedidos da Loja</h1>
          <p class="text-sm text-gray-500 mt-1">Gerencie e avance os pedidos recebidos</p>
        </div>

        @if (lojaUuid()) {
          <admin-pedidos-tab
            [lojaUuid]="lojaUuid()!"
            [excludeStatuses]="excludeStatuses"
          />
        } @else if (carregando()) {
          <div class="flex items-center justify-center py-20">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2" style="border-color: var(--color-brand)"></div>
          </div>
        } @else {
          <div class="text-center py-20 text-gray-400">
            <p class="text-sm">Não foi possível carregar os dados da loja.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class FuncionarioPedidosComponent {
  readonly excludeStatuses: StatusPedido[] = ['entregue'];

  private funcionarioSvc = inject(FuncionarioService);

  readonly carregando = signal(true);

  readonly _funcionario = toSignal(
    this.funcionarioSvc.getMe().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  readonly lojaUuid = computed(() => {
    const f = this._funcionario();
    if (f !== null) this.carregando.set(false);
    return f?.loja_uuid ?? null;
  });
}
