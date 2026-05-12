import { Component, inject, input, forwardRef, signal, ChangeDetectionStrategy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormBuilder, ReactiveFormsModule, Validators, NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';
import { CepService } from '../../core/services/cep.service';
import { UiInputComponent } from './ui-input.component';
import { UiSpinnerComponent } from './ui-spinner.component';

@Component({
  selector: 'app-endereco-form',
  standalone: true,
  imports: [ReactiveFormsModule, UiInputComponent, UiSpinnerComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EnderecoFormComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => EnderecoFormComponent),
      multi: true
    }
  ],
  template: `
    <form
      [formGroup]="form"
      class="grid grid-cols-2 gap-3"
    >
      <div class="col-span-2 relative">
        <ui-input
          formControlName="cep"
          label="CEP"
          placeholder="00000-000"
          [size]="size()"
        />
        @if (loading()) {
          <div class="absolute right-3 bottom-3.5">
            <ui-spinner size="sm" />
          </div>
        }
      </div>
      <div class="col-span-2">
        <ui-input
          formControlName="logradouro"
          label="Logradouro *"
          placeholder="Rua das Flores"
          [size]="size()"
          [error]="fieldError('logradouro')"
        />
      </div>
      <ui-input
        formControlName="numero"
        label="Número *"
        placeholder="123"
        [size]="size()"
        [error]="fieldError('numero')"
      />
      <ui-input
        formControlName="complemento"
        label="Complemento"
        placeholder="Apto 101"
        [size]="size()"
      />
      <ui-input
        formControlName="bairro"
        label="Bairro *"
        placeholder="Centro"
        [size]="size()"
        [error]="fieldError('bairro')"
      />
      <ui-input
        formControlName="cidade"
        label="Cidade *"
        placeholder="São Paulo"
        [size]="size()"
        [error]="fieldError('cidade')"
      />
      <div class="col-span-2">
        <ui-input
          formControlName="estado"
          label="Estado *"
          placeholder="SP"
          [size]="size()"
          [error]="fieldError('estado')"
        />
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnderecoFormComponent implements ControlValueAccessor, Validator {
  private fb = inject(FormBuilder);
  private cepService = inject(CepService);

  size = input<'sm' | 'md'>('sm');
  loading = signal(false);

  form = this.fb.group({
    cep:         [''],
    logradouro:  ['', Validators.required],
    numero:      ['', Validators.required],
    complemento: [''],
    bairro:      ['', Validators.required],
    cidade:      ['', Validators.required],
    estado:      ['', [Validators.required, Validators.maxLength(2), Validators.pattern(/^[A-Z]{2}$/)]],
  });

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.form.valueChanges.subscribe(val => {
      this.onChange(val);
      this.onTouched();
    });

    // CEP Auto-lookup
    this.form.get('cep')?.valueChanges.subscribe(cep => {
      const cleanCep = cep?.replace(/\D/g, '') || '';
      if (cleanCep.length === 8) {
        this.lookupCep(cleanCep);
      }
    });
  }

  writeValue(value: any): void {
    if (value) {
      this.form.patchValue(value, { emitEvent: false });
    } else {
      this.form.reset({}, { emitEvent: false });
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.form.disable() : this.form.enable();
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return this.form.invalid ? { enderecoInvalido: true } : null;
  }

  private lookupCep(cep: string) {
    this.loading.set(true);
    this.cepService.buscar(cep).subscribe({
      next: (res) => {
        this.form.patchValue({
          logradouro: res.logradouro,
          bairro: res.bairro,
          cidade: res.localidade,
          estado: res.uf,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  fieldError(name: string): string | null {
    const ctrl = this.form.get(name);
    if (!ctrl?.invalid || !ctrl?.touched) return null;
    if (ctrl.errors?.['required'])   return 'Campo obrigatório.';
    if (ctrl.errors?.['maxlength'])  return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors?.['pattern'])    return 'Deve ter 2 letras maiúsculas (ex: SP).';
    return null;
  }
}
