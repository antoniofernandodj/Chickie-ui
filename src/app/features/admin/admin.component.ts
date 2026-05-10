import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { LojaService } from '../../core/services/loja.service';
import { Loja } from '../../core/models';
import { UiTabBarComponent, UiSpinnerComponent } from '../../shared/components';
import type { UiTab } from '../../shared/components';
import { AdminPedidosTabComponent } from './components/admin-pedidos-tab.component';
import { AdminEquipeTabComponent } from './components/admin-equipe-tab.component';
import { AdminCatalogoTabComponent } from './components/admin-catalogo-tab.component';
import { AdminAdicionaisTabComponent } from './components/admin-adicionais-tab.component';
import { AdminCuponsTabComponent } from './components/admin-cupons-tab.component';
import { AdminPromocoesTabComponent } from './components/admin-promocoes-tab.component';
import { AdminAvaliacoesTabComponent } from './components/admin-avaliacoes-tab.component';
import { AdminConfigPedidoTabComponent } from './components/admin-config-pedido-tab.component';
import { AdminEnderecosTabComponent } from './components/admin-enderecos-tab.component';
import { AdminHorariosTabComponent } from './components/admin-horarios-tab.component';
import { AdminNavBtnComponent } from './components/admin-nav-btn.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    UiTabBarComponent,
    UiSpinnerComponent,
    AdminPedidosTabComponent,
    AdminEquipeTabComponent,
    AdminCatalogoTabComponent,
    AdminAdicionaisTabComponent,
    AdminCuponsTabComponent,
    AdminPromocoesTabComponent,
    AdminAvaliacoesTabComponent,
    AdminConfigPedidoTabComponent,
    AdminEnderecosTabComponent,
    AdminHorariosTabComponent,
    AdminNavBtnComponent,
  ],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lojaService = inject(LojaService);

  readonly aba = signal('equipe');
  readonly tabs: UiTab[] = [
    { id: 'pedidos',       label: '🛒 Pedidos'        },
    { id: 'equipe',        label: '👥 Equipe'         },
    { id: 'catalogo',      label: '📦 Catálogo'       },
    { id: 'adicionais',    label: '🧀 Adicionais'      },
    { id: 'cupons',        label: '🎟️ Cupons'         },
    { id: 'promocoes',     label: '📢 Promoções'      },
    { id: 'avaliacoes',    label: '⭐ Avaliações'     },
    { id: 'config-pedido', label: '⚙️ Config Pedido'  },
    { id: 'enderecos',     label: '📍 Endereços'      },
    { id: 'horarios',      label: '🕐 Horários'       },
  ];

  readonly lojaUuid$ = this.route.paramMap.pipe(
    map((params) => params.get('loja_uuid')),
    filter((uuid): uuid is string => uuid !== null),
  );

  readonly lojaSelecionada = toSignal<Loja | null>(
    this.lojaUuid$.pipe(
      switchMap((uuid) =>
        this.lojaService.buscarPorUuid(uuid).pipe(
          catchError(() => of(null)),
        ),
      ),
    ),
  );

  readonly lojaLoading = computed(() => this.lojaSelecionada() === undefined);

  voltar() {
    this.router.navigate(['/admin']);
  }
}
