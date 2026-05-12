import { Component, input, output } from '@angular/core';

@Component({
  selector: 'admin-schedule-active-btn',
  standalone: true,
  template: `
    <button
      type="button"
      class="text-xs font-medium px-3 py-1.5 rounded-lg"
      [class.bg-green-100]="ativo()"
      [class.text-green-700]="ativo()"
      [class.bg-gray-100]="!ativo()"
      [class.text-gray-700]="!ativo()"
      (click)="toggle.emit()"
    >
      @if (ativo()) {
        Ativo
      } @else {
        Inativo
      }
    </button>
  `,
})
export class AdminScheduleActiveBtnComponent {
  ativo = input.required<boolean>();
  toggle = output<void>();
}
