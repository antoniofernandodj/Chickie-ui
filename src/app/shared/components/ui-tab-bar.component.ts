import { Component, input, model } from '@angular/core';

export interface UiTab {
  id:    string;
  label: string;
}

@Component({
  selector: 'ui-tab-bar',
  standalone: true,
  template: `
    <div class="tab-scroll flex overflow-x-auto border-b-2 border-gray-100">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          (click)="active.set(tab.id)"
          class="shrink-0 px-5 py-3.5 text-sm font-bold transition-colors duration-150 relative whitespace-nowrap"
          [style.color]="active() === tab.id ? 'var(--color-brand)' : '#9ca3af'"
        >
          {{ tab.label }}
          <span
            class="absolute bottom-[-2px] left-3 right-3 h-0.5 rounded-full transition-opacity duration-200"
            style="background: var(--color-brand)"
            [style.opacity]="active() === tab.id ? '1' : '0'"
          ></span>
        </button>
      }
    </div>
  `,
  styles: [`
    .tab-scroll { overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--color-brand) transparent; }
    .tab-scroll::-webkit-scrollbar { height: 3px; }
    .tab-scroll::-webkit-scrollbar-track { background: transparent; }
    .tab-scroll::-webkit-scrollbar-thumb { background: var(--color-brand); border-radius: 9999px; }
  `],
})
export class UiTabBarComponent {
  tabs   = input.required<UiTab[]>();
  active = model.required<string>();
}
