import { toPage } from '../../../shared/data/page.model';
import {
  PESSOAS_PAGE_SIZE_PADRAO,
  toIdTipoPessoa,
  toListarParams,
  toPessoaDTO,
  toTipoPessoa,
} from './pessoas-api';

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

describe('tipos de pessoa', () => {
  it('lê id e nome de GET /tipo/pessoas/listar', () => {
    expect(toTipoPessoa({ id: 1, nome: 'Associado' })).toEqual({ id: 1, nome: 'Associado' });
  });

  it('descarta itens sem id válido ou sem nome', () => {
    expect(toTipoPessoa({ nome: 'Sem id' })).toBeNull();
    expect(toTipoPessoa({ id: 0, nome: 'Zero' })).toBeNull();
    expect(toTipoPessoa({ id: 2, nome: '' })).toBeNull();
  });

  it('converte o valor do seletor em idTipoPessoa sem valores inválidos', () => {
    expect(toIdTipoPessoa('3')).toBe(3);
    expect(toIdTipoPessoa('')).toBeUndefined();
    expect(toIdTipoPessoa('null')).toBeUndefined();
    expect(toIdTipoPessoa('undefined')).toBeUndefined();
    expect(toIdTipoPessoa('abc')).toBeUndefined();
    expect(toIdTipoPessoa('2.5')).toBeUndefined();
    expect(toIdTipoPessoa(null)).toBeUndefined();
  });

  it('nunca envia idTipoPessoa inválido para a listagem', () => {
    expect(toListarParams({ idTipoPessoa: Number.NaN, page: 0, size: 7 }).has('idTipoPessoa')).toBe(
      false,
    );
  });
});
