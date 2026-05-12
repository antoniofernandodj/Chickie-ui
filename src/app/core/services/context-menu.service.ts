import { Injectable, signal } from '@angular/core';

export type ContextMenuItem =
  | {
      label: string;
      icon?: string;
      action: () => void;
      variant?: 'default' | 'danger';
      disabled?: boolean;
    }
  | 'separator';

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  readonly state = signal<ContextMenuState | null>(null);

  open(x: number, y: number, items: ContextMenuItem[]): void {
    this.state.set({ x, y, items });
  }

  close(): void {
    this.state.set(null);
  }
}
