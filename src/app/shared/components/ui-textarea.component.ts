import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-textarea',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTextareaComponent), multi: true }],
  template: `
    @if (label()) {
      <label
        class="block font-medium text-gray-700 mb-1.5"
        [class]="labelCls()"
        >{{ label() }}</label
      >
    }
    <textarea
      [rows]="rows()"
      [placeholder]="placeholder()"
      [disabled]="isDisabled()"
      [value]="innerValue()"
      (input)="onInput($event)"
      (blur)="onTouched()"
      [class]="textareaCls()"
    ></textarea>
    @if (error()) {
      <p class="text-xs text-red-600 mt-1">{{ error() }}</p>
    } @else if (hint()) {
      <p class="text-xs text-gray-500 mt-1">{{ hint() }}</p>
    }
  `,
})
export class UiTextareaComponent implements ControlValueAccessor {
  label       = input('');
  rows        = input(3);
  size        = input<'sm' | 'md'>('md');
  placeholder = input('');
  error       = input<string | null | undefined>(null);
  hint        = input<string | null | undefined>(null);

  innerValue = signal('');
  isDisabled = signal(false);

  private _onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  labelCls    = computed(() => (this.size() === 'sm' ? 'text-xs' : 'text-sm'));
  textareaCls = computed(() => {
    const pad    = this.size() === 'sm' ? 'px-3 py-2.5' : 'px-4 py-3';
    const border = this.error()
      ? 'border-red-400'
      : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100';
    return `w-full rounded-xl border text-sm outline-none transition-all resize-none placeholder-gray-400 ${pad} ${border}`;
  });

  writeValue(v: string)                    { this.innerValue.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void) { this._onChange = fn; }
  registerOnTouched(fn: () => void)         { this.onTouched = fn; }
  setDisabledState(d: boolean)              { this.isDisabled.set(d); }

  onInput(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    this.innerValue.set(value);
    this._onChange(value);
  }
}
