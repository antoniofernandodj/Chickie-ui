import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken, HttpContext } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AuthService } from '../services/auth.service';

export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);
export const silentContext = () => new HttpContext().set(SILENT_ERROR, true);

function extractErrorMessage(error: HttpErrorResponse): string | null {
  const body = error.error;

  if (!body) return null;

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed?.error ?? parsed?.message ?? null;
    } catch {
      return body.trim() || null;
    }
  }

  if (typeof body === 'object') {
    return body?.error ?? body?.message ?? null;
  }

  return null;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!isPlatformBrowser(platformId)) return throwError(() => err);

      const errorMsg = extractErrorMessage(err);
      console.error(`[OBSERVABILITY] errorInterceptor - HTTP Error: ${err.status} ${err.statusText}. URL: ${req.url}. Message: ${errorMsg}`);

      if (err.status === 401) {
        console.warn('[OBSERVABILITY] errorInterceptor - 401 Unauthorized. Logging out.');
        auth.logout();
        router.navigate(['/auth/login']);
        return throwError(() => err);
      }

      if (err.status === 429) {
        toast.warning('Muitas requisições. Aguarde um momento e tente novamente.');
        return throwError(() => err);
      }

      if (err.status >= 500) {
        const msg = extractErrorMessage(err);
        toast.error(msg ?? 'Erro no servidor. Tente novamente mais tarde.');
        return throwError(() => err);
      }

      if (err.status >= 400 && !req.context.get(SILENT_ERROR)) {
        const msg = extractErrorMessage(err);
        if (msg) toast.error(msg);
      }

      return throwError(() => err);
    }),
  );
};
