import { Component, HostListener, PLATFORM_ID, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ContextMenuService, ContextMenuItem } from '../../core/services/context-menu.service';

const MENU_W = 210;
const MENU_H_PER_ITEM = 40;
const MENU_PADDING = 12;

@Component({
  selector: 'ui-context-menu',
  standalone: true,
  template: `
    @if (svc.state(); as state) {
      <!-- Overlay transparente captura clique fora -->
      <div
        class="fixed inset-0 z-[9998]"
        (click)="svc.close()"
      ></div>

      <div
        class="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-100 origin-top-left"
        [style.left.px]="pos().x"
        [style.top.px]="pos().y"
      >
        @for (item of state.items; track $index) {
          @if (item === 'separator') {
            <div class="my-1 border-t border-gray-100"></div>
          } @else {
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              [class.text-gray-700]="item.variant !== 'danger'"
              [class.hover:bg-gray-50]="item.variant !== 'danger'"
              [class.text-red-600]="item.variant === 'danger'"
              [class.hover:bg-red-50]="item.variant === 'danger'"
              [disabled]="item.disabled ?? false"
              (click)="run(item)"
            >
              @if (item.icon) {
                <span class="text-base w-5 text-center leading-none shrink-0">{{ item.icon }}</span>
              }
              {{ item.label }}
            </button>
          }
        }
      </div>
    }
  `,
})
export class UiContextMenuComponent {
  readonly svc = inject(ContextMenuService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly pos = computed(() => {
    const s = this.svc.state();
    if (!s || !isPlatformBrowser(this.platformId)) return { x: 0, y: 0 };
    const itemCount = s.items.filter(i => i !== 'separator').length;
    const menuH = itemCount * MENU_H_PER_ITEM + MENU_PADDING * 2;
    return {
      x: Math.min(s.x, window.innerWidth - MENU_W - 8),
      y: Math.min(s.y, window.innerHeight - menuH - 8),
    };
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.svc.close();
  }

  run(item: Exclude<ContextMenuItem, 'separator'>): void {
    if (item.disabled) return;
    this.svc.close();
    item.action();
  }
}
