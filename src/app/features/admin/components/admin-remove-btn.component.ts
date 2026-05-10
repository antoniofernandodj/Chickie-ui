import { Component, output } from '@angular/core';

@Component({
  selector: 'admin-remove-btn',
  standalone: true,
  template: `
    <button
      type="button"
      class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
      title="Deletar"
      (click)="remove.emit()"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
    </button>
  `,
})
export class AdminRemoveBtnComponent {
  remove = output<void>();
}
