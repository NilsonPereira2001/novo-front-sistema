import { onlyDigits } from '../../../../shared/utils/cpf';
import { maiusculas } from '../../../../shared/utils/text';
import { FOTO_FORMATO } from '../data/cadastro-api';
import { AssociadoNovoPayload, Referencia, TelefonePayload } from '../models/associado-novo.dto';
import { MembroFormValue } from './membro-form';

/**
 * Monta o JSON de `AssociadoNovoDTO` a partir do estado do formulário.
 *
 * - Não envia `id` nem `dataCadastro` (gerados pelo backend).
 * - Opcionais vazios são omitidos; `telefones` e `convenios` vão sempre como lista.
 * - Relacionamentos como `{ id }`; datas `YYYY-MM-DD`; CPF/CEP/telefone só dígitos.
 * - Textos em MAIÚSCULAS, exceto e-mail e chave Pix.
 */
export function toAssociadoNovoPayload(
  v: MembroFormValue,
  fotoFormato: typeof FOTO_FORMATO = FOTO_FORMATO,
): AssociadoNovoPayload {
  const { pessoais: p, endereco: e, bancarios: b, vinculo: vi, adesao: a, familia: f } = v;

  const payload: AssociadoNovoPayload = {
    foto: toFoto(p.foto, fotoFormato),
    cpf: onlyDigits(p.cpf),
    nome: maiusculas(p.nome),
    nomeGuerra: upper(p.nomeGuerra),
    dataNascimento: text(p.dataNascimento),
    sexo: ref(p.sexo),
    estadoCivil: ref(p.estadoCivil),
    email: text(p.email),
    rg: upper(p.rg),
    naturalidade: upper(p.naturalidade),
    tipoPessoa: ref(p.tipoPessoa),

    cep: digits(e.cep),
    logradouro: upper(e.logradouro),
    numero: upper(e.numero),
    complemento: upper(e.complemento),
    estado: ref(e.estado),
    cidade: upper(e.cidade),
    bairro: upper(e.bairro),

    telefones: toTelefones(v.telefones),

    banco: ref(b.banco),
    tipoConta: upper(b.tipoConta),
    agencia: upper(b.agencia),
    numeroConta: upper(b.numeroConta),
    tipoPix: ref(b.tipoPix),
    chavePix: text(b.chavePix),
    formaPagamento: ref(b.formaPagamento),

    tipoVinculo: ref(vi.tipoVinculo),
    empresaConveniada: ref(vi.empresaConveniada?.id ?? null),
    matricula: upper(vi.matricula),
    instituicao: ref(vi.instituicao),
    unidade: ref(vi.unidade),
    graduacao: ref(vi.graduacao),
    quadro: ref(vi.quadro),
    dataIncorporacao: text(vi.dataIncorporacao),

    tipoSocio: ref(a.tipoSocio),
    associadoIndicador: ref(a.associadoIndicador?.id ?? null),
    convenios: [...new Set(a.convenios)].map((id) => ({ id })),

    nomePai: upper(f.nomePai),
    nomeMae: upper(f.nomeMae),
  };

  return withoutUndefined(payload);
}

function text(value: string): string | undefined {
  const t = value.trim();
  return t === '' ? undefined : t;
}

/** Texto do cadastro em MAIÚSCULAS (e-mail, chave Pix e datas ficam como estão). */
function upper(value: string): string | undefined {
  const t = maiusculas(value);
  return t === '' ? undefined : t;
}

function digits(value: string): string | undefined {
  const d = onlyDigits(value);
  return d === '' ? undefined : d;
}

function ref(id: number | null): Referencia | undefined {
  return id !== null && Number.isSafeInteger(id) && id > 0 ? { id } : undefined;
}

/** Telefones preenchidos, só dígitos; no máximo um principal. */
function toTelefones(
  telefones: readonly { telefone: string; principal: boolean }[],
): TelefonePayload[] {
  let principalUsado = false;
  return telefones
    .map((t) => ({ telefone: onlyDigits(t.telefone), principal: t.principal }))
    .filter((t) => t.telefone !== '')
    .map((t) => {
      const principal = t.principal && !principalUsado;
      principalUsado ||= principal;
      return { telefone: t.telefone, principal };
    });
}

function toFoto(dataUrl: string | null, formato: typeof FOTO_FORMATO): string | undefined {
  if (!dataUrl || formato === null) {
    return undefined;
  }
  if (formato === 'base64') {
    const virgula = dataUrl.indexOf(',');
    return virgula >= 0 ? dataUrl.slice(virgula + 1) : undefined;
  }
  return dataUrl;
}

/** Remove chaves com `undefined` para o corpo conter só o que foi preenchido. */
function withoutUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
}
