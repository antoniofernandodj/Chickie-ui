import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { AdminService } from '../../../core/services/admin.service';
import { EnderecoLoja } from '../../../core/models';
import { EnderecoFormComponent, UiInputComponent, UiButtonComponent } from '../../../shared/components';

@Component({
  selector: 'admin-enderecos-tab',
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoFormComponent, UiInputComponent, UiButtonComponent],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Criar/Editar Endereço -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-5">
          @if (editEnderecoId()) { Editar Endereço } @else { Adicionar Endereço }
        </h2>
        <form [formGroup]="enderecoForm" (ngSubmit)="editEnderecoId() ? atualizarEndereco() : criarEndereco()" class="space-y-4">
          <app-endereco-form formControlName="endereco" />

          <div class="grid grid-cols-2 gap-3">
            <ui-input formControlName="latitude" type="number" label="Latitude" size="sm" step="any"/>
            <ui-input formControlName="longitude" type="number" label="Longitude" size="sm" step="any"/>
          </div>

          @if (enderecoError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ enderecoError() }}</p>
          }

          <div class="flex gap-2">
            <div class="flex-1">
              <ui-button type="submit" [disabled]="enderecoLoadingSubmit() || enderecoForm.invalid" [loading]="enderecoLoadingSubmit()" size="sm" [fullWidth]="true">
                @if (editEnderecoId()) { Atualizar Endereço } @else { Criar Endereço }
              </ui-button>
            </div>
            @if (editEnderecoId()) {
              <ui-button type="button" variant="secondary" size="sm" (click)="cancelarEdicaoEndereco()">Cancelar</ui-button>
            }
          </div>
        </form>
      </div>

      <!-- Lista de Endereços -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-5">Endereços da Loja</h2>
        @if (enderecoLoading()) {
          <p class="text-sm text-gray-500 py-8 text-center">Carregando...</p>
        } @else if (enderecos().length === 0) {
          <p class="text-sm text-gray-500 py-8 text-center">Nenhum endereço cadastrado.</p>
        } @else {
          <div class="space-y-3">
            @for (endereco of enderecos(); track endereco.uuid) {
              <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">{{ endereco.logradouro }}, {{ endereco.numero }}</p>
                    @if (endereco.complemento) {
                      <p class="text-xs text-gray-600">{{ endereco.complemento }}</p>
                    }
                    <p class="text-xs text-gray-500 mt-1">{{ endereco.bairro }} - {{ endereco.cidade }}/{{ endereco.estado }}</p>
                    @if (endereco.cep) {
                      <p class="text-xs text-gray-500">CEP: {{ endereco.cep }}</p>
                    }
                  </div>
                  <div class="flex gap-2">
                    <ui-button size="xs" variant="secondary" (click)="abrirEdicaoEndereco(endereco)">Editar</ui-button>
                    <ui-button size="xs" variant="danger" (click)="deletarEndereco(endereco.uuid)">Deletar</ui-button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminEnderecosTabComponent {
  lojaUuid = input.required<string>();

  private adminService = inject(AdminService);
  private fb = inject(FormBuilder);

  private readonly refreshEnderecoTrigger = new BehaviorSubject<void>(undefined);
  private readonly _enderecos = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshEnderecoTrigger]).pipe(
      switchMap(([uuid]) =>
        this.adminService.listarEnderecosLoja(uuid).pipe(catchError(() => of([] as EnderecoLoja[]))),
      ),
    ),
    { initialValue: [] as EnderecoLoja[] },
  );
  readonly enderecoLoading = computed(() => this._enderecos() === undefined);
  readonly enderecos = computed(() => this._enderecos() ?? []);

  private refreshEnderecos() { this.refreshEnderecoTrigger.next(); }

  enderecoForm = this.fb.group({
    endereco: [null as any],
    latitude: [''],
    longitude: [''],
  });

  enderecoLoadingSubmit = signal(false);
  enderecoError = signal('');
  editEnderecoId = signal<string | null>(null);

  constructor() {
    this.refreshEnderecos();
  }

  criarEndereco() {
    if (this.enderecoForm.invalid) {
      this.enderecoForm.markAllAsTouched();
      this.enderecoError.set('Preencha todos os campos obrigatórios.');
      return;
    }
    this.enderecoLoadingSubmit.set(true);
    this.enderecoError.set('');
    const fv = this.enderecoForm.value;
    const end = fv.endereco!;
    this.adminService.criarEnderecoLoja(this.lojaUuid(), {
      cep: end.cep || null, logradouro: end.logradouro!, numero: end.numero!,
      complemento: end.complemento || null, bairro: end.bairro!, cidade: end.cidade!, estado: end.estado!,
      latitude: fv.latitude ? parseFloat(fv.latitude) : null,
      longitude: fv.longitude ? parseFloat(fv.longitude) : null,
    }).subscribe({
      next: () => {
        this.enderecoLoadingSubmit.set(false);
        toast.success('Endereço criado com sucesso!');
        this.enderecoForm.reset();
        this.refreshEnderecos();
      },
      error: (e) => { this.enderecoLoadingSubmit.set(false); this.enderecoError.set(e?.error?.error ?? 'Erro ao criar endereço.'); },
    });
  }

  abrirEdicaoEndereco(endereco: EnderecoLoja) {
    this.editEnderecoId.set(endereco.uuid);
    this.enderecoForm.patchValue({
      endereco: {
        cep: endereco.cep ?? '', logradouro: endereco.logradouro, numero: endereco.numero,
        complemento: endereco.complemento ?? '', bairro: endereco.bairro, cidade: endereco.cidade, estado: endereco.estado,
      },
      latitude: endereco.latitude?.toString() ?? '',
      longitude: endereco.longitude?.toString() ?? '',
    });
  }

  cancelarEdicaoEndereco() {
    this.editEnderecoId.set(null);
    this.enderecoForm.reset();
    this.enderecoError.set('');
  }

  atualizarEndereco() {
    if (this.enderecoForm.invalid) {
      this.enderecoForm.markAllAsTouched();
      this.enderecoError.set('Preencha todos os campos obrigatórios.');
      return;
    }
    const enderecoUuid = this.editEnderecoId();
    if (!enderecoUuid) return;
    this.enderecoLoadingSubmit.set(true);
    this.enderecoError.set('');
    const fv = this.enderecoForm.value;
    const end = fv.endereco!;
    this.adminService.atualizarEnderecoLoja(this.lojaUuid(), enderecoUuid, {
      cep: end.cep || null, logradouro: end.logradouro, numero: end.numero,
      complemento: end.complemento || null, bairro: end.bairro, cidade: end.cidade, estado: end.estado,
      latitude: fv.latitude ? parseFloat(fv.latitude) : null,
      longitude: fv.longitude ? parseFloat(fv.longitude) : null,
    }).subscribe({
      next: () => {
        this.enderecoLoadingSubmit.set(false);
        this.editEnderecoId.set(null);
        toast.success('Endereço atualizado com sucesso!');
        this.enderecoForm.reset();
        this.refreshEnderecos();
      },
      error: (e) => { this.enderecoLoadingSubmit.set(false); this.enderecoError.set(e?.error?.error ?? 'Erro ao atualizar endereço.'); },
    });
  }

  deletarEndereco(uuid: string) {
    if (!confirm('Deletar este endereço? Esta ação não pode ser desfeita.')) return;
    this.adminService.deletarEnderecoLoja(this.lojaUuid(), uuid).subscribe({
      next: () => {
        toast.success('Endereço deletado com sucesso!');
        if (this.editEnderecoId() === uuid) this.cancelarEdicaoEndereco();
        this.refreshEnderecos();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar endereço.'),
    });
  }
}
