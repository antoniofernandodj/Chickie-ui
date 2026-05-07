import { Injectable, inject, PLATFORM_ID, signal, computed, afterNextRender } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toast } from 'ngx-sonner';
import { ToastQueueService } from './toast-queue.service';
import {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  ConfirmarEmailResponse,
  Usuario,
  ClasseUsuario,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastQueue = inject(ToastQueueService);
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly _token = signal<string | null>(this.loadToken());
  readonly token = this._token.asReadonly();

  // 'loading' enquanto valida o token com /me, 'valid' se ok, 'unauthenticated' se sem token ou inválido
  private readonly _tokenStatus = signal<'loading' | 'valid' | 'unauthenticated'>(
    this.loadToken() ? 'loading' : 'unauthenticated',
  );
  readonly tokenStatus = this._tokenStatus.asReadonly();
  readonly isAuthenticated = computed(() => this._tokenStatus() === 'valid');
  readonly tokenChecking = computed(() => this._tokenStatus() === 'loading');

  // Signal para forçar reatividade quando userClass muda
  private readonly _userClassTrigger = signal<Date>(new Date());

  readonly userClass = computed<ClasseUsuario | null>(() => {
    // Depende do signal para forçar recalculo quando _userClassTrigger muda
    this._userClassTrigger();
    if (!isPlatformBrowser(this.platformId)) return null;
    return (localStorage.getItem('chickie_classe') as ClasseUsuario | null) ?? null;
  });

  readonly isAdmin = computed(() => this.userClass() === 'administrador' || this.userClass() === 'owner');
  readonly isFuncionario = computed(() => this.userClass() === 'funcionario');
  readonly isOwner = computed(() => this.userClass() === 'owner');

  constructor() {
    // Usamos afterNextRender para garantir que a validação só ocorra no browser
    // e após a hidratação inicial estar completa, evitando race conditions.
    afterNextRender(() => {
      const token = this.loadToken();
      if (!token) {
        this._tokenStatus.set('unauthenticated');
        return;
      }

      this.http.get<Usuario>(`${this.base}/me`).subscribe({
        next: (user) => {
          if (user.classe) {
            this.saveItem('chickie_classe', user.classe);
            this._userClassTrigger.set(new Date());
          }
          if (user.nome) this.saveItem('chickie_nome', user.nome);
          this._tokenStatus.set('valid');
        },
        error: (err) => {
          console.error('[AuthService] Erro ao validar token no startup:', err);
          
          // Só limpa o localStorage se for explicitamente 401 (Unauthorized)
          // Se for erro de rede (0), timeout, ou erro de servidor (5xx), não limpamos.
          if (err.status === 401) {
            this.removeItem('chickie_token');
            this.removeItem('chickie_nome');
            this.removeItem('chickie_classe');
            this._token.set(null);
            this._tokenStatus.set('unauthenticated');
            toast.error('Sessão expirada. Faça login novamente.');
          } else {
            // Em caso de erro de rede ou servidor, paramos o loading mas mantemos o token
            // para permitir que o usuário tente novamente depois (ex: dando F5).
            this._tokenStatus.set('unauthenticated');
          }
        },
      });
    });
  }

  private loadToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('chickie_token');
  }

  private saveItem(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, value);
    }
  }

  private removeItem(key: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(key);
    }
  }

  signup(body: SignupRequest): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.base}/signup`, body);
  }

  confirmarEmail(token: string): Observable<ConfirmarEmailResponse> {
    return this.http.get<ConfirmarEmailResponse>(`${this.base}/confirmar-email`, { params: { token } }).pipe(
      tap((res) => {
        this.saveItem('chickie_token', res.token);
        this._token.set(res.token);
        this._tokenStatus.set('valid');
        if (res.usuario.classe) {
          this.saveItem('chickie_classe', res.usuario.classe);
          this._userClassTrigger.set(new Date());
        }
        if (res.usuario.nome) {
          this.saveItem('chickie_nome', res.usuario.nome);
        }
      }),
    );
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, body).pipe(
      tap((res) => {
        this.saveItem('chickie_token', res.access_token);
        this._token.set(res.access_token);
        this._tokenStatus.set('valid');
        const classe = this.extractClasseFromToken(res.access_token);
        if (classe) {
          this.saveItem('chickie_classe', classe);
          this._userClassTrigger.set(new Date());
        }
      }),
    );
  }

  /**
   * GET /api/auth/me - Seção 2.3 da API
   * Busca o perfil do usuário autenticado e salva chickie_classe no localStorage.
   * Deve ser chamado após o login para garantir que a classe seja armazenada.
   */
  fetchAndSaveUserProfile(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.base}/me`).pipe(
      tap((user) => {
        if (user.classe) {
          this.saveItem('chickie_classe', user.classe);
          this._userClassTrigger.set(new Date()); // Força atualização reativa
        }
        if (user.nome) {
          this.saveItem('chickie_nome', user.nome);
        }
      }),
    );
  }

  private extractClasseFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Adiciona padding se necessário
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padLength = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLength);
      
      const payload = JSON.parse(atob(padded));
      
      // Tenta diferentes campos possíveis para a classe
      return payload?.classe 
        ?? payload?.userClass 
        ?? payload?.role 
        ?? payload?.user_class 
        ?? null;
    } catch (e) {
      console.warn('Failed to extract classe from JWT:', e);
      return null;
    }
  }

  saveUserMeta(nome: string): void {
    this.saveItem('chickie_nome', nome);
  }

  /** Solicita redefinição de senha — envia email com link */
  esquecerSenha(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/esqueci-senha`, { email });
  }

  /** Redefine a senha usando o token recebido por email */
  redefinirSenha(token: string, nova_senha: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/redefinir-senha`, { token, nova_senha });
  }

  /** Verificar disponibilidade de email */
  verificarEmail(email: string): Observable<{ disponivel: boolean }> {
    return this.http.post<{ disponivel: boolean }>(`${this.base}/verificar-email`, { email });
  }

  /** Verificar disponibilidade de username */
  verificarUsername(username: string): Observable<{ disponivel: boolean }> {
    return this.http.post<{ disponivel: boolean }>(`${this.base}/verificar-username`, { username });
  }

  /** Verificar disponibilidade de celular */
  verificarCelular(celular: string): Observable<{ disponivel: boolean }> {
    return this.http.post<{ disponivel: boolean }>(
      `${this.base}/verificar-celular`,
      { celular },
    );
  }

  logout(): void {
    this.removeItem('chickie_token');
    this.removeItem('chickie_nome');
    this.removeItem('chickie_classe');
    this._token.set(null);
    this._tokenStatus.set('unauthenticated');
    this._userClassTrigger.set(new Date()); // Força atualização de userClass() para null
    this.toastQueue.enqueue('Sessão encerrada com sucesso.');
  }

  /** Extrai o UUID do usuário do token JWT */
  getUsuarioUuid(): string | null {
    const token = this._token();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padLength = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLength);

      const payload = JSON.parse(atob(padded));
      return payload?.sub ?? payload?.uuid ?? payload?.user_uuid ?? null;
    } catch (e) {
      console.warn('Failed to extract usuario_uuid from JWT:', e);
      return null;
    }
  }
}
