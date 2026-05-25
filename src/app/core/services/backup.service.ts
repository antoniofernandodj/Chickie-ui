import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Baixa todas as configurações da loja como objeto JSON. */
  exportar(lojaUuid: string): Observable<object> {
    return this.http.get<object>(`${this.base}/lojas/${lojaUuid}/backup`);
  }

  /** Restaura as configurações da loja a partir de um snapshot. */
  restaurar(lojaUuid: string, snapshot: object): Observable<object> {
    return this.http.post<object>(`${this.base}/lojas/${lojaUuid}/restore`, snapshot);
  }
}
