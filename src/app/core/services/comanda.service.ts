import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Comanda, FecharComandaRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class ComandaService {
  private readonly http = inject(HttpClient);

  buscarComandaAtiva(lojaUuid: string, numeroMesa: string): Observable<Comanda | null> {
    return this.http
      .get<Comanda>(`/api/comandas/por-loja/${lojaUuid}/mesa/${numeroMesa}/ativa`)
      .pipe(catchError(err => err.status === 404 ? of<Comanda | null>(null) : throwError(() => err)));
  }

  listarComandasAtivas(lojaUuid: string): Observable<Comanda[]> {
    return this.http.get<Comanda[]>(`/api/comandas/por-loja/${lojaUuid}/ativas`);
  }

  fecharComanda(uuid: string, body: FecharComandaRequest): Observable<Comanda> {
    return this.http.post<Comanda>(`/api/comandas/${uuid}/fechar`, body);
  }
}
