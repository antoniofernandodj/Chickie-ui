import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { Adicional, CreateAdicionalRequest } from '../../../core/models';
import { UiInputComponent, UiTextareaComponent, UiButtonComponent } from '../../../shared/components';
import { AdminToggleAvailableBtnComponent } from './admin-toggle-available-btn.component';
import { AdminEditBtnComponent } from './admin-edit-btn.component';
import { AdminRemoveBtnComponent } from './admin-remove-btn.component';

@Component({
  selector: 'admin-adicionais-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, DatePipe,
    UiInputComponent, UiTextareaComponent, UiButtonComponent,
    AdminToggleAvailableBtnComponent, AdminEditBtnComponent, AdminRemoveBtnComponent,
  ],
  styles: `
    @keyframes cascadeFadeIn {
      0% { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .cascade-item {
      opacity: 0;
      animation: cascadeFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
  `,
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Lista de adicionais -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          🧀 Adicionais Cadastrados
        </h3>

        @if (adcLoading()) {
          @for (_ of [1,2,3]; track $index) {
            <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-16"></div>
          }
        } @else if (adicionais().length === 0) {
          <p class="text-xs text-gray-400 text-center py-4">
            Nenhum adicional cadastrado.
          </p>
        } @else {
          <div class="space-y-2">
            @for (adc of adicionais(); track adc.uuid) {
              <div
                class="cascade-item bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-orange-200 transition-colors"
                [style.animation-delay]="$index * 40 + 'ms'"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-900 truncate">
                    {{ adc.nome }}
                  </p>
                  @if (adc.descricao) {
                    <p class="text-xs text-gray-500 truncate">
                      {{ adc.descricao }}
                    </p>
                  }
                  <p class="text-xs text-gray-400 mt-1">
                    Criado em {{ adc.criado_em | date:'dd/MM/yyyy' }}
                  </p>
                </div>
                <div class="flex items-center gap-3 shrink-0 ml-3">
                  <div class="text-right">
                    <p class="text-sm font-semibold text-gray-900">
                      R$ {{ adc.preco | number:'1.2-2' }}
                    </p>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      [class.bg-green-100]="adc.disponivel"
                      [class.text-green-700]="adc.disponivel"
                      [class.bg-red-100]="!adc.disponivel"
                      [class.text-red-700]="!adc.disponivel">
                        {{ adc.disponivel ? 'Disponível' : 'Indisponível' }}
                    </span>
                  </div>
                  <div class="flex gap-1">
                    <admin-toggle-available-btn
                      [available]="adc.disponivel"
                      (toggle)="
                        toggleDisponibilidadeAdicional(
                          adc.uuid,
                          adc.nome,
                          adc.disponivel
                        )
                    "/>
                    <admin-edit-btn
                      (edit)="editarAdicional(adc)"
                    />
                    <admin-remove-btn
                      (remove)="deletarAdicional(adc.uuid, adc.nome)"
                    />
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Criar/Editar Adicional -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          @if (adcEditId()) { 📝 Editar Adicional } @else { 🧀 Criar Adicional }
        </h3>

        <form
          [formGroup]="adcForm"
          (ngSubmit)="adcEditId() ? salvarEdicaoAdicional() : criarAdicional()"
          class="space-y-3"
        >

          <ui-input
            formControlName="nome"
            label="Nome *"
            size="sm"
            [error]="fa.nome.invalid && fa.nome.touched ? 'Nome obrigatório (mín. 2 caracteres)' : null"
          />

          <ui-textarea
            formControlName="descricao"
            label="Descrição"
            size="sm"
            [rows]="2"
          />

          <ui-input
            formControlName="preco"
            type="number"
            label="Preço (R$) *"
            size="sm"
            min="0"
            step="0.01"
            [error]="fa.preco.invalid && fa.preco.touched ? 'Preço obrigatório e deve ser >= 0' : null"
          />

          @if (adcError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ adcError() }}</p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button
                type="submit"
                [disabled]="adcLoadingSubmit() || adcForm.invalid"
                [loading]="adcLoadingSubmit()"
                size="sm"
                [fullWidth]="true"
              >
                @if (adcEditId()) { Atualizar Adicional } @else { Criar Adicional }
              </ui-button>
            </div>
            @if (adcEditId()) {
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                (click)="cancelarEdicaoAdicional()">
                  Cancelar
              </ui-button>
            }
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AdminAdicionaisTabComponent {
  lojaUuid = input.required<string>();

  private catalogoService = inject(CatalogoService);
  private fb = inject(FormBuilder);

  private readonly refreshAdicTrigger = new BehaviorSubject<void>(undefined);
  private readonly _adicionais = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshAdicTrigger]).pipe(
      switchMap(([uuid]) =>
        this.catalogoService.listarAdicionais(uuid).pipe(catchError(() => of([] as Adicional[]))),
      ),
    ),
    { initialValue: [] as Adicional[] },
  );
  readonly adcLoading = computed(() => this._adicionais() === undefined);
  readonly adicionais = computed(() => this._adicionais() ?? []);

  private refreshAdicionais() { this.refreshAdicTrigger.next(); }

  adcForm = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    descricao: [''],
    preco: [0, [Validators.required, Validators.min(0)]],
  });

  adcLoadingSubmit = signal(false);
  adcError = signal('');
  adcEditId = signal<string | null>(null);

  get fa() { return this.adcForm.controls; }

  constructor() {
    this.refreshAdicionais();
  }

  criarAdicional() {
    if (this.adcForm.invalid) { this.adcForm.markAllAsTouched(); return; }
    this.adcLoadingSubmit.set(true);
    this.adcError.set('');
    const fv = this.adcForm.value;
    const body: CreateAdicionalRequest = { nome: fv.nome!, descricao: fv.descricao || '', preco: fv.preco! };
    this.catalogoService.criarAdicional(this.lojaUuid(), body).subscribe({
      next: () => {
        this.adcLoadingSubmit.set(false);
        toast.success('Adicional criado com sucesso!');
        this.adcForm.reset({ preco: 0 });
        this.refreshAdicionais();
      },
      error: (e) => { this.adcLoadingSubmit.set(false); this.adcError.set(e?.error?.error ?? 'Erro ao criar adicional.'); },
    });
  }

  editarAdicional(adc: Adicional) {
    this.adcEditId.set(adc.uuid);
    this.adcForm.patchValue({ nome: adc.nome, descricao: adc.descricao, preco: adc.preco });
    this.adcError.set('');
  }

  salvarEdicaoAdicional() {
    const uuid = this.adcEditId();
    if (!uuid) return;
    if (this.adcForm.invalid) { this.adcForm.markAllAsTouched(); return; }
    this.adcLoadingSubmit.set(true);
    this.adcError.set('');
    const fv = this.adcForm.value;
    this.catalogoService.atualizarAdicional(this.lojaUuid(), uuid, { nome: fv.nome!, descricao: fv.descricao || '', preco: fv.preco! }).subscribe({
      next: () => {
        this.adcLoadingSubmit.set(false);
        this.adcEditId.set(null);
        toast.success('Adicional atualizado com sucesso!');
        this.adcForm.reset({ preco: 0 });
        this.refreshAdicionais();
      },
      error: (e) => { this.adcLoadingSubmit.set(false); this.adcError.set(e?.error?.error ?? 'Erro ao atualizar adicional.'); },
    });
  }

  cancelarEdicaoAdicional() {
    this.adcEditId.set(null);
    this.adcForm.reset({ preco: 0 });
    this.adcError.set('');
  }

  deletarAdicional(uuid: string, nome: string) {
    if (!confirm(`Deletar adicional "${nome}"? Esta ação não pode ser desfeita.`)) return;
    this.catalogoService.deletarAdicional(this.lojaUuid(), uuid).subscribe({
      next: () => { toast.success('Adicional deletado com sucesso!'); this.refreshAdicionais(); },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar adicional.'),
    });
  }

  toggleDisponibilidadeAdicional(uuid: string, nome: string, disponivelAtual: boolean) {
    const novoEstado = !disponivelAtual;
    this.catalogoService.toggleDisponibilidadeAdicional(this.lojaUuid(), uuid, novoEstado).subscribe({
      next: () => { toast.success(`Adicional "${nome}" agora está ${novoEstado ? 'disponível' : 'indisponível'}.`); this.refreshAdicionais(); },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao alterar disponibilidade do adicional.'),
    });
  }
}
