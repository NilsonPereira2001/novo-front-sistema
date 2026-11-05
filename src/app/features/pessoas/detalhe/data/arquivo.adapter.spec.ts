import { dataHoraLocal, ordenarArquivos, toArquivoPessoa, toUploadBody } from './arquivo.adapter';

describe('toArquivoPessoa (ArquivoPessoaDTO)', () => {
  it('lê id, nome, tamanho em texto, departamento e data de importação', () => {
    expect(
      toArquivoPessoa({ id: 12, dataImportacao: '2026-11-05T16:14:03.123', nome: 'RG frente.pdf', tamanho: '482133', departamento: 'ATENDIMENTO' }),
    ).toEqual({
      id: 12,
      nome: 'RG frente.pdf',
      categoria: 'ATENDIMENTO',
      tipo: 'application/pdf',
      tamanho: 482133,
      enviadoEm: '2026-11-05T16:14:03',
      enviadoPor: null,
    });
  });

  it('aceita tamanho nulo (backend antigo) e descarta itens sem id ou nome', () => {
    expect(toArquivoPessoa({ id: 1, nome: 'x.jpg', tamanho: null, departamento: null })?.tamanho).toBeNull();
    expect(toArquivoPessoa({ nome: 'sem id.pdf' })).toBeNull();
    expect(toArquivoPessoa({ id: 2 })).toBeNull();
  });

  it('LocalDateTime em lista também funciona', () => {
    expect(dataHoraLocal([2026, 11, 5, 9, 7, 3, 123000000])).toBe('2026-11-05T09:07:03');
    expect(dataHoraLocal('ontem')).toBeNull();
  });

  it('ordena do mais recente para o mais antigo', () => {
    const a = toArquivoPessoa({ id: 1, nome: 'a.pdf', dataImportacao: '2026-01-01T10:00:00' })!;
    const b = toArquivoPessoa({ id: 2, nome: 'b.pdf', dataImportacao: '2026-03-01T10:00:00' })!;
    expect(ordenarArquivos([a, b]).map((x) => x.id)).toEqual([2, 1]);
  });

  it('monta o multipart com os 4 campos do upload', () => {
    const body = toUploadBody(77, new File(['%PDF'], 'contrato.pdf', { type: 'application/pdf' }), 3);
    expect(body.get('pessoaId')).toBe('77');
    expect(body.get('departamentoId')).toBe('3');
    expect(body.get('nome')).toBe('contrato.pdf');
    expect((body.get('arquivo') as File).name).toBe('contrato.pdf');
  });
});
