import { Component, inject, input, signal, effect } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ConfigPedidoService } from '../../../core/services/config-pedido.service';
import { ConfiguracaoDePedidosLoja, TipoCalculoPedido } from '../../../core/models';
import { UiInputComponent, UiSelectComponent, UiButtonComponent } from '../../../shared/components';

@Component({
  selector: 'admin-config-pedido-tab',
  standalone: true,
  imports: [ReactiveFormsModule, UiInputComponent, UiSelectComponent, UiButtonComponent],
  template: `
    <div class="max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-900 mb-5">⚙️ Configuração de Pedidos</h3>

      @if (configPedidoError()) {
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {{ configPedidoError() }}
        </div>
      }

      @if (configPedidoLoading()) {
        <div class="flex items-center justify-center py-12">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2"
            style="border-color: var(--color-brand)"
          ></div>
        </div>
      } @else {
        <form
          [formGroup]="configPedidoForm"
          (ngSubmit)="salvarConfigPedido()"
          class="space-y-5"
        >
          <ui-input
            formControlName="max_partes"
            type="number"
            label="Máximo de Partes por Item *"
            size="sm"
            min="1"
            max="8"
            step="1"
            hint="Quantidade máxima de partes/porções que um item pode ter."
            [error]="
              fcp.max_partes.invalid && fcp.max_partes.touched ? 'Valor deve ser entre 1 e 8' : null
            "
          />
          <ui-select
            formControlName="tipo_calculo"
            label="Tipo de Cálculo para Partes *"
            size="sm"
            hint="Como calcular o preço quando o cliente pede partes de itens diferentes."
            [error]="fcp.tipo_calculo.invalid && fcp.tipo_calculo.touched ? 'Selecione um tipo' : null"
          >
            <option value="mais_caro">Preço do item mais caro</option>
            <option value="media_ponderada">Média ponderada dos preços</option>
          </ui-select>
          <ui-button
            type="submit"
            [disabled]="configPedidoLoadingSubmit()"
            [loading]="configPedidoLoadingSubmit()"
            size="sm"
            [fullWidth]="true"
          >
            💾 Salvar Configuração
          </ui-button>
        </form>
      }
    </div>
  `,
})
export class AdminConfigPedidoTabComponent {
  lojaUuid = input.required<string>();

  private configPedidoService = inject(ConfigPedidoService);
  private fb = inject(FormBuilder);

  configPedidoData = signal<ConfiguracaoDePedidosLoja | null>(null);
  configPedidoLoading = signal(false);
  configPedidoLoadingSubmit = signal(false);
  configPedidoError = signal('');

  configPedidoForm = this.fb.group({
    max_partes: [4, [Validators.required, Validators.min(1), Validators.max(8)]],
    tipo_calculo: ['mais_caro' as TipoCalculoPedido, Validators.required],
  });

  get fcp() { return this.configPedidoForm.controls; }

  constructor() {
    // Vazio - carregar no effect
  }

  private carregarEffect = effect(() => {
    const uuid = this.lojaUuid();
    if (uuid) {
      this.carregarConfigPedido();
    }
  });

  carregarConfigPedido() {
    const uuid = this.lojaUuid();
    if (!uuid) return;
    this.configPedidoLoading.set(true);
    this.configPedidoError.set('');
    this.configPedidoService.getConfigPedido(uuid).subscribe({
      next: (config) => {
        this.configPedidoData.set(config);
        this.configPedidoForm.patchValue({ max_partes: Number(config.max_partes), tipo_calculo: config.tipo_calculo });
        this.configPedidoLoading.set(false);
      },
      error: () => {
        this.configPedidoData.set(null);
        this.configPedidoForm.reset({ max_partes: 4, tipo_calculo: 'mais_caro' });
        this.configPedidoLoading.set(false);
      },
    });
  }

  salvarConfigPedido() {
    if (this.configPedidoForm.invalid) { this.configPedidoForm.markAllAsTouched(); return; }
    const fv = this.configPedidoForm.getRawValue();
    this.configPedidoLoadingSubmit.set(true);
    this.configPedidoError.set('');
    this.configPedidoService.saveConfigPedido(this.lojaUuid(), {
      max_partes: fv.max_partes != null ? Number(fv.max_partes) : null,
      tipo_calculo: fv.tipo_calculo || "mais_caro",
    }).subscribe({
      next: () => {
        this.configPedidoLoadingSubmit.set(false);
        toast.success('Configuração de pedidos salva com sucesso!');
        this.carregarConfigPedido();
      },
      error: (e) => {
        this.configPedidoLoadingSubmit.set(false);
        this.configPedidoError.set(e?.error?.error ?? 'Erro ao salvar configuração.');
      },
    });
  }
}
