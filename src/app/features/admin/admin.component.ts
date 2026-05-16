import { Component, HostListener, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, switchMap, catchError } from 'rxjs/operators';
import { of, BehaviorSubject } from 'rxjs';
import { LojaService } from '../../core/services/loja.service';
import { Loja } from '../../core/models';
import { UiSpinnerComponent, UiButtonComponent } from '../../shared/components';
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
import { AdminMesasTabComponent } from './components/admin-mesas-tab.component';
import { AdminNavBtnComponent } from './components/admin-nav-btn.component';
import { AdminLojaTabComponent } from './components/admin-loja-tab.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    UiSpinnerComponent,
    UiButtonComponent,
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
    AdminMesasTabComponent,
    AdminNavBtnComponent,
    AdminLojaTabComponent,
  ],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lojaService = inject(LojaService);

  readonly aba = signal('equipe');

  private readonly _isMobile = signal(window.innerWidth < 1024);
  readonly sidebarOpen = signal(window.innerWidth >= 1024);

  @HostListener('window:resize')
  onResize() {
    const mobile = window.innerWidth < 1024;
    this._isMobile.set(mobile);
    if (!mobile && !this.sidebarOpen()) {
      // keep collapsed state on desktop if user explicitly collapsed
    }
  }

  readonly isMobile = this._isMobile.asReadonly();

  readonly navItems = [
    { id: 'pedidos',       icon: '🛒', label: 'Pedidos'       },
    { id: 'equipe',        icon: '👥', label: 'Equipe'        },
    { id: 'catalogo',      icon: '📦', label: 'Catálogo'      },
    { id: 'adicionais',    icon: '🧀', label: 'Adicionais'    },
    { id: 'cupons',        icon: '🎟️', label: 'Cupons'        },
    { id: 'promocoes',     icon: '📢', label: 'Promoções'     },
    { id: 'avaliacoes',    icon: '⭐', label: 'Avaliações'    },
    { id: 'config-pedido', icon: '⚙️', label: 'Config Pedido' },
    { id: 'enderecos',     icon: '📍', label: 'Endereços'     },
    { id: 'horarios',      icon: '🕐', label: 'Horários'      },
    { id: 'mesas',         icon: '🪑', label: 'Mesas'         },
    { id: 'perfil',        icon: '🏪', label: 'Perfil Loja'   },
  ];

  readonly abaLabel = computed(() =>
    this.navItems.find(n => n.id === this.aba())?.label ?? ''
  );

  private readonly refreshTrigger = new BehaviorSubject<void>(undefined);

  readonly lojaUuid$ = this.route.paramMap.pipe(
    map((params) => params.get('loja_uuid')),
    filter((uuid): uuid is string => uuid !== null),
  );

  readonly lojaSelecionada = toSignal<Loja | null>(
    this.refreshTrigger.pipe(
      switchMap(() => this.lojaUuid$.pipe(
        switchMap((uuid) =>
          this.lojaService.buscarPorUuid(uuid).pipe(
            catchError(() => of(null)),
          ),
        ),
      )),
    ),
  );

  readonly lojaLoading = computed(() => this.lojaSelecionada() === undefined);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  selectAba(id: string) {
    this.aba.set(id);
    if (this._isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

  refreshLoja() {
    this.refreshTrigger.next();
  }

  voltar() {
    this.router.navigate(['/admin']);
  }
}
