import { Component, computed, input } from '@angular/core';

const PADDINGS = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' } as const;

@Component({
  selector: 'ui-card',
  standalone: true,
  template: `
    <div [class]="cls()"><ng-content /></div>
  `,
})
export class UiCardComponent {
  padding = input<keyof typeof PADDINGS>('md');
  cls = computed(() => `bg-white rounded-2xl shadow-sm border border-gray-100 ${PADDINGS[this.padding()]}`);
}
