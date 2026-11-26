import {
  agruparPorData,
  daProntuario,
  diaSemana,
  diasDoMes,
  emAberto,
  faixaImc,
  horaTexto,
  imc,
  numeroBr,
  problemaCid,
  somarDias,
  status,
  temSinais,
  toAgendamento,
  toDetalhe,
  toDias,
  toFicha,
  toProntuario,
  toProntuarioPayload,
  toServicos,
  toSinaisPayload,
  SINAIS_VAZIO,
} from './saude-api';

const ag = {
  id: 5, idRegistro: 50, dataHora: '2026-12-01T08:30:00', horaMarcada: true, status: 'agendado', categoria: 'exame',
  idServico: 3, servico: 'ULTRASSOM', idProfissional: 9, profissional: 'DRA. ANA', idPessoa: 70, paciente: 'MARIA',
};

describe('saúde: adaptadores', () => {
  it('agendamento e status', () => {
    const a = toAgendamento(ag);
    expect(a?.categoria).toBe('EXAME');
    expect(a?.status).toBe('AGENDADO');
    expect(status('NAO ATENDIDO')).toBe('NÃO ATENDIDO');
    expect(status('presente')).toBe('PRESENTE');
    expect(toAgendamento({ servico: 'X' })).toBeNull();
    expect(horaTexto({ dataHora: '2026-12-01T08:30:00', horaMarcada: true })).toBe('08:30');
    expect(horaTexto({ dataHora: '2026-12-01T00:00:00', horaMarcada: false })).toBe('Ordem de chegada');
    expect(emAberto('PRESENTE')).toBe(true);
    expect(emAberto('CANCELADO')).toBe(false);
  });

  it('ficha, detalhe e serviços', () => {
    const f = toFicha({ idPessoa: 70, nome: 'MARIA', direito: 'dependente', telefones: ['82999998888', ''], alergias: ['DIPIRONA'], contagem: { faltas: 2 }, proximos: [ag, {}], podeVerProntuario: true });
    expect(f.direito).toBe('DEPENDENTE');
    expect(f.telefones.length).toBe(1);
    expect(f.contagem.faltas).toBe(2);
    expect(f.proximos.length).toBe(1);
    expect(toFicha({ idPessoa: 1, direito: 'qualquer' }).direito).toBe('SEM_DIREITO');
    const d = toDetalhe({ agendamento: ag, orientacoes: 'JEJUM', anexos: [{ id: 1, idAtendimento: 5, nome: 'laudo.pdf' }], clinico: true });
    expect(d.clinico).toBe(true);
    expect(d.anexos[0].nome).toBe('laudo.pdf');
    let erro = false;
    try { toDetalhe({}); } catch { erro = true; }
    expect(erro).toBe(true);
    const s = toServicos([{ id: 1, nome: 'CARDIOLOGIA' }, { id: 2, nome: 'RAIO X', categoria: 'EXAME', ativo: false }]);
    expect(s[0].categoria).toBe('CONSULTA');
    expect(s[0].ativo).toBe(true);
    expect(s[1].ativo).toBe(false);
  });

  it('prontuário: ida e volta', () => {
    const p = toProntuario({
      existe: true, tabagismo: true, frequenciaTabagismo: '10/DIA', alergias: ['DIPIRONA'],
      antecedentesFamiliares: [{ comorbidade: 'DIABETES', idParentesco: 2, parentesco: 'MÃE' }, { idParentesco: 3 }],
      sinaisVitais: [{ id: 1, data: '2026-11-01T12:00:00Z', peso: 80, altura: 1.8, imc: 24.7 }], parentescos: [{ id: 2, nome: 'MÃE' }],
    });
    expect(p.antecedentesFamiliares.length).toBe(1);
    expect(p.sinaisVitais[0].imc).toBe(24.7);
    const v = daProntuario(p);
    v.alergias.push(' dipirona ', 'látex');
    v.etilismo = false;
    v.frequenciaEtilismo = 'X';
    const payload = toProntuarioPayload(v);
    expect(payload.alergias).toEqual(['DIPIRONA', 'LÁTEX']);
    expect(payload.frequenciaEtilismo).toBeNull();
    expect(payload.frequenciaTabagismo).toBe('10/DIA');
  });
});

describe('saúde: regras', () => {
  it('sinais vitais e IMC', () => {
    expect(temSinais(SINAIS_VAZIO)).toBe(false);
    expect(numeroBr('1,70')).toBe(1.7);
    expect(numeroBr('abc')).toBeNull();
    const s = toSinaisPayload({ ...SINAIS_VAZIO, peso: '80,5', altura: '175' });
    expect(s.altura).toBe(1.75);
    expect(s.peso).toBe(80.5);
    expect(imc(80, 1.8)).toBe(24.7);
    expect(imc(80, 180)).toBe(24.7);
    expect(imc(null, 1.8)).toBeNull();
    expect(faixaImc(31)).toBe('Obesidade');
    expect(faixaImc(17)).toBe('Abaixo do peso');
  });

  it('CID', () => {
    expect(problemaCid('')).toBeNull();
    expect(problemaCid('j06.9')).toBeNull();
    expect(problemaCid('I10')).toBeNull();
    expect(problemaCid('123')).toBe('CID inválido (ex.: J06.9).');
  });

  it('datas e agrupamento', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(diasDoMes(2026, 2).length).toBe(28);
    expect(diaSemana('2026-11-26')).toBe(4);
    const dias = toDias([
      { id: 1, data: '2026-12-02', idProfissional: 1, profissional: 'B', idServico: 3, servico: 'S', vagas: 10, ocupadas: 2, livres: 8 },
      { id: 2, data: '2026-12-01', idProfissional: 2, profissional: 'A', idServico: 3, servico: 'S', vagas: 5, ocupadas: 5, livres: 0 },
      { id: 3, data: '2026-12-02', idProfissional: 2, profissional: 'A', idServico: 3, servico: 'S', vagas: 5, ocupadas: 1, livres: 4 },
      { id: 4 },
    ]);
    expect(dias.length).toBe(3);
    const g = agruparPorData(dias);
    expect(g[0].data).toBe('2026-12-01');
    expect(g[1].livres).toBe(12);
  });
});
