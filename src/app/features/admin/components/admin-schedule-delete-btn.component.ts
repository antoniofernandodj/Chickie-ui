import { Component, output } from '@angular/core';

@Component({
  selector: 'admin-schedule-delete-btn',
  standalone: true,
  template: `
    <button
      type="button"
      class="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1.5 rounded hover:bg-red-50"
      (click)="delete.emit()"
    >
      Deletar
    </button>
  `,
})
export class AdminScheduleDeleteBtnComponent {
  delete = output<void>();
}
