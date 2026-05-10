import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { MarketingService } from '../../../core/services/marketing.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { Promocao, CreatePromocaoRequest, TipoDesconto, TipoEscopo, CategoriaProdutos } from '../../../core/models';
import { UiInputComponent, UiSelectComponent, UiTextareaComponent, UiButtonComponent } from '../../../shared/components';
import { AdminRemoveBtnComponent } from './admin-remove-btn.component';

@Component({
  selector: 'admin-promocoes-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, DatePipe,
    UiInputComponent, UiSelectComponent, UiTextareaComponent, UiButtonComponent,
    AdminRemoveBtnComponent,
  ],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Formulário de Promoção -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          @if (promocaoEditId()) { 📝 Editar Promoção } @else { 📢 Criar Promoção }
        </h3>

        <form [formGroup]="promocaoForm" (ngSubmit)="promocaoEditId() ? salvarEdicaoPromocao() : criarPromocao()" class="space-y-3">
          <ui-input formControlName="nome" label="Nome *" size="sm" placeholder="Promoção Pizza Especial"
                    [error]="fprom.nome.invalid && fprom.nome.touched ? 'Nome obrigatório (mín. 3 caracteres)' : null"/>
          <ui-textarea formControlName="descricao" label="Descrição *" size="sm" [rows]="2" placeholder="Desconto especial em pizzas selecionadas"
                       [error]="fprom.descricao.invalid && fprom.descricao.touched ? 'Descrição é obrigatória' : null"/>
          <ui-select formControlName="tipo_desconto" label="Tipo de Desconto *" size="sm">
            <option value="percentual">Percentual (%)</option>
            <option value="valor_fixo">Fixo (R$)</option>
            <option value="frete_gratis">Frete Grátis</option>
          </ui-select>
          <ui-input formControlName="valor_desconto" type="number" size="sm" min="0" step="0.01"
                    [label]="promocaoForm.get('tipo_desconto')?.value === 'percentual' ? 'Valor do Desconto (%) *' : promocaoForm.get('tipo_desconto')?.value === 'valor_fixo' ? 'Valor do Desconto (R$) *' : 'Valor do Desconto (R$)'"
                    [error]="fprom.valor_desconto.invalid && fprom.valor_desconto.touched ? 'Valor obrigatório e deve ser >= 0' : null"/>
          <ui-input formControlName="valor_minimo" type="number" label="Pedido Mínimo (R$)" size="sm" min="0" step="0.01" placeholder="Opcional"/>
          <div class="grid grid-cols-2 gap-3">
            <ui-input formControlName="data_inicio" type="date" label="Data de Início *" size="sm"
                      [error]="fprom.data_inicio.invalid && fprom.data_inicio.touched ? 'Data de início é obrigatória' : null"/>
            <ui-input formControlName="data_fim" type="date" label="Data de Fim *" size="sm"
                      [error]="fprom.data_fim.invalid && fprom.data_fim.touched ? 'Data de fim é obrigatória' : null"/>
          </div>
          <ui-select formControlName="tipo_escopo" label="Escopo da Promoção *" size="sm"
                     [error]="fprom.tipo_escopo.invalid && fprom.tipo_escopo.touched ? 'Selecione o escopo' : null">
            <option value="loja">Toda a Loja</option>
            <option value="produto">Produto Específico</option>
            <option value="categoria">Categoria Específica</option>
          </ui-select>
          <ui-input formControlName="prioridade" type="number" label="Prioridade" size="sm" min="0" step="1" placeholder="1 = maior prioridade"/>

          @if (promocaoError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ promocaoError() }}</p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button type="submit" [disabled]="promocaoLoadingSubmit() || promocaoForm.invalid" [loading]="promocaoLoadingSubmit()" size="sm" [fullWidth]="true">
                @if (promocaoEditId()) { Atualizar Promoção } @else { Criar Promoção }
              </ui-button>
            </div>
            @if (promocaoEditId()) {
              <ui-button type="button" variant="secondary" size="sm" (click)="cancelarEdicaoPromocao()">Cancelar</ui-button>
            }
          </div>
        </form>
      </div>

      <!-- Lista de Promoções -->
      <div>
        <h3 class="text-base font-semibold text-gray-900 mb-5">📢 Promoções da Loja</h3>

        @if (promocaoLoading()) {
          <div class="space-y-3">
            @for (_ of [1,2,3]; track $index) {
              <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-20"></div>
            }
          </div>
        } @else {
          @if (promocoes().length === 0) {
            <div class="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <div class="text-4xl mb-2">📢</div>
              <p class="text-gray-500 text-sm">Nenhuma promoção cadastrada.</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (promocao of promocoes(); track promocao.uuid) {
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:border-orange-200 transition-colors">
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-sm text-gray-900">{{ promocao.nome }}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                              [class.bg-green-100]="promocao.status === 'Ativo'"
                              [class.text-green-700]="promocao.status === 'Ativo'"
                              [class.bg-gray-100]="promocao.status === 'Inativo'"
                              [class.text-gray-700]="promocao.status === 'Inativo'">
                          {{ promocao.status }}
                        </span>
                      </div>
                      <p class="text-xs text-gray-600">{{ promocao.descricao }}</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    <div>
                      <span class="font-medium">Desconto:</span>
                      @if (promocao.tipo_desconto === 'percentual') {
                        {{ promocao.valor_desconto }}%
                      } @else if (promocao.tipo_desconto === 'valor_fixo') {
                        R$ {{ promocao.valor_desconto | number:'1.2-2' }}
                      } @else {
                        Frete Grátis
                      }
                    </div>
                    <div>
                      <span class="font-medium">Pedido mín.:</span>
                      @if (promocao.valor_minimo) {
                        R$ {{ promocao.valor_minimo | number:'1.2-2' }}
                      } @else {
                        —
                      }
                    </div>
                    <div>
                      <span class="font-medium">Vigência:</span>
                      {{ promocao.data_inicio | date:'dd/MM/yyyy' }} - {{ promocao.data_fim | date:'dd/MM/yyyy' }}
                    </div>
                    <div>
                      <span class="font-medium">Escopo:</span>
                      @if (promocao.tipo_escopo === 'loja') { Loja }
                      @else if (promocao.tipo_escopo === 'produto') { Produto }
                      @else { Categoria }
                    </div>
                  </div>

                  <div class="flex gap-1.5">
                    <div class="flex-1">
                      <ui-button size="xs" [fullWidth]="true" variant="secondary" (click)="editarPromocao(promocao)">✏️ Editar</ui-button>
                    </div>
                    <admin-remove-btn (remove)="deletarPromocao(promocao.uuid, promocao.nome)"/>
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
export class AdminPromocoesTabComponent {
  lojaUuid = input.required<string>();

  private marketingService = inject(MarketingService);
  private catalogoService = inject(CatalogoService);
  private fb = inject(FormBuilder);

  private readonly refreshPromocaoTrigger = new BehaviorSubject<void>(undefined);
  private readonly _promocoes = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshPromocaoTrigger]).pipe(
      switchMap(([uuid]) =>
        this.marketingService.listarPromocoes(uuid).pipe(catchError(() => of([] as Promocao[]))),
      ),
    ),
    { initialValue: [] as Promocao[] },
  );
  readonly promocaoLoading = computed(() => this._promocoes() === undefined);
  readonly promocoes = computed(() => this._promocoes() ?? []);

  private refreshPromocoes() { this.refreshPromocaoTrigger.next(); }

  // Categorias for select
  private readonly _categorias = toSignal(
    toObservable(this.lojaUuid).pipe(
      switchMap(uuid =>
        this.catalogoService.listarCategorias(uuid).pipe(catchError(() => of([] as CategoriaProdutos[]))),
      ),
    ),
    { initialValue: [] as CategoriaProdutos[] },
  );
  readonly categorias = computed(() => this._categorias() ?? []);

  promocaoForm = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    descricao: ['', Validators.required],
    tipo_desconto: ['percentual' as TipoDesconto, Validators.required],
    valor_desconto: [0, [Validators.required, Validators.min(0)]],
    valor_minimo: [null as number | null, Validators.min(0)],
    data_inicio: ['', Validators.required],
    data_fim: ['', Validators.required],
    dias_semana_validos: [[] as number[], Validators.required],
    tipo_escopo: ['loja' as TipoEscopo, Validators.required],
    produto_uuid: [null as string | null],
    categoria_uuid: [null as string | null],
    prioridade: [1, [Validators.required, Validators.min(0)]],
  });

  promocaoLoadingSubmit = signal(false);
  promocaoError = signal('');
  promocaoEditId = signal<string | null>(null);

  get fprom() { return this.promocaoForm.controls; }

  constructor() {
    this.refreshPromocoes();
  }

  criarPromocao() {
    if (this.promocaoForm.invalid) { this.promocaoForm.markAllAsTouched(); return; }
    this.promocaoLoadingSubmit.set(true);
    this.promocaoError.set('');
    const fv = this.promocaoForm.value;
    const dataInicioIso = fv.data_inicio ? `${fv.data_inicio}T00:00:00Z` : undefined;
    const dataFimIso = fv.data_fim ? `${fv.data_fim}T23:59:59Z` : undefined;
    const request: CreatePromocaoRequest = {
      nome: fv.nome!, descricao: fv.descricao!, tipo_desconto: fv.tipo_desconto!,
      valor_desconto: fv.valor_desconto!, valor_minimo: fv.valor_minimo ?? undefined,
      data_inicio: dataInicioIso!, data_fim: dataFimIso!, dias_semana_validos: fv.dias_semana_validos!,
      tipo_escopo: fv.tipo_escopo!, produto_uuid: fv.produto_uuid ?? undefined,
      categoria_uuid: fv.categoria_uuid ?? undefined, prioridade: fv.prioridade!,
    };
    this.marketingService.criarPromocao(this.lojaUuid(), request).subscribe({
      next: () => {
        this.promocaoLoadingSubmit.set(false);
        toast.success('Promoção criada com sucesso!');
        this.resetForm();
        this.refreshPromocoes();
      },
      error: (e) => { this.promocaoLoadingSubmit.set(false); this.promocaoError.set(e?.error?.error ?? 'Erro ao criar promoção.'); },
    });
  }

  editarPromocao(promocao: Promocao) {
    this.promocaoEditId.set(promocao.uuid);
    this.promocaoForm.patchValue({
      nome: promocao.nome, descricao: promocao.descricao, tipo_desconto: promocao.tipo_desconto,
      valor_desconto: promocao.valor_desconto, valor_minimo: promocao.valor_minimo,
      data_inicio: promocao.data_inicio.split('T')[0], data_fim: promocao.data_fim.split('T')[0],
      dias_semana_validos: promocao.dias_semana_validos, tipo_escopo: promocao.tipo_escopo,
      produto_uuid: promocao.produto_uuid, categoria_uuid: promocao.categoria_uuid, prioridade: promocao.prioridade,
    });
    this.promocaoError.set('');
  }

  salvarEdicaoPromocao() {
    const uuid = this.promocaoEditId();
    if (!uuid) return;
    if (this.promocaoForm.invalid) { this.promocaoForm.markAllAsTouched(); return; }
    this.promocaoLoadingSubmit.set(true);
    this.promocaoError.set('');
    const fv = this.promocaoForm.value;
    const dataInicioIso = fv.data_inicio ? `${fv.data_inicio}T00:00:00Z` : undefined;
    const dataFimIso = fv.data_fim ? `${fv.data_fim}T23:59:59Z` : undefined;
    const request: CreatePromocaoRequest = {
      nome: fv.nome!, descricao: fv.descricao!, tipo_desconto: fv.tipo_desconto!,
      valor_desconto: fv.valor_desconto!, valor_minimo: fv.valor_minimo ?? undefined,
      data_inicio: dataInicioIso!, data_fim: dataFimIso!, dias_semana_validos: fv.dias_semana_validos!,
      tipo_escopo: fv.tipo_escopo!, produto_uuid: fv.produto_uuid ?? undefined,
      categoria_uuid: fv.categoria_uuid ?? undefined, prioridade: fv.prioridade!,
    };
    this.marketingService.atualizarPromocao(this.lojaUuid(), uuid, request).subscribe({
      next: () => {
        this.promocaoLoadingSubmit.set(false);
        this.promocaoEditId.set(null);
        toast.success('Promoção atualizada com sucesso!');
        this.resetForm();
        this.refreshPromocoes();
      },
      error: (e) => { this.promocaoLoadingSubmit.set(false); this.promocaoError.set(e?.error?.error ?? 'Erro ao atualizar promoção.'); },
    });
  }

  cancelarEdicaoPromocao() {
    this.promocaoEditId.set(null);
    this.resetForm();
    this.promocaoError.set('');
  }

  private resetForm() {
    this.promocaoForm.reset({
      tipo_desconto: 'percentual', valor_desconto: 0, valor_minimo: null,
      dias_semana_validos: [], tipo_escopo: 'loja', produto_uuid: null, categoria_uuid: null, prioridade: 1,
    });
  }

  deletarPromocao(uuid: string, nome: string) {
    if (!confirm(`Deletar promoção "${nome}"? Esta ação não pode ser desfeita.`)) return;
    this.marketingService.deletarPromocao(this.lojaUuid(), uuid).subscribe({
      next: () => {
        toast.success('Promoção deletada com sucesso!');
        if (this.promocaoEditId() === uuid) this.cancelarEdicaoPromocao();
        this.refreshPromocoes();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar promoção.'),
    });
  }
}
