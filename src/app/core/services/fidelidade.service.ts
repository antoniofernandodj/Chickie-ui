import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AtualizarProgramaFidelidadeRequest,
  CriarProgramaFidelidadeRequest,
  ProgramaFidelidade,
  ProgressoComPrograma,
  RecompensaFidelidade,
} from '../models';

@Injectable({ providedIn: 'root' })
export class FidelidadeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fidelidade`;

  /** Público — programas ativos da loja (vitrine). */
  listarProgramasAtivos(lojaUuid: string): Observable<ProgramaFidelidade[]> {
    return this.http.get<ProgramaFidelidade[]>(`${this.base}/programas/${lojaUuid}`);
  }

  /** Admin — lista todos os programas (ativos e inativos) da loja. */
  listarProgramasAdmin(lojaUuid: string): Observable<ProgramaFidelidade[]> {
    return this.http.get<ProgramaFidelidade[]>(`${this.base}/programas/${lojaUuid}/admin`);
  }

  /** Admin — cria um programa. */
  criarPrograma(body: CriarProgramaFidelidadeRequest): Observable<ProgramaFidelidade> {
    return this.http.post<ProgramaFidelidade>(`${this.base}/programas`, body);
  }

  /** Admin — edita programa. */
  atualizarPrograma(uuid: string, body: AtualizarProgramaFidelidadeRequest): Observable<ProgramaFidelidade> {
    return this.http.patch<ProgramaFidelidade>(`${this.base}/programas/${uuid}`, body);
  }

  /** Admin — ativa/desativa. */
  definirStatus(uuid: string, ativo: boolean): Observable<void> {
    return this.http.patch<void>(`${this.base}/programas/${uuid}/status`, { ativo });
  }

  /** Admin — remove programa. */
  deletarPrograma(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/programas/${uuid}`);
  }

  /** Cliente — progresso nos programas ativos de uma loja. */
  meuProgresso(lojaUuid: string): Observable<ProgressoComPrograma[]> {
    return this.http.get<ProgressoComPrograma[]>(`${this.base}/progresso/${lojaUuid}`);
  }

  /** Cliente — recompensas disponíveis em todas as lojas. */
  minhasRecompensas(): Observable<RecompensaFidelidade[]> {
    return this.http.get<RecompensaFidelidade[]>(`${this.base}/recompensas`);
  }
}
