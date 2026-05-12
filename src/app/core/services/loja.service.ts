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
    console.debug(`[OBSERVABILITY] LojaService - Searching lojas. Term: "${termo}", Only open: ${aberta ?? 'all'}`);
    let params = new HttpParams().set('termo', termo);
    if (aberta !== undefined) params = params.set('aberta', String(aberta));
    return this.http.get<Loja[]>(`${this.base}/pesquisar`, { params });
  }

  /** Buscar loja por slug */
  buscarPorSlug(slug: string): Observable<Loja> {
    console.debug(`[OBSERVABILITY] LojaService - Fetching loja by slug: ${slug}`);
    return this.http.get<Loja>(`${this.base}/slug/${slug}`);
  }

  /** Verificar disponibilidade de slug */
  verificarSlug(slug: string): Observable<{ disponivel: boolean; slug: string }> {
    return this.http.get<{ disponivel: boolean; slug: string }>(`${this.base}/verificar-slug/${slug}`);
  }

  /** Buscar loja por UUID */
  buscarPorUuid(uuid: string): Observable<Loja> {
    console.debug(`[OBSERVABILITY] LojaService - Fetching loja by UUID: ${uuid}`);
    return this.http.get<Loja>(`${this.base}/${uuid}`);
  }

  /** Buscar nota média pré-calculada da loja */
  buscarNotaMedia(lojaUuid: string): Observable<NotaMediaLojaResponse> {
    console.debug(`[OBSERVABILITY] LojaService - Fetching average rating for loja: ${lojaUuid}`);
    return this.http.get<NotaMediaLojaResponse>(`${this.base}/${lojaUuid}/nota-media`);
  }

  /** Upload de imagem de banner da loja */
  uploadBannerLoja(lojaUuid: string, file: File): Observable<{ imagem_url: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imagem_url: string; message: string }>(
      `${this.base}/${lojaUuid}/imagem`,
      formData,
    );
  }

  /** Remover imagem de banner da loja */
  removerBannerLoja(lojaUuid: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${lojaUuid}/imagem`);
  }
}
