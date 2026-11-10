import { toIndicacao, toIndicadorOpcao, toIndicadoresParams } from './indicacao.adapter';

const dto = { idAssociado: 501, idPessoa: 77, nome: 'MARIA SOUZA', cpf: '52998224725', status: 'ATIVO', restricao: 'NÃO', primeiraAdesao: '2024-03-10T12:00:00Z' };

describe('indicacao.adapter', () => {
  it('a linha da aba usa o id da Pessoa (link) e a primeira adesão', () => {
    expect(toIndicacao(dto)).toEqual({ id: 77, nome: 'MARIA SOUZA', cpf: '52998224725', dataCadastro: '2024-03-10T12:00:00Z', status: 'ATIVO' });
    expect(toIndicacao({ idAssociado: 1, nome: 'Sem pessoa' })).toBeNull();
  });

  it('a opção de indicador usa o id do ASSOCIADO', () => {
    expect(toIndicadorOpcao(dto)).toEqual({ id: 501, label: 'MARIA SOUZA', detalhe: '529.982.247-25' });
    expect(toIndicadorOpcao({ idPessoa: 77, nome: 'Sem associado' })).toBeNull();
  });

  it('só envia filtro quando há texto', () => {
    expect(toIndicadoresParams('  maria ').toString()).toBe('filtro=maria');
    expect(toIndicadoresParams('   ').toString()).toBe('');
  });
});
