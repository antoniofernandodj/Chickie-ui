import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { CartDrawerComponent } from './shared/components/cart-drawer.component';
import { UiContextMenuComponent } from './shared/components/ui-context-menu.component';
import { NgxSonnerToaster } from 'ngx-sonner';
import { PushNotificationService } from './core/services/push-notification.service';
import { ToastQueueService } from './core/services/toast-queue.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CartDrawerComponent, NgxSonnerToaster, UiContextMenuComponent],
  templateUrl: './app.html',
  styleUrl:    './app.css',
})
export class App implements OnInit {
  private readonly router = inject(Router);
  private readonly push = inject(PushNotificationService);
  private readonly toastQueue = inject(ToastQueueService); // Inicializa o serviço de fila de toasts

  ngOnInit(): void {
    this.push.messages$.subscribe((msg: any) => {
      const url = msg?.notification?.data?.url;
      if (url) this.router.navigateByUrl(url);
    });

    this.push.notificationClicks$.subscribe(({ notification }: any) => {
      const url = notification?.data?.url;
      if (url) this.router.navigateByUrl(url);
    });
  }
}
