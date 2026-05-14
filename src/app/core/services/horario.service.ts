import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { HorarioFuncionamento, StatusLojaAberta } from '../models';
import { createReconnectingSSE } from '../utils/reconnecting-sse';

@Injectable({ providedIn: 'root' })
export class HorarioService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly base = `${environment.apiUrl}/horarios`;

  /** Público — sem autenticação */
  listarPorLoja(lojaUuid: string): Observable<HorarioFuncionamento[]> {
    return this.http.get<HorarioFuncionamento[]>(`${this.base}/${lojaUuid}`);
  }

  /** Público — verifica se a loja está aberta agora (horário de Brasília) */
  verificarStatus(lojaUuid: string): Observable<StatusLojaAberta> {
    return this.http.get<StatusLojaAberta>(`${this.base}/${lojaUuid}/status`);
  }

  /** SSE em tempo real — emite StatusLojaAberta sempre que o status aberta/fechada mudar */
  sseStatus(lojaUuid: string): Observable<StatusLojaAberta> {
    return createReconnectingSSE(
      () => `${this.base}/${lojaUuid}/sse`,
      ['loja_status'],
      this.platformId,
      () => {},
      { logPrefix: `[SSE:loja-status]` },
    ).pipe(
      map(e => JSON.parse(e.data) as StatusLojaAberta),
    );
  }
}
