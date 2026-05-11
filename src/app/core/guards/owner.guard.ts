import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

/**
 * GUARD DO DONO DA PLATAFORMA (ownerGuard)
 * 
 * Este guard garante que apenas o dono da plataforma (Owner) acesse rotas administrativas globais.
 * 
 * POR QUE A MUDANÇA?
 * Sem esta lógica, ao dar F5 na tela /owner, o sistema redirecionava para a Home ('/') 
 * porque o Angular ainda estava validando se você era mesmo o Owner ou apenas um cliente.
 */
export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  /**
   * Função interna que faz a checagem final.
   * Retorna 'true' se for Owner, ou redireciona para a Home ('/') se não for.
   */
  const check = () => {
    const isAllowed = auth.isAuthenticated() && auth.isOwner();
    console.info(`[OBSERVABILITY] ownerGuard - Permission check. Allowed: ${isAllowed}`);
    if (isAllowed) {
      return true;
    }
    return router.createUrlTree(['/']);
  };

  // 1. Se o sistema já terminou de carregar o perfil do usuário...
  const status = auth.tokenStatus();
  console.debug(`[OBSERVABILITY] ownerGuard - Status: ${status}`);
  if (status !== 'loading') {
    // ...executamos a checagem de permissão imediatamente.
    return check();
  }

  // 2. Se ainda estiver carregando (ex: logo após um F5)...
  return toObservable(auth.tokenStatus).pipe(
    filter((s) => s !== 'loading'),
    take(1),
    map(() => check()),
  );
};
