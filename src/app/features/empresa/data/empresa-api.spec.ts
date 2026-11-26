import {
  daEmpresa,
  daSede,
  enderecoDaSede,
  linkSite,
  marcar,
  problemaImagem,
  textoPuro,
  toDados,
  toEmpresaPayload,
  toSedePayload,
} from './empresa-api';

const bruto = {
  id: 3,
  nome: 'ASSOCIAÇÃO X',
  sigla: 'ASX',
  cnpj: '11.222.333/0001-81',
  dataFundacao: '1990-05-10',
  telefone: '8233334444',
  email: 'contato@x.org',
  logo: 'data:image/png;base64,iVBORw0KGgo=',
  cabecalho: 'javascript:alert(1)',
  gestao: { id: 1, nome: 'GESTÃO 2025-2028', inicio: '2025-01-01', fim: '2028-12-31', presidente: 'FULANO', vicePresidente: null },
  sedes: [
    { id: 1, nome: 'SEDE', principal: true, cep: '57000000', logradouro: 'RUA A', numero: '10', cidade: 'MACEIÓ', uf: 'AL', idEstado: 2, telefone1: '82999998888' },
    { nome: 'sem id' },
  ],
  termoAdesao: '<p>Declaro <b>adesão</b></p>',
};

describe('empresa: adaptadores', () => {
  it('lê os dados e descarta imagem que não é data URL de imagem', () => {
    const d = toDados(bruto);
    expect(d.logo).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(d.cabecalho).toBeNull();
    expect(d.gestao?.presidente).toBe('FULANO');
    expect(d.sedes.length).toBe(1);
    expect(d.sedes[0].principal).toBe(true);
    expect(d.termoDesligamento).toBeNull();
  });

  it('dados sem id são resposta inválida', () => {
    let erro = false;
    try { toDados({ nome: 'X' }); } catch { erro = true; }
    expect(erro).toBe(true);
  });

  it('formulário da empresa: ida e volta', () => {
    const v = daEmpresa(toDados(bruto));
    expect(v.cnpj).toBe('11.222.333/0001-81');
    expect(v.telefone).toBe('(82) 3333-4444');
    const p = toEmpresaPayload({ ...v, nome: ' associação  x ', site: ' www.x.org ', email: ' Contato@X.org ', sigla: '' });
    expect(p.nome).toBe('ASSOCIAÇÃO X');
    expect(p.cnpj).toBe('11222333000181');
    expect(p.site).toBe('www.x.org');
    expect(p.email).toBe('contato@x.org');
    expect(p.sigla).toBeNull();
    expect('id' in p).toBe(false);
  });

  it('formulário da sede: ida e volta', () => {
    const s = toDados(bruto).sedes[0];
    const v = daSede(s);
    expect(v.cep).toBe('57000-000');
    expect(v.telefone1).toBe('(82) 99999-8888');
    const p = toSedePayload({ ...v, bairro: ' centro ', complemento: '' });
    expect(p.cep).toBe('57000000');
    expect(p.bairro).toBe('CENTRO');
    expect(p.complemento).toBeNull();
    expect(daSede(null).nome).toBe('');
    expect(enderecoDaSede(s)).toBe('RUA A, 10 · MACEIÓ/AL · CEP 57000-000');
  });
});

describe('empresa: regras', () => {
  it('imagem: tipo e tamanho', () => {
    expect(problemaImagem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(problemaImagem({ type: 'image/svg+xml', size: 1000 })).toBe('Use uma imagem PNG ou JPEG.');
    expect(problemaImagem({ type: 'image/jpeg', size: 2 * 1024 * 1024 })).toBe('A imagem pode ter no máximo 1 MB.');
  });

  it('link do site', () => {
    expect(linkSite('www.x.org')).toBe('https://www.x.org');
    expect(linkSite('http://x.org')).toBe('http://x.org');
    expect(linkSite('  ')).toBeNull();
  });

  it('marcação do termo', () => {
    const r = marcar('Declaro adesão', 8, 14, 'b');
    expect(r.texto).toBe('Declaro <b>adesão</b>');
    expect(r.texto.slice(r.inicio, r.fim)).toBe('adesão');
    expect(marcar('abc', 3, 3, 'br').texto).toBe('abc<br>');
    expect(marcar('um\ndois', 0, 7, 'li').texto).toBe('<ul>\n  <li>um</li>\n  <li>dois</li>\n</ul>');
    expect(textoPuro('<p>Declaro <b>adesão</b></p>')).toBe('Declaro adesão');
    expect(textoPuro(null)).toBe('');
  });
});
