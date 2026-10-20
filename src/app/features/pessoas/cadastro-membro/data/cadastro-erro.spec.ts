import { HttpErrorResponse } from '@angular/common/http';

import { CADASTRO_ERRO_MENSAGENS, CadastroErro, toCadastroErro } from './cadastro-erro';

const resposta = (status: number, error: unknown) =>
  new HttpErrorResponse({ status, error, url: '/backend/associado/salvar/novo' });

describe('toCadastroErro (POST /associado/salvar/novo)', () => {
  it('400 mostra o texto do backend sem o prefixo "Erro:" e com a dica de CPF', () => {
    const erro = toCadastroErro(resposta(400, 'Erro: Dados inválidos ou duplicados.'));
    expect(erro.kind).toBe('validacao');
    expect(erro.mensagem).toBe('Dados inválidos ou duplicados. Confira se o CPF já está cadastrado.');
  });

  it('500 nunca expõe o texto da exceção', () => {
    const erro = toCadastroErro(
      resposta(500, 'Error ao criar associado.java.lang.NullPointerException: x'),
    );
    expect(erro.kind).toBe('server');
    expect(erro.mensagem).toBeNull();
  });

  it('400 com texto técnico cai na mensagem padrão', () => {
    const erro = toCadastroErro(resposta(400, 'org.hibernate.exception.ConstraintViolationException'));
    expect(erro.mensagem).toBeNull();
  });

  it('403 é falta de permissão; 0 é falha de conexão', () => {
    expect(toCadastroErro(resposta(403, { error: 'Forbidden' })).kind).toBe('forbidden');
    expect(toCadastroErro(resposta(0, null)).kind).toBe('network');
  });

  it('preserva CadastroErro e trata erros desconhecidos', () => {
    expect(toCadastroErro(new CadastroErro('rota-pendente')).kind).toBe('rota-pendente');
    expect(toCadastroErro(new Error('x')).kind).toBe('unexpected');
    expect(typeof CADASTRO_ERRO_MENSAGENS.server).toBe('string');
  });
});
