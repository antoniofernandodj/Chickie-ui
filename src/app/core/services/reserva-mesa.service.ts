import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReservaMesa, StatusReserva } from '../models';

export interface CriarReservaPayload {
  numero_mesa:        number;
  data_reserva:       string;   // YYYY-MM-DD
  hora_reserva:       string;   // HH:MM:SS
  hora_fim_reserva:   string;   // HH:MM:SS
  quantidade_pessoas: number;
  observacoes?:       string | null;
  nomes_pessoas?:     string[] | null;
}

@Injectable({ providedIn: 'root' })
export class ReservaMesaService {
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return environment.apiUrl;
  }

  listar(lojaUuid: string): Observable<ReservaMesa[]> {
    return this.http.get<ReservaMesa[]>(`${this.baseUrl}/reservas-mesa/${lojaUuid}`);
  }

  criar(lojaUuid: string, payload: CriarReservaPayload): Observable<ReservaMesa> {
    return this.http.post<ReservaMesa>(`${this.baseUrl}/reservas-mesa/${lojaUuid}`, payload);
  }

  atualizarStatus(uuid: string, status: StatusReserva): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.baseUrl}/reservas-mesa/${uuid}/status`, { status });
  }
}
