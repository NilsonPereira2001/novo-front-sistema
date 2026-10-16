import { JsonRecord, readNumber, readString } from '../utils/json-read';

/** Opção de um campo de seleção: o `id` vai para o backend, o `label` para a tela. */
export interface Opcao {
  readonly id: number;
  readonly label: string;
  /** Informação complementar exibida em buscas (ex.: CPF, tipo). */
  readonly detalhe?: string;
}

/**
 * Campos de texto mais comuns nas entidades de cadastro auxiliares.
 * ⚠️ A CONFIRMAR para cada entidade: o primeiro encontrado vira o rótulo.
 */
export const LABEL_KEYS_PADRAO = ['nome', 'descricao', 'tipo', 'sigla', 'razaoSocial'] as const;

/**
 * Lê uma entidade simples (`{ id, nome }`, `{ id, descricao }`...) como opção.
 * Itens sem `id` numérico ou sem rótulo são descartados — nada é inventado.
 */
export function toOpcao(
  raw: JsonRecord,
  labelKeys: readonly string[] = LABEL_KEYS_PADRAO,
): Opcao | null {
  const id = readNumber(raw, ['id']);
  const label = readString(raw, labelKeys);
  if (id === null || !Number.isSafeInteger(id) || id <= 0 || !label) {
    return null;
  }
  return { id, label };
}
