import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Adicional,
  CategoriaCobertura,
  CategoriaProdutos,
  CategoriaProdutosGlobalResponse,
  CreateAdicionalRequest,
  CreateCategoriaRequest,
  Produto,
} from '../models';


@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalogo`;

  // ── Adicionais ──────────────────────────────────────────────────────────────

  criarAdicional(
    lojaUuid: string,
    body: CreateAdicionalRequest,
  ): Observable<Adicional> {
    return this.http.post<Adicional>(
      `${this.base}/${lojaUuid}/adicionais`,
      body,
    );
  }

  listarAdicionais(lojaUuid: string): Observable<Adicional[]> {
    return this.http.get<Adicional[]>(`${this.base}/${lojaUuid}/adicionais`);
  }

  listarAdicionaisDisponiveis(lojaUuid: string): Observable<Adicional[]> {
    return this.http.get<Adicional[]>(
      `${this.base}/${lojaUuid}/adicionais/disponiveis`,
    );
  }

  marcarAdicionalIndisponivel(
    lojaUuid: string,
    adicionalUuid: string,
  ): Observable<void> {
    return this.http.put<void>(
      `${this.base}/${lojaUuid}/adicionais/${adicionalUuid}/indisponivel`,
      {},
    );
  }

  toggleDisponibilidadeAdicional(
    lojaUuid: string,
    adicionalUuid: string,
    disponivel: boolean,
  ): Observable<void> {
    return this.http.put<void>(
      `${this.base}/${lojaUuid}/adicionais/${adicionalUuid}/disponibilidade`,
      { disponivel },
    );
  }

  atualizarAdicional(
    lojaUuid: string,
    adicionalUuid: string,
    body: CreateAdicionalRequest,
  ): Observable<Adicional> {
    return this.http.put<Adicional>(
      `${this.base}/${lojaUuid}/adicionais/${adicionalUuid}`,
      body,
    );
  }

  deletarAdicional(
    lojaUuid: string,
    adicionalUuid: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${lojaUuid}/adicionais/${adicionalUuid}`,
    );
  }

  // ── Categorias ──────────────────────────────────────────────────────────────

  criarCategoria(
    lojaUuid: string,
    body: CreateCategoriaRequest,
  ): Observable<CategoriaProdutos> {
    return this.http.post<CategoriaProdutos>(
      `${this.base}/${lojaUuid}/categorias`,
      body,
    );
  }

  listarCategorias(lojaUuid: string): Observable<CategoriaProdutos[]> {
    return this.http.get<CategoriaProdutos[]>(
      `${this.base}/${lojaUuid}/categorias`,
    );
  }

  listarCategoriasGlobais(): Observable<CategoriaProdutos[]> {
    return this.http.get<CategoriaProdutos[]>(`${this.base}/categorias/globais`);
  }

  listarCategoriasComCobertura(): Observable<CategoriaCobertura[]> {
    return this.http.get<CategoriaCobertura[]>(`${this.base}/categorias/globais/cobertura`);
  }

  listarProdutosPorCategoriaGlobal(categoriaUuid: string): Observable<CategoriaProdutosGlobalResponse> {
    return this.http.get<CategoriaProdutosGlobalResponse>(
      `${this.base}/categorias/globais/${categoriaUuid}/produtos`,
    );
  }

  atualizarCategoria(
    lojaUuid: string,
    categoriaUuid: string,
    body: CreateCategoriaRequest,
  ): Observable<CategoriaProdutos> {
    return this.http.put<CategoriaProdutos>(
      `${this.base}/${lojaUuid}/categorias/${categoriaUuid}`,
      body,
    );
  }

  deletarCategoria(
    lojaUuid: string,
    categoriaUuid: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${lojaUuid}/categorias/${categoriaUuid}`,
    );
  }

  reordenarCategorias(
    lojaUuid: string,
    ordens: { categoria_uuid: string; ordem: number }[],
  ): Observable<void> {
    return this.http.put<void>(
      `${this.base}/${lojaUuid}/categorias/reordenar`,
      ordens,
    );
  }

  // ── Produtos ────────────────────────────────────────────────────────────────

  private readonly prodBase = `${environment.apiUrl}/produtos`;

  criarProduto(body: Partial<Produto>): Observable<Produto> {
    return this.http.post<Produto>(this.prodBase, body);
  }

  atualizarProduto(uuid: string, body: Partial<Produto>): Observable<Produto> {
    return this.http.put<Produto>(`${this.prodBase}/${uuid}`, body);
  }

  listarProdutos(): Observable<Produto[]> {
    return this.http.get<Produto[]>(this.prodBase);
  }

  /** Público — listar produtos por loja */
  listarProdutosPorLoja(lojaUuid: string): Observable<Produto[]> {
    return this.http.get<Produto[]>(`${this.prodBase}/listar/${lojaUuid}`);
  }

  buscarProduto(uuid: string): Observable<Produto> {
    return this.http.get<Produto>(`${this.prodBase}/${uuid}`);
  }

  listarProdutosPorCategoria(lojaUuid: string, categoriaUuid: string): Observable<Produto[]> {
    return this.http.get<Produto[]>(
      `${this.prodBase}/categoria/${lojaUuid}/${categoriaUuid}`,
    );
  }

  uploadImagemProduto(produtoUuid: string, file: File): Observable<{ imagem_url: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imagem_url: string; message: string }>(
      `${this.prodBase}/${produtoUuid}/imagem`,
      formData,
    );
  }

  removerImagemProduto(produtoUuid: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.prodBase}/${produtoUuid}/imagem`);
  }

  deletarProduto(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.prodBase}/${uuid}`);
  }

  toggleDisponibilidadeProduto(
    lojaUuid: string,
    produtoUuid: string,
    disponivel: boolean,
  ): Observable<void> {
    return this.http.put<void>(
      `${this.prodBase}/${lojaUuid}/${produtoUuid}/disponibilidade`,
      { disponivel },
    );
  }
}
