import { Injectable } from '@angular/core';

const STORAGE_KEY = 'ga.lembrar-usuario';

/**
 * Guarda SOMENTE a identificação de acesso (nunca senha ou token) para
 * preencher o campo de usuário na próxima visita, quando o usuário pedir.
 *
 * Fica no localStorage do navegador; o acesso é protegido por try/catch
 * porque pode estar bloqueado (aba anônima, política do navegador).
 */
@Injectable({ providedIn: 'root' })
export class RememberedIdentifierService {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  save(identifier: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, identifier);
    } catch {
      // Armazenamento indisponível: apenas não lembramos.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nada a fazer.
    }
  }
}
