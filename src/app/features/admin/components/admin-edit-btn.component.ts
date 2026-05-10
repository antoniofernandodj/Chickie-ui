import { Component, output } from '@angular/core';

@Component({
  selector: 'admin-edit-btn',
  standalone: true,
  template: `
    <button
      type="button"
      class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
      title="Editar"
      (click)="edit.emit()"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
    </button>
  `,
})
export class AdminEditBtnComponent {
  edit = output<void>();
}
