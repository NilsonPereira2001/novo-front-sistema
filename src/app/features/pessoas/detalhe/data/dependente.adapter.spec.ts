import { relacaoComTitular, toDependenteResumo, toNovoDependentePayload, toPessoaDetalheDeDependente } from './dependente.adapter';

/** DependentePessoa como o Jackson serializa (pessoa e pessoaTitular são Pessoa). */
function dependenteJson(): Record<string, unknown> {
  return {
    id: 31,
    parentesco: { id: 1, nome: 'FILHO(A)' },
    pessoa: {
      id: 120,
      nome: 'Lucas Moura',
      cpf: '11144477735',
      data_nascimento: '2012-09-03',
      tipo: { id: 3, nome: 'DEPENDENTE' },
      sexo: { id: 1, sexo: 'Masculino' },
      status: 'ATIVO',
      restricao: null,
      endereco: { id: 50, cep: null, logradouro: null, numero: null, complemento: null, estado: null, cidade: null, bairro: null },
      telefones: [],
    },
    pessoaTitular: { id: 1, nome: 'Ana Beatriz Moura', cpf: '52998224725' },
    agregado: true,
    vinculoAgregado: { id: 2, nome: 'UNIVERSITÁRIO' },
    dataInclusao: '2026-11-05T19:00:00Z',
    dataExclusao: null,
    status: 'ATIVO',
  };
}

describe('dependente.adapter', () => {
  it('linha da aba usa o id da Pessoa do dependente', () => {
    expect(toDependenteResumo(dependenteJson())).toEqual({
      id: 120,
      nome: 'Lucas Moura',
      cpf: '11144477735',
      parentesco: 'FILHO(A)',
      dataNascimento: '2012-09-03',
      status: 'ATIVO',
      agregado: true,
      vinculoAgregado: 'UNIVERSITÁRIO',
    });
    expect(toDependenteResumo({ id: 1 })).toBeNull();
  });

  it('detalhe do dependente traz titular, parentesco e agregado; endereço vazio vira null', () => {
    const d = toPessoaDetalheDeDependente(dependenteJson())!;
    expect(d.id).toBe(120);
    expect(d.dependenteId).toBe(31);
    expect(d.perfil).toBe('dependente');
    expect(d.origem).toBe('api');
    expect(d.endereco).toBeNull();
    expect(d.titular).toEqual({
      id: 1,
      nome: 'Ana Beatriz Moura',
      parentesco: 'FILHO(A)',
      agregado: true,
      vinculoAgregado: 'UNIVERSITÁRIO',
      dataInclusao: '2026-11-05T19:00:00Z',
    });
    expect(d.desligamento).toBeNull();
  });

  it('dependente INATIVO mostra a data de exclusão como desligamento', () => {
    const raw = dependenteJson();
    raw['status'] = 'INATIVO';
    raw['dataExclusao'] = '2026-11-06T12:00:00Z';
    expect(toPessoaDetalheDeDependente(raw)?.desligamento).toEqual({ data: '2026-11-06T12:00:00Z', motivo: null });
  });

  it('monta o DependenteNovoDTO sem id/dataCadastro e omite vazios', () => {
    const payload = toNovoDependentePayload(
      {
        nome: '  Lucas Moura ',
        cpf: '111.444.777-35',
        apelido: '',
        dataNascimento: '2012-09-03',
        idSexo: 1,
        idEstadoCivil: null,
        idParentesco: 1,
        naturalidade: '',
        email: '',
        agregado: false,
        idVinculoAgregado: 2,
      },
      1,
      3,
    );
    expect(payload).toEqual({
      nome: 'LUCAS MOURA',
      cpf: '11144477735',
      dataNascimento: '2012-09-03',
      tipoPessoa: { id: 3 },
      sexo: { id: 1 },
      parentesco: { id: 1 },
      pessoaTitular: { id: 1 },
      agregado: false,
    });
  });

  it('dependente direto envia só parentesco; agregado envia só o tipo de vínculo', () => {
    const base = { nome: 'X', cpf: '11144477735', apelido: '', dataNascimento: '', idSexo: null, idEstadoCivil: null, naturalidade: '', email: '' };
    const direto = toNovoDependentePayload({ ...base, agregado: false, idParentesco: 1, idVinculoAgregado: 2 }, 1, null);
    expect(direto['parentesco']).toEqual({ id: 1 });
    expect('vinculoAgregado' in direto).toBe(false);
    expect(direto['agregado']).toBe(false);
    const agregado = toNovoDependentePayload({ ...base, agregado: true, idParentesco: 1, idVinculoAgregado: 2 }, 1, null);
    expect(agregado['vinculoAgregado']).toEqual({ id: 2 });
    expect('parentesco' in agregado).toBe(false);
    expect(agregado['agregado']).toBe(true);
    expect('tipoPessoa' in agregado).toBe(false);
  });

  it('CPF é opcional: vazio não é enviado', () => {
    const payload = toNovoDependentePayload(
      { nome: 'Bebê Moura', cpf: '', apelido: '', dataNascimento: '2026-01-10', idSexo: null, idEstadoCivil: null, idParentesco: 1, naturalidade: '', email: '', agregado: false, idVinculoAgregado: null },
      1,
      2,
    );
    expect('cpf' in payload).toBe(false);
    expect(payload['nome']).toBe('BEBÊ MOURA');
  });

  it('descreve a relação com o titular', () => {
    expect(relacaoComTitular({ agregado: false, parentesco: 'FILHO(A)' })).toBe('FILHO(A)');
    expect(relacaoComTitular({ agregado: true, parentesco: null, vinculoAgregado: 'UNIVERSITÁRIO' })).toBe('Agregado — UNIVERSITÁRIO');
  });
});
