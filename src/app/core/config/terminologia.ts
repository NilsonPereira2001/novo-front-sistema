import { environment } from '../../../environments/environment';

const { membro, membros } = environment.branding.terminologia;

/**
 * Termos usados nos textos fixos do sistema, conforme a nomenclatura da
 * empresa contratante (ver `branding.terminologia` no environment).
 *
 * Os nomes que vêm do banco (ex.: tipos de pessoa) já chegam com a
 * nomenclatura de cada empresa e não passam por aqui.
 */
export const TERMOS = {
  /** "Associado" / "Afiliado" */
  membro,
  /** "Associados" / "Afiliados" */
  membros,
  /** "associado" / "afiliado" */
  membroMin: membro.toLocaleLowerCase('pt-BR'),
  /** "associados" / "afiliados" */
  membrosMin: membros.toLocaleLowerCase('pt-BR'),
} as const;
