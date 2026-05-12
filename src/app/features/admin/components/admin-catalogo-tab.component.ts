import { Component, inject, input, signal, computed, effect, DestroyRef, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { CatalogoService } from '../../../core/services/catalogo.service';
import { CategoriaProdutos, Produto, CreateCategoriaRequest } from '../../../core/models';
import { AdminCategoryCardComponent } from './admin-category-card.component';
import { UiInputComponent, UiSelectComponent, UiTextareaComponent, UiCheckboxComponent, UiButtonComponent } from '../../../shared/components';

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const COMPRESS_AFTER_SIZE = 5 * 1024 * 1024;
const COMPRESSED_IMAGE_MIME = 'image/webp';
const COMPRESSED_IMAGE_QUALITY = 0.82;

@Component({
  selector: 'admin-catalogo-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DragDropModule,
    AdminCategoryCardComponent,
    UiInputComponent,
    UiSelectComponent,
    UiTextareaComponent,
    UiCheckboxComponent,
    UiButtonComponent,
  ],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Categorias -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">📂 Categorias</h3>

        <form
          [formGroup]="catForm"
          (ngSubmit)="catEditId() ? salvarEdicaoCategoria() : criarCategoria()"
          class="space-y-3 mb-6"
        >
          <ui-input
            formControlName="nome"
            label="Nome *"
            size="sm"
            [error]="fc.nome.invalid && fc.nome.touched ? 'Nome obrigatório (mín. 2 caracteres)' : null"
          />

          <ui-textarea
            formControlName="descricao"
            label="Descrição"
            size="sm"
            [rows]="2"
          />

          <div class="flex gap-4">
            <ui-checkbox
              formControlName="pizza_mode"
              label="🍕 Modo Pizza"
              size="sm"
              (change)="$any($event.target).checked && catForm.get('drink_mode')?.setValue(false)"
            />

            <ui-checkbox
              formControlName="drink_mode"
              label="🥤 Modo Drink"
              size="sm"
              (change)="$any($event.target).checked && catForm.get('pizza_mode')?.setValue(false)"
            />
          </div>
          @if (catError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {{ catError() }}
            </p>
          }
          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button
                type="submit"
                [disabled]="catLoadingSubmit() || catForm.invalid"
                [loading]="catLoadingSubmit()"
                size="sm"
                [fullWidth]="true"
              >
                @if (catEditId()) {
                  Atualizar
                } @else {
                  Criar
                }
              </ui-button>
            </div>
            @if (catEditId()) {
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                (click)="cancelarEdicaoCategoria()"
              >
                Cancelar
              </ui-button>
            }
          </div>
        </form>

        <!-- Lista de categorias com produtos -->
        @if (catLoading()) {
          @for (_ of [1, 2, 3]; track $index) {
            <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-16"></div>
          }
        } @else if (categorias().length === 0) {
          <p class="text-xs text-gray-400 text-center py-4">Nenhuma categoria cadastrada.</p>
        } @else {
          @if (catReordering()) {
            <p class="text-xs text-gray-400 text-center mb-2">Salvando ordem...</p>
          }
          <div
            class="space-y-3"
            cdkDropList
            [cdkDropListData]="categorias()"
            (cdkDropListDropped)="onCategoriaDrop($event)"
          >
            @for (cat of categorias(); track cat.uuid) {
              <admin-category-card
                [categoria]="cat"
                [produtos]="produtosPorCategoria().get(cat.uuid) ?? []"
                (editar)="editarCategoria(cat)"
                (deletar)="deletarCategoria(cat.uuid, cat.nome)"
                (toggleProdutoDisponivel)="
                  toggleDisponibilidadeProduto($event.uuid, $event.nome, $event.disponivel, cat.uuid)
                "
                (editarProduto)="editarProduto($event)"
                (removerProduto)="deletarProduto($event.uuid, $event.nome, cat.uuid)"
              />
            }
          </div>
        }
      </div>

      <!-- Produto -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-base font-semibold text-gray-900 mb-5">
          @if (prodEditId()) {
            📝 Editar Produto
          } @else {
            🍔 Criar Produto
          }
        </h3>

        <form
          [formGroup]="prodForm"
          (ngSubmit)="prodEditId() ? salvarEdicaoProduto() : criarProduto()"
          class="space-y-3"
        >
          <ui-select
            formControlName="categoria_uuid"
            label="Categoria *"
            size="sm"
            [error]="
              fp.categoria_uuid.invalid && fp.categoria_uuid.touched ? 'Selecione uma categoria' : null
            "
          >
            <option value="">Selecione...</option>

            @for (cat of categorias(); track cat.uuid) {
              <option [value]="cat.uuid">{{ cat.nome }}</option>
            }
          </ui-select>

          <ui-input
            formControlName="nome"
            label="Nome *"
            size="sm"
            [error]="fp.nome.invalid && fp.nome.touched ? 'Nome obrigatório' : null"
          />

          <ui-textarea
            formControlName="descricao"
            label="Descrição"
            size="sm"
            [rows]="2"
          />

          <div class="grid grid-cols-2 gap-3">
            <ui-input
              formControlName="preco"
              type="number"
              label="Preço (R$) *"
              size="sm"
              min="0"
              step="0.01"
              [error]="fp.preco.invalid && fp.preco.touched ? 'Preço obrigatório' : null"
            />

            <ui-input
              formControlName="tempo_preparo_min"
              type="number"
              label="Tempo (min) *"
              size="sm"
              min="1"
              [error]="
                fp.tempo_preparo_min.invalid && fp.tempo_preparo_min.touched
                  ? 'Tempo obrigatório'
                  : null
              "
            />
          </div>

          <!-- Upload de imagem -->
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1"> Imagem </label>

            <input
              #imagemInput
              type="file"
              accept="image/*"
              (change)="onImagemSelected($event)"
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-700 file:text-xs file:font-medium file:cursor-pointer"
            />

            @if (prodImagemPreview() || (prodEditId() && prodForm.get('imagem_url')?.value)) {
              <div class="relative mt-2 w-24 h-24">
                <img
                  [src]="prodImagemPreview() || prodForm.get('imagem_url')?.value"
                  class="w-full h-full object-cover rounded-xl border border-gray-200"
                />
                <ui-button
                  variant="danger"
                  size="xs"
                  type="button"
                  (click)="removerImagemProduto()"
                  class="absolute -top-2 -right-2"
                  title="Remover imagem"
                  >✕</ui-button
                >
              </div>
            }
          </div>

          <ui-checkbox
            formControlName="destaque"
            label="Destaque"
            size="sm"
          />

          @if (prodError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {{ prodError() }}
            </p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button
                type="submit"
                [disabled]="prodLoading() || prodForm.invalid"
                [loading]="prodLoading()"
                size="sm"
                [fullWidth]="true"
              >
                @if (prodEditId()) {
                  Atualizar Produto
                } @else {
                  Criar Produto
                }
              </ui-button>
            </div>
            @if (prodEditId()) {
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                (click)="cancelarEdicaoProduto()"
              >
                Cancelar
              </ui-button>
            }
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AdminCatalogoTabComponent {
  lojaUuid = input.required<string>();

  private catalogoService = inject(CatalogoService);
  private fb = inject(FormBuilder);

  @ViewChild('imagemInput') imagemInput!: ElementRef<HTMLInputElement>;

  // ── Categorias ────────────────────────────────────────────────────────────
  private readonly refreshCatTrigger = new BehaviorSubject<void>(undefined);
  private readonly _categorias = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshCatTrigger]).pipe(
      switchMap(([uuid]) =>
        this.catalogoService.listarCategorias(uuid).pipe(catchError(() => of([] as CategoriaProdutos[]))),
      ),
    ),
    { initialValue: [] as CategoriaProdutos[] },
  );
  readonly catLoading = computed(() => this._categorias() === undefined);
  private readonly _categoriasOrdem = signal<CategoriaProdutos[] | null>(null);
  readonly categorias = computed(() => {
    const override = this._categoriasOrdem();
    if (override !== null) return override;
    return [...(this._categorias() ?? [])].sort((a, b) => a.ordem - b.ordem);
  });
  readonly catReordering = signal(false);

  // ── Produto form ──────────────────────────────────────────────────────────
  prodForm = this.fb.group({
    categoria_uuid: ['', Validators.required],
    nome: ['', [Validators.required, Validators.minLength(2)]],
    descricao: [''],
    preco: [0, [Validators.required, Validators.min(0)]],
    tempo_preparo_min: [30, [Validators.required, Validators.min(1)]],
    destaque: [false],
    imagem_url: [''],
  });

  // ── Category form ─────────────────────────────────────────────────────────
  catForm = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    descricao: [''],
    ordem: [0, [Validators.min(0)]],
    pizza_mode: [false],
    drink_mode: [false],
  });

  private refreshCategorias() { this.refreshCatTrigger.next(); }

  onCategoriaDrop(event: CdkDragDrop<CategoriaProdutos[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const lista = [...this.categorias()];
    moveItemInArray(lista, event.previousIndex, event.currentIndex);
    const listaComOrdem = lista.map((c, i) => ({ ...c, ordem: i + 1 }));
    this._categoriasOrdem.set(listaComOrdem);
    const ordens = listaComOrdem.map(c => ({ categoria_uuid: c.uuid, ordem: c.ordem }));
    this.catReordering.set(true);
    this.catalogoService.reordenarCategorias(this.lojaUuid(), ordens).subscribe({
      next: () => { this.catReordering.set(false); this._categoriasOrdem.set(null); this.refreshCategorias(); },
      error: (e) => {
        this.catReordering.set(false);
        this._categoriasOrdem.set(null);
        toast.error(e?.error?.error ?? 'Erro ao reordenar categorias.');
        this.refreshCategorias();
      },
    });
  }

  readonly produtosPorCategoria = signal<Map<string, Produto[]>>(new Map());

  private carregarProdutosDaCategoria(categoriaUuid: string) {
    this.catalogoService.listarProdutosPorCategoria(this.lojaUuid(), categoriaUuid).pipe(
      catchError(() => of([] as Produto[]))
    ).subscribe(produtos => {
      const currentMap = this.produtosPorCategoria();
      const newMap = new Map(currentMap);
      newMap.set(categoriaUuid, produtos);
      this.produtosPorCategoria.set(newMap);
    });
  }

  private carregarTodosProdutos() {
    this.categorias().forEach(cat => this.carregarProdutosDaCategoria(cat.uuid));
  }



  catLoadingSubmit = signal(false);
  catError = signal('');
  catEditId = signal<string | null>(null);

  get fc() { return this.catForm.controls; }

  criarCategoria() {
    if (this.catForm.invalid) { this.catForm.markAllAsTouched(); return; }
    this.catLoadingSubmit.set(true);
    this.catError.set('');
    const fv = this.catForm.value;
    const body: CreateCategoriaRequest = {
      nome: fv.nome!, descricao: fv.descricao || null, ordem: fv.ordem ?? 0,
      pizza_mode: fv.pizza_mode ?? false, drink_mode: fv.drink_mode ?? false,
    };
    this.catalogoService.criarCategoria(this.lojaUuid(), body).subscribe({
      next: () => {
        this.catLoadingSubmit.set(false);
        toast.success('Categoria criada com sucesso!');
        this.catForm.reset({ ordem: 0, pizza_mode: false, drink_mode: false });
        this.refreshCategorias();
      },
      error: (e) => { this.catLoadingSubmit.set(false); this.catError.set(e?.error?.error ?? 'Erro ao criar categoria.'); },
    });
  }

  editarCategoria(cat: CategoriaProdutos) {
    this.catEditId.set(cat.uuid);
    this.catForm.patchValue({ nome: cat.nome, descricao: cat.descricao ?? '', ordem: cat.ordem, pizza_mode: cat.pizza_mode, drink_mode: cat.drink_mode });
    this.catError.set('');
  }

  salvarEdicaoCategoria() {
    const uuid = this.catEditId();
    if (!uuid) return;
    if (this.catForm.invalid) { this.catForm.markAllAsTouched(); return; }
    this.catLoadingSubmit.set(true);
    this.catError.set('');
    const fv = this.catForm.value;
    this.catalogoService.atualizarCategoria(this.lojaUuid(), uuid, {
      nome: fv.nome!, descricao: fv.descricao || null, ordem: fv.ordem ?? 0,
      pizza_mode: fv.pizza_mode ?? false, drink_mode: fv.drink_mode ?? false,
    }).subscribe({
      next: () => {
        this.catLoadingSubmit.set(false);
        this.catEditId.set(null);
        toast.success('Categoria atualizada com sucesso!');
        this.catForm.reset({ ordem: 0, pizza_mode: false, drink_mode: false });
        this.refreshCategorias();
      },
      error: (e) => { this.catLoadingSubmit.set(false); this.catError.set(e?.error?.error ?? 'Erro ao atualizar categoria.'); },
    });
  }

  cancelarEdicaoCategoria() {
    this.catEditId.set(null);
    this.catForm.reset({ ordem: 0, pizza_mode: false, drink_mode: false });
    this.catError.set('');
  }

  deletarCategoria(uuid: string, nome: string) {
    if (!confirm(`Deletar categoria "${nome}"? Apenas funciona se não houver produtos vinculados.`)) return;
    this.catalogoService.deletarCategoria(this.lojaUuid(), uuid).subscribe({
      next: () => { toast.success('Categoria deletada com sucesso!'); this.refreshCategorias(); },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar categoria.'),
    });
  }

  prodLoading = signal(false);
  prodError = signal('');
  prodImagem = signal<File | null>(null);
  prodImagemPreview = signal<string | null>(null);
  prodEditId = signal<string | null>(null);

  get fp() { return this.prodForm.controls; }

  private limparInputImagem() {
    this.prodImagem.set(null);
    this.prodImagemPreview.set(null);
    if (this.imagemInput?.nativeElement) {
      this.imagemInput.nativeElement.value = '';
    }
  }

  removerImagemProduto() {
    const uuid = this.prodEditId();
    if (uuid) {
      if (!confirm('Deseja realmente remover a imagem deste produto?')) return;
      this.prodLoading.set(true);
      this.catalogoService.removerImagemProduto(uuid).subscribe({
        next: () => {
          this.prodLoading.set(false);
          toast.success('Imagem removida com sucesso!');
          this.limparInputImagem();
          this.refreshCategorias();
        },
        error: (e) => {
          this.prodLoading.set(false);
          toast.error(e?.error?.error ?? 'Erro ao remover imagem.');
        }
      });
    } else {
      this.limparInputImagem();
    }
  }

  async onImagemSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const prepared = await this.prepareImagemParaUpload(file);
      this.prodImagem.set(prepared);
      this.prodImagemPreview.set(await this.fileToDataUrl(prepared));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar a imagem.';
      toast.error(message);
      this.limparInputImagem();
    }
  }

  private async prepareImagemParaUpload(file: File): Promise<File> {
    if (file.size > COMPRESS_AFTER_SIZE) {
      file = await this.comprimirImagem(file);
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('A imagem deve ter no máximo 20MB.');
    }
    return file;
  }

  private async comprimirImagem(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem para compressão.');
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await this.canvasToBlob(canvas, COMPRESSED_IMAGE_MIME, COMPRESSED_IMAGE_QUALITY);
    const nomeBase = file.name.replace(/\.[^.]+$/, '') || 'imagem';
    return new File([blob], `${nomeBase}.webp`, { type: COMPRESSED_IMAGE_MIME });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Não foi possível comprimir a imagem.')); return; }
        resolve(blob);
      }, type, quality);
    });
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Não foi possível gerar a prévia da imagem.'));
      reader.readAsDataURL(file);
    });
  }

  criarProduto() {
    if (this.prodForm.invalid) { this.prodForm.markAllAsTouched(); return; }
    this.prodLoading.set(true);
    this.prodError.set('');
    const fv = this.prodForm.value;
    this.catalogoService.criarProduto({
      loja_uuid: this.lojaUuid(),
      categoria_uuid: fv.categoria_uuid!,
      nome: fv.nome!,
      descricao: fv.descricao || null,
      preco: fv.preco!,
      tempo_preparo_min: Number(fv.tempo_preparo_min ?? 30),
      destaque: fv.destaque ?? false,
      disponivel: true,
    }).subscribe({
      next: (prod) => {
        const imgFile = this.prodImagem();
        if (imgFile) {
          this.catalogoService.uploadImagemProduto(prod.uuid, imgFile).subscribe({
            next: () => {
              this.prodLoading.set(false);
              toast.success('Produto e imagem criados com sucesso!');
              this.prodForm.reset({ preco: 0, tempo_preparo_min: 30, destaque: false });
              this.limparInputImagem();
              this.carregarProdutosDaCategoria(fv.categoria_uuid!);
            },
            error: () => { this.prodLoading.set(false); toast.error('Produto criado, mas falha ao enviar imagem.'); },
          });
        } else {
          toast.success('Produto criado com sucesso!');
          this.prodLoading.set(false);
          this.prodForm.reset({ preco: 0, tempo_preparo_min: 30, destaque: false });
          this.limparInputImagem();
          this.carregarProdutosDaCategoria(fv.categoria_uuid!);
        }
      },
      error: (e) => { this.prodLoading.set(false); this.prodError.set(e?.error?.error ?? 'Erro ao criar produto.'); },
    });
  }

  editarProduto(prod: Produto) {
    this.prodEditId.set(prod.uuid);
    this.prodForm.patchValue({
      categoria_uuid: prod.categoria_uuid ?? '',
      nome: prod.nome,
      descricao: prod.descricao ?? '',
      preco: prod.preco,
      tempo_preparo_min: prod.tempo_preparo_min,
      destaque: prod.destaque ?? false,
      imagem_url: prod.imagem_url ?? '',
    });
    this.prodError.set('');
    this.limparInputImagem();
  }

  salvarEdicaoProduto() {
    const uuid = this.prodEditId();
    if (!uuid) return;
    if (this.prodForm.invalid) { this.prodForm.markAllAsTouched(); return; }
    this.prodLoading.set(true);
    this.prodError.set('');
    const fv = this.prodForm.value;

    const limparForm = (toastMessage: string) => {
        this.prodLoading.set(false);
        this.prodEditId.set(null);
        this.prodForm.reset({ preco: 0, tempo_preparo_min: 30, destaque: false });
        this.limparInputImagem();
        this.carregarProdutosDaCategoria(fv.categoria_uuid!);
        toast.success(toastMessage);
    }

    this.catalogoService.atualizarProduto(uuid, {
      categoria_uuid: fv.categoria_uuid ?? undefined,
      nome: fv.nome!,
      descricao: fv.descricao || null,
      preco: fv.preco!,
      tempo_preparo_min: Number(fv.tempo_preparo_min ?? 30),
      destaque: fv.destaque ?? false,
    }).subscribe({
      next: (prod) => {
        const imgFile = this.prodImagem();
        if (imgFile) {
          this.catalogoService.uploadImagemProduto(prod.uuid, imgFile).subscribe({
            next: () => limparForm('Produto e imagem atualizados com sucesso!'),
            error: () => {
              toast.success('Produto atualizado, mas falha ao enviar imagem.');
              this.prodLoading.set(false);
            },
          });
        } else { limparForm('Produto atualizado com sucesso!') }
      },
      error: (e) => { this.prodLoading.set(false); this.prodError.set(e?.error?.error ?? 'Erro ao atualizar produto.'); },
    });
  }

  cancelarEdicaoProduto() {
    this.prodEditId.set(null);
    this.prodForm.reset({ preco: 0, tempo_preparo_min: 30, destaque: false });
    this.limparInputImagem();
    this.prodError.set('');
  }

  deletarProduto(uuid: string, nome: string, categoriaUuid?: string) {
    if (!confirm(`Deletar produto "${nome}"? Esta ação não pode ser desfeita.`)) return;
    this.catalogoService.deletarProduto(uuid).subscribe({
      next: () => {
        toast.success('Produto deletado com sucesso!');
        if (categoriaUuid) this.carregarProdutosDaCategoria(categoriaUuid);
        else this.carregarTodosProdutos();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar produto.'),
    });
  }

  toggleDisponibilidadeProduto(uuid: string, nome: string, disponivelAtual: boolean, categoriaUuid?: string) {
    const novoEstado = !disponivelAtual;
    this.catalogoService.toggleDisponibilidadeProduto(this.lojaUuid(), uuid, novoEstado).subscribe({
      next: () => {
        toast.success(`Produto "${nome}" agora está ${novoEstado ? 'disponível' : 'indisponível'}.`);
        if (categoriaUuid) this.carregarProdutosDaCategoria(categoriaUuid);
        else this.carregarTodosProdutos();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao alterar disponibilidade do produto.'),
    });
  }

  constructor() {
    this.refreshCategorias();
    effect(() => {
      const cats = this.categorias();
      if (cats.length > 0) this.carregarTodosProdutos();
      else this.produtosPorCategoria.set(new Map());
    });
  }
}
