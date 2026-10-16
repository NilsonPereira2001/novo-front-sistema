import { toAssociadoNovoPayload } from './membro-payload';
import { MembroFormValue } from './membro-form';

function formVazio(): MembroFormValue {
  return {
    pessoais: {
      foto: null,
      cpf: '',
      nome: '',
      nomeGuerra: '',
      dataNascimento: '',
      sexo: null,
      estadoCivil: null,
      email: '',
      rg: '',
      matricula: '',
      naturalidade: '',
      tipoPessoa: null,
    },
    endereco: {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      estado: null,
      cidade: '',
      bairro: '',
    },
    telefones: [],
    bancarios: {
      banco: null,
      tipoConta: '',
      agencia: '',
      numeroConta: '',
      tipoPix: null,
      chavePix: '',
      formaPagamento: null,
    },
    vinculo: {
      tipoVinculo: null,
      instituicao: null,
      unidade: null,
      graduacao: null,
      quadro: null,
      dataIncorporacao: '',
    },
    adesao: { tipoSocio: null, associadoIndicador: null, empresaConveniada: null, convenios: [] },
    familia: { nomePai: '', nomeMae: '' },
  };
}

describe('toAssociadoNovoPayload', () => {
  it('envia só o mínimo quando nada opcional foi preenchido', () => {
    const v = formVazio();
    v.pessoais.cpf = '529.982.247-25';
    v.pessoais.nome = '  Maria Souza ';
    expect(toAssociadoNovoPayload(v, null)).toEqual({
      cpf: '52998224725',
      nome: 'Maria Souza',
      telefones: [],
      convenios: [],
    });
  });

  it('nunca envia id nem dataCadastro', () => {
    const payload = toAssociadoNovoPayload(formVazio(), null) as unknown as Record<string, unknown>;
    expect('id' in payload).toBe(false);
    expect('dataCadastro' in payload).toBe(false);
  });

  it('envia relacionamentos como { id } e datas em YYYY-MM-DD', () => {
    const v = formVazio();
    v.pessoais.sexo = 2;
    v.pessoais.dataNascimento = '1990-05-20';
    v.endereco.estado = 27;
    v.vinculo.tipoVinculo = 1;
    v.vinculo.instituicao = 4;
    v.vinculo.unidade = 9;
    v.adesao.associadoIndicador = { id: 15, label: 'João' };
    v.adesao.empresaConveniada = { id: 3, label: 'Empresa X' };
    v.adesao.convenios = [5, 7, 5];
    const payload = toAssociadoNovoPayload(v, null);
    expect(payload.sexo).toEqual({ id: 2 });
    expect(payload.dataNascimento).toBe('1990-05-20');
    expect(payload.estado).toEqual({ id: 27 });
    expect(payload.unidade).toEqual({ id: 9 });
    expect(payload.associadoIndicador).toEqual({ id: 15 });
    expect(payload.empresaConveniada).toEqual({ id: 3 });
    expect(payload.convenios).toEqual([{ id: 5 }, { id: 7 }]);
  });

  it('envia telefones só com dígitos, sem "pessoa" e com no máximo um principal', () => {
    const v = formVazio();
    v.telefones = [
      { telefone: '(82) 99999-8888', principal: true },
      { telefone: '(82) 3333-4444', principal: true },
      { telefone: '', principal: false },
    ];
    expect(toAssociadoNovoPayload(v, null).telefones).toEqual([
      { telefone: '82999998888', principal: true },
      { telefone: '8233334444', principal: false },
    ]);
  });

  it('só envia a foto quando o formato estiver configurado', () => {
    const v = formVazio();
    v.pessoais.foto = 'data:image/png;base64,AAAA';
    expect(toAssociadoNovoPayload(v, null).foto).toBeUndefined();
    expect(toAssociadoNovoPayload(v, 'data-url').foto).toBe('data:image/png;base64,AAAA');
    expect(toAssociadoNovoPayload(v, 'base64').foto).toBe('AAAA');
  });
});
