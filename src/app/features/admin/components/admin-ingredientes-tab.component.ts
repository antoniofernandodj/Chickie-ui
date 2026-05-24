import { Component, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { IngredienteService } from '../../../core/services/ingrediente.service';
import { Ingrediente } from '../../../core/models';
import { UiInputComponent, UiButtonComponent } from '../../../shared/components';

@Component({
  selector: 'admin-ingredientes-tab',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, UiInputComponent, UiButtonComponent],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Lista -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">🥬 Ingredientes Cadastrados</h3>

        @if (loading()) {
          @for (_ of [1,2,3]; track $index) {
            <div class="h-16 rounded-xl bg-gray-50 mb-2 animate-pulse"></div>
          }
        } @else if (ingredientes().length === 0) {
          <p class="text-xs text-gray-400 text-center py-6">Nenhum ingrediente cadastrado.</p>
        } @else {
          <div class="space-y-2">
            @for (ing of ingredientes(); track ing.uuid) {
              <div class="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-orange-200 transition-colors">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-gray-900">{{ ing.nome }}</p>
                  <p class="text-xs text-gray-500">
                    @if (ing.unidade_medida) { {{ ing.unidade_medida }} · }
                    R$ {{ ing.preco_unitario | number: '1.2-2' }} / un.
                  </p>
                </div>
                <div class="flex gap-2 ml-3 shrink-0">
                  <ui-button variant="ghost" size="xs" (click)="editarIngrediente(ing)">✏️</ui-button>
                  <ui-button variant="danger" size="xs" (click)="deletarIngrediente(ing)">🗑️</ui-button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Formulário -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          {{ editId() ? '✏️ Editar Ingrediente' : '➕ Novo Ingrediente' }}
        </h3>

        <form [formGroup]="form" (ngSubmit)="salvar()" class="space-y-3">
          <ui-input
            formControlName="nome"
            label="Nome *"
            size="sm"
            [error]="fc.nome.invalid && fc.nome.touched ? 'Nome obrigatório' : null"
          />
          <ui-input
            formControlName="unidade_medida"
            label="Unidade de medida"
            size="sm"
            placeholder="ex: g, ml, un"
          />
          <ui-input
            formControlName="preco_unitario"
            label="Preço unitário (R$) *"
            type="number"
            size="sm"
            min="0"
            step="0.01"
            [error]="fc.preco_unitario.invalid && fc.preco_unitario.touched ? 'Preço obrigatório' : null"
          />

          @if (erro()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ erro() }}</p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button
                type="submit"
                size="sm"
                [fullWidth]="true"
                [disabled]="loadingSubmit() || form.invalid"
                [loading]="loadingSubmit()"
              >
                {{ editId() ? 'Atualizar' : 'Criar' }}
              </ui-button>
            </div>
            @if (editId()) {
              <ui-button type="button" variant="secondary" size="sm" (click)="cancelar()">
                Cancelar
              </ui-button>
            }
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AdminIngredientesTabComponent {
  lojaUuid = input.required<string>();

  private svc = inject(IngredienteService);
  private fb  = inject(FormBuilder);

  private refresh = new BehaviorSubject<void>(undefined);

  private readonly _ingredientes = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refresh]).pipe(
      switchMap(([uuid]) =>
        this.svc.listar(uuid).pipe(catchError(() => of([] as Ingrediente[]))),
      ),
    ),
    { initialValue: [] as Ingrediente[] },
  );
  readonly loading       = signal(false);
  readonly ingredientes  = this._ingredientes;

  readonly editId        = signal<string | null>(null);
  readonly loadingSubmit = signal(false);
  readonly erro          = signal('');

  form = this.fb.group({
    nome:           ['', Validators.required],
    unidade_medida: [''],
    preco_unitario: [0, [Validators.required, Validators.min(0)]],
  });

  get fc() { return this.form.controls; }

  editarIngrediente(ing: Ingrediente) {
    this.editId.set(ing.uuid);
    this.form.patchValue({
      nome:           ing.nome,
      unidade_medida: ing.unidade_medida ?? '',
      preco_unitario: Number(ing.preco_unitario),
    });
    this.erro.set('');
  }

  cancelar() {
    this.editId.set(null);
    this.form.reset({ nome: '', unidade_medida: '', preco_unitario: 0 });
    this.erro.set('');
  }

  salvar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loadingSubmit.set(true);
    this.erro.set('');
    const fv = this.form.value;
    const body = {
      nome:           fv.nome!,
      unidade_medida: fv.unidade_medida || null,
      preco_unitario: Number(fv.preco_unitario ?? 0),
    };
    const uuid = this.editId();
    const obs  = uuid
      ? this.svc.atualizar(this.lojaUuid(), uuid, body)
      : this.svc.criar(this.lojaUuid(), body);

    obs.subscribe({
      next: () => {
        this.loadingSubmit.set(false);
        toast.success(uuid ? 'Ingrediente atualizado!' : 'Ingrediente criado!');
        this.cancelar();
        this.refresh.next();
      },
      error: (e) => {
        this.loadingSubmit.set(false);
        this.erro.set(e?.error?.error ?? 'Erro ao salvar ingrediente.');
      },
    });
  }

  deletarIngrediente(ing: Ingrediente) {
    if (!confirm(`Deletar ingrediente "${ing.nome}"?`)) return;
    this.svc.deletar(this.lojaUuid(), ing.uuid).subscribe({
      next: () => { toast.success('Ingrediente deletado!'); this.refresh.next(); },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar ingrediente.'),
    });
  }
}
