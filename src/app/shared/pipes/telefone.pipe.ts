import { Pipe, PipeTransform } from '@angular/core';

import { formatTelefone } from '../utils/telefone';

/** `{{ pessoa.telefonePrincipal | telefone }}` → (82) 99999-9999 (ou "—"). */
@Pipe({ name: 'telefone' })
export class TelefonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatTelefone(value) || '—';
  }
}
