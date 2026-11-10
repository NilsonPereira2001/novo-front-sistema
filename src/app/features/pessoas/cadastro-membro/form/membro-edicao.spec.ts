import { toAssociadoEdicaoPayload, toDadosEdicao } from './membro-edicao';

/** AssociadoNovoDTO como o AssociadoMapper.listarDadosEditarAssociado devolve. */
function dto(): Record<string, unknown> {
  return {
    id: 501,
    dataCadastro: '2025-01-10T12:00:00Z',
    foto: 'data:image/png;base64,iVBORw0KGgo',
    cpf: '52998224725',
    nome: 'MARIA SOUZA',
    nomeGuerra: 'SOUZA',
    dataNascimento: '1984-07-19',
    sexo: { id: 2, sexo: 'Feminino' },
    estadoCivil: { id: 1, nome: 'Casada' },
    email: 'maria@exemplo.com',
    rg: '123',
    matricula: '7788',
    naturalidade: 'MACEIÓ',
    tipoPessoa: { id: 1, nome: 'AFILIADO' },
    cep: '57020000',
    logradouro: 'RUA A',
    numero: '10',
    complemento: null,
    estado: { id: 2, nome: 'Alagoas' },
    cidade: 'MACEIÓ',
    bairro: 'CENTRO',
    telefones: [{ id: 1, telefone: '82999998888', principal: true }],
    banco: { id: 104, nome: 'Caixa' },
    tipoConta: 'CORRENTE',
    agencia: '0055',
    numeroConta: '1-3',
    tipoPix: { id: 1, tipo: 'CPF' },
    chavePix: '52998224725',
    formaPagamento: { id: 1, forma: 'Desconto em folha' },
    tipoVinculo: { id: 1, nome: 'MILITAR' },
    instituicao: { id: 20, nome: 'PMAL' },
    unidade: { id: 9, nome: '1º BPM' },
    graduacao: { id: 3, nome: 'Cabo' },
    quadro: { id: 2, nome: 'QPMP-0' },
    dataIncorporacao: [2008, 5, 2],
    tipoSocio: { id: 1, nome: 'Efetivo' },
    associadoIndicador: { id: 504, pessoa: { id: 4, nome: 'FERNANDA ROCHA' } },
    empresaConveniada: null,
    convenios: [{ id: 1, nome: 'ODONTO' }, { id: 9, nome: 'MENSALIDADE' }],
    nomePai: 'JOÃO SOUZA',
    nomeMae: null,
  };
}

describe('membro-edicao', () => {
  it('converte o DTO de edição no valor do formulário', () => {
    const d = toDadosEdicao(dto())!;
    expect(d.idAssociado).toBe(501);
    expect(d.valor.pessoais.cpf).toBe('529.982.247-25');
    expect(d.valor.pessoais.sexo).toBe(2);
    expect(d.valor.endereco.cep).toBe('57020-000');
    expect(d.valor.endereco.complemento).toBe('');
    expect(d.valor.telefones).toEqual([{ telefone: '(82) 99999-8888', principal: true }]);
    expect(d.valor.vinculo.dataIncorporacao).toBe('2008-05-02');
    expect(d.valor.vinculo.unidade).toBe(9);
    expect(d.valor.adesao.associadoIndicador).toEqual({ id: 504, label: 'FERNANDA ROCHA' });
    expect(d.valor.adesao.convenios).toEqual([1, 9]);
    expect(d.valor.familia).toEqual({ nomePai: 'JOÃO SOUZA', nomeMae: '' });
  });

  it('rejeita resposta sem id ou nome', () => {
    expect(toDadosEdicao({ nome: 'X' })).toBeNull();
    expect(toDadosEdicao(null)).toBeNull();
  });

  it('PUT leva o id do Associado, mantém a foto e não envia convênios', () => {
    const d = toDadosEdicao(dto())!;
    const payload = toAssociadoEdicaoPayload(d.valor, d.idAssociado) as unknown as Record<string, unknown>;
    expect(d.valor.adesao.dataAdesao).toBe('2025-01-10');
    expect(payload['id']).toBe(501);
    expect(payload['foto']).toBe('data:image/png;base64,iVBORw0KGgo');
    expect('convenios' in payload).toBe(false);
    expect('dataCadastro' in payload).toBe(false);
    expect(payload['associadoIndicador']).toEqual({ id: 504 });
    expect(payload['cpf']).toBe('52998224725');
  });

  it('foto removida vai como "" (o backend apaga); sem mexer, vai a atual', () => {
    const d = toDadosEdicao(dto())!;
    const semFoto = { ...d.valor, pessoais: { ...d.valor.pessoais, foto: null } };
    expect((toAssociadoEdicaoPayload(semFoto, 501) as unknown as Record<string, unknown>)['foto']).toBe('');
  });
});
