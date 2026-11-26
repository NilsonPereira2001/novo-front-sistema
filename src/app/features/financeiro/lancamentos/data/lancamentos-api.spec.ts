import {
  fatias,
  mesmoMes,
  nomeDoArquivo,
  percentualRecebido,
  proximoDiaUtil,
  rotuloStatus,
  toDebito,
  toFechado,
  toFicha,
  toLancamento,
  toPrevia,
  tomStatus,
} from './lancamentos-api';

const valores = { total: 1000, pago: 600, aReceber: 250, atrasado: 100, anistiado: 50, renegociado: 0, cancelado: 30, debitos: 40, debitosPagos: 24, debitosPendentes: 14 };
const item = { id: 7, nsa: 41, dataGeracao: '2026-10-01T11:00:00Z', dataFechamento: null, fechado: false, associados: 30, valores };

describe('lançamentos: adaptadores', () => {
  it('lê o item com os valores', () => {
    const l = toLancamento(item);
    expect(l?.nsa).toBe(41);
    expect(l?.fechado).toBe(false);
    expect(l?.valores.aReceber).toBe(250);
    expect(toLancamento({ nsa: 1 })).toBeNull();
  });

  it('lê a ficha', () => {
    const f = toFicha({
      lancamento: item,
      ultimo: true,
      porStatus: [{ status: 'pago', quantidade: 24, valor: 600 }],
      porOrigem: [{ nome: 'MENSALIDADE', tipo: 'CONVENIO', quantidade: 30, total: 900, pago: 600, pendente: 300 }, { nome: 'X', tipo: 'estranho' }],
      porTipo: [{ status: 'FIXO', quantidade: 38, valor: 950 }],
      relancados: { quantidade: 3, valor: 90, pago: 30, pendente: 60 },
      arquivos: [{ id: 2, nome: 'REM_CEF_20261005_REM.txt', dataGeracao: '2026-10-02T10:00:00Z', dataDebito: '2026-10-05', registros: 20, tamanho: 3000 }, { nome: 'sem id' }],
      remessa: { debitosDebitoConta: 20, valor: 700, semConta: 1, disponivel: true },
      fechamento: { debitos: 10, valor: 250, associadosComCredito: 2, creditoDisponivel: 40 },
    });
    expect(f.ultimo).toBe(true);
    expect(f.porStatus[0].status).toBe('PAGO');
    expect(f.porOrigem[1].tipo).toBe('OUTRO');
    expect(f.arquivos.length).toBe(1);
    expect(f.arquivos[0].dataDebito).toBe('2026-10-05');
    expect(f.remessa.semConta).toBe(1);
    expect(f.fechamento?.associadosComCredito).toBe(2);
    expect(toFicha({ lancamento: { ...item, fechado: true } }).fechamento).toBeNull();
  });

  it('ficha sem lançamento é resposta inválida', () => {
    let erro = false;
    try { toFicha({ porStatus: [] }); } catch { erro = true; }
    expect(erro).toBe(true);
  });

  it('lê fechamento e débito', () => {
    const r = toFechado({ ficha: { lancamento: item }, quitadosComCredito: 2, creditoUsado: 45.5 });
    expect(r.creditoUsado).toBe(45.5);
    const d = toDebito({ id: 1, idAssociado: 9, nome: 'MARIA', descricao: 'MENSALIDADE', origem: 'convenio', valor: 30, valorBase: 35, status: 'em aberto', nsaOrigem: 40 });
    expect(d?.origem).toBe('CONVENIO');
    expect(d?.status).toBe('EM ABERTO');
    expect(toDebito({ id: 1 })).toBeNull();
  });

  it('lê a prévia', () => {
    const p = toPrevia({ proximoNsa: 42, aberto: item, ultimo: item, previstos: [{ nome: 'MENSALIDADE', tipo: 'CONVENIO', quantidade: 30, valor: 900 }], totalPrevisto: 900, podeIniciar: false, motivo: 'aberto' });
    expect(p.proximoNsa).toBe(42);
    expect(p.aberto?.id).toBe(7);
    expect(p.podeIniciar).toBe(false);
    expect(toPrevia({ proximoNsa: 1, podeIniciar: true }).aberto).toBeNull();
  });
});

describe('lançamentos: regras de exibição', () => {
  it('percentual e fatias', () => {
    expect(percentualRecebido(valores)).toBe(60);
    expect(percentualRecebido({ ...valores, total: 0 })).toBe(0);
    const f = fatias(valores);
    expect(f.pago).toBe(60);
    expect(f.aReceber).toBe(25);
    expect(f.atrasado).toBe(10);
    expect(Math.round(f.outros)).toBe(5);
  });

  it('rótulos e tons', () => {
    expect(rotuloStatus('EM TRANSAÇÃO ATUAL')).toBe('A receber');
    expect(rotuloStatus('em aberto')).toBe('Atrasado');
    expect(rotuloStatus('OUTRO')).toBe('OUTRO');
    expect(tomStatus('NÃO DEBITADO')).toBe('atraso');
    expect(tomStatus('PAGO')).toBe('ok');
    expect(tomStatus('CANCELADO')).toBe('neutro');
  });

  it('mesmo mês e nome do arquivo', () => {
    const agora = new Date(2026, 9, 20);
    expect(mesmoMes(new Date(2026, 9, 1, 12).toISOString(), agora)).toBe(true);
    expect(mesmoMes(new Date(2026, 8, 30, 12).toISOString(), agora)).toBe(false);
    expect(mesmoMes(null, agora)).toBe(false);
    expect(nomeDoArquivo('attachment; filename="REM_CEF_20261005_REM.txt"', 'x.txt')).toBe('REM_CEF_20261005_REM.txt');
    expect(nomeDoArquivo(null, 'x.txt')).toBe('x.txt');
  });

  it('próximo dia útil pula o fim de semana', () => {
    expect(proximoDiaUtil(new Date(2026, 10, 27))).toBe('2026-11-30'); // sexta → segunda
    expect(proximoDiaUtil(new Date(2026, 10, 24))).toBe('2026-11-25'); // terça → quarta
  });
});
