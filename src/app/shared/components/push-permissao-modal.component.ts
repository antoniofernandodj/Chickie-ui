import { Component, output } from '@angular/core';
import { UiButtonComponent } from './ui-button.component';

@Component({
  selector: 'app-push-permissao-modal',
  standalone: true,
  imports: [UiButtonComponent],
  template: `
    <!-- Overlay -->
    <div class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      <div
        class="relative w-full sm:max-w-sm bg-white sm:rounded-2xl rounded-t-2xl shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Mobile drag handle -->
        <div class="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-200 rounded-full sm:hidden"></div>

        <!-- Conteúdo -->
        <div class="px-6 pt-8 pb-6 text-center">
          <!-- Ícone -->
          <div class="mx-auto mb-4 w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
            <svg class="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>

          <h2 class="text-lg font-bold text-gray-900 mb-2">
            Acompanhe seu pedido em tempo real
          </h2>

          <p class="text-sm text-gray-500 mb-4 leading-relaxed">
            Podemos te avisar quando seu pedido for <strong class="text-gray-700">confirmado</strong>,
            sair para <strong class="text-gray-700">entrega</strong> e muito mais — mesmo com o app fechado.
          </p>

          <!-- Aviso de janela nativa -->
          <div class="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left mb-6">
            <svg class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-xs text-amber-800 leading-relaxed">
              Ao clicar em <strong>Ativar notificações</strong>, o navegador vai exibir uma janela de confirmação.
              Clique em <strong>"Permitir"</strong> para concluir a ativação.
            </p>
          </div>

          <!-- Ações -->
          <div class="flex flex-col gap-2">
            <ui-button
              variant="primary"
              [fullWidth]="true"
              (click)="confirmar.emit()"
            >
              🔔 Ativar notificações
            </ui-button>
            <ui-button
              variant="ghost"
              [fullWidth]="true"
              (click)="recusar.emit()"
            >
              Agora não
            </ui-button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PushPermissaoModalComponent {
  confirmar = output<void>();
  recusar   = output<void>();
}
