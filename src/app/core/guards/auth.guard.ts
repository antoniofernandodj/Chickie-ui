import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

/**
 * GUARD DE AUTENTICAÇÃO (authGuard)
 * 
 * Este guard decide se um usuário pode ou não acessar uma rota que exige login.
 * 
 * O PROBLEMA DO REFRESH:
 * Quando você dá F5, o Angular reinicia do zero. O AuthService lê o token do localStorage
 * e pergunta ao servidor: "Este token ainda vale?". Isso demora alguns milissegundos.
 * Se o Guard rodar nesse meio tempo, ele vai achar que você não está logado.
 * 
 * A SOLUÇÃO:
 * Este guard agora sabe "esperar". Se o status for 'loading' (carregando), ele aguarda
 * a resposta do servidor antes de decidir.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // 1. Pegamos o status atual (Pode ser: 'loading', 'valid' ou 'unauthenticated')
  const status = auth.tokenStatus();
  console.info(`[OBSERVABILITY] authGuard - Nav attempt. Status: ${status}`);

  // 2. Se já sabemos que é válido, liberamos na hora (true)
  if (status === 'valid') {
    console.debug('[OBSERVABILITY] authGuard - Access granted (already valid)');
    return true;
  }

  // 3. Se já sabemos que não está logado, mandamos para o login na hora
  if (status === 'unauthenticated') {
    console.warn('[OBSERVABILITY] authGuard - Access denied (unauthenticated). Redirecting to login.');
    return router.createUrlTree(['/auth/login']);
  }

  // 4. Se estiver em 'loading' (carregando após um F5), usamos RxJS para "observar" a mudança:
  console.debug('[OBSERVABILITY] authGuard - Status is loading. Waiting for token validation...');
  return toObservable(auth.tokenStatus).pipe(
    filter((s) => s !== 'loading'),
    take(1),
    map((s) => {
      const allowed = s === 'valid';
      console.info(`[OBSERVABILITY] authGuard - Validation finished. Status: ${s}. Allowed: ${allowed}`);
      return allowed ? true : router.createUrlTree(['/auth/login']);
    }),
  );
};
