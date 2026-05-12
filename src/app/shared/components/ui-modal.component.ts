import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ui-modal',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      (click)="close.emit()"
    >
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      <div
        class="relative w-full bg-white sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90dvh] flex flex-col"
        [class]="widthCls()"
        (click)="$event.stopPropagation()"
      >
        <!-- Mobile drag handle -->
        <div
          class="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-200 rounded-full sm:hidden"
        ></div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div class="flex-1 min-w-0">
            <ng-content select="[uiModalSubtitle]" />
            <h2 class="text-base font-bold text-gray-900">{{ title() }}</h2>
          </div>
          <div class="flex items-center gap-3 ml-3 shrink-0">
            <ng-content select="[uiModalHeaderActions]" />
            <button
              type="button"
              (click)="close.emit()"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto flex-1">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class UiModalComponent {
  title = input('');
  size  = input<'sm' | 'md' | 'lg'>('md');
  close = output<void>();

  widthCls = computed(() => ({ sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' })[this.size()]);
}
