import { percentual, toPainelFinanceiro } from './dashboard-api';

const base = {
  previsao: { total: 1000, convenios: 800, associadosComConvenio: 20, acordos: 50, qtdAcordos: 2, planos: 150, vidasPlano: 3, lancamentoAberto: null },
  debitos: { total: 300, qtdLancamentos: 10, qtdAssociados: 4, associadosAtivos: 20, associadosAtivosComDebito: 3 },
};

describe('dashboard-api', () => {
  it('lê o painel e soma anistiado + renegociado em "outros"', () => {
    const p = toPainelFinanceiro({
      ...base,
      lancamentos: [
        { id: 2, nsa: 8, dataGeracao: '2026-10-01T12:00:00Z', fechado: true, total: 100, pago: 70, emAberto: 20, anistiado: 5, renegociado: 5, emTransacao: 0 },
        { id: 1, nsa: 7, dataGeracao: '2026-09-01T12:00:00Z', fechado: true, total: 90, pago: 90 },
      ],
      debitosPorCategoria: [{ nome: 'MENSALIDADE', tipo: 'CONVENIO', valor: 200, qtd: 6 }, { nome: 'ZERO', valor: 0, qtd: 0 }],
      debitosPorIdade: [{ nome: 'Até 30 dias', valor: 0, qtd: 0 }, { nome: '31 a 60 dias', valor: 30, qtd: 1 }],
      recebimentosMes: { total: 40, qtd: 2, porForma: [{ nome: 'PIX', valor: 40, qtd: 2 }] },
      maioresDevedores: [{ idAssociado: 501, nome: 'ANA', valor: 115.9, qtd: 4 }],
    });
    expect(p.lancamentos.map((l) => l.nsa)).toEqual([7, 8]);
    expect(p.lancamentos[1].outros).toBe(10);
    expect(p.debitosPorCategoria.map((c) => c.nome)).toEqual(['MENSALIDADE']);
    expect(p.debitosPorIdade.length).toBe(2);
    expect(p.previsao.lancamentoAberto).toBeNull();
    expect(p.recebimentosMes.porForma[0].nome).toBe('PIX');
  });

  it('sem previsão ou débitos é formato inesperado', () => {
    let erro = '';
    try { toPainelFinanceiro({ debitos: {} }); } catch (e) { erro = (e as Error).name; }
    expect(erro).toBe('UnexpectedResponseError');
    expect(percentual(3, 20)).toBe(15);
    expect(percentual(1, 0)).toBe(0);
  });
});
