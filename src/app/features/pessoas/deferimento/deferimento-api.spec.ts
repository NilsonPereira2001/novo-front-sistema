import { pedidoPendente } from '../detalhe/models/perfil-config';
import { filtrarPedidos, toIndeferirParams, toPedido } from './deferimento-api';

const adesao = { idAssociado: 501, idPessoa: 1, nome: 'MARIA SOUZA', cpf: '52998224725', restricao: 'AGUARDANDO ADESÃO', ultimaAdesao: '2026-11-01T12:00:00Z', dataDesligamento: null, motivoDesligamento: null, tipoVinculo: 'MILITAR', instituicao: 'PMAL' };
const deslig = { ...adesao, idAssociado: 504, idPessoa: 4, nome: 'JOSÉ LIMA', cpf: '11144477735', restricao: 'AGUARDANDO DESLIGAMENTO', dataDesligamento: '2026-11-05T12:00:00Z', motivoDesligamento: 'MUDANÇA DE CIDADE' };

describe('deferimento-api', () => {
  it('identifica o tipo do pedido pela restrição e usa a data certa', () => {
    const a = toPedido(adesao)!;
    expect([a.idAssociado, a.idPessoa, a.tipo, a.data, a.motivo]).toEqual([501, 1, 'adesao', '2026-11-01T12:00:00Z', null]);
    const d = toPedido(deslig)!;
    expect([d.tipo, d.data, d.motivo, d.tipoVinculo]).toEqual(['desligamento', '2026-11-05T12:00:00Z', 'MUDANÇA DE CIDADE', 'MILITAR']);
  });

  it('descarta restrição desconhecida e itens sem ids', () => {
    expect(toPedido({ ...adesao, restricao: 'FINANCEIRA' })).toBeNull();
    expect(toPedido({ ...adesao, idPessoa: null })).toBeNull();
  });

  it('filtra por tipo e por nome (sem acento) ou CPF', () => {
    const lista = [toPedido(adesao)!, toPedido(deslig)!];
    expect(filtrarPedidos(lista, '', 'desligamento').map((p) => p.idAssociado)).toEqual([504]);
    expect(filtrarPedidos(lista, 'jose', 'todos').map((p) => p.idAssociado)).toEqual([504]);
    expect(filtrarPedidos(lista, '529.982', 'todos').map((p) => p.idAssociado)).toEqual([501]);
  });

  it('motivo do indeferimento vai como parâmetro', () => {
    expect(toIndeferirParams('  documentação incompleta ').toString()).toBe('motivo=documenta%C3%A7%C3%A3o%20incompleta');
  });

  it('pedido pendente no detalhe vem da restrição', () => {
    expect(pedidoPendente('AGUARDANDO ADESÃO')).toBe('adesao');
    expect(pedidoPendente('AGUARDANDO DESLIGAMENTO')).toBe('desligamento');
    expect(pedidoPendente('ADESÃO INDEFERIDO')).toBeNull();
    expect(pedidoPendente(null)).toBeNull();
  });
});
