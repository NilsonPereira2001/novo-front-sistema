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
 * Lê uma entidade simples (`{ id, nome }`, `{ id, sexo }`, `{ id, forma }`...)
 * como opção. Procura o rótulo nos campos informados; se nenhum existir e a
 * entidade tiver um único campo de texto além do `id`, usa esse campo.
 * Itens sem `id` numérico ou sem rótulo são descartados — nada é inventado.
 */
export function toOpcao(
  raw: JsonRecord,
  labelKeys: readonly string[] = LABEL_KEYS_PADRAO,
): Opcao | null {
  const id = readNumber(raw, ['id']);
  const label = readString(raw, labelKeys) ?? unicoTexto(raw);
  if (id === null || !Number.isSafeInteger(id) || id <= 0 || !label) {
    return null;
  }
  return { id, label };
}

/** Valor do único campo de texto da entidade (fora `id`), se houver exatamente um. */
function unicoTexto(raw: JsonRecord): string | null {
  const textos = Object.entries(raw)
    .filter(([key, value]) => key !== 'id' && typeof value === 'string' && value.trim() !== '')
    .map(([, value]) => (value as string).trim());
  return textos.length === 1 ? textos[0] : null;
}
