import { Component, computed, input } from '@angular/core';

const SIZES = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-16 h-16 text-2xl' } as const;

@Component({
  selector: 'ui-avatar',
  standalone: true,
  template: `
    <div
      [class]="cls()"
      style="background: var(--color-brand)"
    >
      {{ initial() }}
    </div>
  `,
})
export class UiAvatarComponent {
  initial = input('?');
  size    = input<keyof typeof SIZES>('md');
  rounded = input<'xl' | '2xl' | 'full'>('2xl');

  cls = computed(() => {
    const base = 'flex items-center justify-center text-white font-bold shrink-0';
    const s = SIZES[this.size()];
    return `${base} ${s} rounded-${this.rounded()}`;
  });
}
