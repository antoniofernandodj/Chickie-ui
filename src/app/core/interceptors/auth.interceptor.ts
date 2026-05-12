import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  console.debug(`[OBSERVABILITY] authInterceptor - Outgoing request: ${req.method} ${req.url}`);

  const token = localStorage.getItem('chickie_token');
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Não tenta refresh se não for 401 ou se já for a própria chamada de refresh
      if (error.status !== 401 || req.url.includes('/auth/refresh')) {
        return throwError(() => error);
      }

      const authService = inject(AuthService);

      console.debug('[OBSERVABILITY] authInterceptor - 401 recebido, tentando refresh de token...');

      return authService.refreshToken().pipe(
        switchMap((tokens) => {
          console.debug('[OBSERVABILITY] authInterceptor - Token renovado. Repetindo requisição original.');
          const retryReq = req.clone({
            setHeaders: { Authorization: `Bearer ${tokens.access_token}` },
          });
          return next(retryReq);
        }),
        catchError((refreshError) => {
          console.error('[OBSERVABILITY] authInterceptor - Refresh falhou. Encerrando sessão.', refreshError);
          authService.logout(true);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
