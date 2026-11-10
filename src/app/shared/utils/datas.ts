/** Data de hoje no fuso do navegador, no formato do `<input type="date">` (YYYY-MM-DD). */
export function hojeIso(agora: Date = new Date()): string {
  const d = agora;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Data escolhida (YYYY-MM-DD) → Instant ISO, com a hora atual do navegador.
 * Mantém o dia certo no fuso local e a ordem entre cadastros do mesmo dia.
 * Retorna `undefined` para datas inválidas.
 */
export function instanteDaData(data: string, agora: Date = new Date()): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());
  if (!m) {
    return undefined;
  }
  const d = new Date(+m[1], +m[2] - 1, +m[3], agora.getHours(), agora.getMinutes(), agora.getSeconds());
  return Number.isNaN(d.getTime()) || d.getDate() !== +m[3] ? undefined : d.toISOString();
}
