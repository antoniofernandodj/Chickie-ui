import { Directive, ElementRef, HostListener, inject, input, Renderer2 } from '@angular/core';
import { ContextMenuService, ContextMenuItem } from '../../core/services/context-menu.service';

@Directive({
  selector: '[appContextMenu]',
  standalone: true,
})
export class ContextMenuDirective {
  readonly appContextMenu = input.required<ContextMenuItem[]>();

  private readonly svc = inject(ContextMenuService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerFired = false;
  private moved = false;

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: MouseEvent): void {
    const items = this.appContextMenu();
    if (!items.length) return;
    e.preventDefault();
    // On Android the contextmenu event fires after the long-press timer already
    // opened the menu — skip reopening but still suppress the native menu.
    if (this.timerFired) {
      this.timerFired = false;
      return;
    }
    this.svc.open(e.clientX, e.clientY, items);
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return; // mouse uses the contextmenu event
    if (!this.appContextMenu().length) return;
    this.timerFired = false;
    this.moved = false;
    this.setPressing(true);
    this.timer = setTimeout(() => {
      if (!this.moved) {
        this.timerFired = true;
        this.setPressing(false);
        this.svc.open(e.clientX, e.clientY, this.appContextMenu());
      }
    }, 500);
  }

  @HostListener('pointermove')
  onPointerMove(): void {
    this.moved = true;
    this.clearTimer();
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  onPointerUp(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.setPressing(false);
  }

  private setPressing(on: boolean): void {
    const el = this.el.nativeElement;
    if (on) {
      this.renderer.setStyle(el, 'opacity', '0.55');
      this.renderer.setStyle(el, 'transition', 'opacity 0.15s');
      this.renderer.setStyle(el, 'user-select', 'none');
    } else {
      this.renderer.removeStyle(el, 'opacity');
      this.renderer.removeStyle(el, 'user-select');
    }
  }
}
