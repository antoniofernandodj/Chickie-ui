import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';

import { FidelidadeService } from '../../../core/services/fidelidade.service';
import { ProdutoService } from '../../../core/services/produto.service';
import {
  AtualizarProgramaFidelidadeRequest,
  CriarProgramaFidelidadeRequest,
  ProgramaFidelidade,
  Produto,
  TipoProgramaFidelidade,
} from '../../../core/models';
import {
  UiButtonComponent,
  UiInputComponent,
  UiSelectComponent,
  UiTextareaComponent,
} from '../../../shared/components';
import { AdminEditBtnComponent } from './admin-edit-btn.component';
import { AdminRemoveBtnComponent } from './admin-remove-btn.component';

@Component({
  selector: 'admin-fidelidade-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    UiButtonComponent,
    UiInputComponent,
    UiSelectComponent,
    UiTextareaComponent,
    AdminEditBtnComponent,
    AdminRemoveBtnComponent,
  ],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Formulário -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          @if (editId()) {
            📝 Editar Programa
          } @else {
            🎁 Criar Programa de Fidelidade
          }
        </h3>

        <form
          [formGroup]="form"
          (ngSubmit)="editId() ? salvar() : criar()"
          class="space-y-3"
        >
          <ui-input
            formControlName="nome"
            label="Nome do programa *"
            size="sm"
            placeholder="Cada R$100 ganha uma pizza"
            [error]="
              fc.nome.invalid && fc.nome.touched
                ? 'Nome obrigatório (mín. 3 caracteres)'
                : null
            "
          />
          <ui-textarea
            formControlName="descricao"
            label="Descrição"
            size="sm"
            [rows]="2"
            placeholder="Acumule compras e ganhe brindes."
          />

          <ui-select
            formControlName="tipo"
            label="Tipo de regra *"
            size="sm"
          >
            <option value="valor_acumulado">Valor acumulado (R$ X em compras)</option>
            <option value="contagem_produto">Contagem de produto (N compras do produto A)</option>
          </ui-select>

          @if (tipo() === 'valor_acumulado') {
            <ui-input
              formControlName="meta_valor"
              type="number"
              size="sm"
              min="0"
              step="0.01"
              label="Meta em R$ *"
              placeholder="100.00"
              [error]="
                fc.meta_valor.invalid && fc.meta_valor.touched
                  ? 'Meta deve ser maior que zero'
                  : null
              "
            />
          } @else {
            <ui-select
              formControlName="produto_gatilho_uuid"
              label="Produto gatilho *"
              size="sm"
            >
              <option value="">Selecione...</option>
              @for (p of produtos(); track p.uuid) {
                <option [value]="p.uuid">{{ p.nome }}</option>
              }
            </ui-select>
            <ui-input
              formControlName="meta_contagem"
              type="number"
              size="sm"
              min="1"
              step="1"
              label="Quantas vezes precisa comprar *"
              placeholder="10"
              [error]="
                fc.meta_contagem.invalid && fc.meta_contagem.touched
                  ? 'Quantidade deve ser maior que zero'
                  : null
              "
            />
          }

          <ui-select
            formControlName="produto_recompensa_uuid"
            label="Produto recompensa *"
            size="sm"
          >
            <option value="">Selecione...</option>
            @for (p of produtos(); track p.uuid) {
              <option [value]="p.uuid">{{ p.nome }}</option>
            }
          </ui-select>

          <ui-input
            formControlName="validade_recompensa_dias"
            type="number"
            size="sm"
            min="1"
            step="1"
            label="Validade da recompensa (dias) *"
            placeholder="30"
            [error]="
              fc.validade_recompensa_dias.invalid && fc.validade_recompensa_dias.touched
                ? 'Validade deve ser maior que zero'
                : null
            "
          />

          @if (erro()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ erro() }}</p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button
                type="submit"
                [disabled]="submitting() || form.invalid"
                [loading]="submitting()"
                size="sm"
                [fullWidth]="true"
              >
                @if (editId()) {
                  Atualizar Programa
                } @else {
                  Criar Programa
                }
              </ui-button>
            </div>
            @if (editId()) {
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                (click)="cancelarEdicao()"
              >Cancelar</ui-button>
            }
          </div>
        </form>
      </div>

      <!-- Lista -->
      <div>
        <h3 class="text-base font-semibold text-gray-900 mb-5">🎁 Programas da Loja</h3>

        @if (loading()) {
          <div class="space-y-3">
            @for (_ of [1, 2, 3]; track $index) {
              <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-20"></div>
            }
          </div>
        } @else if (programas().length === 0) {
          <div class="text-center py-10 bg-white rounded-2xl border border-gray-100">
            <div class="text-4xl mb-2">🎁</div>
            <p class="text-gray-500 text-sm">Nenhum programa cadastrado.</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (prog of programas(); track prog.uuid) {
              <div
                class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-colors"
                [class.border-green-200]="prog.status === 'ativo'"
                [class.border-gray-300]="prog.status === 'inativo'"
              >
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-semibold text-sm text-gray-900">{{ prog.nome }}</span>
                      <span
                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                        [class.bg-green-100]="prog.status === 'ativo'"
                        [class.text-green-700]="prog.status === 'ativo'"
                        [class.bg-gray-200]="prog.status === 'inativo'"
                        [class.text-gray-700]="prog.status === 'inativo'"
                      >
                        {{ prog.status === 'ativo' ? 'Ativo' : 'Inativo' }}
                      </span>
                    </div>
                    @if (prog.descricao) {
                      <p class="text-xs text-gray-600">{{ prog.descricao }}</p>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                  <div>
                    <span class="font-medium">Tipo:</span>
                    {{ prog.tipo === 'valor_acumulado' ? 'Valor acumulado' : 'Contagem de produto' }}
                  </div>
                  @if (prog.tipo === 'valor_acumulado') {
                    <div>
                      <span class="font-medium">Meta:</span>
                      R$ {{ prog.meta_valor | number: '1.2-2' }}
                    </div>
                  } @else {
                    <div>
                      <span class="font-medium">Gatilho:</span>
                      {{ nomeProduto(prog.produto_gatilho_uuid) }} × {{ prog.meta_contagem }}
                    </div>
                  }
                  <div>
                    <span class="font-medium">Brinde:</span>
                    {{ nomeProduto(prog.produto_recompensa_uuid) }}
                  </div>
                  <div>
                    <span class="font-medium">Validade:</span>
                    {{ prog.validade_recompensa_dias }} dias
                  </div>
                </div>

                <div class="flex gap-1.5">
                  <div class="flex-1">
                    <ui-button
                      size="xs"
                      [fullWidth]="true"
                      [variant]="prog.status === 'ativo' ? 'danger' : 'secondary'"
                      (click)="toggleStatus(prog)"
                    >
                      @if (prog.status === 'ativo') {
                        Desativar
                      } @else {
                        Ativar
                      }
                    </ui-button>
                  </div>
                  <admin-edit-btn (edit)="editar(prog)" />
                  <admin-remove-btn (remove)="deletar(prog)" />
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminFidelidadeTabComponent implements OnInit {
  lojaUuid = input.required<string>();

  private fidelidadeService = inject(FidelidadeService);
  private produtoService = inject(ProdutoService);
  private fb = inject(FormBuilder);

  // Programas
  private readonly refreshTrigger = new Subject<void>();
  private readonly _programas = toSignal(
    this.refreshTrigger.pipe(
      switchMap(() =>
        this.fidelidadeService
          .listarProgramasAdmin(this.lojaUuid())
          .pipe(catchError(() => of([] as ProgramaFidelidade[]))),
      ),
    ),
    { initialValue: undefined as ProgramaFidelidade[] | undefined } as any,
  );
  readonly loading = computed(() => this._programas() === undefined);
  readonly programas = computed(() => this._programas() ?? []);

  // Produtos da loja (para os selects)
  private readonly _produtos = toSignal(
    this.refreshTrigger.pipe(
      switchMap(() =>
        this.produtoService
          .listarPorLoja(this.lojaUuid())
          .pipe(catchError(() => of([] as Produto[]))),
      ),
    ),
    { initialValue: [] as Produto[] },
  );
  readonly produtos = computed(() => this._produtos() ?? []);
  nomeProduto(uuid: string | null): string {
    if (!uuid) return '—';
    return this.produtos().find(p => p.uuid === uuid)?.nome ?? '—';
  }

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    descricao: [''],
    tipo: ['valor_acumulado' as TipoProgramaFidelidade, Validators.required],
    meta_valor: [0, [Validators.min(0)]],
    produto_gatilho_uuid: [''],
    meta_contagem: [0, [Validators.min(0)]],
    produto_recompensa_uuid: ['', Validators.required],
    validade_recompensa_dias: [30, [Validators.required, Validators.min(1)]],
  });

  get fc() { return this.form.controls; }
  readonly tipo = signal<TipoProgramaFidelidade>('valor_acumulado');

  submitting = signal(false);
  erro = signal('');
  editId = signal<string | null>(null);

  constructor() {
    const tipoControl = this.form.get('tipo');
    if (tipoControl) {
      tipoControl.valueChanges.subscribe(t => {
        const tipo = (t ?? 'valor_acumulado') as TipoProgramaFidelidade;
        this.tipo.set(tipo);
        const metaValor = this.form.get('meta_valor');
        const metaContagem = this.form.get('meta_contagem');
        const gatilho = this.form.get('produto_gatilho_uuid');
        if (tipo === 'valor_acumulado') {
          metaValor?.setValidators([Validators.required, Validators.min(0.01)]);
          metaContagem?.clearValidators();
          gatilho?.clearValidators();
        } else {
          metaContagem?.setValidators([Validators.required, Validators.min(1)]);
          gatilho?.setValidators([Validators.required]);
          metaValor?.clearValidators();
        }
        metaValor?.updateValueAndValidity();
        metaContagem?.updateValueAndValidity();
        gatilho?.updateValueAndValidity();
      });
    }
  }

  ngOnInit() { this.refresh(); }

  private refresh() { this.refreshTrigger.next(); }

  private toCriarRequest(): CriarProgramaFidelidadeRequest {
    const fv = this.form.value;
    const tipo = (fv.tipo ?? 'valor_acumulado') as TipoProgramaFidelidade;
    return {
      loja_uuid: this.lojaUuid(),
      nome: fv.nome!,
      descricao: fv.descricao || null,
      tipo,
      meta_valor: tipo === 'valor_acumulado' ? Number(fv.meta_valor) : null,
      produto_gatilho_uuid: tipo === 'contagem_produto' ? fv.produto_gatilho_uuid || null : null,
      meta_contagem: tipo === 'contagem_produto' ? Number(fv.meta_contagem) : null,
      produto_recompensa_uuid: fv.produto_recompensa_uuid!,
      validade_recompensa_dias: Number(fv.validade_recompensa_dias),
    };
  }

  criar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.erro.set('');
    this.fidelidadeService.criarPrograma(this.toCriarRequest()).subscribe({
      next: () => {
        this.submitting.set(false);
        toast.success('Programa criado!');
        this.form.reset({ tipo: 'valor_acumulado', validade_recompensa_dias: 30 });
        this.tipo.set('valor_acumulado');
        this.refresh();
      },
      error: (e) => {
        this.submitting.set(false);
        this.erro.set(e?.error?.error ?? 'Erro ao criar programa.');
      },
    });
  }

  editar(prog: ProgramaFidelidade) {
    this.editId.set(prog.uuid);
    this.tipo.set(prog.tipo);
    this.form.patchValue({
      nome: prog.nome,
      descricao: prog.descricao ?? '',
      tipo: prog.tipo,
      meta_valor: prog.meta_valor ?? 0,
      produto_gatilho_uuid: prog.produto_gatilho_uuid ?? '',
      meta_contagem: prog.meta_contagem ?? 0,
      produto_recompensa_uuid: prog.produto_recompensa_uuid,
      validade_recompensa_dias: prog.validade_recompensa_dias,
    });
    this.erro.set('');
  }

  salvar() {
    const uuid = this.editId();
    if (!uuid) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.erro.set('');
    const body = this.toCriarRequest();
    const upd: AtualizarProgramaFidelidadeRequest = {
      nome: body.nome,
      descricao: body.descricao,
      meta_valor: body.meta_valor,
      produto_gatilho_uuid: body.produto_gatilho_uuid,
      meta_contagem: body.meta_contagem,
      produto_recompensa_uuid: body.produto_recompensa_uuid,
      validade_recompensa_dias: body.validade_recompensa_dias,
    };
    this.fidelidadeService.atualizarPrograma(uuid, upd).subscribe({
      next: () => {
        this.submitting.set(false);
        this.editId.set(null);
        toast.success('Programa atualizado!');
        this.form.reset({ tipo: 'valor_acumulado', validade_recompensa_dias: 30 });
        this.tipo.set('valor_acumulado');
        this.refresh();
      },
      error: (e) => {
        this.submitting.set(false);
        this.erro.set(e?.error?.error ?? 'Erro ao atualizar programa.');
      },
    });
  }

  cancelarEdicao() {
    this.editId.set(null);
    this.form.reset({ tipo: 'valor_acumulado', validade_recompensa_dias: 30 });
    this.tipo.set('valor_acumulado');
    this.erro.set('');
  }

  toggleStatus(prog: ProgramaFidelidade) {
    const ativo = prog.status !== 'ativo';
    this.fidelidadeService.definirStatus(prog.uuid, ativo).subscribe({
      next: () => {
        toast.success(`Programa "${prog.nome}" agora está ${ativo ? 'ativo' : 'inativo'}.`);
        this.refresh();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao alterar status.'),
    });
  }

  deletar(prog: ProgramaFidelidade) {
    if (!confirm(`Deletar programa "${prog.nome}"? Esta ação não pode ser desfeita.`)) return;
    this.fidelidadeService.deletarPrograma(prog.uuid).subscribe({
      next: () => {
        toast.success('Programa deletado.');
        if (this.editId() === prog.uuid) this.cancelarEdicao();
        this.refresh();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar programa.'),
    });
  }
}
