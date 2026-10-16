import { FormControl } from '@angular/forms';

import { applyMask } from '../utils/masks';
import {
  cepValidator,
  cpfValidator,
  isoDateValidator,
  minYearValidator,
  notFutureDateValidator,
  telefoneValidator,
} from './brazil.validators';

const c = (value: string) => new FormControl(value);

describe('validadores', () => {
  it('CPF: aceita válido (com ou sem máscara) e vazio', () => {
    expect(cpfValidator(c('529.982.247-25'))).toBeNull();
    expect(cpfValidator(c('52998224725'))).toBeNull();
    expect(cpfValidator(c(''))).toBeNull();
  });

  it('CPF: rejeita dígitos errados, repetidos ou incompletos', () => {
    expect(cpfValidator(c('529.982.247-26'))).toEqual({ cpf: true });
    expect(cpfValidator(c('111.111.111-11'))).toEqual({ cpf: true });
    expect(cpfValidator(c('123'))).toEqual({ cpf: true });
  });

  it('CEP e telefone', () => {
    expect(cepValidator(c('57000-000'))).toBeNull();
    expect(cepValidator(c('5700'))).toEqual({ cep: true });
    expect(telefoneValidator(c('(82) 99999-8888'))).toBeNull();
    expect(telefoneValidator(c('(82) 3333-4444'))).toBeNull();
    expect(telefoneValidator(c('9999'))).toEqual({ telefone: true });
  });

  it('datas', () => {
    expect(isoDateValidator(c('2024-02-29'))).toBeNull();
    expect(isoDateValidator(c('2023-02-29'))).toEqual({ data: true });
    expect(notFutureDateValidator(c('2999-01-01'))).toEqual({ dataFutura: true });
    expect(minYearValidator(1900)(c('0198-01-01'))).toEqual({ dataMinima: { year: 1900 } });
  });
});

describe('máscaras', () => {
  it('formatam enquanto digita', () => {
    expect(applyMask('cpf', '52998224725')).toBe('529.982.247-25');
    expect(applyMask('cpf', '5299')).toBe('529.9');
    expect(applyMask('cep', '57000000')).toBe('57000-000');
    expect(applyMask('telefone', '82999998888')).toBe('(82) 99999-8888');
    expect(applyMask('telefone', '8233334444')).toBe('(82) 3333-4444');
    expect(applyMask('telefone', '829')).toBe('(82) 9');
  });
});
