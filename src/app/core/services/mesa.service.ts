import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Mesa } from '../models';

@Injectable({ providedIn: 'root' })
export class MesaService {
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return environment.apiUrl;
  }

  listar(lojaUuid: string): Observable<Mesa[]> {
    return this.http.get<Mesa[]>(`${this.baseUrl}/mesas/${lojaUuid}`);
  }

  bulkSet(lojaUuid: string, total: number): Observable<Mesa[]> {
    return this.http.post<Mesa[]>(`${this.baseUrl}/mesas/${lojaUuid}/bulk`, { total });
  }
}
