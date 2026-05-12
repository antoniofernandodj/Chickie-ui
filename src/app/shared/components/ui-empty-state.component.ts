import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  template: `
    <div class="text-center py-20">
      <div class="text-6xl mb-4">{{ emoji() }}</div>
      <h2 class="text-xl font-semibold text-gray-800 mb-2">{{ title() }}</h2>
      @if (subtitle()) {
        <p class="text-gray-500 text-sm mb-6">{{ subtitle() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class UiEmptyStateComponent {
  emoji    = input('📭');
  title    = input.required<string>();
  subtitle = input('');
}
