import { diasDe, gradeDoMes, horario, lerMes, maisUmaHora, porDia, somarMeses, toCompromissos, toPayload } from './agenda-api';

const base = { descricao: null, local: null, cor: 'azul' as const, lembreteMinutos: null };

describe('agenda-api', () => {
  it('grade do mês: 42 dias começando na segunda', () => {
    const g = gradeDoMes(2026, 11); // 01/11/2026 é domingo
    expect(g.length).toBe(42);
    expect(g[0]).toBe('2026-10-26');
    expect(g[6]).toBe('2026-11-01');
    expect(gradeDoMes(2026, 6)[0]).toBe('2026-06-01'); // 01/06/2026 é segunda
  });

  it('meses', () => {
    expect(lerMes('2026-11')).toEqual({ ano: 2026, mes: 11 });
    expect(lerMes('2026-00')).toBeNull();
    expect(somarMeses(2026, 12, 1)).toBe('2027-01');
    expect(somarMeses(2026, 1, -1)).toBe('2025-12');
  });

  it('compromissos por dia (vários dias, dia inteiro primeiro)', () => {
    const lista = toCompromissos([
      { id: 1, titulo: 'Reunião', inicio: '2026-11-26T14:00:00', fim: '2026-11-26T15:00:00' },
      { id: 2, titulo: 'Congresso', inicio: '2026-11-25T00:00:00', fim: '2026-11-27T23:59:00', diaInteiro: true, cor: 'verde' },
      { id: 3, titulo: 'Cedo', inicio: '2026-11-26T08:00:00', fim: '2026-11-26T09:00:00', cor: 'xpto' },
      { titulo: 'sem id', inicio: '2026-11-26T08:00:00' },
    ]);
    expect(lista.length).toBe(3);
    expect(lista[2].cor).toBe('azul');
    expect(diasDe(lista[1])).toEqual(['2026-11-25', '2026-11-26', '2026-11-27']);
    expect(porDia(lista).get('2026-11-26')?.map((c) => c.id)).toEqual([2, 3, 1]);
  });

  it('horário exibido', () => {
    expect(horario({ ...base, id: 1, titulo: 'x', inicio: '2026-11-26T14:00:00', fim: '2026-11-26T15:30:00', diaInteiro: false })).toBe('14:00 – 15:30');
    expect(horario({ ...base, id: 1, titulo: 'x', inicio: '2026-11-26T00:00:00', fim: '2026-11-26T23:59:00', diaInteiro: true })).toBe('Dia inteiro');
    expect(horario({ ...base, id: 1, titulo: 'x', inicio: '2026-11-25T00:00:00', fim: '2026-11-27T23:59:00', diaInteiro: true })).toBe('25/11 a 27/11');
  });

  it('payload do formulário', () => {
    const f = { titulo: ' Médico ', descricao: '', local: ' Clínica ', data: '2026-11-30', horaInicio: '08:30', dataFim: '', horaFim: '09:30', diaInteiro: false, cor: 'laranja' as const, lembreteMinutos: 60 };
    expect(toPayload(f)).toEqual({ titulo: 'Médico', descricao: null, local: 'Clínica', inicio: '2026-11-30T08:30:00', fim: '2026-11-30T09:30:00', diaInteiro: false, cor: 'laranja', lembreteMinutos: 60 });
    const d = toPayload({ ...f, diaInteiro: true, dataFim: '2026-12-02' });
    expect([d.inicio, d.fim, d.lembreteMinutos]).toEqual(['2026-11-30T00:00:00', '2026-12-02T23:59:00', null]);
    expect(maisUmaHora('23:30')).toBe('23:59');
    expect(maisUmaHora('09:15')).toBe('10:15');
  });
});
