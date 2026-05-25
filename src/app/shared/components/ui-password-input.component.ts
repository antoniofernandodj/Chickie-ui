import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-password-input',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiPasswordInputComponent),
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
    <div class="relative">
      <input
        [type]="showPass() ? 'text' : 'password'"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        [value]="innerValue()"
        [attr.autocomplete]="autocomplete() || null"
        (input)="onInput($event)"
        (blur)="onTouched()"
        [class]="inputCls()"
      />
      <button
        type="button"
        (click)="showPass.set(!showPass())"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
      >
        @if (showPass()) {
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
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        } @else {
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
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        }
      </button>
    </div>
    @if (error()) {
      <p class="text-xs text-red-600 mt-1">{{ error() }}</p>
    }
  `,
})
export class UiPasswordInputComponent implements ControlValueAccessor {
  label        = input('Senha');
  placeholder  = input('••••••••');
  size         = input<'sm' | 'md'>('md');
  error        = input<string | null | undefined>(null);
  autocomplete = input<string>('');

  innerValue = signal('');
  isDisabled = signal(false);
  showPass   = signal(false);

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  labelCls = computed(() => this.size() === 'sm' ? 'text-xs' : 'text-sm');

  inputCls = computed(() => {
    const pad    = this.size() === 'sm' ? 'px-3 py-2.5' : 'px-4 py-3';
    const border = this.error() ? 'border-red-400' : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100';
    return `w-full rounded-xl border text-sm outline-none transition-all placeholder-gray-400 pr-12 ${pad} ${border}`;
  });

  writeValue(v: string)                    { this.innerValue.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void){ this.onChange = fn; }
  registerOnTouched(fn: () => void)        { this.onTouched = fn; }
  setDisabledState(d: boolean)             { this.isDisabled.set(d); }

  onInput(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.innerValue.set(v);
    this.onChange(v);
  }
}
