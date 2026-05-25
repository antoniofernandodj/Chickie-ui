import { Injectable } from '@angular/core';
import { formatPhone } from '../utils/phone-utils';

export interface ContatoGuestSalvo {
  id: string;
  numero: string;          // apenas dígitos (11 chars)
  numeroFormatado: string; // (XX) X XXXX-XXXX
}

const STORAGE_KEY = 'chickie_contatos_guest';
const MAX_SAVED   = 5;

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

@Injectable({ providedIn: 'root' })
export class GuestContatoService {
  listar(): ContatoGuestSalvo[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  salvar(numero: string): void {
    // numero deve ser apenas dígitos, 11 chars
    if (numero.length !== 11) return;
    try {
      const lista = this.listar().filter(c => c.numero !== numero);
      lista.unshift({ id: gerarId(), numero, numeroFormatado: formatPhone(numero) });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista.slice(0, MAX_SAVED)));
    } catch {
      // silently ignore (ex: modo privado com storage bloqueado)
    }
  }

  remover(id: string): void {
    try {
      const lista = this.listar().filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // silently ignore
    }
  }
}
