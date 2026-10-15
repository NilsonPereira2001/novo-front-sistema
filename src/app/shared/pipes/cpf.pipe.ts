import { Pipe, PipeTransform } from '@angular/core';

import { formatCpf } from '../utils/cpf';

/** `{{ pessoa.cpf | cpf }}` → 000.000.000-00 (ou "—" quando vazio). */
@Pipe({ name: 'cpf' })
export class CpfPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatCpf(value) || '—';
  }
}
