import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Funcionario } from '../models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FuncionarioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/funcionarios`;

  getMe(): Observable<Funcionario> {
    return this.http.get<Funcionario>(`${this.base}/me`);
  }
}
