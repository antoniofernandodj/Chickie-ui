import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError, debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { Funcionario, Entregador, UpdateFuncionarioRequest, UpdateEntregadorRequest } from '../../../core/models';
import { UiInputComponent, UiPasswordInputComponent, UiButtonComponent } from '../../../shared/components';
import { AdminToggleAvailableBtnComponent } from './admin-toggle-available-btn.component';
import { AdminEditBtnComponent } from './admin-edit-btn.component';

@Component({
  selector: 'admin-equipe-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe,
    UiInputComponent, UiPasswordInputComponent, UiButtonComponent,
    AdminToggleAvailableBtnComponent, AdminEditBtnComponent,
  ],
  template: `
    <div class="grid md:grid-cols-2 gap-6">
      <!-- Funcionário -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">➕ Adicionar Funcionário</h3>
        <form
          [formGroup]="funcForm"
          (ngSubmit)="adicionarFuncionario()"
          autocomplete="off"
          class="space-y-3"
        >
          <ui-input
            formControlName="nome"
            label="Nome *"
            size="sm"
            autocomplete="off"
            [error]="ff.nome.invalid && ff.nome.touched ? 'Nome é obrigatório' : null"
          />
          <ui-input
            formControlName="username"
            label="Username *"
            size="sm"
            autocomplete="off"
            [state]="
              !ff.username.invalid && funcUsernameChecking()
                ? 'warning'
                : !ff.username.invalid && funcUsernameAvailable() === true
                  ? 'success'
                  : 'default'
            "
            [error]="
              ff.username.invalid && ff.username.touched
                ? ff.username.errors?.['required']
                  ? 'Username é obrigatório'
                  : 'Mínimo 3 caracteres'
                : !ff.username.invalid && !funcUsernameChecking() && funcUsernameAvailable() === false
                  ? '❌ Username já está em uso'
                  : null
            "
            [hint]="
              !ff.username.invalid && funcUsernameChecking()
                ? 'Verificando...'
                : !ff.username.invalid && !funcUsernameChecking() && funcUsernameAvailable() === true
                  ? '✅ Username disponível!'
                  : null
            "
          />
          <ui-input
            formControlName="email"
            type="email"
            label="E-mail *"
            size="sm"
            [state]="
              !ff.email.invalid && funcEmailChecking()
                ? 'warning'
                : !ff.email.invalid && funcEmailAvailable() === true
                  ? 'success'
                  : 'default'
            "
            [error]="
              ff.email.invalid && ff.email.touched
                ? ff.email.errors?.['required']
                  ? 'E-mail é obrigatório'
                  : 'E-mail inválido'
                : !ff.email.invalid && !funcEmailChecking() && funcEmailAvailable() === false
                  ? '❌ E-mail já está em uso'
                  : null
            "
            [hint]="
              !ff.email.invalid && funcEmailChecking()
                ? 'Verificando...'
                : !ff.email.invalid && !funcEmailChecking() && funcEmailAvailable() === true
                  ? '✅ E-mail disponível!'
                  : null
            "
          />
          <ui-password-input
            formControlName="senha"
            label="Senha *"
            size="sm"
            autocomplete="new-password"
            [error]="
              ff.senha.invalid && ff.senha.touched
                ? ff.senha.errors?.['required']
                  ? 'Senha é obrigatória'
                  : 'Mínimo 6 caracteres'
                : null
            "
          />
          <ui-input
            formControlName="celular"
            label="Celular *"
            size="sm"
            placeholder="(21) 9 9999-9999"
            mask="phone"
            [error]="
              ff.celular.invalid && ff.celular.touched
                ? ff.celular.errors?.['required']
                  ? 'Celular é obrigatório'
                  : 'Celular deve ter 11 dígitos'
                : null
            "
          />
          <ui-input
            formControlName="cargo"
            label="Cargo"
            size="sm"
          />
          <ui-input
            formControlName="salario"
            type="number"
            label="Salário *"
            size="sm"
            min="0"
            step="0.01"
            [error]="
              ff.salario.invalid && ff.salario.touched
                ? ff.salario.errors?.['required']
                  ? 'Salário é obrigatório'
                  : 'Salário deve ser >= 0'
                : null
            "
          />
          <ui-input
            formControlName="data_admissao"
            type="date"
            label="Data admissão *"
            size="sm"
            [error]="
              ff.data_admissao.invalid && ff.data_admissao.touched
                ? 'Data admissão é obrigatória'
                : null
            "
          />
          @if (equipeError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ equipeError() }}</p>
          }
          <ui-button
            type="submit"
            [disabled]="equipeLoading() || !funcFormReady"
            [loading]="equipeLoading()"
            size="sm"
            [fullWidth]="true"
          >
            Adicionar
          </ui-button>
        </form>

        <!-- Lista de funcionários -->
        <div class="mt-6">
          <h4 class="text-xs font-semibold text-gray-500 uppercase mb-3">Funcionários cadastrados</h4>
          @if (funcLoading()) {
            @for (_ of [1, 2, 3]; track $index) {
              <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-16"></div>
            }
          } @else if (funcionarios().length === 0) {
            <p class="text-xs text-gray-400 text-center py-4">Nenhum funcionário cadastrado.</p>
          } @else {
            <div class="space-y-2">
              @for (func of funcionarios(); track func.uuid) {
                <div class="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-gray-900">{{ func.cargo ?? 'Sem cargo' }}</p>
                    <p class="text-xs text-gray-500">
                      Admitido em {{ func.data_admissao | date: 'dd/MM/yyyy' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <p class="text-sm font-semibold text-gray-900">
                      R$ {{ func.salario | number: '1.2-2' }}
                    </p>
                    <admin-edit-btn (edit)="abrirEditFuncionario(func)" />
                  </div>
                </div>
              }
            </div>
          }

          <!-- Edit Funcionario Modal -->
          @if (editFuncionario()) {
            <div
              class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              (click)="fecharEditFuncionario()"
            >
              <div
                class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
                (click)="$event.stopPropagation()"
              >
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-base font-semibold text-gray-900">Editar Funcionário</h3>
                  <ui-button
                    type="button"
                    variant="ghost"
                    size="xs"
                    (click)="fecharEditFuncionario()"
                    >✕</ui-button
                  >
                </div>
                <form
                  [formGroup]="editFuncForm"
                  (ngSubmit)="salvarEditFuncionario()"
                  class="space-y-4"
                >
                  <ui-input
                    formControlName="cargo"
                    label="Cargo"
                    size="sm"
                  />
                  <ui-input
                    formControlName="salario"
                    type="number"
                    label="Salário *"
                    size="sm"
                    min="0"
                    step="0.01"
                    [error]="
                      editFf.salario.invalid && editFf.salario.touched
                        ? 'Salário é obrigatório e deve ser >= 0'
                        : null
                    "
                  />
                  <ui-input
                    formControlName="data_admissao"
                    type="date"
                    label="Data admissão *"
                    size="sm"
                    [error]="
                      editFf.data_admissao.invalid && editFf.data_admissao.touched
                        ? 'Data admissão é obrigatória'
                        : null
                    "
                  />
                  <div class="flex gap-2 pt-2">
                    <div class="flex-1">
                      <ui-button
                        type="submit"
                        [disabled]="editFuncLoading() || editFuncForm.invalid"
                        [loading]="editFuncLoading()"
                        size="sm"
                        [fullWidth]="true"
                        >Salvar</ui-button
                      >
                    </div>
                    <ui-button
                      type="button"
                      variant="secondary"
                      size="sm"
                      (click)="fecharEditFuncionario()"
                      >Cancelar</ui-button
                    >
                  </div>
                </form>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Entregador -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">🛵 Adicionar Entregador</h3>
        <form
          [formGroup]="entregForm"
          (ngSubmit)="adicionarEntregador()"
          autocomplete="off"
          class="space-y-3"
        >
          <ui-input
            formControlName="nome"
            label="Nome *"
            size="sm"
            autocomplete="off"
            [error]="ef.nome.invalid && ef.nome.touched ? 'Nome é obrigatório' : null"
          />
          <ui-input
            formControlName="username"
            label="Username *"
            size="sm"
            autocomplete="off"
            [state]="
              !ef.username.invalid && entregUsernameChecking()
                ? 'warning'
                : !ef.username.invalid && entregUsernameAvailable() === true
                  ? 'success'
                  : 'default'
            "
            [error]="
              ef.username.invalid && ef.username.touched
                ? ef.username.errors?.['required']
                  ? 'Username é obrigatório'
                  : 'Mínimo 3 caracteres'
                : !ef.username.invalid &&
                    !entregUsernameChecking() &&
                    entregUsernameAvailable() === false
                  ? '❌ Username já está em uso'
                  : null
            "
            [hint]="
              !ef.username.invalid && entregUsernameChecking()
                ? 'Verificando...'
                : !ef.username.invalid &&
                    !entregUsernameChecking() &&
                    entregUsernameAvailable() === true
                  ? '✅ Username disponível!'
                  : null
            "
          />
          <ui-input
            formControlName="email"
            type="email"
            label="E-mail *"
            size="sm"
            autocomplete="off"
            [state]="
              !ef.email.invalid && entregEmailChecking()
                ? 'warning'
                : !ef.email.invalid && entregEmailAvailable() === true
                  ? 'success'
                  : 'default'
            "
            [error]="
              ef.email.invalid && ef.email.touched
                ? ef.email.errors?.['required']
                  ? 'E-mail é obrigatório'
                  : 'E-mail inválido'
                : !ef.email.invalid && !entregEmailChecking() && entregEmailAvailable() === false
                  ? '❌ E-mail já está em uso'
                  : null
            "
            [hint]="
              !ef.email.invalid && entregEmailChecking()
                ? 'Verificando...'
                : !ef.email.invalid && !entregEmailChecking() && entregEmailAvailable() === true
                  ? '✅ E-mail disponível!'
                  : null
            "
          />
          <ui-password-input
            formControlName="senha"
            label="Senha *"
            size="sm"
            autocomplete="new-password"
            [error]="
              ef.senha.invalid && ef.senha.touched
                ? ef.senha.errors?.['required']
                  ? 'Senha é obrigatória'
                  : 'Mínimo 6 caracteres'
                : null
            "
          />
          <ui-input
            formControlName="celular"
            label="Celular *"
            size="sm"
            placeholder="(21) 9 9999-9999"
            mask="phone"
            autocomplete="off"
            [error]="
              ef.celular.invalid && ef.celular.touched
                ? ef.celular.errors?.['required']
                  ? 'Celular é obrigatório'
                  : 'Celular deve ter 11 dígitos'
                : null
            "
          />
          <ui-input
            formControlName="veiculo"
            label="Veículo"
            size="sm"
          />
          <ui-input
            formControlName="placa"
            label="Placa"
            size="sm"
          />
          @if (entregError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ entregError() }}</p>
          }
          <ui-button
            type="submit"
            [disabled]="entregLoading() || !entregFormReady"
            [loading]="entregLoading()"
            size="sm"
            [fullWidth]="true"
          >
            Adicionar
          </ui-button>
        </form>

        <!-- Lista de entregadores -->
        <div class="mt-6">
          <h4 class="text-xs font-semibold text-gray-500 uppercase mb-3">Entregadores cadastrados</h4>
          @if (entregLoadingList()) {
            @for (_ of [1, 2, 3]; track $index) {
              <div class="bg-gray-50 rounded-xl p-4 mb-2 skeleton h-16"></div>
            }
          } @else if (entregadores().length === 0) {
            <p class="text-xs text-gray-400 text-center py-4">Nenhum entregador cadastrado.</p>
          } @else {
            <div class="space-y-2">
              @for (entreg of entregadores(); track entreg.uuid) {
                <div class="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-gray-900">
                      {{ entreg.veiculo ?? 'Sem veículo' }}
                      @if (entreg.placa) {
                        <span class="text-xs text-gray-500 ml-2">({{ entreg.placa }})</span>
                      }
                    </p>
                    <p class="text-xs text-gray-500">
                      <span class="inline-flex items-center gap-1">
                        <span
                          class="w-2 h-2 rounded-full"
                          [class.bg-green-500]="entreg.disponivel"
                          [class.bg-red-500]="!entreg.disponivel"
                        ></span>
                        {{ entreg.disponivel ? 'Disponível' : 'Indisponível' }}
                      </span>
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <admin-toggle-available-btn
                      [available]="entreg.disponivel"
                      (toggle)="
                        toggleDisponibilidadeEntregador(
                          entreg.uuid,
                          entreg.veiculo ?? 'Entregador',
                          entreg.disponivel
                        )
                      "
                    />
                    <admin-edit-btn (edit)="abrirEditEntregador(entreg)" />
                  </div>
                </div>
              }
            </div>
          }

          <!-- Edit Entregador Modal -->
          @if (editEntregador()) {
            <div
              class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              (click)="fecharEditEntregador()"
            >
              <div
                class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
                (click)="$event.stopPropagation()"
              >
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-base font-semibold text-gray-900">Editar Entregador</h3>
                  <ui-button
                    type="button"
                    variant="ghost"
                    size="xs"
                    (click)="fecharEditEntregador()"
                    >✕</ui-button
                  >
                </div>
                <form
                  [formGroup]="editEntregForm"
                  (ngSubmit)="salvarEditEntregador()"
                  class="space-y-4"
                >
                  <ui-input
                    formControlName="veiculo"
                    label="Veículo"
                    size="sm"
                  />
                  <ui-input
                    formControlName="placa"
                    label="Placa"
                    size="sm"
                  />
                  <div class="flex gap-2 pt-2">
                    <div class="flex-1">
                      <ui-button
                        type="submit"
                        [disabled]="editEntregLoading() || editEntregForm.invalid"
                        [loading]="editEntregLoading()"
                        size="sm"
                        [fullWidth]="true"
                        >Salvar</ui-button
                      >
                    </div>
                    <ui-button
                      type="button"
                      variant="secondary"
                      size="sm"
                      (click)="fecharEditEntregador()"
                      >Cancelar</ui-button
                    >
                  </div>
                </form>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class AdminEquipeTabComponent {
  lojaUuid = input.required<string>();

  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  // ── Funcionários ──────────────────────────────────────────────────────────
  private readonly refreshFuncTrigger = new BehaviorSubject<void>(undefined);
  private readonly _funcionarios = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshFuncTrigger]).pipe(
      switchMap(([uuid]) =>
        this.adminService.listarFuncionarios(uuid).pipe(catchError(() => of([] as Funcionario[]))),
      ),
    ),
    { initialValue: [] as Funcionario[] },
  );
  readonly funcLoading = computed(() => this._funcionarios() === undefined);
  readonly funcionarios = computed(() => this._funcionarios() ?? []);

  private refreshFuncionarios() { this.refreshFuncTrigger.next(); }

  // ── Entregadores ──────────────────────────────────────────────────────────
  private readonly refreshEntregTrigger = new BehaviorSubject<void>(undefined);
  private readonly _entregadores = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshEntregTrigger]).pipe(
      switchMap(([uuid]) =>
        this.adminService.listarEntregadores(uuid).pipe(catchError(() => of([] as Entregador[]))),
      ),
    ),
    { initialValue: [] as Entregador[] },
  );
  readonly entregLoadingList = computed(() => this._entregadores() === undefined);
  readonly entregadores = computed(() => this._entregadores() ?? []);

  private refreshEntregadores() { this.refreshEntregTrigger.next(); }

  // ── Funcionario form ──────────────────────────────────────────────────────
  funcForm = this.fb.group({
    nome:          ['', Validators.required],
    username:      ['', [Validators.required, Validators.minLength(3)]],
    email:         ['', [Validators.required, Validators.email]],
    senha:         ['', [Validators.required, Validators.minLength(6)]],
    celular:       ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    cargo:         [''],
    salario:       [0, [Validators.required, Validators.min(0)]],
    data_admissao: ['', Validators.required],
  });

  funcEmailChecking = signal(false);
  funcEmailAvailable = signal<boolean | null>(null);
  funcUsernameChecking = signal(false);
  funcUsernameAvailable = signal<boolean | null>(null);
  equipeLoading = signal(false);
  equipeError = signal('');

  get ff() { return this.funcForm.controls; }
  get funcFormReady(): boolean {
    return this.funcEmailAvailable() === true && this.funcUsernameAvailable() === true && this.funcForm.valid;
  }

  // ── Editar Funcionário ────────────────────────────────────────────────────
  editFuncionario = signal<Funcionario | null>(null);
  editFuncForm = this.fb.group({
    cargo:         [''],
    salario:       [0, [Validators.required, Validators.min(0)]],
    data_admissao: ['', Validators.required],
  });
  editFuncLoading = signal(false);
  get editFf() { return this.editFuncForm.controls; }

  // ── Entregador form ───────────────────────────────────────────────────────
  entregForm = this.fb.group({
    nome:     ['', Validators.required],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email:    ['', [Validators.required, Validators.email]],
    senha:    ['', [Validators.required, Validators.minLength(6)]],
    celular:  ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    veiculo:  [''],
    placa:    [''],
  });

  entregEmailChecking = signal(false);
  entregEmailAvailable = signal<boolean | null>(null);
  entregUsernameChecking = signal(false);
  entregUsernameAvailable = signal<boolean | null>(null);
  entregLoading = signal(false);
  entregError = signal('');

  get ef() { return this.entregForm.controls; }
  get entregFormReady(): boolean {
    return this.entregEmailAvailable() === true && this.entregUsernameAvailable() === true && this.entregForm.valid;
  }

  // ── Editar Entregador ─────────────────────────────────────────────────────
  editEntregador = signal<Entregador | null>(null);
  editEntregForm = this.fb.group({ veiculo: [''], placa: [''] });
  editEntregLoading = signal(false);
  get editEf() { return this.editEntregForm.controls; }

  constructor() {
    this.refreshFuncionarios();
    this.refreshEntregadores();

    const funcEmailControl = this.funcForm.get('email');
    if (funcEmailControl) {
      funcEmailControl.valueChanges.pipe(
        debounceTime(400), distinctUntilChanged(),
        filter((email): email is string => {
          const emailValid = this.funcForm.get('email')?.valid ?? false;
          return email != null && email.length > 0 && emailValid;
        }),
        switchMap(email => {
          this.funcEmailChecking.set(true);
          this.funcEmailAvailable.set(null);
          return this.authService.verificarEmail(email).pipe(
            catchError(() => { this.funcEmailChecking.set(false); this.funcEmailAvailable.set(null); return of({ disponivel: false }); })
          );
        })
      ).subscribe(result => { this.funcEmailChecking.set(false); this.funcEmailAvailable.set(result.disponivel); });
    }

    const funcUsernameControl = this.funcForm.get('username');
    if (funcUsernameControl) {
      funcUsernameControl.valueChanges.pipe(
        debounceTime(400), distinctUntilChanged(),
        filter((username): username is string => username != null && username.length >= 3),
        switchMap(username => {
          this.funcUsernameChecking.set(true);
          this.funcUsernameAvailable.set(null);
          return this.authService.verificarUsername(username).pipe(
            catchError(() => { this.funcUsernameChecking.set(false); this.funcUsernameAvailable.set(null); return of({ disponivel: false }); })
          );
        })
      ).subscribe(result => { this.funcUsernameChecking.set(false); this.funcUsernameAvailable.set(result.disponivel); });
    }

    const entregEmailControl = this.entregForm.get('email');
    if (entregEmailControl) {
      entregEmailControl.valueChanges.pipe(
        debounceTime(400), distinctUntilChanged(),
        filter((email): email is string => {
          const emailValid = this.entregForm.get('email')?.valid ?? false;
          return email != null && email.length > 0 && emailValid;
        }),
        switchMap(email => {
          this.entregEmailChecking.set(true);
          this.entregEmailAvailable.set(null);
          return this.authService.verificarEmail(email).pipe(
            catchError(() => { this.entregEmailChecking.set(false); this.entregEmailAvailable.set(null); return of({ disponivel: false }); })
          );
        })
      ).subscribe(result => { this.entregEmailChecking.set(false); this.entregEmailAvailable.set(result.disponivel); });
    }

    const entregUsernameControl = this.entregForm.get('username');
    if (entregUsernameControl) {
      entregUsernameControl.valueChanges.pipe(
        debounceTime(400), distinctUntilChanged(),
        filter((username): username is string => username != null && username.length >= 3),
        switchMap(username => {
          this.entregUsernameChecking.set(true);
          this.entregUsernameAvailable.set(null);
          return this.authService.verificarUsername(username).pipe(
            catchError(() => { this.entregUsernameChecking.set(false); this.entregUsernameAvailable.set(null); return of({ disponivel: false }); })
          );
        })
      ).subscribe(result => { this.entregUsernameChecking.set(false); this.entregUsernameAvailable.set(result.disponivel); });
    }
  }

  adicionarFuncionario() {
    if (this.funcForm.invalid || !this.funcFormReady) {
      this.funcForm.markAllAsTouched();
      this.equipeError.set('Preencha todos os campos obrigatórios corretamente e aguarde a verificação.');
      return;
    }
    this.equipeLoading.set(true);
    this.equipeError.set('');
    const fv = this.funcForm.value;
    this.adminService.adicionarFuncionario(this.lojaUuid(), {
      nome: fv.nome!, username: fv.username!, email: fv.email!, senha: fv.senha!,
      celular: fv.celular!, cargo: fv.cargo || null, salario: fv.salario!, data_admissao: fv.data_admissao!,
    }).subscribe({
      next: () => {
        this.equipeLoading.set(false);
        toast.success('Funcionário adicionado com sucesso!');
        this.funcForm.reset({ salario: 0 });
        this.refreshFuncionarios();
      },
      error: (e) => { this.equipeLoading.set(false); this.equipeError.set(e?.error?.error ?? 'Erro ao adicionar funcionário.'); },
    });
  }

  abrirEditFuncionario(func: Funcionario) {
    this.editFuncionario.set(func);
    this.editFuncForm.patchValue({ cargo: func.cargo ?? '', salario: func.salario, data_admissao: func.data_admissao });
  }

  fecharEditFuncionario() { this.editFuncionario.set(null); this.editFuncForm.reset({ salario: 0 }); }

  salvarEditFuncionario() {
    const func = this.editFuncionario();
    if (!func) return;
    if (this.editFuncForm.invalid) { this.editFuncForm.markAllAsTouched(); return; }
    this.editFuncLoading.set(true);
    const fv = this.editFuncForm.value;
    const body: UpdateFuncionarioRequest = { cargo: fv.cargo || null, salario: fv.salario!, data_admissao: fv.data_admissao! };
    this.adminService.atualizarFuncionario(this.lojaUuid(), func.uuid, body).subscribe({
      next: () => {
        this.editFuncLoading.set(false);
        toast.success('Funcionário atualizado com sucesso!');
        this.fecharEditFuncionario();
        this.refreshFuncionarios();
      },
      error: (e) => { this.editFuncLoading.set(false); toast.error(e?.error?.error ?? 'Erro ao atualizar funcionário.'); },
    });
  }

  adicionarEntregador() {
    if (this.entregForm.invalid || !this.entregFormReady) {
      this.entregForm.markAllAsTouched();
      this.entregError.set('Preencha todos os campos obrigatórios corretamente e aguarde a verificação.');
      return;
    }
    this.entregLoading.set(true);
    this.entregError.set('');
    const fv = this.entregForm.value;
    this.adminService.adicionarEntregador(this.lojaUuid(), {
      nome: fv.nome!, username: fv.username!, email: fv.email!, senha: fv.senha!,
      celular: fv.celular!, veiculo: fv.veiculo || null, placa: fv.placa || null,
    }).subscribe({
      next: () => {
        this.entregLoading.set(false);
        toast.success('Entregador adicionado com sucesso!');
        this.entregForm.reset();
        this.refreshEntregadores();
      },
      error: (e) => { this.entregLoading.set(false); this.entregError.set(e?.error?.error ?? 'Erro ao adicionar entregador.'); },
    });
  }

  abrirEditEntregador(entreg: Entregador) {
    this.editEntregador.set(entreg);
    this.editEntregForm.patchValue({ veiculo: entreg.veiculo ?? '', placa: entreg.placa ?? '' });
  }

  fecharEditEntregador() { this.editEntregador.set(null); this.editEntregForm.reset(); }

  salvarEditEntregador() {
    const entreg = this.editEntregador();
    if (!entreg) return;
    if (this.editEntregForm.invalid) { this.editEntregForm.markAllAsTouched(); return; }
    this.editEntregLoading.set(true);
    const fv = this.editEntregForm.value;
    const body: UpdateEntregadorRequest = { veiculo: fv.veiculo || null, placa: fv.placa || null };
    this.adminService.atualizarEntregador(this.lojaUuid(), entreg.uuid, body).subscribe({
      next: () => {
        this.editEntregLoading.set(false);
        toast.success('Entregador atualizado com sucesso!');
        this.fecharEditEntregador();
        this.refreshEntregadores();
      },
      error: (e) => { this.editEntregLoading.set(false); toast.error(e?.error?.error ?? 'Erro ao atualizar entregador.'); },
    });
  }

  toggleDisponibilidadeEntregador(uuid: string, nome: string, disponivelAtual: boolean) {
    const novoEstado = !disponivelAtual;
    this.adminService.toggleDisponibilidadeEntregador(this.lojaUuid(), uuid, novoEstado).subscribe({
      next: () => {
        toast.success(`Entregador "${nome}" agora está ${novoEstado ? 'disponível' : 'indisponível'}.`);
        this.refreshEntregadores();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao alterar disponibilidade do entregador.'),
    });
  }
}
