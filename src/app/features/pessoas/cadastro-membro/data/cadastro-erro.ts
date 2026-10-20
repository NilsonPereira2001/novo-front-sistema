/**
 * Interpretação das falhas de `POST /associado/salvar/novo`.
 *
 * Respostas do controller (salvarNovoAssociado):
 *   400 · texto "Erro: Dados inválidos ou duplicados." → mostrado sem o "Erro:"
 *   403 · sem a permissão AFILIADO_CRIAR
 *   500 · texto "Error ao criar associado." + exceção → NUNCA exibido
 */

import { HttpErrorResponse } from '@angular/common/http';

import { TERMOS } from '../../../../core/config/terminologia';
import { isRecord, readString } from '../../../../shared/utils/json-read';

export type CadastroErroKind =
  | 'rota-pendente'
  | 'validacao'
  | 'forbidden'
  | 'network'
  | 'server'
  | 'unexpected';

/** Falha ao salvar. `mensagem` só vem preenchida quando é um texto amigável do backend. */
export class CadastroErro extends Error {
  constructor(
    readonly kind: CadastroErroKind,
    readonly mensagem: string | null = null,
  ) {
    super(kind);
    this.name = 'CadastroErro';
  }
}

export function toCadastroErro(error: unknown): CadastroErro {
  if (error instanceof CadastroErro) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new CadastroErro('unexpected');
  }
  if (error.status === 0) {
    return new CadastroErro('network');
  }
  if (error.status === 403) {
    return new CadastroErro('forbidden');
  }
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    const mensagem = mensagemAmigavel(error.error);
    // "Dados inválidos ou duplicados" costuma ser CPF já cadastrado.
    const dica = mensagem && /duplicad/i.test(mensagem) ? ' Confira se o CPF já está cadastrado.' : '';
    return new CadastroErro('validacao', mensagem ? mensagem + dica : null);
  }
  // O 500 do salvarNovoAssociado traz o texto da exceção: nunca é exibido.
  if (error.status >= 500) {
    return new CadastroErro('server');
  }
  return new CadastroErro('unexpected');
}

/**
 * O backend responde validações com texto (ex.: "CPF já cadastrado.").
 * Só repassa textos curtos e sem cara de detalhe técnico.
 */
export function mensagemAmigavel(body: unknown): string | null {
  const texto = typeof body === 'string' ? body : isRecord(body) ? readString(body, ['message']) : null;
  if (!texto) {
    return null;
  }
  // "Erro: Dados inválidos ou duplicados." → "Dados inválidos ou duplicados."
  const limpo = texto.trim().replace(/^erro\s*:\s*/i, '');
  const tecnico = /exception|stack|sql|org\.|java\.|\bat\s+\w+\./i.test(limpo);
  return limpo.length > 0 && limpo.length <= 300 && !tecnico ? limpo : null;
}

export const CADASTRO_ERRO_MENSAGENS: Readonly<Record<CadastroErroKind, string>> = {
  'rota-pendente':
    'O envio do cadastro ainda não está disponível: falta configurar o endereço de criação no sistema.',
  validacao: 'O servidor recusou o cadastro. Revise os dados informados e tente novamente.',
  forbidden: `Seu usuário não tem permissão para cadastrar ${TERMOS.membrosMin}.`,
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  server:
    'O servidor não conseguiu salvar o cadastro. Tente novamente; se o problema continuar, contate o suporte.',
  unexpected: 'Não foi possível concluir o cadastro. Tente novamente.',
};
