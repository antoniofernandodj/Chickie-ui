import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

/**
 * GUARD DO FUNCIONÁRIO (funcionarioGuard)
 * 
 * Este guard garante que apenas funcionários acessem o painel KDS.
 */
export const funcionarioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const check = () => {
    // Permite funcionário ou admin/owner (para supervisão)
    if (auth.isAuthenticated() && (auth.userClass() === 'funcionario' || auth.isAdmin())) {
      return true;
    }
    return router.createUrlTree(['/']);
  };

  const status = auth.tokenStatus();
  if (status !== 'loading') {
    return check();
  }

  return toObservable(auth.tokenStatus).pipe(
    filter((s) => s !== 'loading'),
    take(1),
    map(() => check()),
  );
};
