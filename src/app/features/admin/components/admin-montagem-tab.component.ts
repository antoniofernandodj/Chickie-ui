import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
  EtapaComOpcoes,
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
  { value: 'escolha_unica',      label: 'Escolha única (radio)'       },
  { value: 'escolha_multipla',   label: 'Múltipla seleção (checkbox)' },
  { value: 'quantidade_por_opcao', label: 'Quantidade por opção'      },
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
                class="text-left p-4 rounded-xl border transition-colors"
                [class]="produtoSelecionado()?.uuid === prod.uuid
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'"
                (click)="selecionarProduto(prod)"
              >
                <p class="text-sm font-semibold text-gray-900">{{ prod.nome }}</p>
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
              <ui-button variant="danger" size="sm" (click)="deletarMontagem()">
                🗑️ Excluir Montagem
              </ui-button>
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
              <form [formGroup]="montagemForm" (ngSubmit)="salvarMontagem(prod.uuid)" class="space-y-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
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

            <!-- Etapas existentes -->
            @if (montagemCompleta(); as mc) {
              <div class="space-y-4">
                @for (etapa of mc.etapas; track etapa.uuid) {
                  <div class="border border-gray-200 rounded-xl overflow-hidden">
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
                    <!-- Opções da etapa -->
                    <div class="p-4 space-y-2">
                      @for (opcao of etapa.opcoes; track opcao.uuid) {
                        <div class="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg">
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="text-xs text-gray-500">{{ opcao.ordem }}.</span>
                            <span class="text-sm text-gray-800">{{ opcao.nome }}</span>
                            @if (opcao.gratis) {
                              <span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">grátis</span>
                            } @else {
                              <span class="text-xs text-gray-500">+R$ {{ opcao.preco_extra | number: '1.2-2' }}</span>
                            }
                          </div>
                          <ui-button variant="danger" size="xs" (click)="deletarOpcao(opcao.uuid)">×</ui-button>
                        </div>
                      }
                      <!-- Adicionar opção -->
                      @if (etapaExpandida() === etapa.uuid) {
                        <form [formGroup]="opcaoForm" (ngSubmit)="salvarOpcao(etapa.uuid)" class="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl space-y-2">
                          <h5 class="text-xs font-semibold text-gray-700">Nova Opção</h5>
                          <ui-select formControlName="ingrediente_uuid" label="Ingrediente *" size="sm">
                            <option value="">Selecione...</option>
                            @for (ing of ingredientes(); track ing.uuid) {
                              <option [value]="ing.uuid">{{ ing.nome }}</option>
                            }
                          </ui-select>
                          <ui-input formControlName="nome" label="Nome exibido" size="sm" placeholder="Deixe vazio para usar o do ingrediente" />
                          <div class="grid grid-cols-2 gap-2">
                            <ui-input formControlName="preco_extra" label="Preço extra (R$)" type="number" size="sm" min="0" step="0.01" />
                            <ui-input formControlName="ordem" label="Ordem" type="number" size="sm" min="1" />
                          </div>
                          <div class="flex gap-4">
                            <ui-checkbox formControlName="gratis" label="Sempre grátis" size="sm" />
                          </div>
                          <div class="flex gap-2">
                            <ui-button type="submit" size="sm" [disabled]="opcaoForm.invalid">Adicionar</ui-button>
                            <ui-button type="button" variant="secondary" size="sm" (click)="etapaExpandida.set(null)">Cancelar</ui-button>
                          </div>
                        </form>
                      } @else {
                        <ui-button variant="secondary" size="xs" [fullWidth]="true" (click)="abrirNovaOpcao(etapa.uuid)">
                          + Adicionar opção
                        </ui-button>
                      }
                    </div>
                  </div>
                }

                <!-- Criar nova etapa -->
                @if (criandoEtapa()) {
                  <form [formGroup]="etapaForm" (ngSubmit)="salvarEtapa(mc.montagem.uuid)" class="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
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
                    <div class="grid grid-cols-3 gap-2">
                      <ui-input formControlName="ordem" label="Ordem" type="number" size="sm" min="1" />
                      <ui-input formControlName="min_selecoes" label="Mín. seleções" type="number" size="sm" min="0" />
                      <ui-input formControlName="max_selecoes" label="Máx. seleções" type="number" size="sm" min="1" placeholder="∞" />
                    </div>
                    <div class="flex gap-2">
                      <ui-button type="submit" size="sm" [disabled]="etapaForm.invalid">Criar Etapa</ui-button>
                      <ui-button type="button" variant="secondary" size="sm" (click)="criandoEtapa.set(false)">Cancelar</ui-button>
                    </div>
                  </form>
                } @else {
                  <ui-button variant="secondary" size="sm" [fullWidth]="true" (click)="criandoEtapa.set(true)">
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
    const cats = this._categorias() ?? [];
    const prods = this._todosProdutos() ?? [];
    const uuidsMontagem = new Set(cats.filter(c => c.montagem_mode).map(c => c.uuid));
    return prods.filter(p => uuidsMontagem.has(p.categoria_uuid));
  });

  // ── Produto selecionado ───────────────────────────────────────────────────
  readonly produtoSelecionado = signal<Produto | null>(null);

  private refreshMontagem = new BehaviorSubject<void>(undefined);

  readonly montagemCompleta   = signal<MontagemCompleta | null>(null);
  readonly carregandoMontagem = signal(false);
  readonly montagemExistente  = signal(true); // will be set after load

  selecionarProduto(prod: Produto) {
    this.produtoSelecionado.set(prod);
    this.montagemCompleta.set(null);
    this.criandoMontagem.set(false);
    this.criandoEtapa.set(false);
    this.etapaExpandida.set(null);
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
        if (prod) this.carregarMontagem(prod.uuid);
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao excluir montagem.'),
    });
  }

  // ── Etapas ────────────────────────────────────────────────────────────────
  readonly criandoEtapa = signal(false);

  etapaForm = this.fb.group({
    nome:          ['', Validators.required],
    descricao:     [''],
    papel:         ['ingrediente' as PapelEtapa, Validators.required],
    tipo:          ['escolha_multipla' as TipoEtapaMontagem, Validators.required],
    ordem:         [1, [Validators.required, Validators.min(1)]],
    min_selecoes:  [0, [Validators.required, Validators.min(0)]],
    max_selecoes:  [null as number | null],
    selecoes_gratuitas: [null as number | null],
  });

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
        this.etapaForm.reset({ nome: '', papel: 'ingrediente', tipo: 'escolha_multipla', ordem: 1, min_selecoes: 0 });
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

  // ── Opções ────────────────────────────────────────────────────────────────
  readonly etapaExpandida = signal<string | null>(null);

  opcaoForm = this.fb.group({
    ingrediente_uuid: ['', Validators.required],
    nome:             [''],
    descricao:        [''],
    preco_extra:      [0, [Validators.required, Validators.min(0)]],
    gratis:           [false],
    ordem:            [1, [Validators.required, Validators.min(1)]],
    max_quantidade:   [null as number | null],
  });

  abrirNovaOpcao(etapaUuid: string) {
    this.etapaExpandida.set(etapaUuid);
    const mc = this.montagemCompleta();
    const etapa = mc?.etapas.find(e => e.uuid === etapaUuid);
    const nextOrdem = (etapa?.opcoes.length ?? 0) + 1;
    this.opcaoForm.reset({ ingrediente_uuid: '', nome: '', descricao: '', preco_extra: 0, gratis: false, ordem: nextOrdem });
  }

  salvarOpcao(etapaUuid: string) {
    if (this.opcaoForm.invalid) { this.opcaoForm.markAllAsTouched(); return; }
    const fv = this.opcaoForm.value;
    // Use ingredient name if no override name given
    const ing = this.ingredientes().find(i => i.uuid === fv.ingrediente_uuid);
    const nome = fv.nome?.trim() || ing?.nome || '';
    this.montagemSvc.criarOpcao(etapaUuid, {
      ingrediente_uuid: fv.ingrediente_uuid!,
      nome,
      descricao:        fv.descricao || null,
      preco_extra:      Number(fv.preco_extra ?? 0),
      gratis:           fv.gratis ?? false,
      ordem:            Number(fv.ordem ?? 1),
      max_quantidade:   fv.max_quantidade ? Number(fv.max_quantidade) : null,
    }).subscribe({
      next: () => {
        toast.success('Opção adicionada!');
        this.etapaExpandida.set(null);
        const prod = this.produtoSelecionado();
        if (prod) this.carregarMontagem(prod.uuid);
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao adicionar opção.'),
    });
  }

  deletarOpcao(uuid: string) {
    if (!confirm('Remover esta opção?')) return;
    this.montagemSvc.deletarOpcao(uuid).subscribe({
      next: () => {
        toast.success('Opção removida!');
        const prod = this.produtoSelecionado();
        if (prod) this.carregarMontagem(prod.uuid);
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao remover opção.'),
    });
  }
}
