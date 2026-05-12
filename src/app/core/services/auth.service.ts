import { Injectable, inject, PLATFORM_ID, signal, computed, afterNextRender } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { toast } from 'ngx-sonner';
import { ToastQueueService } from './toast-queue.service';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
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

  private readonly _token = signal<string | null>(this.loadItem('chickie_token'));
  readonly token = this._token.asReadonly();

  private readonly _tokenStatus = signal<'loading' | 'valid' | 'unauthenticated'>(
    this.loadItem('chickie_token') ? 'loading' : 'unauthenticated',
  );
  readonly tokenStatus = this._tokenStatus.asReadonly();
  readonly isAuthenticated = computed(() => this._tokenStatus() === 'valid');
  readonly tokenChecking = computed(() => this._tokenStatus() === 'loading');

  private readonly _userClassTrigger = signal<Date>(new Date());
  readonly userClass = computed<ClasseUsuario | null>(() => {
    this._userClassTrigger();
    if (!isPlatformBrowser(this.platformId)) return null;
    return (localStorage.getItem('chickie_classe') as ClasseUsuario | null) ?? null;
  });

  readonly isAdmin = computed(() => this.userClass() === 'administrador' || this.userClass() === 'owner');
  readonly isFuncionario = computed(() => this.userClass() === 'funcionario');
  readonly isOwner = computed(() => this.userClass() === 'owner');

  // Coordenação de refresh concorrente
  private _isRefreshing = false;
  private readonly _refreshSubject = new BehaviorSubject<string | null>(null);

  constructor() {
    afterNextRender(() => {
      const token = this.loadItem('chickie_token');
      if (!token) {
        console.info('[OBSERVABILITY] AuthService - No token found in localStorage.');
        this._tokenStatus.set('unauthenticated');
        return;
      }

      console.debug('[OBSERVABILITY] AuthService - Validating token with /me...');
      this.http.get<Usuario>(`${this.base}/me`).subscribe({
        next: (user) => {
          console.info(`[OBSERVABILITY] AuthService - Token valid. User: ${user.nome}, Class: ${user.classe}`);
          if (user.classe) {
            this.saveItem('chickie_classe', user.classe);
            this._userClassTrigger.set(new Date());
          }
          if (user.nome) this.saveItem('chickie_nome', user.nome);
          this._tokenStatus.set('valid');
        },
        error: (err) => {
          console.error('[OBSERVABILITY] AuthService - Error validating token on startup:', err);

          // O interceptor pode ter chamado logout() silenciosamente (refresh falhou).
          // Nesse caso, _token já é null — não precisamos fazer nada.
          if (!this._token()) return;

          if (err.status === 401) {
            console.warn('[OBSERVABILITY] AuthService - 401 durante startup. Limpando sessão.');
            this.clearSession();
            toast.error('Sessão expirada. Faça login novamente.');
          } else {
            console.warn(`[OBSERVABILITY] AuthService - Erro de rede/servidor (${err.status}) durante startup. Mantendo token.`);
            this._tokenStatus.set('unauthenticated');
          }
        },
      });
    });
  }

  private loadItem(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(key);
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

  private clearSession(): void {
    this.removeItem('chickie_token');
    this.removeItem('chickie_refresh_token');
    this.removeItem('chickie_nome');
    this.removeItem('chickie_classe');
    this._token.set(null);
    this._tokenStatus.set('unauthenticated');
    this._userClassTrigger.set(new Date());
  }

  private saveTokens(accessToken: string, refreshToken: string): void {
    this.saveItem('chickie_token', accessToken);
    this.saveItem('chickie_refresh_token', refreshToken);
    this._token.set(accessToken);
  }

  signup(body: SignupRequest): Observable<SignupResponse> {
    console.info(`[OBSERVABILITY] AuthService - Signup attempt for email: ${body.email}`);
    return this.http.post<SignupResponse>(`${this.base}/signup`, body).pipe(
      tap({
        next: () => console.info(`[OBSERVABILITY] AuthService - Signup successful for email: ${body.email}`),
        error: (err) => console.error(`[OBSERVABILITY] AuthService - Signup failed for email: ${body.email}`, err),
      }),
    );
  }

  confirmarEmail(token: string): Observable<ConfirmarEmailResponse> {
    console.info('[OBSERVABILITY] AuthService - Email confirmation attempt.');
    return this.http.get<ConfirmarEmailResponse>(`${this.base}/confirmar-email`, { params: { token } }).pipe(
      tap((res) => {
        console.info(`[OBSERVABILITY] AuthService - Email confirmed. User: ${res.usuario.nome}`);
        this.saveTokens(res.access_token, res.refresh_token);
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
    console.info(`[OBSERVABILITY] AuthService - Login attempt for identifier: ${body.identifier}`);
    return this.http.post<LoginResponse>(`${this.base}/login`, body).pipe(
      tap({
        next: (res) => {
          console.info(`[OBSERVABILITY] AuthService - Login successful for identifier: ${body.identifier}`);
          this.saveTokens(res.access_token, res.refresh_token);
          this._tokenStatus.set('valid');
          const classe = this.extractClasseFromToken(res.access_token);
          if (classe) {
            console.debug(`[OBSERVABILITY] AuthService - Extracted class from token: ${classe}`);
            this.saveItem('chickie_classe', classe);
            this._userClassTrigger.set(new Date());
          }
        },
        error: (err) => console.error(`[OBSERVABILITY] AuthService - Login failed for identifier: ${body.identifier}`, err),
      }),
    );
  }

  /**
   * Renova o access_token usando o refresh_token armazenado.
   * Requisições concorrentes aguardam o primeiro refresh completar.
   */
  refreshToken(): Observable<RefreshTokenResponse> {
    const storedRefresh = this.loadItem('chickie_refresh_token');

    if (!storedRefresh) {
      return throwError(() => new Error('Sem refresh token armazenado'));
    }

    if (this._isRefreshing) {
      // Aguarda o refresh em andamento e retorna um resultado "sintético"
      return this._refreshSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((newAccessToken) => {
          const newRefresh = this.loadItem('chickie_refresh_token') ?? '';
          return [{ access_token: newAccessToken!, refresh_token: newRefresh, token_type: 'Bearer' as const }];
        }),
      );
    }

    this._isRefreshing = true;
    this._refreshSubject.next(null);

    return this.http
      .post<RefreshTokenResponse>(`${this.base}/refresh`, { refresh_token: storedRefresh })
      .pipe(
        tap((tokens) => {
          console.info('[OBSERVABILITY] AuthService - Token renovado com sucesso.');
          this.saveTokens(tokens.access_token, tokens.refresh_token);
          this._isRefreshing = false;
          this._refreshSubject.next(tokens.access_token);
        }),
        catchError((err) => {
          console.error('[OBSERVABILITY] AuthService - Falha ao renovar token:', err);
          this._isRefreshing = false;
          this._refreshSubject.next(null);
          return throwError(() => err);
        }),
      );
  }

  fetchAndSaveUserProfile(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.base}/me`).pipe(
      tap((user) => {
        if (user.classe) {
          this.saveItem('chickie_classe', user.classe);
          this._userClassTrigger.set(new Date());
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
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padLength = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLength);
      const payload = JSON.parse(atob(padded));
      return payload?.classe ?? payload?.userClass ?? payload?.role ?? payload?.user_class ?? null;
    } catch (e) {
      console.warn('Failed to extract classe from JWT:', e);
      return null;
    }
  }

  saveUserMeta(nome: string): void {
    this.saveItem('chickie_nome', nome);
  }

  esquecerSenha(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/esqueci-senha`, { email });
  }

  redefinirSenha(token: string, nova_senha: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/redefinir-senha`, { token, nova_senha });
  }

  verificarEmail(email: string): Observable<{ disponivel: boolean }> {
    return this.http.post<{ disponivel: boolean }>(`${this.base}/verificar-email`, { email });
  }

  verificarUsername(username: string): Observable<{ disponivel: boolean }> {
    return this.http.post<{ disponivel: boolean }>(`${this.base}/verificar-username`, { username });
  }

  verificarCelular(celular: string): Observable<{ disponivel: boolean }> {
    return this.http.post<{ disponivel: boolean }>(`${this.base}/verificar-celular`, { celular });
  }

  logout(silent = false): void {
    console.info('[OBSERVABILITY] AuthService - Logging out user.');
    this.clearSession();
    if (!silent) {
      this.toastQueue.enqueue('Sessão encerrada com sucesso.');
    }
  }

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
