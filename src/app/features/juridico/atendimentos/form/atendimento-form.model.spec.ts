import { AtendimentoForm, ModoAtendimento, dataHoraValidator, toAtendimentoPayload } from './atendimento-form.model';

const local = (ms: number) => {
  const d = new Date(Date.now() + ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

describe('atendimento-form.model', () => {
  it('data/hora: agendar exige futuro; registrar aceita até 5 min à frente', () => {
    let modo: ModoAtendimento = 'agendar';
    const v = dataHoraValidator(() => modo);
    const ctl = (value: string) => ({ value }) as never;
    expect(v(ctl(local(-60_000)))).toEqual({ dataPassada: true });
    expect(v(ctl(local(3_600_000)))).toBeNull();
    modo = 'registrar';
    expect(v(ctl(local(-3_600_000)))).toBeNull();
    expect(v(ctl(local(3_600_000)))).toEqual({ dataFutura: true });
    expect(v(ctl('12/11/2026'))).toEqual({ dataHora: true });
  });

  it('payload: maiúsculas, só dígitos, sem relato ao agendar', () => {
    const valor = {
      dataHora: '2026-11-12T10:00', modalidade: 'PRESENCIAL', idTipo: 1, idArea: 2, assunto: ' horas extras ',
      fatosCliente: 'relato', analiseJuridica: '  ', orientacao: '', colaboradores: [31],
      pessoas: [{ idPessoa: null, nome: 'josé', cpf: '529.982.247-25', telefone: '(82) 99999-0000' }],
    };
    const f = { getRawValue: () => valor } as unknown as AtendimentoForm;
    const r = toAtendimentoPayload(f, 'registrar');
    expect(r.dataHora).toBe('2026-11-12T10:00:00');
    expect([r.assunto, r.fatosCliente, r.analiseJuridica]).toEqual(['HORAS EXTRAS', 'RELATO', null]);
    expect(r.pessoas[0]).toEqual({ idPessoa: null, nome: 'JOSÉ', cpf: '52998224725', telefone: '82999990000' });
    expect(r.idsColaboradores).toEqual([31]);
    const a = toAtendimentoPayload(f, 'agendar');
    expect('fatosCliente' in a).toBe(false);
    expect('id' in a).toBe(false);
  });
});
