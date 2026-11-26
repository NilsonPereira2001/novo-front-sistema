import {
  daPasta,
  iniciais,
  problemaGestao,
  proximaOrdem,
  tempoNoCargo,
  toComposicao,
  toElegiveis,
  toGestaoPayload,
  toGestoes,
  toNomearPayload,
  toPaginaDiretores,
  toPastaPayload,
  toPastas,
} from './diretoria-api';

const pasta = { id: 1, nome: 'PRESIDÊNCIA', descricao: null, remuneracao: 1500, ordem: 1, ativa: true, diretoresNoHistorico: 3 };

describe('diretoria: adaptadores', () => {
  it('lê a composição, com vaga e ocupante', () => {
    const c = toComposicao({
      gestaoAtual: { id: 4, nome: 'GESTÃO 2025-2028', inicio: '2025-01-01', atual: true },
      cadeiras: [
        { pasta, ocupante: { idDiretor: 9, idAssociado: 7, idPessoa: 70, nome: 'MARIA', dataNomeacao: '2025-01-02', foto: 'javascript:x', associadoAtivo: false, statusAssociado: 'DESLIGADO' } },
        { pasta: { ...pasta, id: 2, nome: 'SECRETARIA' }, ocupante: null },
        { pasta: { nome: 'sem id' } },
      ],
      ocupadas: 1,
      vagas: 1,
      alertas: 1,
    });
    expect(c.gestaoAtual?.nome).toBe('GESTÃO 2025-2028');
    expect(c.cadeiras.length).toBe(2);
    expect(c.cadeiras[0].ocupante?.foto).toBeNull();
    expect(c.cadeiras[0].ocupante?.associadoAtivo).toBe(false);
    expect(c.cadeiras[1].ocupante).toBeNull();
  });

  it('pastas, gestões, histórico e elegíveis', () => {
    expect(toPastas([pasta, { ativa: false }]).length).toBe(1);
    expect(toPastas([{ ...pasta, ativa: false }])[0].ativa).toBe(false);
    expect(toPastas([{ id: 3, nome: 'X' }])[0].ativa).toBe(true);
    const g = toGestoes([{ id: 1, nome: 'G', idPresidente: 5, presidente: 'JOÃO', atual: true, diretores: 6 }]);
    expect(g[0].idPresidente).toBe(5);
    const h = toPaginaDiretores({ content: [{ id: 1, idAssociado: 2, idPessoa: 20, nome: 'ANA', status: 'desligado', dataExoneracao: '2026-01-10' }], totalElements: 1, totalPages: 1, size: 20, number: 0 });
    expect(h.content[0].status).toBe('DESLIGADO');
    expect(h.content[0].idPessoa).toBe(20);
    const e = toElegiveis({ content: [{ idAssociado: 3, nome: 'PEDRO', diretoriaAtual: 'TESOURARIA' }, { nome: 'x' }], totalElements: 2, totalPages: 1, size: 10, number: 0 });
    expect(e.length).toBe(1);
    expect(e[0].diretoriaAtual).toBe('TESOURARIA');
  });
});

describe('diretoria: formulários e regras', () => {
  it('pasta: ida e volta', () => {
    const v = daPasta(toPastas([pasta])[0]);
    expect(v.remuneracao).toBe('1500,00');
    expect(v.ordem).toBe('1');
    const p = toPastaPayload({ nome: ' diretoria  de esportes ', descricao: '', remuneracao: '1.234,50', ordem: '' });
    expect(p.nome).toBe('DIRETORIA DE ESPORTES');
    expect(p.descricao).toBeNull();
    expect(p.remuneracao).toBe(1234.5);
    expect(p.ordem).toBeNull();
    expect(daPasta(null, 4).ordem).toBe('4');
    expect(proximaOrdem([{ ...toPastas([pasta])[0], ordem: 7 }])).toBe(8);
  });

  it('nomeação e gestão', () => {
    const n = toNomearPayload({ idPasta: 1, idAssociado: 2, dataNomeacao: '2026-01-01', portaria: ' portaria 1/2026 ', idGestao: null });
    expect(n.portaria).toBe('PORTARIA 1/2026');
    expect('id' in n).toBe(false);
    const base = { nome: 'G', inicio: '2025-01-01', fim: '', presidente: { id: 1, nome: 'A' }, vice: { id: 2, nome: 'B' } };
    expect(problemaGestao(base)).toBeNull();
    expect(problemaGestao({ ...base, vice: { id: 1, nome: 'A' } })).toBe('Presidente e vice-presidente devem ser pessoas diferentes.');
    expect(problemaGestao({ ...base, fim: '2024-12-31' })).toBe('O fim do mandato não pode ser antes do início.');
    expect(problemaGestao({ ...base, inicio: '' })).toBe('Informe o início do mandato.');
    const g = toGestaoPayload({ ...base, nome: ' gestão  2025 ' });
    expect(g.nome).toBe('GESTÃO 2025');
    expect(g.fim).toBeNull();
    expect(g.idVicePresidente).toBe(2);
  });

  it('tempo no cargo e iniciais', () => {
    const hoje = new Date(2026, 10, 26);
    expect(tempoNoCargo('2024-08-26', hoje)).toBe('2 anos e 3 meses');
    expect(tempoNoCargo('2026-06-01', hoje)).toBe('5 meses');
    expect(tempoNoCargo('2026-11-14', hoje)).toBe('12 dias');
    expect(tempoNoCargo('2025-11-26', hoje)).toBe('1 ano');
    expect(tempoNoCargo(null, hoje)).toBeNull();
    expect(iniciais('MARIA DA SILVA')).toBe('MS');
    expect(iniciais('ANA')).toBe('A');
  });
});
