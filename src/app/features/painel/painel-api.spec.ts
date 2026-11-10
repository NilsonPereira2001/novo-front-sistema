import { agruparResto, idadeNoAno, ticksEixo, toAniversariante, toPainel } from './painel-api';

describe('painel-api', () => {
  it('lê o resumo, ordena as distribuições e descarta zeros', () => {
    const p = toPainel({
      totais: { total: 10, ativos: 6, inativos: 1, desligados: 2, aguardandoAdesao: 1, aguardandoDesligamento: 0 },
      porVinculo: [{ nome: 'CIVIL', total: 2 }, { nome: 'MILITAR', total: 4 }, { nome: 'X', total: 0 }],
      porTipoSocio: [{ nome: 'CONTRIBUINTE', total: 1 }, { nome: 'EFETIVO', total: 5 }],
      militaresPorUnidade: [{ nome: null, total: 1 }, { nome: '1º BPM', total: 3 }],
      porInstituicao: [],
      evolucao: [{ ano: 2026, mes: 11, adesoes: 3, desligamentos: 1 }, { ano: 2026, mes: 10, adesoes: 2, desligamentos: 0 }],
    });
    expect(p.totais.ativos).toBe(6);
    expect(p.porVinculo.map((q) => q.nome)).toEqual(['MILITAR', 'CIVIL']);
    expect(p.porTipoSocio.map((q) => q.nome)).toEqual(['EFETIVO', 'CONTRIBUINTE']);
    expect(p.militaresPorUnidade).toEqual([{ nome: '1º BPM', total: 3 }, { nome: null, total: 1 }]);
    expect(p.evolucao.map((m) => m.mes)).toEqual([10, 11]);
  });

  it('resposta sem totais é formato inesperado', () => {
    let erro = '';
    try { toPainel({ porVinculo: [] }); } catch (e) { erro = (e as Error).name; }
    expect(erro).toBe('UnexpectedResponseError');
  });

  it('aniversariante: militar mostra a unidade; demais, a instituição', () => {
    const mil = toAniversariante({ idPessoa: 1, nome: 'ANA', dataNascimento: [1990, 11, 5], tipoVinculo: 'MILITAR', unidade: '1º BPM', instituicao: 'PMAL' })!;
    expect([mil.dataNascimento, mil.dia, mil.lotacao]).toEqual(['1990-11-05', 5, '1º BPM']);
    const civ = toAniversariante({ idPessoa: 2, nome: 'JOÃO', dataNascimento: '1985-11-20', tipoVinculo: 'CIVIL', unidade: null, instituicao: 'SEFAZ' })!;
    expect(civ.lotacao).toBe('SEFAZ');
    expect(toAniversariante({ idPessoa: 3, nome: 'SEM DATA' })).toBeNull();
    expect(idadeNoAno('1990-11-05', 2026)).toBe(36);
  });

  it('agrupa o resto em "Outras" e calcula ticks limpos', () => {
    const itens = [5, 4, 3, 2, 1].map((t, i) => ({ nome: 'U' + i, total: t }));
    expect(agruparResto(itens, 3, 'Outras')).toEqual([{ nome: 'U0', total: 5 }, { nome: 'U1', total: 4 }, { nome: 'Outras', total: 6 }]);
    expect(agruparResto(itens, 8, 'Outras').length).toBe(5);
    expect(ticksEixo(7)).toEqual([0, 2, 4, 6, 8]);
    expect(ticksEixo(43)).toEqual([0, 20, 40, 60]);
    expect(ticksEixo(0)).toEqual([0, 1]);
  });
});
