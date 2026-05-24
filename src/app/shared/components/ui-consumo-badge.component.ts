import { Component, input } from '@angular/core';
import { UiBadgeComponent } from './ui-badge.component';

/**
 * Badge que indica o tipo de consumo de um pedido (mesa ou PDV).
 * - `true`  → Para viagem 🥡
 * - `false` → Comer no local 🪑
 * - `null`  → Não informado (não renderiza nada)
 */
@Component({
  selector: 'ui-consumo-badge',
  standalone: true,
  imports: [UiBadgeComponent],
  template: `
    @if (paraViagem() === true) {
      <ui-badge color="yellow">🥡 Viagem</ui-badge>
    } @else if (paraViagem() === false) {
      <ui-badge color="green">🪑 Local</ui-badge>
    }
  `,
})
export class UiConsumoBadgeComponent {
  paraViagem = input<boolean | null>(null);
}
