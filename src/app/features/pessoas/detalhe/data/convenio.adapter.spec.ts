import { ordenarConvenios, toConvenioDoMembro, toConvenioOpcao } from './convenio.adapter';

/** ConvenioAssociado como o Jackson serializa (associado tem @JsonBackReference e não vem). */
const vinculo = (over: Record<string, unknown> = {}) => ({
  id: 9,
  dataAdesao: '2025-02-01T12:00:00Z',
  dataExclusao: null,
  convenio: { id: 4, fixo: true, nativo: false, nome: 'PLANO ODONTOLÓGICO', nomeFantasia: 'ODONTO+', valor: 32.9, status: 'ATIVO' },
  status: 'ATIVO',
  ...over,
});

describe('convenio.adapter', () => {
  it('lê o vínculo: id do ConvenioAssociado, id do Convenio, valor e datas', () => {
    expect(toConvenioDoMembro(vinculo())).toEqual({
      id: 9,
      convenioId: 4,
      nome: 'PLANO ODONTOLÓGICO',
      fixo: true,
      nativo: false,
      valor: 32.9,
      dataAdesao: '2025-02-01T12:00:00Z',
      dataExclusao: null,
      status: 'ATIVO',
    });
  });

  it('dataExclusao (LocalDateTime) em texto ou lista', () => {
    expect(toConvenioDoMembro(vinculo({ status: 'DESLIGADO', dataExclusao: '2026-11-10T15:20:11.5' }))?.dataExclusao).toBe('2026-11-10T15:20:11');
    expect(toConvenioDoMembro(vinculo({ dataExclusao: [2026, 11, 10, 15, 20, 11] }))?.dataExclusao).toBe('2026-11-10T15:20:11');
  });

  it('descarta vínculo sem convênio', () => {
    expect(toConvenioDoMembro({ id: 1, status: 'ATIVO' })).toBeNull();
  });

  it('opção de convênio para adicionar traz o valor mensal', () => {
    const o = toConvenioOpcao({ id: 4, nome: 'PLANO ODONTOLÓGICO', valor: 32.9 }, 'en-US');
    expect(o?.id).toBe(4);
    expect(o?.label).toBe('PLANO ODONTOLÓGICO');
    expect(o?.detalhe?.endsWith('por mês')).toBe(true);
  });

  it('ordena ativos por nome e depois o histórico mais recente', () => {
    const a = toConvenioDoMembro(vinculo({ id: 1, convenio: { id: 1, nome: 'SEGURO', fixo: true } }))!;
    const b = toConvenioDoMembro(vinculo({ id: 2, convenio: { id: 2, nome: 'ODONTO', fixo: true } }))!;
    const c = toConvenioDoMembro(vinculo({ id: 3, status: 'DESLIGADO', dataExclusao: '2025-01-01T00:00:00', convenio: { id: 3, nome: 'A', fixo: true } }))!;
    const d = toConvenioDoMembro(vinculo({ id: 4, status: 'DESLIGADO', dataExclusao: '2026-01-01T00:00:00', convenio: { id: 4, nome: 'B', fixo: true } }))!;
    expect(ordenarConvenios([c, a, d, b]).map((x) => x.id)).toEqual([2, 1, 4, 3]);
  });
});
