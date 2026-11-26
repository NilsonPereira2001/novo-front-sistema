import { quando, toListaParams, toPaginaAvisos, visaoValida } from './avisos-api';

describe('avisos-api', () => {
  it('página de avisos e prioridade normalizada', () => {
    const pg = toPaginaAvisos({
      content: [
        { id: 1, titulo: 'Recesso', conteudo: 'Sem expediente', prioridade: 'urgente', fixado: true, dataPublicacao: '2026-11-26T09:00:00', dataExpiracao: '2026-12-31', lido: false, podeEditar: true, leituras: 3 },
        { id: 2, titulo: 'X', prioridade: 'qualquer' },
        { titulo: 'sem id' },
      ],
      totalElements: 2, totalPages: 1, number: 0, size: 10,
    });
    expect(pg.content.length).toBe(2);
    expect(pg.content[0].prioridade).toBe('URGENTE');
    expect(pg.content[0].dataExpiracao).toBe('2026-12-31');
    expect(pg.content[1].prioridade).toBe('NORMAL');
  });

  it('parâmetros por visão', () => {
    expect(toListaParams('vigentes', '', 0, 10).toString()).toBe('page=0&size=10');
    expect(toListaParams('nao-lidos', ' ferias ', 1, 10).toString()).toBe('page=1&size=10&filtro=ferias&naoLidos=true');
    expect(toListaParams('encerrados', '', 0, 10).toString()).toBe('page=0&size=10&encerrados=true');
    expect(visaoValida('xyz')).toBe('vigentes');
  });

  it('quando foi publicado', () => {
    const agora = new Date(2026, 10, 26, 15, 0);
    expect(quando('2026-11-26T09:05:00', agora)).toBe('hoje às 09:05');
    expect(quando('2026-11-25T18:00:00', agora)).toBe('ontem às 18:00');
    expect(quando('2026-11-22T10:00:00', agora)).toBe('há 4 dias');
    expect(quando('2026-10-01T10:00:00', agora)).toBe('01/10/2026');
  });
});
