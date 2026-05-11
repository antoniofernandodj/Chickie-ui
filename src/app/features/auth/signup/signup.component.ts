import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ClasseUsuario } from '../../../core/models';
import { validarCpf } from '../../../core/utils/cpf-utils';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, of } from 'rxjs';

function cpfValidator(control: AbstractControl): ValidationErrors | null {
  const digits = (control.value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return validarCpf(digits) ? null : { cpf: true };
}
import {
  UiInputComponent,
  UiPasswordInputComponent,
  UiButtonComponent,
  UiErrorBannerComponent,
  UiAvatarComponent,
  UiSpinnerComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-signup',
  imports: [RouterLink, ReactiveFormsModule,
    UiInputComponent, UiPasswordInputComponent, UiButtonComponent,
    UiErrorBannerComponent, UiAvatarComponent, UiSpinnerComponent],
  templateUrl: './signup.component.html',
})
export class SignupComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private fb     = inject(FormBuilder);

  emailAvailable    = signal<boolean | null>(null);
  usernameAvailable = signal<boolean | null>(null);
  celularAvailable  = signal<boolean | null>(null);
  emailChecking     = signal(false);
  usernameChecking  = signal(false);
  celularChecking   = signal(false);

  form = this.fb.group({
    nome:        ['', [Validators.required, Validators.minLength(3)]],
    username:    ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-z0-9_-]+$/)]],
    email:       ['', [Validators.required, Validators.email]],
    senha:       ['', [Validators.required, Validators.minLength(6)]],
    celular:     ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    cpf:         ['', [Validators.required, Validators.pattern(/^\d{11}$/), cpfValidator]],
    auth_method: ['email'],
    classe:      ['cliente' as ClasseUsuario],
  });

  readonly classOptions: { value: ClasseUsuario; label: string; icon: string }[] = [
    { value: 'cliente',        label: 'Cliente',        icon: '🛒' },
    { value: 'administrador',  label: 'Administrador',  icon: '👑' },
  ];

  loading  = signal(false);
  error    = signal('');

  constructor() {
    const email = this.form.get('email')!;
    email.valueChanges.pipe(
      debounceTime(400), distinctUntilChanged(),
      filter((v): v is string => email.valid && !!v?.length),
      switchMap(v => { this.emailChecking.set(true); this.emailAvailable.set(null);
        return this.auth.verificarEmail(v).pipe(catchError(() => { this.emailChecking.set(false); return of({ disponivel: false }); })); })
    ).subscribe(r => { this.emailChecking.set(false); this.emailAvailable.set(r.disponivel); });

    const username = this.form.get('username')!;
    username.valueChanges.pipe(
      debounceTime(400), distinctUntilChanged(),
      switchMap(v => {
        const cleaned = (v ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (cleaned !== v) {
          username.setValue(cleaned, { emitEvent: false });
        }
        v = cleaned;
        if (v.length < 3) return of(undefined);
        this.usernameChecking.set(true); this.usernameAvailable.set(null);
        return this.auth.verificarUsername(v).pipe(catchError(() => { this.usernameChecking.set(false); return of({ disponivel: false }); }));
      })
    ).subscribe(r => { this.usernameChecking.set(false); if (r) this.usernameAvailable.set(r.disponivel); });

    const celular = this.form.get('celular')!;
    celular.valueChanges.pipe(
      debounceTime(400), distinctUntilChanged(),
      filter((v): v is string => v != null && v.length === 11),
      switchMap(v => { this.celularChecking.set(true); this.celularAvailable.set(null);
        return this.auth.verificarCelular(v).pipe(catchError(() => { this.celularChecking.set(false); return of({ disponivel: false }); })); })
    ).subscribe(r => { this.celularChecking.set(false); this.celularAvailable.set(r.disponivel); });
  }

  get f() { return this.form.controls; }

  get formReady(): boolean {
    return this.emailAvailable() === true && this.usernameAvailable() === true
        && this.celularAvailable() === true && this.form.valid;
  }

  cpfError = computed(() => {
    const c = this.f.cpf;
    if (!c.invalid || !c.touched) return null;
    if (c.errors?.['required']) return 'CPF é obrigatório.';
    if (c.errors?.['pattern'] || c.errors?.['cpf']) return 'CPF inválido.';
    return null;
  });

  nomeError = computed(() => {
    const c = this.f.nome;
    if (!c.invalid || !c.touched) return null;
    if (c.errors?.['required'])  return 'Nome é obrigatório.';
    if (c.errors?.['minlength']) return 'Nome deve ter pelo menos 3 caracteres.';
    return null;
  });

  usernameError = computed(() => {
    const c = this.f.username;
    if (!c.invalid || !c.touched) return null;
    if (c.errors?.['required'])  return 'Username é obrigatório.';
    if (c.errors?.['minlength']) return 'Username deve ter pelo menos 3 caracteres.';
    if (c.errors?.['pattern'])   return 'Username inválido. Use apenas letras sem acento, números, underscore (_) ou hífen (-).';
    return null;
  });

  emailError = computed(() => {
    const c = this.f.email;
    if (!c.invalid || !c.touched) return null;
    if (c.errors?.['required']) return 'E-mail é obrigatório.';
    if (c.errors?.['email'])    return 'E-mail inválido.';
    return null;
  });

  celularError = computed(() => {
    const c = this.f.celular;
    if (!c.invalid || !c.touched) return null;
    if (c.errors?.['required']) return 'Celular é obrigatório.';
    if (c.errors?.['pattern'])  return 'Celular deve ter 11 dígitos.';
    return null;
  });

  senhaError = computed(() => {
    const c = this.f.senha;
    if (!c.invalid || !c.touched) return null;
    if (c.errors?.['required'])  return 'Senha é obrigatória.';
    if (c.errors?.['minlength']) return 'Senha deve ter pelo menos 6 caracteres.';
    return null;
  });

  usernameState = computed(() => {
    if (this.f.username.invalid) return 'default' as const;
    if (this.usernameChecking()) return 'warning' as const;
    if (this.usernameAvailable() === true)  return 'success' as const;
    if (this.usernameAvailable() === false) return 'error' as const;
    return 'default' as const;
  });

  emailState = computed(() => {
    if (this.f.email.invalid) return 'default' as const;
    if (this.emailChecking()) return 'warning' as const;
    if (this.emailAvailable() === true)  return 'success' as const;
    if (this.emailAvailable() === false) return 'error' as const;
    return 'default' as const;
  });

  celularState = computed(() => {
    if (this.f.celular.invalid) return 'default' as const;
    if (this.celularChecking()) return 'warning' as const;
    if (this.celularAvailable() === true)  return 'success' as const;
    if (this.celularAvailable() === false) return 'error' as const;
    return 'default' as const;
  });

  submit() {
    if (this.form.invalid) {
      console.warn('[OBSERVABILITY] SignupComponent - Form invalid on submit');
      this.form.markAllAsTouched();
      this.error.set('Preencha todos os campos obrigatórios corretamente.');
      return;
    }
    if (!this.formReady) {
      console.warn('[OBSERVABILITY] SignupComponent - Form not ready (availability checks pending or failed)');
      this.error.set('Aguarde a verificação dos campos ou corrija os erros.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const v = this.form.value;
    console.info(`[OBSERVABILITY] SignupComponent - Submitting signup for email: ${v.email}`);
    this.auth.signup({ nome: v.nome!, username: v.username!, email: v.email!, senha: v.senha!, celular: v.celular!, cpf: v.cpf!, auth_method: v.auth_method!, classe: v.classe! })
      .subscribe({
        next: () => {
          console.info(`[OBSERVABILITY] SignupComponent - Signup successful for email: ${v.email}. Redirecting to verification.`);
          sessionStorage.setItem('chickie_signup_pending', JSON.stringify({ email: v.email!, nome: v.nome!, payload: { nome: v.nome!, username: v.username!, email: v.email!, senha: v.senha!, celular: v.celular!, cpf: v.cpf!, auth_method: v.auth_method!, classe: v.classe! } }));
          this.router.navigate(['/auth/verificar-email']);
        },
        error: (err) => {
          console.error(`[OBSERVABILITY] SignupComponent - Signup failed for email: ${v.email}`, err);
          this.loading.set(false);
          this.error.set(err?.error?.error ?? 'Erro ao criar conta. Tente novamente.');
        },
      });
  }
}