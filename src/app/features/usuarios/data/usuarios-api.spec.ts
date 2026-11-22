import { regrasDaSenha } from '../../auth/trocar-senha/senha-regras';
import {
  PERSONALIZADO,
  agruparPermissoes,
  idsDoPerfil,
  perfilParaSalvar,
  rotuloPermissao,
  rotuloStatus,
  rotuloVinculo,
  toDetalhe,
  toListaParams,
  toPaginaUsuarios,
  toSenhaGerada,
} from './usuarios-api';

const PERMS = [
  { id: 1, nome: 'LISTAR_PROCESSOS', sigla: null, tipo: 'JURIDICO' },
  { id: 2, nome: 'PROCESSO_EDITAR', sigla: null, tipo: 'JURIDICO' },
  { id: 3, nome: 'CREDENCIAL_SISTEMA', sigla: null, tipo: null },
];
const PERFIS = [
  { nome: 'ADMINISTRADOR', permissoes: ['LISTAR_PROCESSOS', 'PROCESSO_EDITAR', 'CREDENCIAL_SISTEMA'] },
  { nome: 'ADVOGADO(A)', permissoes: ['LISTAR_PROCESSOS', 'PROCESSO_EDITAR'] },
  { nome: 'PERSONALIZADO', permissoes: [] },
];

describe('usuarios-api', () => {
  it('lista: página e filtros (1º acesso vira status ATIVO + primeiroAcesso)', () => {
    const pg = toPaginaUsuarios({
      content: [{ id: 1, usuario: '52998224725', nome: 'ANA', status: 'ativo', primeiroLogin: true, permissoes: 4, ultimoLogin: null }, { nome: 'X' }],
      totalElements: 1, totalPages: 1, number: 0, size: 20,
    });
    expect(pg.content.length).toBe(1);
    expect(pg.content[0].status).toBe('ATIVO');
    expect(toListaParams({ page: 0, size: 20, status: 'PRIMEIRO_ACESSO', vinculo: 'DIRETOR', filtro: ' ana ' }).toString()).toBe(
      'page=0&size=20&filtro=ana&status=ATIVO&primeiroAcesso=true&vinculo=DIRETOR',
    );
  });

  it('detalhe e senha gerada', () => {
    const r = toSenhaGerada({
      usuario: { id: 7, usuario: '52998224725', nome: 'ANA', status: 'ATIVO', primeiroLogin: true, permissoes: [PERMS[0]], ultimosAcessos: [{ entrada: '2026-11-20T08:00:00', navegador: 'Chrome' }] },
      senhaProvisoria: 'Ab3kLm9pQr',
      emailEnviado: true,
    });
    expect(r.senhaProvisoria).toBe('Ab3kLm9pQr');
    expect(r.usuario.permissoes.length).toBe(1);
    expect(r.usuario.ultimosAcessos[0].entrada).toBe('2026-11-20T08:00:00');
    let erro = '';
    try {
      toSenhaGerada({ usuario: { id: 7, usuario: 'x' } });
    } catch (e) {
      erro = (e as Error).name;
    }
    expect(erro).toBe('UnexpectedResponseError');
    expect(toDetalhe({ id: 1, usuario: 'x', status: 'BLOQUEADO' }).status).toBe('BLOQUEADO');
  });

  it('rótulos de situação, vínculo e permissão', () => {
    expect(rotuloStatus({ status: 'ATIVO', primeiroLogin: true }).texto).toBe('Aguardando 1º acesso');
    expect(rotuloStatus({ status: 'BLOQUEADO', primeiroLogin: false }).tom).toBe('danger');
    expect(rotuloVinculo('FUNCIONARIO,DIRETOR')).toBe('Funcionário e diretor');
    expect(rotuloVinculo(null)).toBe('—');
    expect(rotuloPermissao(PERMS[0])).toBe('Listar processos');
  });

  it('perfis: ids do perfil, agrupamento e perfil a salvar', () => {
    expect(idsDoPerfil(PERFIS[1], PERMS)).toEqual([1, 2]);
    const g = agruparPermissoes(PERMS);
    expect(g.map((x) => x.tipo)).toEqual(['JURIDICO', 'Outras']);
    expect(perfilParaSalvar('ADVOGADO(A)', [2, 1], PERFIS, PERMS)).toBe('ADVOGADO(A)');
    expect(perfilParaSalvar('ADVOGADO(A)', [1], PERFIS, PERMS)).toBe(PERSONALIZADO);
    expect(perfilParaSalvar(PERSONALIZADO, [1, 2], PERFIS, PERMS)).toBe(PERSONALIZADO);
  });

  it('regras da senha (iguais ao backend)', () => {
    const falhas = (s: string) => regrasDaSenha(s, '52998224725', 'Atual1234').filter((r) => !r.ok).map((r) => r.texto);
    expect(falhas('Nova12345')).toEqual([]);
    expect(falhas('abcdefgh')).toEqual(['Letras e números']);
    expect(falhas('x52998224725')).toEqual(['Não contém o CPF']);
    expect(falhas('Atual1234')).toEqual(['Diferente da senha atual']);
    expect(falhas('ab 12345')).toEqual(['Sem espaços']);
  });
});
