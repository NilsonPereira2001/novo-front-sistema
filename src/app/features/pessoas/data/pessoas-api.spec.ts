import { toPage } from '../../../shared/data/page.model';
import { PESSOAS_PAGE_SIZE_PADRAO, toListarParams, toPessoaDTO } from './pessoas-api';

describe('toListarParams', () => {
  it('consulta inicial envia só page e size', () => {
    expect(toListarParams({ page: 0, size: PESSOAS_PAGE_SIZE_PADRAO }).toString()).toBe(
      'page=0&size=7',
    );
  });

  it('envia filtro sem espaços nas pontas', () => {
    const params = toListarParams({ filtro: '  Maria ', page: 0, size: 7 });
    expect(params.get('filtro')).toBe('Maria');
  });

  it('não envia filtro vazio', () => {
    expect(toListarParams({ filtro: '   ', page: 0, size: 7 }).has('filtro')).toBe(false);
  });

  it('envia filtro e tipo juntos', () => {
    const params = toListarParams({ filtro: 'Maria', idTipoPessoa: 1, page: 0, size: 7 });
    expect(params.get('filtro')).toBe('Maria');
    expect(params.get('idTipoPessoa')).toBe('1');
  });

  it('não envia idTipoPessoa quando não selecionado', () => {
    expect(toListarParams({ page: 2, size: 15 }).has('idTipoPessoa')).toBe(false);
  });
});

describe('toPage com PessoaDTO', () => {
  const pageImpl = {
    content: [
      {
        id: 1,
        cpf: '12345678901',
        nome: 'Maria',
        dataCadastro: '2026-10-15T14:28:23.309Z',
        tipo: 'ASSOCIADO',
        status: 'ATIVO',
        restricao: false,
        telefonePrincipal: '82999998888',
      },
      { id: 2, cpf: null, nome: null, dataCadastro: 'invalida', tipo: null, status: null },
      { nome: 'sem id' },
    ],
    totalElements: 9,
    totalPages: 2,
    size: 7,
    number: 1,
    first: false,
    last: true,
    numberOfElements: 2,
    empty: false,
  };

  it('lê o Page do Spring e descarta itens sem id', () => {
    const page = toPage(pageImpl, toPessoaDTO);
    expect(page?.content.length).toBe(2);
    expect(page?.totalElements).toBe(9);
    expect(page?.number).toBe(1);
    expect(page?.last).toBe(true);
  });

  it('trata campos nulos e data inválida sem quebrar', () => {
    const pessoa = toPage(pageImpl, toPessoaDTO)?.content[1];
    expect(pessoa?.dataCadastro).toBeNull();
    expect(pessoa?.restricao).toBeNull();
    expect(pessoa?.telefonePrincipal).toBeNull();
  });

  it('aceita o formato PagedModel', () => {
    const page = toPage(
      { content: [], page: { size: 7, number: 0, totalElements: 0, totalPages: 0 } },
      toPessoaDTO,
    );
    expect(page?.empty).toBe(true);
    expect(page?.first).toBe(true);
  });

  it('rejeita respostas fora do formato', () => {
    expect(toPage([{ id: 1 }], toPessoaDTO)).toBeNull();
    expect(toPage({ content: [] }, toPessoaDTO)).toBeNull();
  });
});
