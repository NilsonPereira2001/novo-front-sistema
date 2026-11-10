import {
  ehPendente,
  lerValor,
  periodoPadrao,
  situacao,
  somar,
  toExtratoParams,
  toFicha,
  toListaParams,
  toPaginaResumo,
} from './financeiro-api';

describe('financeiro-api', () => {
  it('lê a página da lista com débitos e crédito', () => {
    const p = toPaginaResumo({
      content: [{ idAssociado: 501, idPessoa: 1, nome: 'ANA', cpf: '1', status: 'ATIVO', formaPagamento: 'BOLETO', qtdDebitos: 2, valorDebitos: 50.5, credito: 0 }, { nome: 'SEM ID' }],
      totalElements: 1, totalPages: 1, number: 0, size: 10,
    });
    expect(p.content.length).toBe(1);
    expect([p.content[0].idAssociado, p.content[0].qtdDebitos, p.content[0].valorDebitos]).toEqual([501, 2, 50.5]);
  });

  it('lê a ficha com débitos, convênios e acordos', () => {
    const f = toFicha({
      idAssociado: 501, idPessoa: 1, nome: 'ANA', credito: 10, valorDebitos: 30,
      debitos: [{ id: 9, descricao: 'MENSALIDADE', status: 'EM ABERTO', valor: 30, dataOrigem: '2026-10-05T12:00:00Z' }, { descricao: 'sem id' }],
      convenios: [{ id: 71, nome: 'MENSALIDADE', valor: 30, fixo: true }],
      acordos: [{ id: 3, totalParcelas: 5, parcelasPagas: 2, status: 'ATIVO' }],
    });
    expect(f.debitos.map((d) => d.id)).toEqual([9]);
    expect(f.convenios[0].fixo).toBe(true);
    expect(f.acordos[0].parcelasPagas).toBe(2);
    expect(f.lancamentoAtual).toEqual([]);
  });

  it('situação: rótulo e pendência', () => {
    expect(situacao('EM ABERTO')).toEqual({ rotulo: 'Em aberto', tom: 'danger' });
    expect(situacao('PAGO').tom).toBe('success');
    expect(situacao('OUTRO').rotulo).toBe('Outro');
    expect([ehPendente('NÃO DEBITADO'), ehPendente('PAGO'), ehPendente('EM TRANSAÇÃO ATUAL')]).toEqual([true, false, false]);
  });

  it('parâmetros: só envia filtros preenchidos', () => {
    expect(toListaParams({ filtro: ' ana ', comDebito: true, comCredito: false, page: 0, size: 10 }).toString()).toBe('page=0&size=10&filtro=ana&comDebito=true');
    expect(toExtratoParams({ inicio: '2025-11-01', fim: '2026-11-10', page: 1, size: 20 }).toString()).toBe('inicio=2025-11-01&fim=2026-11-10&page=1&size=20');
  });

  it('valores: soma em centavos e leitura do valor digitado', () => {
    expect(somar([0.1, 0.2])).toBe(0.3);
    expect([lerValor('1.234,56'), lerValor('25'), lerValor('10,5'), lerValor('abc'), lerValor('1,234')]).toEqual([1234.56, 25, 10.5, null, null]);
    expect(periodoPadrao(new Date(2026, 10, 10))).toEqual({ inicio: '2025-11-01', fim: '2026-11-10' });
  });
});
