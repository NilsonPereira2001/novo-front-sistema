import { Pipe, PipeTransform } from '@angular/core';

/**
 * Exibe um valor do backend sem interpretá-lo: texto como veio,
 * `true`/`false` como "Sim"/"Não" e vazio como "—".
 */
@Pipe({ name: 'displayValue' })
export class DisplayValuePipe implements PipeTransform {
  transform(value: string | number | boolean | null | undefined): string {
    if (value === true) {
      return 'Sim';
    }
    if (value === false) {
      return 'Não';
    }
    if (value === null || value === undefined || String(value).trim() === '') {
      return '—';
    }
    return String(value);
  }
}
