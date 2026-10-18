import { toOpcao } from './opcao.model';

describe('toOpcao', () => {
  it('usa os campos de rótulo informados', () => {
    expect(toOpcao({ id: 1, sexo: 'Feminino' }, ['sexo'])).toEqual({ id: 1, label: 'Feminino' });
    expect(toOpcao({ id: 2, forma: 'Boleto' }, ['forma'])).toEqual({ id: 2, label: 'Boleto' });
  });

  it('usa o único campo de texto quando o nome do campo não é conhecido', () => {
    expect(toOpcao({ id: 3, sexo: 'Masculino' })).toEqual({ id: 3, label: 'Masculino' });
  });

  it('não adivinha quando há mais de um campo de texto desconhecido', () => {
    expect(toOpcao({ id: 4, codigo: 'X', apelido: 'Y' })).toBeNull();
  });

  it('descarta itens sem id', () => {
    expect(toOpcao({ sexo: 'Feminino' }, ['sexo'])).toBeNull();
  });
});
