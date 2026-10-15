import { humanize, normalizeKey } from '../../../shared/utils/text';
import { TipoPessoa } from './pessoas.models';

export const TIPO_LABEL: Readonly<Record<TipoPessoa, string>> = {
  ASSOCIADO: 'Associado',
  DEPENDENTE: 'Dependente',
  FUNCIONARIO: 'Funcionário',
};

/** Classe da etiqueta de cada tipo (sóbria, sem excesso de cor). */
export const TIPO_TAG: Readonly<Record<TipoPessoa, string>> = {
  ASSOCIADO: 'tag tag--primary',
  DEPENDENTE: 'tag tag--outline',
  FUNCIONARIO: 'tag',
};

/** Filtros da listagem. `param` é o valor usado na URL (`?tipo=associado`). */
export const TIPO_FILTROS: readonly {
  readonly value: TipoPessoa | null;
  readonly param: string | null;
  readonly label: string;
}[] = [
  { value: null, param: null, label: 'Todos' },
  { value: 'ASSOCIADO', param: 'associado', label: 'Associados' },
  { value: 'DEPENDENTE', param: 'dependente', label: 'Dependentes' },
  { value: 'FUNCIONARIO', param: 'funcionario', label: 'Funcionários' },
];

export function tipoFromParam(param: string | null): TipoPessoa | null {
  return TIPO_FILTROS.find((f) => f.param === param)?.value ?? null;
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

/** Cor da bolinha de situação a partir do texto do backend. */
export function situacaoTone(situacao: string | null): StatusTone {
  const key = normalizeKey(situacao);
  if (!key) {
    return 'neutral';
  }
  if (
    key.startsWith('ATIV') ||
    key.includes('EM_DIA') ||
    (key.includes('DEFERID') && !key.includes('INDEFERID'))
  ) {
    return 'success';
  }
  if (key.includes('AGUARD') || key.includes('PENDENT') || key.includes('ANALISE')) {
    return 'warning';
  }
  if (
    key.includes('INADIMPL') ||
    key.includes('BLOQUE') ||
    key.includes('SUSPENS') ||
    key.includes('INDEFERID')
  ) {
    return 'danger';
  }
  return 'neutral';
}

export function situacaoLabel(situacao: string | null): string {
  return humanize(situacao) || '—';
}
