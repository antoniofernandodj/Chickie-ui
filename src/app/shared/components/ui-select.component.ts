import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-select',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelectComponent), multi: true }],
  template: `
    @if (label()) {
      <label
        class="block font-medium text-gray-700 mb-1.5"
        [class]="labelCls()"
        >{{ label() }}</label
      >
    }
    <select
      [disabled]="isDisabled()"
      [value]="innerValue()"
      (change)="onSelect($any($event.target).value)"
      (blur)="onTouched()"
      [class]="selectCls()"
    >
      <ng-content />
    </select>
    @if (error()) {
      <p class="text-xs text-red-600 mt-1">{{ error() }}</p>
    } @else if (hint()) {
      <p class="text-xs text-gray-500 mt-1">{{ hint() }}</p>
    }
  `,
})
export class UiSelectComponent implements ControlValueAccessor {
  label = input('');
  size  = input<'sm' | 'md'>('md');
  error = input<string | null | undefined>(null);
  hint  = input<string | null | undefined>(null);

  innerValue = signal('');
  isDisabled = signal(false);

  private _onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  labelCls  = computed(() => (this.size() === 'sm' ? 'text-xs' : 'text-sm'));
  selectCls = computed(() => {
    const pad    = this.size() === 'sm' ? 'px-3 py-2.5' : 'px-4 py-3';
    const border = this.error()
      ? 'border-red-400'
      : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100';
    return `w-full rounded-xl border text-sm outline-none transition-all bg-white ${pad} ${border}`;
  });

  writeValue(v: string)                    { this.innerValue.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void) { this._onChange = fn; }
  registerOnTouched(fn: () => void)         { this.onTouched = fn; }
  setDisabledState(d: boolean)              { this.isDisabled.set(d); }

  onSelect(value: string) {
    this.innerValue.set(value);
    this._onChange(value);
  }
}
