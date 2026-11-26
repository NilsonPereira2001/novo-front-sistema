import {
  diasSemMovimentar,
  haQuanto,
  hora,
  nomesAtendidos,
  painelDoAdvogadoApi,
  primeiroNome,
  saudacao,
  textoRanking,
  toPainelAdvogado,
} from './meu-painel-api';

const corpo = {
  advogado: { idFuncionario: 7, idPessoa: 70, nome: 'MARIA DAS DORES', oab: 'AL 1234', cargo: 'ADVOGADO(A)', dataAdmissao: '2024-02-01', status: 'ATIVO' },
  totais: { processos: 40, processosAtivos: 31, processosParados: 3, atendidosNoMes: 12, atendidosMesAnterior: 10, posicaoRanking: null, participantesRanking: 4 },
  evolucao: [
    { ano: 2026, mes: 11, atendidos: 12, naoAtendidos: 1, processos: 2, movimentacoes: 30 },
    { ano: 2026, mes: 10, atendidos: 10, naoAtendidos: 0, processos: 1, movimentacoes: 25 },
  ],
  atendimentosHoje: [{ id: 1, status: 'AGENDADO', dataHora: '2026-11-26T14:30:00', pessoas: [{ idPessoa: 5, nome: 'JOSÉ' }] }, { status: 'X' }],
  proximosAtendimentos: [],
  ultimasMovimentacoes: [{ idProcesso: 9, numeroProcesso: '00012345620268020001', data: '2026-11-20', titulo: 'Juntada', resumo: 'Petição juntada' }, { titulo: 'sem processo' }],
  processosRecentes: [{ id: 9, numeroProcesso: '00012345620268020001', status: 'EM ANDAMENTO', ultimaMovimentacao: '2026-11-20', partes: ['JOSÉ', '', 3] }],
  processosParados: [],
  processosPorStatus: [{ nome: 'EM ANDAMENTO', qtd: 31 }, { nome: 'ARQUIVADO', qtd: 9 }, { nome: 'VAZIO', qtd: 0 }],
  processosPorArea: [],
  proximasAudiencias: [{ idProcesso: 9, numeroProcesso: '1', data: '2026-12-01', tipo: 'CONCILIAÇÃO' }],
};

describe('painel do advogado: adaptador', () => {
  it('lê o painel', () => {
    const p = toPainelAdvogado(corpo);
    expect(p.advogado.idFuncionario).toBe(7);
    expect(p.advogado.oab).toBe('AL 1234');
    expect(p.totais.processosAtivos).toBe(31);
    expect(p.totais.agendadosFuturos).toBe(0);
    expect(p.totais.posicaoRanking).toBeNull();
    expect(p.evolucao.length).toBe(2);
    expect(p.evolucao[0].mes).toBe(10);
    expect(p.evolucao[1].valores['movimentacoes']).toBe(30);
    expect(p.atendimentosHoje.length).toBe(1);
    expect(p.ultimasMovimentacoes.length).toBe(1);
    expect(p.processosRecentes[0].partes.length).toBe(1);
    expect(p.processosPorStatus.length).toBe(2);
    expect(p.proximasAudiencias[0].data).toBe('2026-12-01');
  });

  it('rejeita resposta sem advogado ou totais', () => {
    let erros = 0;
    for (const b of [null, {}, { advogado: { nome: 'X' }, totais: {} }, { advogado: { idFuncionario: 1, nome: 'X' } }]) {
      try { toPainelAdvogado(b); } catch { erros++; }
    }
    expect(erros).toBe(4);
  });

  it('monta o endereço do painel de outro advogado', () => {
    expect(painelDoAdvogadoApi(7)).toBe('/juridico/advogados/7/painel');
  });
});

describe('painel do advogado: apoio', () => {
  it('saudação e primeiro nome', () => {
    expect(saudacao(8)).toBe('Bom dia');
    expect(saudacao(12)).toBe('Boa tarde');
    expect(saudacao(19)).toBe('Boa noite');
    expect(primeiroNome('  ÁLVARO DE SOUZA ')).toBe('Álvaro');
    expect(primeiroNome('')).toBe('');
  });

  it('ranking', () => {
    expect(textoRanking(null, 3)).toBe('Sem atendimentos realizados no mês');
    expect(textoRanking(2, 5)).toBe('2º de 5 colaboradores');
    expect(textoRanking(1, 1)).toBe('Único com atendimentos no mês');
  });

  it('tempo sem movimentar', () => {
    const hoje = new Date(2026, 10, 26);
    expect(diasSemMovimentar({ ultimaMovimentacao: '2026-11-23', dataCadastro: null }, hoje)).toBe(3);
    expect(diasSemMovimentar({ ultimaMovimentacao: null, dataCadastro: '2026-11-26' }, hoje)).toBe(0);
    expect(diasSemMovimentar({ ultimaMovimentacao: null, dataCadastro: null }, hoje)).toBeNull();
    expect(haQuanto(0)).toBe('hoje');
    expect(haQuanto(1)).toBe('ontem');
    expect(haQuanto(45)).toBe('há 45 dias');
    expect(haQuanto(200)).toBe('há 6 meses');
    expect(haQuanto(430)).toBe('há 1 ano e 2 meses');
    expect(haQuanto(null)).toBe('—');
  });

  it('hora e nomes atendidos', () => {
    expect(hora('2026-11-26T09:05:00')).toBe('09:05');
    expect(hora(null)).toBe('—');
    const p = (nome: string) => ({ idPessoa: null, nome, cpf: null, telefone: null });
    expect(nomesAtendidos({ pessoas: [] })).toBe('Pessoa não informada');
    expect(nomesAtendidos({ pessoas: [p('ANA'), p('BIA')] })).toBe('ANA e BIA');
    expect(nomesAtendidos({ pessoas: [p('ANA'), p('BIA'), p('CAU')] })).toBe('ANA e mais 2');
  });
});
