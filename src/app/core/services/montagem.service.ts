import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MontagemCompleta,
  CriarMontagemRequest,
  CriarEtapaRequest,
  CriarOpcaoRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class MontagemService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/montagens`;

  // ── Público ────────────────────────────────────────────────────────────────

  buscarPorProduto(produtoUuid: string): Observable<MontagemCompleta> {
    return this.http.get<MontagemCompleta>(`${this.base}/produto/${produtoUuid}`);
  }

  // ── Admin — Montagem ───────────────────────────────────────────────────────

  criar(lojaUuid: string, body: CriarMontagemRequest): Observable<{ uuid: string }> {
    return this.http.post<{ uuid: string }>(`${this.base}/${lojaUuid}`, body);
  }

  deletar(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${uuid}`);
  }

  // ── Admin — Etapas ─────────────────────────────────────────────────────────

  criarEtapa(montagemUuid: string, body: CriarEtapaRequest): Observable<{ uuid: string }> {
    return this.http.post<{ uuid: string }>(`${this.base}/${montagemUuid}/etapas`, body);
  }

  deletarEtapa(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/etapas/${uuid}`);
  }

  // ── Admin — Opções ─────────────────────────────────────────────────────────

  criarOpcao(etapaUuid: string, body: CriarOpcaoRequest): Observable<{ uuid: string }> {
    return this.http.post<{ uuid: string }>(`${this.base}/etapas/${etapaUuid}/opcoes`, body);
  }

  deletarOpcao(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/opcoes/${uuid}`);
  }
}
