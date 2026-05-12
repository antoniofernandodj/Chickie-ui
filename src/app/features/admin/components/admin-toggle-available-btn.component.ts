import { Component, input, output } from '@angular/core';

@Component({
  selector: 'admin-toggle-available-btn',
  standalone: true,
  template: `
    <button
      type="button"
      class="p-1.5 rounded-lg transition-colors"
      [class.hover:bg-orange-50]="available()"
      [class.text-gray-400]="true"
      [class.hover:text-orange-600]="available()"
      [class.hover:bg-green-50]="!available()"
      [class.hover:text-green-600]="!available()"
      [title]="available() ? 'Marcar indisponível' : 'Marcar disponível'"
      (click)="toggle.emit()"
    >
      @if (available()) {
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      } @else {
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      }
    </button>
  `,
})
export class AdminToggleAvailableBtnComponent {
  available = input.required<boolean>();
  toggle = output<void>();
}
