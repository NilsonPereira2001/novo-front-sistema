import { applyMask } from '../../../../shared/utils/masks';
import { daFicha, exigeValor, isCnpjValido, problemaDocumento, toPayload, ConvenioFormValor } from '../form/convenio-regras';
import { classeValida, emAberto, toAderente, toFicha, toItem, toSalvo } from './convenios-api';

const fichaBruta = {
  convenio: {
    id: 3, nome: 'MENSALIDADE', classe: 'NATIVO', nativo: true, fixo: true, valor: 35.5, status: 'ativo',
    cpfcnpj: '11222333000181', publico: { id: 1, tipo: 'EFETIVO' }, aderentes: 120,
  },
  endereco: { cep: '57000000', cidade: 'MACEIÓ', uf: 'AL', idEstado: 2 },
  aderentesAtivos: 118, aderentesDesligados: 4, aderentesAssociadosAtivos: 110, receitaMensalPrevista: 4189,
  associadosSemAdesao: 7,
  debitos: [
    { status: 'PAGO', quantidade: 100, valor: 3550 },
    { status: 'EM ABERTO', quantidade: 3, valor: 106.5 },
    { status: 'NÃO DEBITADO', quantidade: 2, valor: 71 },
  ],
  lancamentos: [{ idLancamento: 9, nsa: 41, dataGeracao: '2026-10-01T08:00:00', debitos: 105, valor: 3727.5, pago: 3550 }],
};

const formBase: ConvenioFormValor = {
  nome: ' odonto sorriso ', nomeFantasia: '', tipo: 'JURIDICA', cpfcnpj: '11.222.333/0001-81', classe: 'NATIVO',
  valor: '1.234,50', relancaPendencia: true, associadosAntigos: true, idPublico: null,
  cep: '57000-000', logradouro: 'rua a', numero: '10', complemento: '', bairro: 'centro', cidade: 'maceió', idEstado: 2,
};

describe('convênios: adaptadores', () => {
  it('normaliza classe e item', () => {
    expect(classeValida('fixo')).toBe('FIXO');
    expect(classeValida(null)).toBe('AVULSO');
    const i = toItem(fichaBruta.convenio);
    expect(i?.classe).toBe('NATIVO');
    expect(i?.status).toBe('ATIVO');
    expect(i?.publico?.tipo).toBe('EFETIVO');
    expect(toItem({ nome: 'SEM ID' })).toBeNull();
  });

  it('lê a ficha e soma o que está em aberto', () => {
    const f = toFicha(fichaBruta);
    expect(f.associadosSemAdesao).toBe(7);
    expect(f.lancamentos[0].nsa).toBe(41);
    expect(emAberto(f.debitos)).toEqual({ quantidade: 5, valor: 177.5 });
    expect(toSalvo({ ficha: fichaBruta, aplicados: 7 }).aplicados).toBe(7);
  });

  it('ficha sem convênio é resposta inválida', () => {
    let erro = false;
    try { toFicha({ endereco: {} }); } catch { erro = true; }
    expect(erro).toBe(true);
  });

  it('lê aderente', () => {
    const a = toAderente({ idAdesao: 5, idAssociado: 8, nome: 'MARIA', cpf: '12345678909', status: 'ativo' });
    expect(a?.idAssociado).toBe(8);
    expect(toAderente({ nome: 'X' })).toBeNull();
  });
});

describe('convênios: regras', () => {
  it('valida CPF/CNPJ', () => {
    expect(isCnpjValido('11222333000181')).toBe(true);
    expect(isCnpjValido('11222333000182')).toBe(false);
    expect(isCnpjValido('11111111111111')).toBe(false);
    expect(problemaDocumento('')).toBeNull();
    expect(problemaDocumento('529.982.247-25')).toBeNull();
    expect(problemaDocumento('123')).toBe('documento');
  });

  it('nativo e fixo exigem valor', () => {
    expect(exigeValor('NATIVO')).toBe(true);
    expect(exigeValor('FIXO')).toBe(true);
    expect(exigeValor('AVULSO')).toBe(false);
  });

  it('monta o payload: nativo é fixo, maiúsculas, só dígitos', () => {
    const p = toPayload(formBase, false);
    expect(p.nome).toBe('ODONTO SORRISO');
    expect(p.nativo).toBe(true);
    expect(p.fixo).toBe(true);
    expect(p.associadosAntigos).toBe(true);
    expect(p.cpfcnpj).toBe('11222333000181');
    expect(p.cep).toBe('57000000');
    expect(p.valor).toBe(1234.5);
    expect(p.cidade).toBe('MACEIÓ');
    expect(p.nomeFantasia).toBeNull();
    expect('id' in p).toBe(false);
  });

  it('associados antigos só na criação e só para nativo', () => {
    expect(toPayload(formBase, true).associadosAntigos).toBe(false);
    expect(toPayload({ ...formBase, classe: 'FIXO' }, false).associadosAntigos).toBe(false);
    const avulso = toPayload({ ...formBase, classe: 'AVULSO' }, false);
    expect(avulso.fixo).toBe(false);
    expect(avulso.nativo).toBe(false);
  });

  it('preenche o formulário a partir da ficha', () => {
    const v = daFicha(toFicha(fichaBruta));
    expect(v.cpfcnpj).toBe('11.222.333/0001-81');
    expect(v.cep).toBe('57000-000');
    expect(v.valor).toBe('35,50');
    expect(v.idPublico).toBe(1);
    expect(v.associadosAntigos).toBe(false);
  });

  it('máscara de documento alterna CPF/CNPJ', () => {
    expect(applyMask('documento', '52998224725')).toBe('529.982.247-25');
    expect(applyMask('documento', '11222333000181')).toBe('11.222.333/0001-81');
  });
});
