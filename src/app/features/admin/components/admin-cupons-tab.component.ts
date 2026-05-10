import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BehaviorSubject, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { MarketingService } from '../../../core/services/marketing.service';
import { Cupom, CreateCupomRequest, UpdateCupomRequest, TipoDesconto } from '../../../core/models';
import { UiInputComponent, UiSelectComponent, UiTextareaComponent, UiButtonComponent } from '../../../shared/components';
import { AdminEditBtnComponent } from './admin-edit-btn.component';
import { AdminRemoveBtnComponent } from './admin-remove-btn.component';

@Component({
  selector: 'admin-cupons-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, DatePipe,
    UiInputComponent, UiSelectComponent, UiTextareaComponent, UiButtonComponent,
    AdminEditBtnComponent, AdminRemoveBtnComponent,
  ],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Formulário de Cupom -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          @if (cupomEditId()) { 📝 Editar Cupom } @else { 🎟️ Criar Cupom de Desconto }
        </h3>

        <form [formGroup]="cupomForm" (ngSubmit)="cupomEditId() ? salvarEdicaoCupom() : criarCupom()" class="space-y-3">
          <ui-input formControlName="codigo" label="Código *" size="sm" placeholder="PROMO10"
                    [error]="fcup.codigo.invalid && fcup.codigo.touched ? 'Código obrigatório (mín. 3 caracteres)' : null"/>
          <ui-textarea formControlName="descricao" label="Descrição *" size="sm" [rows]="2" placeholder="Ganhe 10% de desconto"
                       [error]="fcup.descricao.invalid && fcup.descricao.touched ? 'Descrição é obrigatória' : null"/>
          <ui-select formControlName="tipo_desconto" label="Tipo de Desconto *" size="sm">
            <option value="percentual">Percentual (%)</option>
            <option value="valor_fixo">Fixo (R$)</option>
            <option value="frete_gratis">Frete Grátis</option>
          </ui-select>
          <ui-input formControlName="valor_desconto" type="number" size="sm" min="0" step="0.01"
                    [label]="cupomForm.get('tipo_desconto')?.value === 'percentual' ? 'Valor do Desconto (%) *' : cupomForm.get('tipo_desconto')?.value === 'valor_fixo' ? 'Valor do Desconto (R$) *' : 'Valor do Desconto (R$)'"
                    [error]="fcup.valor_desconto.invalid && fcup.valor_desconto.touched ? 'Valor obrigatório e deve ser >= 0' : null"/>
          <ui-input formControlName="valor_minimo" type="number" size="sm" min="0" step="0.01"
                    [label]="cupomForm.get('tipo_desconto')?.value === 'frete_gratis' ? 'Pedido Mínimo (R$)' : 'Pedido Mínimo (R$) *'"
                    [error]="fcup.valor_minimo.invalid && fcup.valor_minimo.touched ? 'Pedido mínimo obrigatório e deve ser >= 0' : null"/>
          <ui-input formControlName="data_validade" type="date" label="Data de Validade *" size="sm"
                    [error]="fcup.data_validade.invalid && fcup.data_validade.touched ? 'Data de validade é obrigatória' : null"/>
          <ui-input formControlName="limite_uso" type="number" label="Limite de Uso *" size="sm" min="0" step="1" placeholder="0 = ilimitado"
                    [error]="fcup.limite_uso.invalid && fcup.limite_uso.touched ? 'Limite obrigatório e deve ser >= 0' : null"/>

          @if (cupomError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ cupomError() }}</p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button type="submit" [disabled]="cupomLoadingSubmit() || cupomForm.invalid" [loading]="cupomLoadingSubmit()" size="sm" [fullWidth]="true">
                @if (cupomEditId()) { Atualizar Cupom } @else { Criar Cupom }
              </ui-button>
            </div>
            @if (cupomEditId()) {
              <ui-button type="button" variant="secondary" size="sm" (click)="cancelarEdicaoCupom()">Cancelar</ui-button>
            }
          </div>
        </form>
      </div>

      <!-- Lista de Cupons -->
      <div>
        <h3 class="text-base font-semibold text-gray-900 mb-5">🎟️ Cupons da Loja</h3>

        @if (cupomLoading()) {
          <div class="space-y-3">
            @for (_ of [1,2,3]; track $index) {
              <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-20"></div>
            }
          </div>
        } @else {
          @let cuponsDaLoja = cupons().filter(c => c.loja_uuid === lojaUuid());
          @if (cuponsDaLoja.length === 0) {
            <div class="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <div class="text-4xl mb-2">🎟️</div>
              <p class="text-gray-500 text-sm">Nenhum cupom cadastrado.</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (cupom of cuponsDaLoja; track cupom.uuid) {
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:border-orange-200 transition-colors"
                     [class.border-green-200]="cupom.status === 'Ativo'"
                     [class.border-red-200]="cupom.status === 'Inativo'"
                     [class.border-gray-300]="cupom.status === 'Expirado'">
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-mono font-bold text-sm bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                          {{ cupom.codigo }}
                        </span>
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                              [class.bg-green-100]="cupom.status === 'Ativo'"
                              [class.text-green-700]="cupom.status === 'Ativo'"
                              [class.bg-red-100]="cupom.status === 'Inativo'"
                              [class.text-red-700]="cupom.status === 'Inativo'"
                              [class.bg-gray-100]="cupom.status === 'Expirado'"
                              [class.text-gray-700]="cupom.status === 'Expirado'">
                          {{ cupom.status }}
                        </span>
                      </div>
                      <p class="text-xs text-gray-600">{{ cupom.descricao }}</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    <div>
                      <span class="font-medium">Desconto:</span>
                      @if (cupom.tipo_desconto === 'percentual') {
                        {{ cupom.valor_desconto }}%
                      } @else {
                        R$ {{ cupom.valor_desconto | number:'1.2-2' }}
                      }
                    </div>
                    <div>
                      <span class="font-medium">Pedido mín.:</span> R$ {{ cupom.valor_minimo | number:'1.2-2' }}
                    </div>
                    <div>
                      <span class="font-medium">Validade:</span> {{ cupom.data_validade | date:'dd/MM/yyyy' }}
                    </div>
                    <div>
                      <span class="font-medium">Usos:</span> {{ cupom.uso_atual }} / {{ cupom.limite_uso || '∞' }}
                    </div>
                  </div>

                  <div class="flex gap-1.5">
                    <div class="flex-1">
                      <ui-button size="xs" [fullWidth]="true" [variant]="cupom.status === 'Ativo' ? 'danger' : 'secondary'" (click)="toggleStatusCupom(cupom)">
                        @if (cupom.status === 'Ativo') { Desativar } @else { Ativar }
                      </ui-button>
                    </div>
                    <admin-edit-btn (edit)="editarCupom(cupom)"/>
                    <admin-remove-btn (remove)="deletarCupom(cupom.uuid, cupom.codigo)"/>
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class AdminCuponsTabComponent {
  lojaUuid = input.required<string>();

  private marketingService = inject(MarketingService);
  private fb = inject(FormBuilder);

  private readonly refreshCupomTrigger = new BehaviorSubject<void>(undefined);
  private readonly _cupons = toSignal(
    this.refreshCupomTrigger.pipe(
      switchMap(() => this.marketingService.listarCupons().pipe(catchError(() => of([] as Cupom[])))),
    ),
    { initialValue: [] as Cupom[] },
  );
  readonly cupomLoading = computed(() => this._cupons() === undefined);
  readonly cupons = computed(() => this._cupons() ?? []);

  private refreshCupons() { this.refreshCupomTrigger.next(); }

  cupomForm = this.fb.group({
    codigo: ['', [Validators.required, Validators.minLength(3)]],
    descricao: ['', Validators.required],
    tipo_desconto: ['percentual' as TipoDesconto, Validators.required],
    valor_desconto: [0, [Validators.required, Validators.min(0)]],
    valor_minimo: [0, [Validators.required, Validators.min(0)]],
    data_validade: ['', Validators.required],
    limite_uso: [0, [Validators.required, Validators.min(0)]],
  });

  cupomLoadingSubmit = signal(false);
  cupomError = signal('');
  cupomEditId = signal<string | null>(null);

  get fcup() { return this.cupomForm.controls; }

  constructor() {
    this.refreshCupons();

    const tipoDescontoControl = this.cupomForm.get('tipo_desconto');
    if (tipoDescontoControl) {
      tipoDescontoControl.valueChanges.subscribe(tipo => {
        const valorDescontoControl = this.cupomForm.get('valor_desconto');
        const valorMinimoControl = this.cupomForm.get('valor_minimo');
        if (tipo === 'frete_gratis') {
          valorDescontoControl?.setValue(0);
          valorMinimoControl?.setValue(0);
          valorDescontoControl?.disable();
          valorMinimoControl?.disable();
          valorDescontoControl?.clearValidators();
          valorMinimoControl?.clearValidators();
        } else {
          valorDescontoControl?.enable();
          valorMinimoControl?.enable();
          valorDescontoControl?.setValidators([Validators.required, Validators.min(0)]);
          valorMinimoControl?.setValidators([Validators.required, Validators.min(0)]);
        }
        valorDescontoControl?.updateValueAndValidity();
        valorMinimoControl?.updateValueAndValidity();
      });
    }
  }

  criarCupom() {
    if (this.cupomForm.invalid) { this.cupomForm.markAllAsTouched(); return; }
    this.cupomLoadingSubmit.set(true);
    this.cupomError.set('');
    const fv = this.cupomForm.value;
    const dataValidadeIso = fv.data_validade ? `${fv.data_validade}T23:59:59Z` : undefined;
    this.marketingService.criarCupom({
      loja_uuid: this.lojaUuid(),
      codigo: fv.codigo!,
      descricao: fv.descricao!,
      tipo_desconto: fv.tipo_desconto!,
      valor_desconto: fv.valor_desconto!,
      valor_minimo: fv.valor_minimo!,
      data_validade: dataValidadeIso!,
      limite_uso: fv.limite_uso!,
    } as any).subscribe({
      next: () => {
        this.cupomLoadingSubmit.set(false);
        toast.success('Cupom criado com sucesso!');
        this.cupomForm.reset({ tipo_desconto: 'percentual', valor_desconto: 0, valor_minimo: 0, limite_uso: 0 });
        this.refreshCupons();
      },
      error: (e) => { this.cupomLoadingSubmit.set(false); this.cupomError.set(e?.error?.error ?? 'Erro ao criar cupom.'); },
    });
  }

  editarCupom(cupom: Cupom) {
    this.cupomEditId.set(cupom.uuid);
    this.cupomForm.patchValue({
      codigo: cupom.codigo, descricao: cupom.descricao, tipo_desconto: cupom.tipo_desconto,
      valor_desconto: cupom.valor_desconto, valor_minimo: cupom.valor_minimo,
      data_validade: cupom.data_validade, limite_uso: cupom.limite_uso,
    });
    this.cupomError.set('');
  }

  salvarEdicaoCupom() {
    const uuid = this.cupomEditId();
    if (!uuid) return;
    if (this.cupomForm.invalid) { this.cupomForm.markAllAsTouched(); return; }
    this.cupomLoadingSubmit.set(true);
    this.cupomError.set('');
    const fv = this.cupomForm.value;
    const dataValidadeIso = fv.data_validade ? `${fv.data_validade}T23:59:59Z` : undefined;
    const updateRequest: UpdateCupomRequest = {
      codigo: fv.codigo ?? undefined, descricao: fv.descricao ?? undefined,
      tipo_desconto: fv.tipo_desconto ?? undefined, valor_desconto: fv.valor_desconto ?? undefined,
      valor_minimo: fv.valor_minimo ?? undefined, data_validade: dataValidadeIso,
      limite_uso: fv.limite_uso ?? undefined,
    };
    this.marketingService.atualizarCupom(uuid, updateRequest).subscribe({
      next: () => {
        this.cupomLoadingSubmit.set(false);
        this.cupomEditId.set(null);
        toast.success('Cupom atualizado com sucesso!');
        this.cupomForm.reset({ tipo_desconto: 'percentual', valor_desconto: 0, valor_minimo: 0, limite_uso: 0 });
        this.refreshCupons();
      },
      error: (e) => { this.cupomLoadingSubmit.set(false); this.cupomError.set(e?.error?.error ?? 'Erro ao atualizar cupom.'); },
    });
  }

  cancelarEdicaoCupom() {
    this.cupomEditId.set(null);
    this.cupomForm.reset({ tipo_desconto: 'percentual', valor_desconto: 0, valor_minimo: 0, limite_uso: 0 });
    this.cupomError.set('');
  }

  deletarCupom(uuid: string, codigo: string) {
    if (!confirm(`Deletar cupom "${codigo}"? Esta ação não pode ser desfeita.`)) return;
    this.marketingService.deletarCupom(uuid).subscribe({
      next: () => {
        toast.success('Cupom deletado com sucesso!');
        if (this.cupomEditId() === uuid) this.cancelarEdicaoCupom();
        this.refreshCupons();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar cupom.'),
    });
  }

  toggleStatusCupom(cupom: Cupom) {
    const novoStatus = cupom.status === 'Ativo' ? 'Inativo' : 'Ativo';
    this.marketingService.atualizarStatusCupom(cupom.uuid, novoStatus === 'Ativo').subscribe({
      next: () => {
        toast.success(`Cupom "${cupom.codigo}" agora está ${novoStatus === 'Ativo' ? 'ativo' : 'inativo'}.`);
        this.refreshCupons();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao alterar status do cupom.'),
    });
  }
}
