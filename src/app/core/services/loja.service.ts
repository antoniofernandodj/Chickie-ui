import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Loja } from '../models';

export interface NotaMediaLojaResponse {
  loja_uuid: string;
  nota_media: number | null;
}

@Injectable({ providedIn: 'root' })
export class LojaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lojas`;

  /** Pesquisar lojas por termo (com status aberta/fechada) */
  pesquisar(termo: string, aberta?: boolean): Observable<Loja[]> {
    let params = new HttpParams().set('termo', termo);
    if (aberta !== undefined) params = params.set('aberta', String(aberta));
    return this.http.get<Loja[]>(`${this.base}/pesquisar`, { params });
  }

  /** Buscar loja por slug */
  buscarPorSlug(slug: string): Observable<Loja> {
    return this.http.get<Loja>(`${this.base}/slug/${slug}`);
  }

  /** Verificar disponibilidade de slug */
  verificarSlug(slug: string): Observable<{ disponivel: boolean; slug: string }> {
    return this.http.get<{ disponivel: boolean; slug: string }>(`${this.base}/verificar-slug/${slug}`);
  }

  /** Buscar loja por UUID */
  buscarPorUuid(uuid: string): Observable<Loja> {
    return this.http.get<Loja>(`${this.base}/${uuid}`);
  }

  /** Buscar nota média pré-calculada da loja */
  buscarNotaMedia(lojaUuid: string): Observable<NotaMediaLojaResponse> {
    return this.http.get<NotaMediaLojaResponse>(`${this.base}/${lojaUuid}/nota-media`);
  }
}
