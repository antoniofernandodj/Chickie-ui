import { Component, input } from '@angular/core';

/**
 * variant 'badge' — pill com fundo colorido (padrão, para listas)
 * variant 'chip'  — texto com ponto pulsante (para barra de info da loja)
 */
@Component({
  selector: 'ui-loja-aberta',
  standalone: true,
  template: `
    @if (variant() === 'chip') {
      @if (aberta()) {
        <span class="flex items-center gap-1 text-green-600 font-medium shrink-0">
          <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>Aberto agora
        </span>
      } @else {
        <span class="flex items-center gap-1 text-red-500 font-medium shrink-0">
          <span class="w-2 h-2 bg-red-500 rounded-full"></span>Fechado
        </span>
      }
    } @else {
      @if (aberta()) {
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Aberto
        </span>
      } @else {
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
          Fechado
        </span>
      }
    }
  `,
})
export class UiLojaAbertaComponent {
  aberta  = input.required<boolean>();
  variant = input<'badge' | 'chip'>('badge');
}
