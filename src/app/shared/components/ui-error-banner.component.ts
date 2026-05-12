import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-error-banner',
  standalone: true,
  template: `
    <div
      class="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700"
    >
      <svg
        class="w-4 h-4 shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clip-rule="evenodd"
        />
      </svg>
      {{ message() }}
    </div>
  `,
})
export class UiErrorBannerComponent {
  message = input.required<string>();
}
