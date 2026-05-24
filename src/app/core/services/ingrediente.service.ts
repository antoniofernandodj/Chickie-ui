import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Ingrediente,
  CreateIngredienteRequest,
  UpdateIngredienteRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class IngredienteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ingredientes`;

  listar(lojaUuid: string): Observable<Ingrediente[]> {
    return this.http.get<Ingrediente[]>(`${this.base}/${lojaUuid}`);
  }

  criar(lojaUuid: string, body: CreateIngredienteRequest): Observable<Ingrediente> {
    return this.http.post<Ingrediente>(`${this.base}/${lojaUuid}`, body);
  }

  atualizar(lojaUuid: string, uuid: string, body: UpdateIngredienteRequest): Observable<Ingrediente> {
    return this.http.put<Ingrediente>(`${this.base}/${lojaUuid}/${uuid}`, body);
  }

  deletar(lojaUuid: string, uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${lojaUuid}/${uuid}`);
  }
}
