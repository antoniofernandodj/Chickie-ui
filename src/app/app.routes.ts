import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ownerGuard } from './core/guards/owner.guard';
import { funcionarioGuard } from './core/guards/funcionario.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component')
      .then(m => m.HomeComponent),
    title: 'Chiquitos — Delivery',
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component')
      .then(m => m.LoginComponent),
    title: 'Entrar — Chiquitos',
  },
  {
    path: 'auth/signup',
    loadComponent: () => import('./features/auth/signup/signup.component')
      .then(m => m.SignupComponent),
    title: 'Criar conta — Chiquitos',
  },
  {
    path: 'auth/verificar-email',
    loadComponent: () => import('./features/auth/verificar-email/verificar-email.component')
      .then(m => m.VerificarEmailComponent),
    title: 'Verifique seu email — Chiquitos',
  },
  {
    path: 'auth/confirmar-email',
    loadComponent: () => import('./features/auth/confirmar-email/confirmar-email.component')
      .then(m => m.ConfirmarEmailComponent),
    title: 'Confirmar email — Chiquitos',
  },
  {
    path: 'auth/esqueci-senha',
    loadComponent: () => import('./features/auth/esqueci-senha/esqueci-senha.component')
      .then(m => m.EsqueciSenhaComponent),
    title: 'Esqueci minha senha — Chiquitos',
  },
  {
    path: 'auth/redefinir-senha',
    loadComponent: () => import('./features/auth/redefinir-senha/redefinir-senha.component')
      .then(m => m.RedefinirSenhaComponent),
    title: 'Redefinir senha — Chiquitos',
  },
  {
    path: 'loja/:slug/mesa/:numero',
    loadComponent: () => import('./features/loja/loja-detalhe.component')
      .then(m => m.LojaDetalheComponent),
    title: 'Pedido na Mesa — Chiquitos',
  },
  {
    path: 'loja/:slug',
    loadComponent: () => import('./features/loja/loja-detalhe.component')
      .then(m => m.LojaDetalheComponent),
    title: 'Loja — Chiquitos',
  },
  {
    path: 'categorias/:uuid',
    loadComponent: () => import('./features/categorias/categoria-detalhe.component')
      .then(m => m.CategoriaDetalheComponent),
    title: 'Categoria — Chiquitos',
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./features/pedidos/pedidos.component')
      .then(m => m.PedidosComponent),
    title: 'Meus Pedidos — Chiquitos',
  },
  {
    path: 'pedidos/:uuid',
    loadComponent: () => import('./features/pedidos/pedido-detalhe.component')
      .then(m => m.PedidoDetalheComponent),
    title: 'Pedido — Chiquitos',
  },
  {
    path: 'favoritos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/favoritos/favoritos.component')
      .then(m => m.FavoritosComponent),
    title: 'Favoritos — Chiquitos',
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./features/perfil/perfil.component')
      .then(m => m.PerfilComponent),
    title: 'Meu Perfil — Chiquitos',
  },
  {
    path: 'kds',
    canActivate: [funcionarioGuard],
    loadComponent: () => import('./features/kds/kds-panel.component')
      .then(m => m.KdsPanelComponent),
    title: 'KDS — Chiquitos',
  },
  {
    path: 'pdv',
    canActivate: [funcionarioGuard],
    loadComponent: () => import('./features/pdv/pdv.component')
      .then(m => m.PdvComponent),
    title: 'PDV — Chiquitos',
  },
  {
    path: 'owner',
    canActivate: [ownerGuard],
    loadComponent: () => import('./features/owner/owner-panel.component')
      .then(m => m.OwnerPanelComponent),
    title: 'Painel Owner — Chiquitos',
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin-lojas-list.component')
      .then(m => m.AdminLojasListComponent),
    title: 'Minhas Lojas — Chiquitos',
  },
  {
    path: 'admin/:loja_uuid',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/admin.component')
          .then(m => m.AdminComponent),
      },
      {
        path: 'pdv',
        loadComponent: () => import('./features/pdv/pdv.component')
          .then(m => m.PdvComponent),
        title: 'PDV Admin — Chiquitos',
      },
      {
        path: 'kds',
        loadComponent: () => import('./features/kds/kds-panel.component')
          .then(m => m.KdsPanelComponent),
        title: 'KDS Admin — Chiquitos',
      }
    ],
    title: 'Painel Admin — Chiquitos',
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout.component')
      .then(m => m.CheckoutComponent),
    title: 'Checkout — Chiquitos',
  },
  {
    path: 'design-system',
    loadComponent: () => import('./features/design-system/design-system.component')
      .then(m => m.DesignSystemComponent),
    title: 'Design System — Chiquitos',
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component')
      .then(m => m.NotFoundComponent),
    title: '404 — Chiquitos',
  },
];
