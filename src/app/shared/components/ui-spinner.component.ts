import { Component, computed, input } from '@angular/core';

const SIZES = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8', xl: 'w-10 h-10' } as const;

@Component({
  selector: 'ui-spinner',
  standalone: true,
  template: `
    <svg
      [class]="'animate-spin ' + cls()"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  `,
})
export class UiSpinnerComponent {
  size = input<keyof typeof SIZES>('sm');
  cls = computed(() => SIZES[this.size()]);
}
