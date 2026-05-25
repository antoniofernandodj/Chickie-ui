import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = environment.apiUrl;

  private vapidKey: string | null = null;

  // ── Soft-ask ────────────────────────────────────────────────────────────────
  /** true enquanto o modal de pré-permissão estiver visível */
  readonly softAskVisivel = signal(false);

  private softAskResolve: ((granted: boolean) => void) | null = null;

  /**
   * Exibe o modal customizado de permissão e aguarda a resposta do usuário.
   * Retorna `true` se ele clicou em "Ativar", `false` se recusou ou dispensou.
   * Se a permissão já estiver concedida/negada, resolve imediatamente sem exibir o modal.
   */
  async pedirPermissaoViaSoftAsk(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    const perm = Notification.permission;
    if (perm === 'granted') return true;
    if (perm === 'denied')  return false;

    // permissão ainda "default" → mostrar modal
    return new Promise<boolean>(resolve => {
      this.softAskResolve = resolve;
      this.softAskVisivel.set(true);
    });
  }

  /** Chamado pelo modal quando o usuário clica em "Ativar notificações" */
  confirmarSoftAsk(): void {
    this.softAskVisivel.set(false);
    this.softAskResolve?.(true);
    this.softAskResolve = null;
  }

  /** Chamado pelo modal quando o usuário clica em "Agora não" ou fecha o modal */
  recusarSoftAsk(): void {
    this.softAskVisivel.set(false);
    this.softAskResolve?.(false);
    this.softAskResolve = null;
  }
  // ────────────────────────────────────────────────────────────────────────────

  async carregarVapidKey(): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      console.debug('[PUSH] carregarVapidKey: não é browser, ignorando');
      return '';
    }
    if (this.vapidKey) return this.vapidKey;

    console.info('[PUSH] buscando VAPID public key do backend...');
    try {
      const resp = await firstValueFrom(
        this.http.get<{ public_key: string }>(`${this.api}/push/vapid-public-key`),
      );
      const public_key = resp?.public_key;

      if (!public_key) {
        console.error('[PUSH] VAPID_PUBLIC_KEY está vazia no backend — configure a variável de ambiente');
        return '';
      }
      this.vapidKey = public_key;
      console.info('[PUSH] VAPID public key carregada com sucesso:', public_key.substring(0, 10) + '...');
      return public_key;
    } catch (err) {
      console.error('[PUSH] falha ao buscar VAPID public key do backend:', err);
      return '';
    }
  }

  async subscribe(): Promise<void> {
    console.info('[PUSH] subscribe iniciado (usuário logado)');
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.swPush.isEnabled) {
      console.warn('[PUSH] swPush.isEnabled=false — service worker desabilitado (apenas funciona em build de produção ou com PWA habilitado).');
      return;
    }

    try {
      const publicKey = await this.carregarVapidKey();
      if (!publicKey) {
        console.error('[PUSH] subscribe: publicKey vazia, abortando');
        return;
      }

      // Soft-ask: mostrar modal customizado antes de acionar a permissão nativa
      const confirmado = await this.pedirPermissaoViaSoftAsk();
      if (!confirmado) {
        console.info('[PUSH] subscribe: usuário recusou o soft-ask, abortando');
        return;
      }

      console.info('[PUSH] solicitando subscription ao browser (usuário)...');
      const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });

      console.info('[PUSH] subscription obtida com sucesso:', {
        endpoint: sub.endpoint,
        keys: Object.keys((sub.toJSON() as any).keys || {})
      });

      await firstValueFrom(this.http.post(`${this.api}/usuarios/me/push-subscription`, sub.toJSON()));
      console.info('[PUSH] subscription de usuário salva no backend com sucesso');
    } catch (err) {
      console.error('[PUSH] falha crítica no fluxo de subscribe de usuário:', err);
    }
  }

  async subscribePorPedido(pedidoUuid: string): Promise<void> {
    console.info('[PUSH] subscribePorPedido iniciado', { pedidoUuid });
    if (!isPlatformBrowser(this.platformId)) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PUSH] browser não suporta push notifications', { pedidoUuid });
      return;
    }

    try {
      const publicKey = await this.carregarVapidKey();
      if (!publicKey) {
        console.error('[PUSH] subscribePorPedido: publicKey não encontrada, abortando', { pedidoUuid });
        return;
      }

      const currentPermission = Notification.permission;
      console.info('[PUSH] permissão atual:', currentPermission, { pedidoUuid });

      if (currentPermission === 'denied') {
        console.warn('[PUSH] permissão bloqueada pelo usuário — não é possível registrar push', { pedidoUuid });
        return;
      }

      if (currentPermission === 'default') {
        // Soft-ask: mostrar modal customizado antes de acionar a permissão nativa
        const confirmado = await this.pedirPermissaoViaSoftAsk();
        if (!confirmado) {
          console.info('[PUSH] subscribePorPedido: usuário recusou o soft-ask', { pedidoUuid });
          return;
        }

        const result = await Notification.requestPermission();
        console.info('[PUSH] resultado do pedido de permissão nativa:', result, { pedidoUuid });
        if (result !== 'granted') {
          console.warn('[PUSH] permissão não concedida na janela nativa:', result, { pedidoUuid });
          return;
        }
      }

      console.info('[PUSH] aguardando service worker ficar ativo...', { pedidoUuid });
      const registration = await navigator.serviceWorker.ready;
      console.info('[PUSH] service worker ativo, solicitando subscription...', { pedidoUuid });

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      console.info('[PUSH] subscription guest obtida:', { endpoint: sub.endpoint, pedidoUuid });

      await firstValueFrom(
        this.http.post(`${this.api}/pedidos/${pedidoUuid}/push-subscription`, sub.toJSON()),
      );
      console.info('[PUSH] subscription guest vinculada ao pedido no backend', { pedidoUuid });
    } catch (err) {
      console.error('[PUSH] falha ao registrar push subscription para pedido guest:', err, { pedidoUuid });
    }
  }

  async unsubscribe(): Promise<void> {
    console.info('[PUSH] unsubscribe solicitado');
    if (!isPlatformBrowser(this.platformId) || !this.swPush.isEnabled) return;

    try {
      const sub = await firstValueFrom(this.swPush.subscription.pipe(take(1)));
      if (!sub) {
        console.debug('[PUSH] unsubscribe: nenhuma subscription ativa encontrada');
        return;
      }

      console.info('[PUSH] removendo subscription do backend...', { endpoint: sub.endpoint });
      await firstValueFrom(
        this.http.delete(`${this.api}/usuarios/me/push-subscription`, {
          body: { endpoint: sub.endpoint },
        }),
      );

      console.info('[PUSH] cancelando subscription no browser...');
      const success = await sub.unsubscribe();
      console.info('[PUSH] unsubscribe concluído', { success });
    } catch (err) {
      console.warn('[PUSH] erro durante o processo de unsubscribe:', err);
    }
  }

  get messages$() {
    return this.swPush.messages;
  }

  get notificationClicks$() {
    return this.swPush.notificationClicks;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from(rawData, c => c.charCodeAt(0));
  }
}
