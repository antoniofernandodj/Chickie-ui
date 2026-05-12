import { Component, computed, input } from '@angular/core';

type Color = 'gray' | 'green' | 'red' | 'yellow' | 'orange' | 'blue' | 'purple' | 'teal';

const COLORS: Record<Color, string> = {
  gray:   'bg-gray-100 text-gray-600',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  teal:   'bg-teal-100 text-teal-700',
};

@Component({
  selector: 'ui-badge',
  standalone: true,
  template: `
    <span [class]="cls()"><ng-content /></span>
  `,
})
export class UiBadgeComponent {
  color = input<Color>('gray');
  cls   = computed(() => `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${COLORS[this.color()]}`);
}
