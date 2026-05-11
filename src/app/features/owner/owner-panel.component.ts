import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiButtonComponent, UiInputComponent, UiCheckboxComponent } from '../../shared/components';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { UsuarioService } from '../../core/services/usuario.service';
import { AdminService } from '../../core/services/admin.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import { Usuario, ClasseUsuario, CategoriaProdutos } from '../../core/models';

@Component({
  selector: 'app-owner-panel',
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent, UiInputComponent, UiCheckboxComponent],
  templateUrl: './owner-panel.component.html',
})
export class OwnerPanelComponent {
  private usuarioService = inject(UsuarioService);
  private adminService = inject(AdminService);
  private catalogoService = inject(CatalogoService);
  private fb = inject(FormBuilder);

  constructor() {
    console.info('[OBSERVABILITY] OwnerPanelComponent - Initializing owner panel');
  }

  readonly aba = signal('usuarios');
  readonly tabs = [
    { id: 'usuarios', label: '👥 Usuários' },
    { id: 'lojas', label: '🏪 Lojas' },
    { id: 'categorias', label: '📂 Categorias Globais' },
    { id: 'admin', label: '⚠️ Administração' },
  ];

  // ── Usuários ──────────────────────────────────────────────────────────────

  readonly classeFiltro = signal<ClasseUsuario | undefined>(undefined);

  private readonly refreshUsuariosTrigger = new BehaviorSubject<void>(undefined);

  readonly _usuarios = toSignal(
    this.refreshUsuariosTrigger.pipe(
      switchMap(() => {
        const classe = this.classeFiltro();
        console.debug(`[OBSERVABILITY] OwnerPanelComponent - Loading users. Filter: ${classe ?? 'all'}`);
        return this.usuarioService.listar(classe).pipe(
          tap((u: Usuario[]) => console.debug(`[OBSERVABILITY] OwnerPanelComponent - Users loaded: ${u.length}`)),
          catchError((err) => {
            console.error('[OBSERVABILITY] OwnerPanelComponent - Error loading users', err);
            return of([] as Usuario[]);
          }),
        );
      }),
    ),
    { initialValue: [] as Usuario[] },
  );
  readonly usuariosLoading = computed(() => this._usuarios() === undefined);
  readonly usuarios = computed<Usuario[]>(() => this._usuarios() ?? []);

  readonly usuariosFiltrados = computed(() => {
    const usuarios = this.usuarios();
    const filtro = this.classeFiltro();
    if (!filtro) return usuarios;
    return usuarios.filter((u: Usuario) => u.classe === filtro);
  });

  refreshUsuarios() {
    this.refreshUsuariosTrigger.next();
  }

  setFiltro(classe: ClasseUsuario | undefined) {
    this.classeFiltro.set(classe);
  }

  toggleBloqueioUsuario(usuario: Usuario) {
    const novoEstado = !usuario.ativo;
    this.usuarioService.bloquearUsuario(usuario.uuid, novoEstado).subscribe({
      next: () => {
        toast.success(`Usuário "${usuario.nome}" ${novoEstado ? 'bloqueado' : 'desbloqueado'}!`);
        this.refreshUsuarios();
      },
      error: (e) => {
        toast.error(e?.error?.error ?? 'Erro ao alterar status do usuário.');
      },
    });
  }

  toggleAtivoUsuario(usuario: Usuario) {
    const novoEstado = !usuario.ativo;
    this.usuarioService.ativarUsuario(usuario.uuid, novoEstado).subscribe({
      next: () => {
        toast.success(`Usuário "${usuario.nome}" ${novoEstado ? 'ativado' : 'desativado'}!`);
        this.refreshUsuarios();
      },
      error: (e) => {
        toast.error(e?.error?.error ?? 'Erro ao alterar status do usuário.');
      },
    });
  }

  marcarRemocao(usuario: Usuario) {
    this.usuarioService.marcarRemocao(usuario.uuid).subscribe({
      next: () => {
        toast.success(`Usuário "${usuario.nome}" marcado para remoção!`);
        this.refreshUsuarios();
      },
      error: (e) => {
        toast.error(e?.error?.error ?? 'Erro ao marcar usuário para remoção.');
      },
    });
  }

  desmarcarRemocao(usuario: Usuario) {
    this.usuarioService.desmarcarRemocao(usuario.uuid).subscribe({
      next: () => {
        toast.success(`Usuário "${usuario.nome}" desmarcado para remoção!`);
        this.refreshUsuarios();
      },
      error: (e) => {
        toast.error(e?.error?.error ?? 'Erro ao desmarcar usuário para remoção.');
      },
    });
  }

  // ── Lojas ─────────────────────────────────────────────────────────────────

  readonly lojas = signal<any[]>([]);
  readonly lojasLoading = signal(false);

  toggleBloqueioLoja(loja: any) {
    const novoEstado = !loja.ativa;
    this.adminService.bloquearLoja(loja.uuid, novoEstado).subscribe({
      next: () => {
        toast.success(`Loja "${loja.nome}" ${novoEstado ? 'bloqueada' : 'desbloqueada'}!`);
        this.refreshLojas();
      },
      error: (e) => {
        toast.error(e?.error?.error ?? 'Erro ao alterar status da loja.');
      },
    });
  }

  refreshLojas() {
    toast.info('Listagem de lojas em desenvolvimento.');
  }

  // ── Categorias Globais ────────────────────────────────────────────────────

  private readonly refreshCatTrigger = new BehaviorSubject<void>(undefined);

  readonly _categorias = toSignal(
    this.refreshCatTrigger.pipe(
      switchMap(() =>
        this.catalogoService.listarCategoriasGlobais().pipe(
          catchError(() => of([] as CategoriaProdutos[])),
        ),
      ),
    ),
    { initialValue: [] as CategoriaProdutos[] },
  );
  readonly catLoading = computed(() => this._categorias() === undefined);
  readonly categorias = computed(() => this._categorias() ?? []);

  readonly catEditandoUuid = signal<string | null>(null);
  readonly catLoadingSubmit = signal(false);
  readonly catError = signal('');
  readonly catDeleteConfirm = signal<string | null>(null);

  readonly catForm = this.fb.group({
    nome:       ['', Validators.required],
    descricao:  [''],
    pizza_mode: [false],
    drink_mode: [false],
  });

  refreshCategorias() {
    this.refreshCatTrigger.next();
  }

  iniciarEdicaoCategoria(cat: CategoriaProdutos) {
    this.catEditandoUuid.set(cat.uuid);
    this.catError.set('');
    this.catForm.setValue({
      nome:       cat.nome,
      descricao:  cat.descricao ?? '',
      pizza_mode: cat.pizza_mode,
      drink_mode: cat.drink_mode,
    });
  }

  cancelarEdicaoCategoria() {
    this.catEditandoUuid.set(null);
    this.catError.set('');
    this.catForm.reset({ nome: '', descricao: '', pizza_mode: false, drink_mode: false });
  }

  salvarCategoria() {
    if (this.catForm.invalid) {
      this.catForm.markAllAsTouched();
      return;
    }
    const fv = this.catForm.value;
    const body = {
      nome:       fv.nome!,
      descricao:  fv.descricao || null,
      pizza_mode: fv.pizza_mode ?? false,
      drink_mode: fv.drink_mode ?? false,
    };
    this.catLoadingSubmit.set(true);
    this.catError.set('');

    const editando = this.catEditandoUuid();
    const obs = editando
      ? this.adminService.atualizarCategoriaGlobal(editando, body)
      : this.adminService.criarCategoriaGlobal(body);

    obs.subscribe({
      next: () => {
        this.catLoadingSubmit.set(false);
        toast.success(editando ? 'Categoria atualizada!' : 'Categoria criada!');
        this.cancelarEdicaoCategoria();
        this.refreshCategorias();
      },
      error: (e) => {
        this.catLoadingSubmit.set(false);
        this.catError.set(e?.error?.error ?? 'Erro ao salvar categoria.');
      },
    });
  }

  confirmarDeleteCategoria(uuid: string) {
    this.catDeleteConfirm.set(uuid);
  }

  cancelarDeleteCategoria() {
    this.catDeleteConfirm.set(null);
  }

  deletarCategoria(uuid: string) {
    this.adminService.deletarCategoriaGlobal(uuid).subscribe({
      next: () => {
        toast.success('Categoria removida!');
        this.catDeleteConfirm.set(null);
        this.refreshCategorias();
      },
      error: (e) => {
        toast.error(e?.error?.error ?? 'Erro ao remover categoria.');
        this.catDeleteConfirm.set(null);
      },
    });
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  readonly wipeLoading = signal(false);
  readonly wipeConfirm = signal(false);

  confirmarWipe() {
    this.wipeConfirm.set(true);
  }

  cancelarWipe() {
    this.wipeConfirm.set(false);
  }

  executarWipe() {
    this.wipeLoading.set(true);
    this.adminService.wipeDatabase().subscribe({
      next: () => {
        this.wipeLoading.set(false);
        this.wipeConfirm.set(false);
        toast.success('Banco de dados limpo com sucesso!');
      },
      error: (e) => {
        this.wipeLoading.set(false);
        toast.error(e?.error?.error ?? 'Erro ao limpar banco de dados.');
      },
    });
  }

  getClasseBadgeClass(classe: string): string {
    switch (classe) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'administrador':
        return 'bg-blue-100 text-blue-800';
      case 'funcionario':
        return 'bg-green-100 text-green-800';
      case 'entregador':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
