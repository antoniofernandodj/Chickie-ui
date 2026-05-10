import { Component, computed, input } from '@angular/core';
import { UiSpinnerComponent } from './ui-spinner.component';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'flat';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  xs: 'py-2 px-4 text-xs',
  sm: 'py-2.5 px-4 text-sm',
  md: 'py-3 px-5 text-sm',
  lg: 'py-3.5 px-6 text-sm',
};

const VARIANTS: Record<Variant, string> = {
  primary:   'rounded-xl text-white',
  secondary: 'rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  ghost:     'rounded-xl text-gray-600 hover:bg-gray-100',
  danger:    'rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50',
  flat:      'rounded-none w-full text-left text-gray-700 hover:bg-orange-50/50 active:!bg-orange-50',
};

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [UiSpinnerComponent],
  host: { '[class.block]': 'fullWidth()', '[class.w-full]': 'fullWidth()' },
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="cls()"
      [style]="variant() === 'primary' ? 'background:var(--color-brand)' : ''"
    >
      @if (loading()) {
        <span class="flex items-center justify-center gap-2">
          <ui-spinner size="sm"/>
          <ng-content/>
        </span>
      } @else {
        <ng-content/>
      }
    </button>
  `,
})
export class UiButtonComponent {
  variant   = input<Variant>('primary');
  size      = input<Size>('md');
  type      = input('button');
  loading   = input(false);
  disabled  = input(false);
  fullWidth = input(false);


  cls = computed(() => {
    const base = 'font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed';
    const w = this.variant() !== 'flat' && this.fullWidth() ? 'w-full' : '';
    return [base, w, SIZES[this.size()], VARIANTS[this.variant()]].filter(Boolean).join(' ');
  });
}
