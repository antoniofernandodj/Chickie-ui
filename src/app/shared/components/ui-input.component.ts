import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatPhone } from '../../core/utils/phone-utils';
import { formatCpf } from '../../core/utils/cpf-utils';

@Component({
  selector: 'ui-input',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiInputComponent),
    multi: true,
  }],
  template: `
    @if (label()) {
      <label
        class="block font-medium text-gray-700 mb-1.5"
        [class]="labelCls()"
        >{{ label() }}</label
      >
    }
    <input
      [type]="type()"
      [placeholder]="placeholder()"
      [disabled]="isDisabled()"
      [value]="innerValue()"
      [readOnly]="disableAutofill() && autofillBlocked()"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [attr.step]="step() ?? null"
      [attr.autocomplete]="autocomplete() || null"
      (input)="onInput($event)"
      (focus)="autofillBlocked.set(false)"
      (blur)="onTouched()"
      [class]="inputCls()"
    />
    @if (error()) {
      <p class="text-xs text-red-600 mt-1">{{ error() }}</p>
    } @else if (hint()) {
      <p class="text-xs text-gray-500 mt-1">{{ hint() }}</p>
    }
    <ng-content select="[uiInputFeedback]" />
  `,
})
export class UiInputComponent implements ControlValueAccessor {
  label       = input('');
  type        = input('text');
  placeholder = input('');
  size        = input<'sm' | 'md'>('md');
  state       = input<'default' | 'error' | 'success' | 'warning'>('default');
  error       = input<string | null | undefined>(null);
  hint        = input<string | null | undefined>(null);
  mask        = input<'phone' | 'cpf' | null>(null);
  min          = input<string | number | null>(null);
  max          = input<string | number | null>(null);
  step         = input<string | number | null>(null);
  autocomplete = input<string>('');
  disableAutofill = input(false);

  innerValue = signal('');
  isDisabled = signal(false);
  autofillBlocked = signal(true);

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  labelCls = computed(() => this.size() === 'sm' ? 'text-xs' : 'text-sm');

  inputCls = computed(() => {
    const pad    = this.size() === 'sm' ? 'px-3 py-2.5' : 'px-4 py-3';
    const s      = this.error() ? 'error' : this.state();
    const border = {
      default: 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100',
      error:   'border-red-400',
      success: 'border-green-400 focus:border-green-400 focus:ring-2 focus:ring-green-100',
      warning: 'border-yellow-400 focus:border-yellow-400',
    }[s];
    return `w-full rounded-xl border text-sm outline-none transition-all placeholder-gray-400 ${pad} ${border}`;
  });

  writeValue(v: string) {
    if (this.mask() === 'phone' && v) {
      this.innerValue.set(formatPhone(v.replace(/\D/g, '').slice(0, 11)));
    } else if (this.mask() === 'cpf' && v) {
      this.innerValue.set(formatCpf(v));
    } else {
      this.innerValue.set(v ?? '');
    }
  }
  registerOnChange(fn: (v: string) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void)   { this.onTouched = fn; }
  setDisabledState(d: boolean)        { this.isDisabled.set(d); }

  onInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (this.mask() === 'phone') {
      const digits = input.value.replace(/\D/g, '').slice(0, 11);
      const formatted = formatPhone(digits);
      input.value = formatted;
      this.innerValue.set(formatted);
      this.onChange(digits);
    } else if (this.mask() === 'cpf') {
      const digits = input.value.replace(/\D/g, '').slice(0, 11);
      const formatted = formatCpf(digits);
      input.value = formatted;
      this.innerValue.set(formatted);
      this.onChange(digits);
    } else {
      this.innerValue.set(input.value);
      this.onChange(input.value);
    }
  }
}
