import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MontagemCompleta,
  CriarMontagemRequest,
  CriarEtapaRequest,
  CriarOpcaoRequest,
} from '../models';
import { SILENT_ERROR } from '../interceptors/http-context-tokens';

@Injectable({ providedIn: 'root' })
export class MontagemService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/montagens`;

  // ── Público ────────────────────────────────────────────────────────────────

  buscarPorProduto(produtoUuid: string): Observable<MontagemCompleta> {
    // SILENT_ERROR=true: o 404 "sem montagem" é esperado — o componente trata, sem toast
    return this.http.get<MontagemCompleta>(`${this.base}/produto/${produtoUuid}`, {
      context: new HttpContext().set(SILENT_ERROR, true),
    });
  }

  // ── Admin — Montagem ───────────────────────────────────────────────────────

  criar(lojaUuid: string, body: CriarMontagemRequest): Observable<{ uuid: string }> {
    return this.http.post<{ uuid: string }>(`${this.base}/${lojaUuid}`, body);
  }

  deletar(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${uuid}`);
  }

  duplicar(montagemUuid: string, produtoDestinoUuid: string): Observable<{ uuid: string }> {
    return this.http.post<{ uuid: string }>(
      `${this.base}/${montagemUuid}/duplicar`,
      { produto_uuid: produtoDestinoUuid },
    );
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

  criarOpcoesBulk(etapaUuid: string, items: Omit<CriarOpcaoRequest, 'ordem'>[]): Observable<import('../models').OpcaoMontagem[]> {
    return this.http.post<import('../models').OpcaoMontagem[]>(
      `${this.base}/etapas/${etapaUuid}/opcoes/bulk`,
      items,
    );
  }

  deletarOpcao(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/opcoes/${uuid}`);
  }
}
