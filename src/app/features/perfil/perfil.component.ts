import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { BehaviorSubject, catchError, of, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { DatePipe } from '@angular/common';
import { EnderecoUsuarioService } from '../../core/services/endereco-usuario.service';
import { AuthService } from '../../core/services/auth.service';
import { FidelidadeService } from '../../core/services/fidelidade.service';
import { EnderecoUsuario, EnderecoUsuarioRequest, RecompensaFidelidade } from '../../core/models';
import {
  UiTabBarComponent, UiCardComponent,
  UiButtonComponent, UiAvatarComponent, UiTab, EnderecoFormComponent,
} from '../../shared/components';

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, DatePipe,
    UiTabBarComponent, UiCardComponent, UiButtonComponent, UiAvatarComponent, EnderecoFormComponent],
  templateUrl: './perfil.component.html',
})
export class PerfilComponent {
  private endService       = inject(EnderecoUsuarioService);
  private auth             = inject(AuthService);
  private fb               = inject(FormBuilder);
  private fidelidadeService = inject(FidelidadeService);

  readonly tabs: UiTab[] = [
    { id: 'conta',        label: '👤 Conta' },
    { id: 'enderecos',    label: '📍 Endereços' },
    { id: 'recompensas',  label: '🎁 Recompensas' },
  ];

  readonly abaAtiva   = signal('conta');
  readonly showForm   = signal(false);
  readonly editando   = signal<string | null>(null);
  readonly formLoading= signal(false);
  readonly formError  = signal('');

  readonly nomeExibido = () => { try { return localStorage.getItem('chickie_nome') ?? 'Usuário'; } catch { return 'Usuário'; } };
  readonly initial     = () => this.nomeExibido().charAt(0).toUpperCase();

  private readonly refreshTrigger = new BehaviorSubject<void>(undefined);

  readonly _enderecos = toSignal(
    this.refreshTrigger.pipe(
      switchMap(() => this.endService.listar()),
      catchError(() => of([])),
    ),
    { initialValue: [] as EnderecoUsuario[] },
  );
  readonly endLoading = computed(() => this._enderecos() === undefined);
  readonly enderecos  = computed(() => this._enderecos() ?? []);

  private readonly recompensasTrigger = new BehaviorSubject<void>(undefined);
  readonly _recompensas = toSignal(
    this.recompensasTrigger.pipe(
      switchMap(() =>
        this.fidelidadeService.minhasRecompensas().pipe(
          catchError(() => of([] as RecompensaFidelidade[])),
        ),
      ),
    ),
    { initialValue: undefined as RecompensaFidelidade[] | undefined } as any,
  );
  readonly recompensasLoading = computed(() => this._recompensas() === undefined);
  readonly recompensas        = computed(() => this._recompensas() ?? []);

  formEnd = this.fb.group({
    endereco: [null as any],
    _uuid:    ['' as string | null],
  });

  get fe() { return this.formEnd.controls; }

  emptyForm() {
    this.formEnd.reset({ endereco: null, _uuid: null });
  }

  abrirFormNovo() { this.emptyForm(); this.editando.set(null); this.showForm.set(true); this.formError.set(''); }

  editarEndereco(e: EnderecoUsuario) {
    this.formEnd.patchValue({
      endereco: {
        cep: e.cep ?? '', logradouro: e.logradouro, numero: e.numero,
        complemento: e.complemento ?? '', bairro: e.bairro, cidade: e.cidade, estado: e.estado
      },
      _uuid: e.uuid
    });
    this.editando.set(e.uuid);
    this.showForm.set(true);
    this.formError.set('');
  }

  cancelarForm() { this.showForm.set(false); this.editando.set(null); }

  salvarEndereco() {
    if (this.formEnd.invalid) { this.formEnd.markAllAsTouched(); this.formError.set('Preencha os campos obrigatórios.'); return; }
    this.formLoading.set(true); this.formError.set('');

    const { endereco } = this.formEnd.value;
    const payload: EnderecoUsuarioRequest = {
      cep: endereco.cep || null, logradouro: endereco.logradouro!, numero: endereco.numero!,
      complemento: endereco.complemento || null, bairro: endereco.bairro!, cidade: endereco.cidade!, estado: endereco.estado!,
    };
    const uuid = this.editando();
    const op   = uuid ? this.endService.atualizar(uuid, payload) : this.endService.criar(payload);
    op.subscribe({
      next: () => { this.formLoading.set(false); this.cancelarForm(); this.refreshTrigger.next();
        toast.success(uuid ? 'Endereço atualizado!' : 'Endereço adicionado!'); },
      error: (e) => { this.formLoading.set(false); this.formError.set(e?.error?.error ?? 'Erro ao salvar endereço.'); },
    });
  }

  deletarEndereco(uuid: string) {
    if (!confirm('Remover este endereço?')) return;
    this.endService.deletar(uuid).subscribe({ next: () => { this.refreshTrigger.next(); toast.success('Endereço removido!'); } });
  }

  logout() { this.auth.logout(); location.href = '/'; }
}
