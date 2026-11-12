import { paraLocalDateTime, semanaDe, situacaoDe, somarDias, toDetalhe, toDias, toLista, toPeriodoParams } from './atendimentos-api';

describe('atendimentos-api', () => {
  it('lista: lê LocalDateTime em texto ou array e ordena pela hora', () => {
    const l = toLista([
      { id: 2, status: 'ATENDIDO', dataHora: [2026, 11, 12, 15, 0], dataHoraAtendimento: [2026, 11, 12, 15, 0], tipo: 'CONSULTA', pessoas: [{ nome: 'ANA', idPessoa: 1 }], colaboradores: [{ id: 31, nome: 'DRA. LIMA' }] },
      { id: 1, status: 'AGENDADO', dataHora: '2026-11-12T09:30:00', dataHoraAgendamento: '2026-11-12T09:30:00' },
      { status: 'sem id' },
    ]);
    expect(l.map((a) => a.id)).toEqual([1, 2]);
    expect([l[1].dataHora, l[1].pessoas[0].idPessoa, l[1].colaboradores[0].nome]).toEqual(['2026-11-12T15:00:00', 1, 'DRA. LIMA']);
  });

  it('situação: atrasado é agendado com horário passado', () => {
    const agora = '2026-11-12T12:00:00';
    expect(situacaoDe({ status: 'AGENDADO', dataHora: '2026-11-12T09:30:00' }, agora)).toBe('atrasado');
    expect(situacaoDe({ status: 'AGENDADO', dataHora: '2026-11-12T14:00:00' }, agora)).toBe('agendado');
    expect(situacaoDe({ status: 'NÃO ATENDIDO', dataHora: '2026-11-12T09:00:00' }, agora)).toBe('nao-atendido');
    expect(situacaoDe({ status: 'ATENDIDO', dataHora: '2026-11-12T09:00:00' }, agora)).toBe('atendido');
  });

  it('semana de segunda a domingo e soma de dias', () => {
    expect(semanaDe('2026-11-12')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(semanaDe('2026-11-15')[0]).toBe('2026-11-09');
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(paraLocalDateTime('2026-11-12T14:30')).toBe('2026-11-12T14:30:00');
  });

  it('detalhe, dias e parâmetros', () => {
    const d = toDetalhe({ atendimento: { id: 5, status: 'ATENDIDO' }, idTipo: 2, idArea: 1, fatosCliente: 'X' });
    expect([d.atendimento.id, d.idTipo, d.fatosCliente, d.orientacao]).toEqual([5, 2, 'X', null]);
    expect(toDias([{ data: [2026, 11, 12], agendados: 2, atendidos: 1, naoAtendidos: 0 }])['2026-11-12'].agendados).toBe(2);
    expect(toPeriodoParams('2026-11-09', '2026-11-15', null).toString()).toBe('de=2026-11-09&ate=2026-11-15');
  });
});
