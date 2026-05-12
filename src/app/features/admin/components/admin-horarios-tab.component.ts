import { Component, inject, input, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { AdminService } from '../../../core/services/admin.service';
import { HorarioFuncionamento } from '../../../core/models';
import { AdminScheduleDayCardComponent } from './admin-schedule-day-card.component';
import { UiInputComponent, UiSelectComponent, UiButtonComponent } from '../../../shared/components';

@Component({
  selector: 'admin-horarios-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AdminScheduleDayCardComponent,
    UiInputComponent,
    UiSelectComponent,
    UiButtonComponent
  ],
  template: `
    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Criar Horário -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-5">Adicionar Horário</h2>
        <form
          [formGroup]="horarioForm"
          (ngSubmit)="criarHorario()"
          class="space-y-4"
        >
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1.5"> Dia da Semana * </label>
            @if (diasSemanaDisponiveis().length === 0) {
              <div
                class="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 text-center"
              >
                Todos os 7 dias já estão cadastrados. Libere um dia para cadastrar outro.
              </div>
            } @else {
              <ui-select
                formControlName="dia_semana"
                size="sm"
                [error]="hh.dia_semana.invalid && hh.dia_semana.touched ? 'Dia é obrigatório' : null"
              >
                @for (dia of diasSemanaDisponiveis(); track dia.valor) {
                  <option [value]="dia.valor">{{ dia.nome }}</option>
                }
              </ui-select>
            }
          </div>
          <div class="grid grid-cols-2 gap-3">
            <ui-input
              formControlName="abertura"
              type="time"
              label="Abertura *"
              size="sm"
              [error]="
                hh.abertura.invalid && hh.abertura.touched ? 'Hora de abertura é obrigatória' : null
              "
            />
            <ui-input
              formControlName="fechamento"
              type="time"
              label="Fechamento *"
              size="sm"
              [error]="
                hh.fechamento.invalid && hh.fechamento.touched
                  ? 'Hora de fechamento é obrigatória'
                  : null
              "
            />
          </div>

          @if (horarioError()) {
            <p class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {{ horarioError() }}
            </p>
          }

          <ui-button
            type="submit"
            [disabled]="horarioLoadingSubmit() || horarioForm.invalid"
            [loading]="horarioLoadingSubmit()"
            size="sm"
            [fullWidth]="true"
          >
            Criar Horário
          </ui-button>
        </form>
      </div>

      <!-- Lista de Horários -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-5">Horários de Funcionamento</h2>
        @if (horarioLoading()) {
          <p class="text-sm text-gray-500 py-8 text-center">Carregando...</p>
        } @else if (horarios().length === 0) {
          <p class="text-sm text-gray-500 py-8 text-center">Nenhum horário cadastrado.</p>
        } @else {
          <div class="space-y-3">
            @for (horario of horarios(); track horario.uuid) {
              <admin-schedule-day-card
                [horario]="horario"
                [diaNome]="diasSemana[horario.dia_semana]?.nome ?? ''"
                (toggleAtivo)="toggleDiaAtivo(horario)"
                (deletar)="deletarDia(horario.dia_semana, diasSemana[horario.dia_semana]?.nome ?? '')"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminHorariosTabComponent {
  lojaUuid = input.required<string>();

  private adminService = inject(AdminService);
  private fb = inject(FormBuilder);

  private readonly refreshHorarioTrigger = new BehaviorSubject<void>(undefined);

  horarioForm = this.fb.group({
    dia_semana: [0, Validators.required],
    abertura: ['', Validators.required],
    fechamento: ['', Validators.required],
  });

  horarioLoadingSubmit = signal(false);
  horarioError = signal('');

  private readonly _horarios = toSignal(
    combineLatest([toObservable(this.lojaUuid), this.refreshHorarioTrigger]).pipe(
      switchMap(([uuid]) =>
        this.adminService.listarHorarios(uuid).pipe(catchError(() => of(
          [] as HorarioFuncionamento[]))
        ),
      ),
    ),
    { initialValue: [] as HorarioFuncionamento[] },
  );
  readonly horarioLoading = computed(() => this._horarios() === undefined);
  readonly horarios = computed(() => this._horarios() ?? []);

  private refreshHorarios() { this.refreshHorarioTrigger.next(); }

  readonly diasSemana = [
    { valor: 0, nome: 'Domingo' },
    { valor: 1, nome: 'Segunda-feira' },
    { valor: 2, nome: 'Terça-feira' },
    { valor: 3, nome: 'Quarta-feira' },
    { valor: 4, nome: 'Quinta-feira' },
    { valor: 5, nome: 'Sexta-feira' },
    { valor: 6, nome: 'Sábado' },
  ];

  constructor() {
    this.refreshHorarios();
  }

  readonly diasSemanaDisponiveis = computed(() => {
    const horariosList = this.horarios();
    const diasCadastrados = new Set(horariosList.map(h => h.dia_semana));
    return this.diasSemana.filter(dia => !diasCadastrados.has(dia.valor));
  });

  get hh() { return this.horarioForm.controls; }


  criarHorario() {
    if (this.horarioForm.invalid) {
      this.horarioForm.markAllAsTouched();
      this.horarioError.set('Preencha todos os campos obrigatórios.');
      return;
    }
    this.horarioLoadingSubmit.set(true);
    this.horarioError.set('');
    const fv = this.horarioForm.value;
    this.adminService.criarHorario(this.lojaUuid(), {
      dia_semana: parseInt(fv.dia_semana as unknown as string, 10),
      abertura: fv.abertura!,
      fechamento: fv.fechamento!,
      ativo: true,
    }).subscribe({
      next: () => {
        this.horarioLoadingSubmit.set(false);
        toast.success('Horário criado com sucesso!');
        this.horarioForm.reset({ dia_semana: 0 });
        this.refreshHorarios();
      },
      error: (e) => {
        this.horarioLoadingSubmit.set(false);
        this.horarioError.set(e?.error?.error ?? 'Erro ao criar horário.');
      },
    });
  }

  toggleDiaAtivo(horario: HorarioFuncionamento) {
    this.adminService.toggleDiaAtivo(
      this.lojaUuid(), horario.dia_semana, !horario.ativo
    ).subscribe({
      next: () => {
        toast.success(`Dia ${horario.ativo ? 'desativado' : 'ativado'} com sucesso!`);
        this.refreshHorarios();
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao alterar status do dia.'),
    });
  }

  deletarDia(diaSemana: number, diaNome: string) {
    if (!confirm(`Deletar horário de ${diaNome}? Esta ação não pode ser desfeita.`)) return;
    this.adminService.deletarDia(this.lojaUuid(), diaSemana).subscribe({
      next: () => { toast.success('Horário deletado com sucesso!'); this.refreshHorarios(); },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao deletar horário.'),
    });
  }
}
