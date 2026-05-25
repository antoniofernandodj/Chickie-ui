import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { MontagemService } from '../../../core/services/montagem.service';
import { IngredienteService } from '../../../core/services/ingrediente.service';
import { CatalogoService } from '../../../core/services/catalogo.service';
import {
  MontagemCompleta,
  Produto,
  Ingrediente,
  PapelEtapa,
  TipoEtapaMontagem,
} from '../../../core/models';
import { UiInputComponent, UiSelectComponent, UiTextareaComponent, UiButtonComponent, UiCheckboxComponent } from '../../../shared/components';

const PAPEIS: { value: PapelEtapa; label: string }[] = [
  { value: 'base',        label: '🌾 Base'       },
  { value: 'ingrediente', label: '🥬 Ingrediente' },
  { value: 'molho',       label: '🫙 Molho'       },
  { value: 'extra',       label: '➕ Extra'        },
  { value: 'outro',       label: '📦 Outro'        },
];

const TIPOS: { value: TipoEtapaMontagem; label: string }[] = [
  { value: 'escolha_unica',        label: 'Escolha única (radio)'       },
  { value: 'escolha_multipla',     label: 'Múltipla seleção (checkbox)' },
  { value: 'quantidade_por_opcao', label: 'Quantidade por opção'        },
];

@Component({
  selector: 'admin-montagem-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    UiInputComponent, UiSelectComponent, UiTextareaComponent,
    UiButtonComponent, UiCheckboxComponent,
  ],
  template: `
    <div class="space-y-6">

      <!-- Selecionar produto montável -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-4">🥗 Gerenciar Montagem por Produto</h3>

        @if (produtosMontagemMode().length === 0) {
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            ⚠️ Nenhuma categoria com <strong>Modo Montagem</strong> ativo. Configure uma categoria em
            <em>Catálogo</em> antes de criar montagens.
          </div>
        } @else {
          <div class="grid sm:grid-cols-2 gap-3">
            @for (prod of produtosMontagemMode(); track prod.uuid) {
              <button
                type="button"
                class="relative text-left p-4 rounded-xl border transition-colors"
                [class]="produtoSelecionado()?.uuid === prod.uuid
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'"
                (click)="selecionarProduto(prod)"
              >
                <!-- Indicador visual: tem montagem (verde) / sem montagem (cinza) / carregando (pulse) -->
                <span
                  class="absolute top-2.5 right-2.5 h-2 w-2 rounded-full"
                  [class]="statusMontagem().get(prod.uuid) === true  ? 'bg-emerald-400' :
                           statusMontagem().get(prod.uuid) === false ? 'bg-gray-200' :
                           'bg-gray-100 animate-pulse'"
                ></span>
                <p class="text-sm font-semibold text-gray-900 pr-4">{{ prod.nome }}</p>
                <p class="text-xs text-gray-400 mt-0.5">R$ {{ prod.preco | number: '1.2-2' }}</p>
              </button>
            }
          </div>
        }
      </div>

      <!-- Montagem do produto selecionado -->
      @if (produtoSelecionado(); as prod) {
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-base font-semibold text-gray-900">
              🧩 Montagem: {{ prod.nome }}
            </h3>
            @if (!montagemExistente()) {
              <ui-button size="sm" (click)="criarMontagem(prod)">
                + Criar Montagem
              </ui-button>
            } @else {
              <div class="flex gap-2">
                <ui-button variant="secondary" size="sm" (click)="abrirDuplicar()">
                  📋 Duplicar
                </ui-button>
                <ui-button variant="danger" size="sm" (click)="deletarMontagem()">
                  🗑️ Excluir
                </ui-button>
              </div>
            }
          </div>

          @if (carregandoMontagem()) {
            <div class="space-y-2">
              @for (_ of [1,2,3]; track $index) {
                <div class="h-16 rounded-xl bg-gray-50 animate-pulse"></div>
              }
            </div>
          } @else if (!montagemExistente()) {
            <p class="text-sm text-gray-500">Este produto ainda não tem montagem configurada.</p>
          } @else {

            <!-- Criar montagem -->
            @if (criandoMontagem()) {
              <form [formGroup]="montagemForm" (ngSubmit)="salvarMontagem(prod.uuid)"
                    class="space-y-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 class="text-sm font-semibold text-gray-800">Nova Montagem</h4>
                <ui-input formControlName="nome" label="Nome *" size="sm" />
                <ui-textarea formControlName="descricao" label="Descrição" size="sm" [rows]="2" />
                <ui-input formControlName="preco_base" label="Preço base (R$) *" type="number" size="sm" min="0" step="0.01" />
                <div class="flex gap-2">
                  <ui-button type="submit" size="sm" [disabled]="montagemForm.invalid">Criar</ui-button>
                  <ui-button type="button" variant="secondary" size="sm" (click)="criandoMontagem.set(false)">Cancelar</ui-button>
                </div>
              </form>
            }

            <!-- Duplicar montagem para outro produto -->
            @if (duplicando()) {
              <div class="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                <h4 class="text-sm font-semibold text-gray-800">📋 Duplicar montagem para outro produto</h4>
                <p class="text-xs text-gray-500">
                  Selecione o produto destino. Todas as etapas e opções serão copiadas com novos IDs.
                </p>
                <div class="grid sm:grid-cols-2 gap-2">
                  @for (dest of produtosDestinoDisponivel(); track dest.uuid) {
                    <button
                      type="button"
                      class="text-left p-3 rounded-xl border transition-colors text-sm"
                      [class]="produtoDestino()?.uuid === dest.uuid
                        ? 'border-purple-500 bg-purple-100 font-semibold'
                        : 'border-gray-200 bg-white hover:border-purple-300'"
                      (click)="produtoDestino.set(dest)"
                    >
                      {{ dest.nome }}
                    </button>
                  }
                  @if (produtosDestinoDisponivel().length === 0) {
                    <p class="text-xs text-gray-400 col-span-2">
                      Não há outros produtos montáveis sem montagem configurada.
                    </p>
                  }
                </div>
                <div class="flex gap-2">
                  <ui-button size="sm" [disabled]="!produtoDestino()" (click)="confirmarDuplicar()">
                    Duplicar
                  </ui-button>
                  <ui-button variant="secondary" size="sm" (click)="fecharDuplicar()">
                    Cancelar
                  </ui-button>
                </div>
              </div>
            }

            <!-- Etapas existentes -->
            @if (montagemCompleta(); as mc) {
              <div class="space-y-4">
                @for (etapa of mc.etapas; track etapa.uuid) {
                  <div class="border border-gray-200 rounded-xl overflow-hidden">

                    <!-- Cabeçalho da etapa -->
                    <div class="bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p class="text-sm font-semibold text-gray-900">{{ etapa.nome }}</p>
                        <p class="text-xs text-gray-400">
                          {{ etapa.tipo }} · min: {{ etapa.min_selecoes }}
                          @if (etapa.max_selecoes !== null) { · max: {{ etapa.max_selecoes }} }
                        </p>
                      </div>
                      <ui-button variant="danger" size="xs" (click)="deletarEtapa(etapa.uuid)">🗑️</ui-button>
                    </div>

                    <!-- Opções existentes -->
                    <div class="p-4 space-y-2">
                      @for (opcao of etapa.opcoes; track opcao.uuid) {
                        <div class="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg">
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="text-xs text-gray-400 tabular-nums">{{ opcao.ordem }}.</span>
                            <span class="text-sm text-gray-800 truncate">{{ opcao.nome }}</span>
                            @if (opcao.gratis) {
                              <span class="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">grátis</span>
                            } @else {
                              <span class="shrink-0 text-xs text-gray-500">+R$ {{ opcao.preco_extra | number: '1.2-2' }}</span>
                            }
                          </div>
                          <ui-button variant="danger" size="xs" (click)="deletarOpcao(opcao.uuid, etapa.uuid)">×</ui-button>
                        </div>
                      }

                      <!-- ── Painel bulk de novas opções ── -->
                      @if (etapaExpandida() === etapa.uuid) {
                        <div class="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl space-y-3">

                          <!-- Legenda colunas -->
                          <div class="grid grid-cols-[1fr_1fr_6rem_5rem_2rem] gap-2 px-1">
                            <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Ingrediente *</span>
                            <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nome exibido</span>
                            <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Preço extra</span>
                            <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Grátis</span>
                            <span></span>
                          </div>

                          <!-- Linhas do FormArray -->
                          <form [formGroup]="bulkForm" (ngSubmit)="salvarOpcoesBulk(etapa.uuid)" class="space-y-2">
                            <div formArrayName="linhas">
                              @for (ctrl of bulkLinhasAsGroups; track $index; let i = $index) {
                                <div [formGroupName]="i"
                                     class="grid grid-cols-[1fr_1fr_6rem_5rem_2rem] gap-2 items-center">
                                  <!-- Ingrediente -->
                                  <select formControlName="ingrediente_uuid"
                                          class="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                                    <option value="">Selecione...</option>
                                    @for (ing of ingredientes(); track ing.uuid) {
                                      <option [value]="ing.uuid">{{ ing.nome }}</option>
                                    }
                                  </select>
                                  <!-- Nome override -->
                                  <input formControlName="nome" type="text"
                                         placeholder="Usa nome do ingrediente"
                                         class="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                                  <!-- Preço extra -->
                                  <input formControlName="preco_extra" type="number" min="0" step="0.01"
                                         class="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                                  <!-- Grátis -->
                                  <label class="flex items-center justify-center gap-1.5 cursor-pointer select-none">
                                    <input formControlName="gratis" type="checkbox"
                                           class="h-4 w-4 rounded accent-orange-500" />
                                    <span class="text-xs text-gray-600">grátis</span>
                                  </label>
                                  <!-- Remover linha -->
                                  <button type="button" (click)="removerLinha(i)"
                                          class="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors text-base font-bold">
                                    ×
                                  </button>
                                </div>
                              }
                            </div>

                            <!-- Ações -->
                            <div class="flex items-center justify-between pt-1">
                              <button type="button" (click)="adicionarLinha()"
                                      class="flex items-center gap-1.5 rounded-lg border border-dashed border-green-400 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
                                + Adicionar linha
                              </button>
                              <div class="flex gap-2">
                                <ui-button type="button" variant="secondary" size="sm" (click)="fecharBulk()">
                                  Cancelar
                                </ui-button>
                                <ui-button type="submit" size="sm"
                                           [disabled]="bulkForm.invalid || bulkLinhas.length === 0">
                                  Salvar todas ({{ bulkLinhas.length }})
                                </ui-button>
                              </div>
                            </div>
                          </form>
                        </div>

                      } @else {
                        <button type="button" (click)="abrirBulkOpcoes(etapa.uuid)"
                                class="mt-1 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
                          + Adicionar opções
                        </button>
                      }
                    </div>
                  </div>
                }

                <!-- Criar nova etapa -->
                @if (criandoEtapa()) {
                  <form [formGroup]="etapaForm" (ngSubmit)="salvarEtapa(mc.montagem.uuid)"
                        class="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                    <h4 class="text-sm font-semibold text-gray-800">Nova Etapa</h4>
                    <ui-input formControlName="nome" label="Nome *" size="sm" />
                    <ui-textarea formControlName="descricao" label="Descrição" size="sm" [rows]="2" />
                    <div class="grid grid-cols-2 gap-3">
                      <ui-select formControlName="papel" label="Papel *" size="sm">
                        @for (p of papeis; track p.value) {
                          <option [value]="p.value">{{ p.label }}</option>
                        }
                      </ui-select>
                      <ui-select formControlName="tipo" label="Tipo *" size="sm">
                        @for (t of tipos; track t.value) {
                          <option [value]="t.value">{{ t.label }}</option>
                        }
                      </ui-select>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <ui-input formControlName="min_selecoes" label="Mín. seleções" type="number" size="sm" min="0" />
                      <ui-input formControlName="max_selecoes" label="Máx. seleções" type="number" size="sm" min="1" placeholder="∞" />
                    </div>
                    <div class="flex gap-2">
                      <ui-button type="submit" size="sm" [disabled]="etapaForm.invalid">Criar Etapa</ui-button>
                      <ui-button type="button" variant="secondary" size="sm" (click)="criandoEtapa.set(false)">Cancelar</ui-button>
                    </div>
                  </form>
                } @else {
                  <ui-button variant="secondary" size="sm" [fullWidth]="true" (click)="abrirNovaEtapa(mc)">
                    + Adicionar Etapa
                  </ui-button>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class AdminMontagemTabComponent {
  lojaUuid = input.required<string>();

  private montagemSvc    = inject(MontagemService);
  private ingredienteSvc = inject(IngredienteService);
  private catalogoSvc    = inject(CatalogoService);
  private fb             = inject(FormBuilder);

  readonly papeis = PAPEIS;
  readonly tipos  = TIPOS;

  // ── Produtos em modo montagem ──────────────────────────────────────────────
  private refreshProd = new BehaviorSubject<void>(undefined);

  private readonly _categorias = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshProd]).pipe(
      switchMap(([uuid]) =>
        this.catalogoSvc.listarCategorias(uuid).pipe(catchError(() => of([]))),
      ),
    ),
    { initialValue: [] as any[] },
  );

  private readonly _todosProdutos = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshProd]).pipe(
      switchMap(([uuid]) =>
        this.catalogoSvc.listarProdutosPorLoja(uuid).pipe(catchError(() => of([]))),
      ),
    ),
    { initialValue: [] as Produto[] },
  );

  readonly produtosMontagemMode = computed<Produto[]>(() => {
    const cats  = this._categorias()  ?? [];
    const prods = this._todosProdutos() ?? [];
    const uuidsMontagem = new Set(cats.filter(c => c.montagem_mode).map(c => c.uuid));
    return prods.filter(p => uuidsMontagem.has(p.categoria_uuid));
  });

  // ── Status de montagem por produto (Map<uuid, tem_montagem>) ─────────────
  // Preenchido em background assim que a lista de produtos carrega.
  readonly statusMontagem = signal<Map<string, boolean>>(new Map());

  private readonly _verificarStatus = effect(() => {
    const prods = this.produtosMontagemMode();
    if (!prods.length) return;

    // Lê o mapa atual sem registrá-lo como dependência (evita loop)
    const current = untracked(() => this.statusMontagem());
    const unchecked = prods.filter(p => !current.has(p.uuid));

    for (const prod of unchecked) {
      this.montagemSvc.buscarPorProduto(prod.uuid).pipe(
        catchError(() => of(null)),
      ).subscribe(mc => {
        this.statusMontagem.update(m => new Map(m).set(prod.uuid, mc !== null));
      });
    }
  }, { allowSignalWrites: true });

  private setStatus(uuid: string, value: boolean) {
    this.statusMontagem.update(m => new Map(m).set(uuid, value));
  }

  // ── Produto selecionado ───────────────────────────────────────────────────
  readonly produtoSelecionado = signal<Produto | null>(null);

  private refreshMontagem = new BehaviorSubject<void>(undefined);

  readonly montagemCompleta   = signal<MontagemCompleta | null>(null);
  readonly carregandoMontagem = signal(false);
  readonly montagemExistente  = signal(true);

  selecionarProduto(prod: Produto) {
    this.produtoSelecionado.set(prod);
    this.montagemCompleta.set(null);
    this.criandoMontagem.set(false);
    this.criandoEtapa.set(false);
    this.fecharBulk();
    this.carregarMontagem(prod.uuid);
  }

  private carregarMontagem(produtoUuid: string) {
    this.carregandoMontagem.set(true);
    this.montagemSvc.buscarPorProduto(produtoUuid).pipe(
      catchError(() => of(null)),
    ).subscribe(mc => {
      this.carregandoMontagem.set(false);
      this.montagemCompleta.set(mc);
      this.montagemExistente.set(mc !== null);
      this.setStatus(produtoUuid, mc !== null);
    });
  }

  // ── Ingredientes ──────────────────────────────────────────────────────────
  private readonly _ingredientes = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshMontagem]).pipe(
      switchMap(([uuid]) =>
        this.ingredienteSvc.listar(uuid).pipe(catchError(() => of([] as Ingrediente[]))),
      ),
    ),
    { initialValue: [] as Ingrediente[] },
  );
  readonly ingredientes = this._ingredientes;

  // ── Montagem form ─────────────────────────────────────────────────────────
  readonly criandoMontagem = signal(false);

  montagemForm = this.fb.group({
    nome:       ['', Validators.required],
    descricao:  [''],
    preco_base: [0, [Validators.required, Validators.min(0)]],
  });

  criarMontagem(prod: Produto) {
    this.montagemForm.reset({ nome: prod.nome, descricao: '', preco_base: prod.preco });
    this.criandoMontagem.set(true);
    this.montagemExistente.set(true);
  }

  salvarMontagem(produtoUuid: string) {
    if (this.montagemForm.invalid) { this.montagemForm.markAllAsTouched(); return; }
    const fv = this.montagemForm.value;
    this.montagemSvc.criar(this.lojaUuid(), {
      produto_uuid: produtoUuid,
      nome:         fv.nome!,
      descricao:    fv.descricao || null,
      preco_base:   Number(fv.preco_base ?? 0),
    }).subscribe({
      next: () => {
        toast.success('Montagem criada!');
        this.criandoMontagem.set(false);
        this.setStatus(produtoUuid, true);
        this.carregarMontagem(produtoUuid);
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao criar montagem.'),
    });
  }

  deletarMontagem() {
    const mc = this.montagemCompleta();
    if (!mc) return;
    if (!confirm('Excluir toda a montagem deste produto?')) return;
    this.montagemSvc.deletar(mc.montagem.uuid).subscribe({
      next: () => {
        toast.success('Montagem excluída!');
        const prod = this.produtoSelecionado();
        if (prod) {
          this.setStatus(prod.uuid, false);
          this.carregarMontagem(prod.uuid);
        }
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao excluir montagem.'),
    });
  }

  // ── Duplicar montagem ─────────────────────────────────────────────────────
  readonly duplicando     = signal(false);
  readonly produtoDestino = signal<Produto | null>(null);

  readonly produtosDestinoDisponivel = computed<Produto[]>(() => {
    const atual = this.produtoSelecionado();
    return this.produtosMontagemMode().filter(p => p.uuid !== atual?.uuid);
  });

  abrirDuplicar() {
    this.produtoDestino.set(null);
    this.duplicando.set(true);
  }

  fecharDuplicar() {
    this.duplicando.set(false);
    this.produtoDestino.set(null);
  }

  confirmarDuplicar() {
    const mc   = this.montagemCompleta();
    const dest = this.produtoDestino();
    if (!mc || !dest) return;

    this.montagemSvc.duplicar(mc.montagem.uuid, dest.uuid).subscribe({
      next: () => {
        toast.success(`Montagem duplicada para "${dest.nome}"!`);
        this.setStatus(dest.uuid, true);
        this.fecharDuplicar();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao duplicar montagem.'),
    });
  }

  // ── Etapas ────────────────────────────────────────────────────────────────
  readonly criandoEtapa = signal(false);

  etapaForm = this.fb.group({
    nome:               ['', Validators.required],
    descricao:          [''],
    papel:              ['ingrediente' as PapelEtapa, Validators.required],
    tipo:               ['escolha_multipla' as TipoEtapaMontagem, Validators.required],
    ordem:              [1, [Validators.required, Validators.min(1)]],
    min_selecoes:       [0, [Validators.required, Validators.min(0)]],
    max_selecoes:       [null as number | null],
    selecoes_gratuitas: [null as number | null],
  });

  abrirNovaEtapa(mc: MontagemCompleta) {
    const nextOrdem = (mc.etapas?.length ?? 0) + 1;
    this.etapaForm.reset({ nome: '', papel: 'ingrediente', tipo: 'escolha_multipla', ordem: nextOrdem, min_selecoes: 0 });
    this.criandoEtapa.set(true);
  }

  salvarEtapa(montagemUuid: string) {
    if (this.etapaForm.invalid) { this.etapaForm.markAllAsTouched(); return; }
    const fv = this.etapaForm.value;
    this.montagemSvc.criarEtapa(montagemUuid, {
      nome:               fv.nome!,
      descricao:          fv.descricao || null,
      papel:              fv.papel as PapelEtapa,
      tipo:               fv.tipo as TipoEtapaMontagem,
      ordem:              Number(fv.ordem ?? 1),
      min_selecoes:       Number(fv.min_selecoes ?? 0),
      max_selecoes:       fv.max_selecoes ? Number(fv.max_selecoes) : null,
      selecoes_gratuitas: fv.selecoes_gratuitas ? Number(fv.selecoes_gratuitas) : null,
    }).subscribe({
      next: () => {
        toast.success('Etapa criada!');
        this.criandoEtapa.set(false);
        this.etapaForm.reset({ nome: '', papel: 'ingrediente', tipo: 'escolha_multipla', min_selecoes: 0 });
        const prod = this.produtoSelecionado();
        if (prod) this.carregarMontagem(prod.uuid);
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao criar etapa.'),
    });
  }

  deletarEtapa(uuid: string) {
    if (!confirm('Excluir esta etapa e todas as suas opções?')) return;
    this.montagemSvc.deletarEtapa(uuid).subscribe({
      next: () => {
        toast.success('Etapa excluída!');
        const prod = this.produtoSelecionado();
        if (prod) this.carregarMontagem(prod.uuid);
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao excluir etapa.'),
    });
  }

  // ── Opções — Bulk insert ──────────────────────────────────────────────────
  readonly etapaExpandida = signal<string | null>(null);

  /** FormGroup raiz contendo o FormArray de linhas */
  bulkForm = this.fb.group({
    linhas: this.fb.array([] as FormGroup[]),
  });

  /** Acesso tipado ao FormArray */
  get bulkLinhas(): FormArray {
    return this.bulkForm.get('linhas') as FormArray;
  }

  /** Cast para uso no template com @for */
  get bulkLinhasAsGroups(): FormGroup[] {
    return this.bulkLinhas.controls as FormGroup[];
  }

  private novaLinhaGroup(): FormGroup {
    return this.fb.group({
      ingrediente_uuid: ['', Validators.required],
      nome:             [''],
      preco_extra:      [0, [Validators.required, Validators.min(0)]],
      gratis:           [false],
    });
  }

  abrirBulkOpcoes(etapaUuid: string) {
    // Limpa linhas anteriores e começa com 1 linha vazia
    while (this.bulkLinhas.length > 0) this.bulkLinhas.removeAt(0);
    this.bulkLinhas.push(this.novaLinhaGroup());
    this.etapaExpandida.set(etapaUuid);
  }

  fecharBulk() {
    this.etapaExpandida.set(null);
    while (this.bulkLinhas.length > 0) this.bulkLinhas.removeAt(0);
  }

  adicionarLinha() {
    this.bulkLinhas.push(this.novaLinhaGroup());
  }

  removerLinha(index: number) {
    this.bulkLinhas.removeAt(index);
  }

  salvarOpcoesBulk(etapaUuid: string) {
    if (this.bulkForm.invalid || this.bulkLinhas.length === 0) {
      this.bulkForm.markAllAsTouched();
      return;
    }

    const items = (this.bulkLinhas.value as any[]).map(row => {
      const ing  = this.ingredientes().find(i => i.uuid === row.ingrediente_uuid);
      const nome = (row.nome as string)?.trim() || ing?.nome || '';
      return {
        ingrediente_uuid: row.ingrediente_uuid as string,
        nome,
        preco_extra:  Number(row.preco_extra ?? 0),
        gratis:       Boolean(row.gratis),
        max_quantidade: null,
      };
    });

    this.montagemSvc.criarOpcoesBulk(etapaUuid, items).subscribe({
      next: (criadas) => {
        toast.success(`${criadas.length} opção(ões) adicionada(s)!`);
        // Atualização reativa direta — sem reload completo
        this.montagemCompleta.update(mc => {
          if (!mc) return mc;
          return {
            ...mc,
            etapas: mc.etapas.map(e =>
              e.uuid === etapaUuid
                ? { ...e, opcoes: [...e.opcoes, ...criadas] }
                : e
            ),
          };
        });
        this.fecharBulk();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao adicionar opções.'),
    });
  }

  deletarOpcao(uuid: string, etapaUuid: string) {
    if (!confirm('Remover esta opção?')) return;
    this.montagemSvc.deletarOpcao(uuid).subscribe({
      next: () => {
        toast.success('Opção removida!');
        // Atualização reativa direta — remove só o item excluído
        this.montagemCompleta.update(mc => {
          if (!mc) return mc;
          return {
            ...mc,
            etapas: mc.etapas.map(e =>
              e.uuid === etapaUuid
                ? { ...e, opcoes: e.opcoes.filter(o => o.uuid !== uuid) }
                : e
            ),
          };
        });
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao remover opção.'),
    });
  }
}
