import { lerMes, nomeMes, rotuloMes, somarMeses, toPainelJuridico, toRanking, variacao } from './painel-juridico-api';

describe('painel-juridico-api', () => {
  it('lê o painel: séries ordenadas, contagens sem zeros, advogados e audiências', () => {
    const p = toPainelJuridico({
      totais: { processos: 40, processosAtivos: 31, agendados: 5, agendadosAtrasados: 1, atendidosNoMes: 9, atendidosMesAnterior: 6, advogadosAtivos: 3 },
      processosPorMes: [{ ano: 2026, mes: 11, qtd: 4 }, { ano: 2026, mes: 10, qtd: 2 }, { ano: 0, mes: 1, qtd: 9 }],
      atendimentosPorMes: [{ ano: 2026, mes: 11, atendidos: 9, naoAtendidos: 1 }],
      processosPorStatus: [{ nome: 'ARQUIVADO', qtd: 9 }, { nome: 'EM ANDAMENTO', qtd: 31 }, { nome: 'X', qtd: 0 }],
      processosPorArea: [{ nome: null, qtd: 2 }],
      advogados: [{ id: 7, nome: 'ANA', oab: 'AL 123', processos: 10, processosAtivos: 8, proximaAudiencia: '2026-11-20' }, { nome: 'SEM ID' }],
      proximasAudiencias: [{ idProcesso: 3, numeroProcesso: '00012344620248020001', data: '2026-11-20', tipo: 'CONCILIAÇÃO', responsavel: 'ANA' }],
    });
    expect(p.totais.processos).toBe(40);
    expect(p.totais.processosParados).toBe(0);
    expect(p.processosPorMes.map((m) => [m.mes, m.valores['qtd']])).toEqual([[10, 2], [11, 4]]);
    expect(p.atendimentosPorMes[0].valores).toEqual({ atendidos: 9, naoAtendidos: 1, agendados: 0 });
    expect(p.processosPorStatus.map((s) => s.nome)).toEqual(['EM ANDAMENTO', 'ARQUIVADO']);
    expect(p.processosPorArea[0].nome).toBeNull();
    expect(p.advogados.length).toBe(1);
    expect(p.advogados[0].proximaAudiencia).toBe('2026-11-20');
    expect(p.proximasAudiencias[0].idProcesso).toBe(3);
    expect(p.atendimentosPorTipo).toEqual([]);
  });

  it('sem totais é formato inesperado', () => {
    let erro = '';
    try {
      toPainelJuridico({ processosPorMes: [] });
    } catch (e) {
      erro = (e as Error).name;
    }
    expect(erro).toBe('UnexpectedResponseError');
  });

  it('ranking ordenado por atendidos e nome', () => {
    const r = toRanking({ ano: 2026, mes: 11, total: 12, itens: [{ id: 1, nome: 'BRUNO', atendidos: 3 }, { id: 2, nome: 'ANA', atendidos: 3, mesAnterior: 5 }, { id: 3, nome: 'CAIO', atendidos: 6 }] });
    expect(r.itens.map((i) => i.nome)).toEqual(['CAIO', 'ANA', 'BRUNO']);
    expect(r.itens[1].mesAnterior).toBe(5);
  });

  it('meses: rótulos, leitura e soma', () => {
    expect(rotuloMes(2026, 11)).toBe('nov/26');
    expect(nomeMes(2026, 3)).toBe('março de 2026');
    expect(lerMes('2026-11')).toEqual({ ano: 2026, mes: 11 });
    expect(lerMes('2026-13')).toBeNull();
    expect(somarMeses(2026, 1, -1)).toBe('2025-12');
    expect(somarMeses(2026, 12, 1)).toBe('2027-01');
  });

  it('variação contra o mês anterior', () => {
    expect(variacao(9, 6)).toEqual({ texto: '+50% sobre o mês anterior', direcao: 'sobe' });
    expect(variacao(3, 6).direcao).toBe('desce');
    expect(variacao(4, 4).direcao).toBe('igual');
    expect(variacao(2, 0).texto.includes('mês anterior sem registros')).toBe(true);
  });
});
