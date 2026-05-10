import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-checkbox',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCheckboxComponent), multi: true }],
  template: `
    <label class="inline-flex items-center gap-2 cursor-pointer" [class.opacity-50]="isDisabled()">
      <input
        type="checkbox"
        [checked]="innerValue()"
        [disabled]="isDisabled()"
        (change)="onChange($any($event.target).checked)"
        (blur)="onTouched()"
        class="rounded border-gray-300 text-orange-500 focus:ring-orange-400 focus:ring-2"
      />
      @if (label()) {
        <span [class]="labelCls()">{{ label() }}</span>
      }
      <ng-content/>
    </label>
  `,
})
export class UiCheckboxComponent implements ControlValueAccessor {
  label    = input('');
  size     = input<'sm' | 'md'>('md');

  innerValue = signal(false);
  isDisabled = signal(false);

  private _onChange: (v: boolean) => void = () => {};
  onTouched: () => void = () => {};

  labelCls = computed(() => {
    const t = this.size() === 'sm' ? 'text-xs' : 'text-sm';
    return `font-medium text-gray-700 select-none ${t}`;
  });

  writeValue(v: boolean)                    { this.innerValue.set(!!v); }
  registerOnChange(fn: (v: boolean) => void) { this._onChange = fn; }
  registerOnTouched(fn: () => void)          { this.onTouched = fn; }
  setDisabledState(d: boolean)               { this.isDisabled.set(d); }

  onChange(checked: boolean) {
    this.innerValue.set(checked);
    this._onChange(checked);
  }
}
