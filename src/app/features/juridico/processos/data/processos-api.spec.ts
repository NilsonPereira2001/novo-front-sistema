import { applyMask } from '../../../../shared/utils/masks';
import { cnjValido, formatarCnj, proximasAudiencias, statusProcesso, toDetalhe, toListaParams, toPaginaProcessos } from './processos-api';

describe('processos-api', () => {
  it('CNJ: máscara, formatação e dígito verificador', () => {
    expect(applyMask('cnj', '00012344620248020001')).toBe('0001234-46.2024.8.02.0001');
    expect(applyMask('cnj', '0001234')).toBe('0001234');
    expect(applyMask('cnj', '000123446')).toBe('0001234-46');
    expect(formatarCnj('00012344620248020001')).toBe('0001234-46.2024.8.02.0001');
    expect(formatarCnj('123/2009')).toBe('123/2009');
    expect(cnjValido('0001234-46.2024.8.02.0001')).toBe(true);
    expect(cnjValido('0001234-79.2024.8.02.0001')).toBe(false);
    expect(cnjValido('123')).toBe(false);
  });

  it('lista: lê processo e partes resumidas', () => {
    const p = toPaginaProcessos({
      content: [{ processo: { id: 7, numeroProcesso: '0001234-46.2024.8.02.0001', descricao: 'AÇÃO DE COBRANÇA', status: 'EM ANDAMENTO', dataUltimaMovimentacao: [2026, 11, 3], responsavel: 'DRA. LIMA' }, partes: ['ANA (AUTOR)', 3] }, { processo: { id: 8 } }],
      totalElements: 1, totalPages: 1, number: 0, size: 10,
    });
    expect(p.content.length).toBe(1);
    expect([p.content[0].dataUltimaMovimentacao, p.content[0].partes]).toEqual(['2026-11-03', ['ANA (AUTOR)']]);
  });

  it('detalhe: partes com tipo, movimentações e audiências', () => {
    const d = toDetalhe({
      id: 7, numeroProcesso: '1', valorAcao: 1500.5, responsavel: { id: 3, nome: 'DRA. LIMA', oab: 'AL 1234' },
      partes: [{ id: 1, nome: 'ANA', tipoParte: { id: 2, nome: 'AUTOR' }, idPessoa: 1 }],
      movimentacoes: [{ id: 10, data: '2026-11-03', titulo: 'CONCLUSOS', descricao: 'x' }, { titulo: 'sem id' }],
      audiencias: [{ id: 5, data: '2026-12-01', tipo: 'CONCILIAÇÃO' }, { id: 6, data: '2026-01-10', tipo: 'INSTRUÇÃO' }],
    });
    expect([d.responsavel?.oab, d.partes[0].tipoParte, d.partes[0].idTipoParte, d.movimentacoes.length]).toEqual(['AL 1234', 'AUTOR', 2, 1]);
    expect(proximasAudiencias(d.audiencias, '2026-11-12').map((a) => a.id)).toEqual([5]);
  });

  it('status e parâmetros', () => {
    expect(statusProcesso('EM ANDAMENTO')).toEqual({ rotulo: 'Em andamento', tom: 'info' });
    expect(statusProcesso('ARQUIVADO').tom).toBe('neutral');
    expect(toListaParams({ filtro: ' ana ', status: 'JULGADO', page: 0, size: 10 }).toString()).toBe('page=0&size=10&filtro=ana&status=JULGADO');
  });
});
