import { daPessoa, ehTerceirizado, pisValido, tempoDeCasa, toFicha, toItem, toPayload, toVerificacao, ColaboradorFormValor } from './colaboradores-api';

const pessoa = {
  idPessoa: 10, cpf: '52998224725', nome: 'JOÃO DA SILVA', dataNascimento: '1990-03-15', idSexo: 1,
  telefones: [{ telefone: '82999998888', principal: true }, { telefone: '' }], cep: '57000000', foto: 'javascript:x',
};

const base: ColaboradorFormValor = {
  foto: null, cpf: '529.982.247-25', nome: ' joão  da silva ', nomeGuerra: '', dataNascimento: '1990-03-15', idSexo: 1, idEstadoCivil: null,
  rg: '', naturalidade: 'maceió', email: ' Joao@X.com ', nomePai: '', nomeMae: 'maria', tituloEleitor: '1234 5678 9012',
  telefones: [{ telefone: '(82) 99999-8888', principal: true }, { telefone: '', principal: false }],
  cep: '57000-000', logradouro: 'rua a', numero: '10', complemento: '', idEstado: 2, cidade: 'maceió', bairro: 'centro',
  idBanco: null, tipoConta: '', agencia: '', numeroConta: '', idTipoPix: null, chavePix: 'Joao@X.com',
  idCargo: 1, idDepartamento: 2, idTipoContratacao: 3, idTerceirizada: null, dataAdmissao: '2026-01-05', salario: '2.500,00',
  ctps: '123', pis: '', oab: '',
};

describe('colaboradores: adaptadores', () => {
  it('item e verificação', () => {
    const i = toItem({ id: 1, idPessoa: 10, nome: 'JOÃO', status: 'ativo', temUsuario: true });
    expect(i?.status).toBe('ATIVO');
    expect(toItem({ id: 2, nome: 'X', status: 'qualquer' })?.status).toBe('DESLIGADO');
    expect(toItem({ nome: 'sem id' })).toBeNull();
    const v = toVerificacao({ cpf: '52998224725', pessoaExiste: true, pessoa, associado: 'ATIVO', dependente: false });
    expect(v.pessoa?.foto).toBeNull();
    expect(v.pessoa?.telefones.length).toBe(1);
    expect(v.idColaboradorAtivo).toBeNull();
  });

  it('ficha exige colaborador e pessoa', () => {
    const f = toFicha({ colaborador: { id: 1, idPessoa: 10, nome: 'JOÃO', status: 'ATIVO' }, pessoa, funcional: { cargo: 'AUXILIAR', salario: 2500 }, pendencias: { diasAgendaFuturos: 3 } });
    expect(f.funcional.salario).toBe(2500);
    expect(f.pendencias.diasAgendaFuturos).toBe(3);
    let erro = false;
    try { toFicha({ colaborador: { id: 1 } }); } catch { erro = true; }
    expect(erro).toBe(true);
  });
});

describe('colaboradores: formulário e regras', () => {
  it('monta o payload', () => {
    const p = toPayload(base);
    expect(p.cpf).toBe('52998224725');
    expect(p.nome).toBe('JOÃO DA SILVA');
    expect(p.email).toBe('joao@x.com');
    expect(p.chavePix).toBe('Joao@X.com');
    expect(p.naturalidade).toBe('MACEIÓ');
    expect(p.tituloEleitor).toBe('123456789012');
    expect(p.telefones.length).toBe(1);
    expect(p.telefones[0].telefone).toBe('82999998888');
    expect(p.salario).toBe(2500);
    expect(p.cep).toBe('57000000');
    expect(p.complemento).toBeNull();
    expect('id' in p).toBe(false);
  });

  it('preenche a partir da pessoa e do vínculo', () => {
    const v = toVerificacao({ pessoaExiste: true, pessoa });
    const d = daPessoa(v.pessoa!, { idCargo: 1, cargo: null, idDepartamento: 2, departamento: null, idTipoContratacao: 3, tipoContratacao: null, idTerceirizada: null, terceirizada: null, dataAdmissao: '2026-01-05', salario: 1500.5, ctps: null, pis: null, oab: null, dataDesligamento: null, motivoDesligamento: null });
    expect(d.cpf).toBe('529.982.247-25');
    expect(d.cep).toBe('57000-000');
    expect(d.telefones?.[0].telefone).toBe('(82) 99999-8888');
    expect(d.salario).toBe('1500,50');
    expect(daPessoa(v.pessoa!).idCargo).toBeUndefined();
  });

  it('PIS, terceirizado e tempo de casa', () => {
    expect(pisValido('120.56412.54-5')).toBe(true);
    expect(pisValido('12056412541')).toBe(false);
    expect(pisValido('11111111111')).toBe(false);
    expect(pisValido('123')).toBe(false);
    expect(ehTerceirizado('TERCEIRIZADO')).toBe(true);
    expect(ehTerceirizado('CLT')).toBe(false);
    expect(tempoDeCasa('2024-08-26', null, new Date(2026, 10, 26))).toBe('2 anos e 3 meses');
    expect(tempoDeCasa('2026-11-20', null, new Date(2026, 10, 26))).toBe('menos de 1 mês');
    expect(tempoDeCasa('2020-01-01', '2021-01-01')).toBe('1 ano');
  });
});
