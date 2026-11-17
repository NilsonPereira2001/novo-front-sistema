import { estadoComPessoa, pessoaLevada, situacaoValida, toFicha, toListaParams, toPaginaPessoas } from './pessoas-juridico-api';

describe('pessoas-juridico-api', () => {
  it('lista: página e parâmetros só com filtros preenchidos', () => {
    const pg = toPaginaPessoas({
      content: [{ id: 5, nome: 'ANA', cpf: '52998224725', processos: 2, atendimentos: 1, ultimoAtendimento: '2026-11-10T09:30:00' }, { nome: 'SEM ID' }],
      totalElements: 1, totalPages: 1, number: 0, size: 20,
    });
    expect(pg.content.length).toBe(1);
    expect(pg.content[0].ultimoAtendimento).toBe('2026-11-10T09:30:00');
    expect(toListaParams({ page: 0, size: 20 }).toString()).toBe('page=0&size=20');
    expect(toListaParams({ page: 1, size: 20, filtro: ' ana ', situacao: 'COM_PROCESSO' }).toString()).toBe('page=1&size=20&filtro=ana&situacao=COM_PROCESSO');
    expect(situacaoValida('com_atendimento')).toBe('COM_ATENDIMENTO');
    expect(situacaoValida('xyz')).toBe('');
  });

  it('ficha: pessoa, totais, processos, atendimentos (mais recentes primeiro) e arquivos', () => {
    const f = toFicha({
      pessoa: { id: 5, nome: 'ANA', cpf: '52998224725', dataNascimento: '1990-02-03', endereco: 'RUA A, 10' },
      totais: { processos: 1, processosAtivos: 1, atendidos: 2, proximaAudiencia: '2026-12-01', ultimoAtendimento: '2026-11-10T09:30:00' },
      processos: [{ id: 3, numeroProcesso: '00012344620248020001', status: 'EM ANDAMENTO', partes: ['AUTOR', 7] }],
      atendimentos: [
        { id: 1, status: 'ATENDIDO', dataHora: '2026-10-01T10:00:00' },
        { id: 2, status: 'ATENDIDO', dataHora: '2026-11-10T09:30:00', qtdAnexos: 1 },
      ],
      arquivos: [{ id: 9, nome: 'rg.pdf', tamanho: 100, idAtendimento: 2 }],
      pendenciasProcuracao: ['RG', 3],
    });
    expect(f.pessoa.dataNascimento).toBe('1990-02-03');
    expect(f.totais.proximaAudiencia).toBe('2026-12-01');
    expect(f.processos[0].partes).toEqual(['AUTOR']);
    expect(f.atendimentos.map((a) => a.id)).toEqual([2, 1]);
    expect(f.arquivos[0].idAtendimento).toBe(2);
    expect(f.pendenciasProcuracao).toEqual(['RG']);
  });

  it('ficha sem pessoa é formato inesperado', () => {
    let erro = '';
    try {
      toFicha({ totais: {} });
    } catch (e) {
      erro = (e as Error).name;
    }
    expect(erro).toBe('UnexpectedResponseError');
  });

  it('pessoa levada para os formulários pelo state da navegação', () => {
    const st = estadoComPessoa({ id: 5, nome: 'ANA', cpf: '52998224725', telefone: '82999990000' } as never);
    expect(pessoaLevada(st)).toEqual({ idPessoa: 5, nome: 'ANA', cpf: '52998224725', telefone: '82999990000' });
    expect(pessoaLevada({ navigationId: 3 })).toBeNull();
    expect(pessoaLevada(null)).toBeNull();
  });
});
