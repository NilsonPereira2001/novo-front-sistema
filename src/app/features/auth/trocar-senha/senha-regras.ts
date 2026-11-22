/** Regras da senha (iguais às do backend: UsuarioSistemaService.problemaDaSenha). */
export interface RegraSenha {
  readonly texto: string;
  readonly ok: boolean;
}

export function regrasDaSenha(senha: string, cpf: string | null, atual: string): RegraSenha[] {
  const digitosCpf = (cpf ?? '').replace(/\D/g, '');
  return [
    { texto: 'Pelo menos 8 caracteres', ok: senha.length >= 8 && senha.length <= 72 },
    { texto: 'Letras e números', ok: /\p{L}/u.test(senha) && /\d/.test(senha) },
    { texto: 'Sem espaços', ok: senha.length > 0 && !/\s/.test(senha) },
    { texto: 'Não contém o CPF', ok: senha.length > 0 && !(digitosCpf.length === 11 && senha.includes(digitosCpf)) },
    { texto: 'Diferente da senha atual', ok: senha.length > 0 && senha !== atual },
  ];
}
