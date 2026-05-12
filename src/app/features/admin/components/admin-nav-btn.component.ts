import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'admin-nav-btn',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="link()"
      class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
      [class]="colorCls()"
    >
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
          [attr.d]="iconPath()"
        />
      </svg>
      <ng-content />
    </a>
  `,
})
export class AdminNavBtnComponent {
  link  = input.required<string[]>();
  color = input<'blue' | 'green' | 'orange'>('blue');

  colorCls() {
    switch (this.color()) {
      case 'green':  return 'bg-green-50 text-green-700 hover:bg-green-100';
      case 'orange': return 'bg-orange-50 text-orange-700 hover:bg-orange-100';
      default:       return 'bg-blue-50 text-blue-700 hover:bg-blue-100';
    }
  }

  iconPath() {
    switch (this.color()) {
      case 'blue':
        return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
      case 'orange':
        return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      default:
        return 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z';
    }
  }
}
