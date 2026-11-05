/**
 * Converte a entidade `Associado` do backend (com `Pessoa` dentro) no modelo
 * da tela de detalhe e da ficha.
 *
 * Nomes seguidos das entidades informadas:
 *   Associado: id, ultimaAdesao, primeiraAdesao, pessoa, tipoVinculo,
 *     instituicao, unidade, graduacao, quadro, tipoSocio, formaPagamento,
 *     data_incorporacao, associadoIndicador, status, motivo_desligamento,
 *     codigoCadastramento, dataDesligamento, empresaConveniada, valorCredito,
 *     restricao (conveniosFixos tem @JsonIgnore e não vem).
 *   Pessoa: id, data_cadastro, imgPerfil (byte[] → base64), nome, cpf,
 *     matricula, naturalidade, nomeMae, nomePai, rg, tituloEleitor,
 *     data_nascimento, tipo, sexo, nome_guerra, estadoCivil, email, status,
 *     carteiraImpressa, carteiraEntregue, qrcodeValidador (byte[] → base64),
 *     endereco, telefones, conta, restricao.
 *
 * Os campos com "_" (data_incorporacao, nome_guerra...) saem assim no JSON
 * porque o Lombok gera getData_incorporacao(). A versão camelCase também é
 * aceita, caso o backend passe a usar @JsonProperty.
 *
 * `Conta` no repositório back-novo: agencia, operacao, numero_conta, banco,
 * tipoPix, pix (também aceitos os nomes do AssociadoNovoDTO). Datas `Date`
 * chegam como "yyyy-MM-dd" (spring.jackson.date-format) ou em milissegundos.
 * Foto: `imgPerfil` (byte[]) ou `foto` (String), conforme a versão.
 *
 * ⚠️ A CONFIRMAR: o campo de texto
 * de EstadoCivil, TipoVinculo, Unidade, Graduacao, Quadro, TipoSocio e TipoPix
 * (lidos por `nome`/`descricao` ou pelo único campo de texto da entidade).
 */

import { LABELS } from '../../cadastro-membro/data/cadastro-api';
import { toOpcao } from '../../../../shared/data/opcao.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { PessoaDetalhe, PessoaRef, TelefoneDetalhe } from '../models/pessoa-detalhe.model';
import { perfilDoTipo } from '../models/perfil-config';

export function toPessoaDetalheDeAssociado(raw: unknown): PessoaDetalhe | null {
  if (!isRecord(raw)) {
    return null;
  }
  const base = dadosDaPessoa(readRecord(raw, ['pessoa']));
  if (!base) {
    return null; // sem a pessoa não há o que mostrar
  }
  const s = (...keys: string[]) => readString(raw, keys);

  return {
    ...base,
    associadoId: readNumber(raw, ['id']),
    perfil: base.tipoNome ? perfilDoTipo(base.tipoNome) : 'membro',
    tipoNome: base.tipoNome ?? 'ASSOCIADO',
    status: s('status') ?? base.status,
    restricao: s('restricao') ?? base.restricao,

    vinculo: {
      tipoVinculo: rotulo(raw['tipoVinculo']),
      instituicao: rotulo(raw['instituicao']),
      unidade: rotulo(raw['unidade']),
      graduacao: rotulo(raw['graduacao']),
      quadro: rotulo(raw['quadro']),
      dataIncorporacao: dataLocal(raw, ['data_incorporacao', 'dataIncorporacao']),
      empresaConveniada: rotulo(raw['empresaConveniada'], LABELS.empresa),
    },

    adesao: {
      tipoSocio: rotulo(raw['tipoSocio']),
      formaPagamento: rotulo(raw['formaPagamento'], LABELS.formaPagamento),
      primeiraAdesao: instante(raw, ['primeiraAdesao', 'primeira_adesao']),
      ultimaAdesao: instante(raw, ['ultimaAdesao', 'ultima_adesao']),
      codigoCadastramento: s('codigoCadastramento', 'codigo_cadastramento'),
      valorCredito: readNumber(raw, ['valorCredito', 'valor_credito']),
      indicador: indicador(raw['associadoIndicador']),
    },

    desligamento: desligamento(raw),
  };
}

/** Partes de PessoaDetalhe que vêm só da entidade `Pessoa`. */
export type DadosDaPessoa = Omit<PessoaDetalhe, 'perfil' | 'tipoNome'> & { readonly tipoNome: string | null };

/**
 * Lê a entidade `Pessoa` (comum a associado e dependente). `null` sem id ou nome.
 */
export function dadosDaPessoa(pessoa: JsonRecord | null): DadosDaPessoa | null {
  const id = pessoa ? readNumber(pessoa, ['id']) : null;
  const nome = pessoa ? readString(pessoa, ['nome']) : null;
  if (!pessoa || id === null || !Number.isSafeInteger(id) || id <= 0 || !nome) {
    return null;
  }
  const s = (src: JsonRecord | null, ...keys: string[]) => (src ? readString(src, keys) : null);
  const endereco = readRecord(pessoa, ['endereco']);
  const conta = readRecord(pessoa, ['conta']);

  return {
    id,
    origem: 'api',
    tipoNome: rotulo(pessoa['tipo']),
    status: s(pessoa, 'status'),
    restricao: s(pessoa, 'restricao'),
    foto: imagemBase64(pessoa['imgPerfil'] ?? pessoa['foto']),
    qrcode: imagemBase64(pessoa['qrcodeValidador']),
    dataCadastro: instante(pessoa, ['data_cadastro', 'dataCadastro']),

    pessoais: {
      nome,
      cpf: s(pessoa, 'cpf'),
      nomeGuerra: s(pessoa, 'nome_guerra', 'nomeGuerra'),
      dataNascimento: dataLocal(pessoa, ['data_nascimento', 'dataNascimento']),
      sexo: rotulo(pessoa['sexo'], LABELS.sexo),
      estadoCivil: rotulo(pessoa['estadoCivil']),
      email: s(pessoa, 'email'),
      rg: s(pessoa, 'rg'),
      naturalidade: s(pessoa, 'naturalidade'),
      nomePai: s(pessoa, 'nomePai', 'nome_pai'),
      nomeMae: s(pessoa, 'nomeMae', 'nome_mae'),
      matricula: s(pessoa, 'matricula'),
      tituloEleitor: s(pessoa, 'tituloEleitor', 'titulo_eleitor'),
    },

    endereco:
      endereco && ['cep', 'logradouro', 'cidade', 'bairro'].some((k) => s(endereco, k))
        ? {
            cep: s(endereco, 'cep'),
            logradouro: s(endereco, 'logradouro'),
            numero: s(endereco, 'numero'),
            complemento: s(endereco, 'complemento'),
            bairro: s(endereco, 'bairro'),
            cidade: s(endereco, 'cidade'),
            estado: rotulo(endereco['estado'], LABELS.estado),
          }
        : null,

    telefones: telefones(pessoa['telefones']),

    bancarios: conta
      ? {
          banco: rotulo(conta['banco'], LABELS.banco),
          tipoConta: s(conta, 'tipoConta', 'tipo_conta'),
          agencia: s(conta, 'agencia'),
          operacao: s(conta, 'operacao'),
          numeroConta: s(conta, 'numeroConta', 'numero_conta', 'conta'),
          tipoPix: rotulo(conta['tipoPix']),
          chavePix: s(conta, 'chavePix', 'chave_pix', 'pix'),
        }
      : null,

    carteira: {
      impressa: booleano(pessoa['carteiraImpressa']),
      entregue: booleano(pessoa['carteiraEntregue']),
    },
  };
}

// --- Leitores ------------------------------------------------------------------

/** Texto de uma entidade auxiliar (`{ id, nome }`, `{ id, sexo }`...). */
export function rotulo(value: unknown, keys?: readonly string[]): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return toOpcao(value, keys ? [...keys, 'nome', 'descricao'] : undefined)?.label ?? null;
}

function booleano(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function telefones(value: unknown): TelefoneDetalhe[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .map((t) => ({ telefone: readString(t, ['telefone']) ?? '', principal: t['principal'] === true }))
    .filter((t) => t.telefone !== '')
    .sort((a, b) => Number(b.principal) - Number(a.principal));
}

/** O indicador é outro Associado: o link usa o id da Pessoa dele. */
function indicador(value: unknown): PessoaRef | null {
  const pessoa = isRecord(value) ? readRecord(value, ['pessoa']) : null;
  const id = pessoa ? readNumber(pessoa, ['id']) : null;
  const nome = pessoa ? readString(pessoa, ['nome']) : null;
  return id !== null && nome ? { id, nome } : null;
}

function desligamento(raw: JsonRecord): PessoaDetalhe['desligamento'] {
  const data = instante(raw, ['dataDesligamento', 'data_desligamento']);
  const motivo = readString(raw, ['motivo_desligamento', 'motivoDesligamento']);
  return data || motivo ? { data, motivo } : null;
}

/**
 * `LocalDate`/`Date`: "2008-05-02", "2008-05-02T03:00:00.000+00:00",
 * [2008, 5, 2] ou milissegundos. Sai sempre YYYY-MM-DD.
 */
export function dataLocal(source: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      return v.slice(0, 10);
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v); // java.util.Date como timestamp (ms)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => Number.isInteger(n))) {
      const [y, m, d] = v as number[];
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * `Instant`: texto ISO ("2023-02-01T13:20:00Z") ou número de segundos
 * (com fração) quando o Jackson grava datas como timestamp.
 */
export function instante(source: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      return v;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const ms = Math.abs(v) > 1e11 ? v : v * 1000; // milissegundos ou segundos
      return new Date(ms).toISOString();
    }
  }
  return null;
}

/**
 * `byte[]` chega como base64 (padrão do Jackson). Só vira imagem se o
 * conteúdo for reconhecido como JPEG, PNG, GIF ou WebP.
 */
export function imagemBase64(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 16) {
    return null;
  }
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/.test(value)) {
    return value;
  }
  const tipo = value.startsWith('/9j/')
    ? 'jpeg'
    : value.startsWith('iVBORw0KGgo')
      ? 'png'
      : value.startsWith('R0lGOD')
        ? 'gif'
        : value.startsWith('UklGR')
          ? 'webp'
          : null;
  return tipo && /^[A-Za-z0-9+/=\r\n]+$/.test(value) ? `data:image/${tipo};base64,${value}` : null;
}
