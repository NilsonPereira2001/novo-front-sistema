/** Item de uma lista de barras (`nome` null = não informado). */
export interface Quantidade {
  readonly nome: string | null;
  readonly total: number;
}

/** Mantém as `limite - 1` maiores e soma o resto em "Outras" (sem gerar cor nova). */
export function agruparResto(itens: readonly Quantidade[], limite: number, rotuloResto: string): Quantidade[] {
  if (itens.length <= limite) {
    return [...itens];
  }
  const topo = itens.slice(0, limite - 1);
  const resto = itens.slice(limite - 1).reduce((s, q) => s + q.total, 0);
  return [...topo, { nome: rotuloResto, total: resto }];
}
