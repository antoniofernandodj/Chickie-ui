import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReservaMesa, StatusReserva } from '../models';

@Injectable({ providedIn: 'root' })
export class ReservaMesaService {
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return environment.apiUrl;
  }

  listar(lojaUuid: string): Observable<ReservaMesa[]> {
    return this.http.get<ReservaMesa[]>(`${this.baseUrl}/reservas-mesa/${lojaUuid}`);
  }

  atualizarStatus(uuid: string, status: StatusReserva): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.baseUrl}/reservas-mesa/${uuid}/status`, { status });
  }
}
