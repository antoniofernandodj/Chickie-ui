import { Component, computed, input } from '@angular/core';
import { StatusPedido } from '../../core/models';

const CFG: Record<StatusPedido, { label: string; color: string; bg: string; icon: string }> = {
  criado:                         { label: 'Criado',            color: 'text-gray-600',   bg: 'bg-gray-100',   icon: '🕐' },
  aguardando_confirmacao_de_loja: { label: 'Aguardando loja',   color: 'text-yellow-700', bg: 'bg-yellow-100', icon: '⏳' },
  confirmado_pela_loja:           { label: 'Confirmado',        color: 'text-blue-700',   bg: 'bg-blue-100',   icon: '✅' },
  em_preparo:                     { label: 'Em preparo',        color: 'text-purple-700', bg: 'bg-purple-100', icon: '👨‍🍳' },
  pronto:                         { label: 'Pronto',            color: 'text-teal-700',   bg: 'bg-teal-100',   icon: '📦' },
  saiu_para_entrega:              { label: 'Saiu para entrega', color: 'text-orange-700', bg: 'bg-orange-100', icon: '🛵' },
  entregue:                       { label: 'Entregue',          color: 'text-green-700',  bg: 'bg-green-100',  icon: '🎉' },
  cancelado:                      { label: 'Cancelado',         color: 'text-red-700',    bg: 'bg-red-100',    icon: '❌' },
};

export { CFG as STATUS_PEDIDO_CFG };

@Component({
  selector: 'ui-status-badge',
  standalone: true,
  template: `
    <span
      [class]="
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ' +
        cfg().bg +
        ' ' +
        cfg().color
      "
    >
      {{ cfg().icon }} {{ cfg().label }}
    </span>
  `,
})
export class UiStatusBadgeComponent {
  status = input.required<StatusPedido | string>();
  cfg    = computed(() => CFG[this.status() as StatusPedido] ?? CFG['criado']);
}
