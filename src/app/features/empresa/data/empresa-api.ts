/**
 * Administração › Dados da empresa (EmpresaDadosController, PR #8 do back-novo). Permissão DADOS_EMPRESA.
 *
 *   GET    empresa/dados
 *   PUT    empresa/dados                              {nome, sigla, cnpj, dataFundacao, site, email, telefone}
 *   POST   empresa/dados/imagens/{logo|cabecalho}     multipart "arquivo" (PNG/JPEG até 1 MB)
 *   PUT    empresa/dados/termos/{adesao|desligamento} {conteudo}
 *   POST   empresa/dados/sedes · PUT /sedes/{id} · POST /sedes/{id}/principal · DELETE /sedes/{id}
 *
 * Todas devolvem os dados completos atualizados.
 */

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { applyMask } from '../../../shared/utils/masks';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { dataLocal } from '../../pessoas/detalhe/data/associado.adapter';

export const EMPRESA_API = {
  dados: '/empresa/dados',
  imagem: (tipo: TipoImagem) => `/empresa/dados/imagens/${tipo}`,
  termo: (tipo: TipoTermo) => `/empresa/dados/termos/${tipo}`,
  sedes: '/empresa/dados/sedes',
  sede: (id: number) => `/empresa/dados/sedes/${id}`,
  principal: (id: number) => `/empresa/dados/sedes/${id}/principal`,
} as const;

export type TipoImagem = 'logo' | 'cabecalho';
export type TipoTermo = 'adesao' | 'desligamento';

export const IMAGEM_MAX_BYTES = 1024 * 1024;
export const SIGLA_MAX = 20;

export interface Sede {
  readonly id: number;
  readonly nome: string;
  readonly principal: boolean;
  readonly telefone1: string | null;
  readonly telefone2: string | null;
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly cidade: string | null;
  readonly idEstado: number | null;
  readonly uf: string | null;
}

export interface GestaoAtual {
  readonly id: number;
  readonly nome: string | null;
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly presidente: string | null;
  readonly vicePresidente: string | null;
}

export interface DadosEmpresa {
  readonly id: number;
  readonly nome: string;
  readonly sigla: string | null;
  readonly cnpj: string | null;
  readonly dataFundacao: string | null;
  readonly site: string | null;
  readonly email: string | null;
  readonly telefone: string | null;
  /** data URL ou null */
  readonly logo: string | null;
  readonly cabecalho: string | null;
  readonly gestao: GestaoAtual | null;
  readonly sedes: readonly Sede[];
  readonly termoAdesao: string | null;
  readonly termoDesligamento: string | null;
}

// --- Adaptadores ---------------------------------------------------------------------

const IMAGEM_OK = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/;

function imagem(v: string | null): string | null {
  return v && IMAGEM_OK.test(v) ? v : null;
}

function toSede(r: JsonRecord): Sede | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    nome: readString(r, ['nome']) ?? '—',
    principal: r['principal'] === true,
    telefone1: readString(r, ['telefone1']),
    telefone2: readString(r, ['telefone2']),
    cep: readString(r, ['cep']),
    logradouro: readString(r, ['logradouro']),
    numero: readString(r, ['numero']),
    complemento: readString(r, ['complemento']),
    bairro: readString(r, ['bairro']),
    cidade: readString(r, ['cidade']),
    idEstado: readNumber(r, ['idEstado']),
    uf: readString(r, ['uf']),
  };
}

export function toDados(body: unknown): DadosEmpresa {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const id = readNumber(body, ['id']);
  if (id === null) throw new UnexpectedResponseError();
  const g = readRecord(body, ['gestao']);
  const gid = g ? readNumber(g, ['id']) : null;
  return {
    id,
    nome: readString(body, ['nome']) ?? '',
    sigla: readString(body, ['sigla']),
    cnpj: readString(body, ['cnpj']),
    dataFundacao: dataLocal(body, ['dataFundacao']),
    site: readString(body, ['site']),
    email: readString(body, ['email']),
    telefone: readString(body, ['telefone']),
    logo: imagem(readString(body, ['logo'])),
    cabecalho: imagem(readString(body, ['cabecalho'])),
    gestao:
      g && gid !== null
        ? {
            id: gid,
            nome: readString(g, ['nome']),
            inicio: dataLocal(g, ['inicio']),
            fim: dataLocal(g, ['fim']),
            presidente: readString(g, ['presidente']),
            vicePresidente: readString(g, ['vicePresidente']),
          }
        : null,
    sedes: (Array.isArray(body['sedes']) ? body['sedes'].filter(isRecord) : []).map(toSede).filter((s): s is Sede => s !== null),
    termoAdesao: readString(body, ['termoAdesao']),
    termoDesligamento: readString(body, ['termoDesligamento']),
  };
}

// --- Formulários ---------------------------------------------------------------------

export interface EmpresaFormValor {
  nome: string;
  sigla: string;
  cnpj: string;
  dataFundacao: string;
  site: string;
  email: string;
  telefone: string;
}

export interface SedeFormValor {
  nome: string;
  telefone1: string;
  telefone2: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  idEstado: number | null;
}

const txt = (v: string): string | null => (v.trim() ? v.trim().replace(/\s+/g, ' ').toUpperCase() : null);
const livre = (v: string): string | null => (v.trim() ? v.trim() : null);
const dig = (v: string): string | null => v.replace(/\D/g, '') || null;

export function toEmpresaPayload(v: EmpresaFormValor) {
  return {
    nome: v.nome.trim().replace(/\s+/g, ' ').toUpperCase(),
    sigla: txt(v.sigla),
    cnpj: dig(v.cnpj),
    dataFundacao: v.dataFundacao || null,
    site: livre(v.site),
    email: v.email.trim() ? v.email.trim().toLowerCase() : null,
    telefone: livre(v.telefone),
  };
}

export function daEmpresa(d: DadosEmpresa): EmpresaFormValor {
  const cnpj = (d.cnpj ?? '').replace(/\D/g, '');
  const tel = (d.telefone ?? '').replace(/\D/g, '');
  return {
    nome: d.nome,
    sigla: d.sigla ?? '',
    cnpj: cnpj ? applyMask('documento', cnpj) : '',
    dataFundacao: d.dataFundacao ?? '',
    site: d.site ?? '',
    email: d.email ?? '',
    telefone: tel ? applyMask('telefone', tel) : (d.telefone ?? ''),
  };
}

export function toSedePayload(v: SedeFormValor) {
  return {
    nome: v.nome.trim().replace(/\s+/g, ' ').toUpperCase(),
    telefone1: livre(v.telefone1),
    telefone2: livre(v.telefone2),
    cep: dig(v.cep),
    logradouro: txt(v.logradouro),
    numero: txt(v.numero),
    complemento: txt(v.complemento),
    bairro: txt(v.bairro),
    cidade: txt(v.cidade),
    idEstado: v.idEstado,
  };
}

export function daSede(s: Sede | null): SedeFormValor {
  const tel = (t: string | null) => {
    const d = (t ?? '').replace(/\D/g, '');
    return d ? applyMask('telefone', d) : (t ?? '');
  };
  return {
    nome: s?.nome ?? '',
    telefone1: tel(s?.telefone1 ?? null),
    telefone2: tel(s?.telefone2 ?? null),
    cep: s?.cep ? applyMask('cep', s.cep) : '',
    logradouro: s?.logradouro ?? '',
    numero: s?.numero ?? '',
    complemento: s?.complemento ?? '',
    bairro: s?.bairro ?? '',
    cidade: s?.cidade ?? '',
    idEstado: s?.idEstado ?? null,
  };
}

/** Endereço em uma linha. */
export function enderecoDaSede(s: Sede): string {
  const partes = [
    [s.logradouro, s.numero].filter(Boolean).join(', '),
    s.complemento,
    s.bairro,
    [s.cidade, s.uf].filter(Boolean).join('/'),
    s.cep ? 'CEP ' + applyMask('cep', s.cep) : null,
  ].filter((x) => !!x);
  return partes.length ? partes.join(' · ') : 'Endereço não informado';
}

/** null = ok. Confere tipo e tamanho antes de enviar (o back confere de novo pelos bytes). */
export function problemaImagem(arquivo: { type: string; size: number }): string | null {
  if (!['image/png', 'image/jpeg'].includes(arquivo.type)) return 'Use uma imagem PNG ou JPEG.';
  if (arquivo.size > IMAGEM_MAX_BYTES) return 'A imagem pode ter no máximo 1 MB.';
  return null;
}

/** Link do site com protocolo (para abrir em nova aba). */
export function linkSite(site: string | null): string | null {
  if (!site) return null;
  const s = site.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// --- Termos (HTML simples, impresso nos requerimentos) ---------------------------------

export type Marcacao = 'b' | 'i' | 'u' | 'p' | 'br' | 'li';

/**
 * Aplica a marcação à seleção do texto. Devolve o novo texto e a nova seleção.
 * - b/i/u/p envolvem a seleção; br insere quebra; li transforma cada linha selecionada em item de lista.
 */
export function marcar(texto: string, inicio: number, fim: number, m: Marcacao): { texto: string; inicio: number; fim: number } {
  const a = Math.max(0, Math.min(inicio, texto.length));
  const b = Math.max(a, Math.min(fim, texto.length));
  const antes = texto.slice(0, a);
  const sel = texto.slice(a, b);
  const depois = texto.slice(b);
  let meio: string;
  if (m === 'br') {
    meio = sel + '<br>';
  } else if (m === 'li') {
    const linhas = (sel || 'Item').split('\n').map((l) => l.trim()).filter(Boolean);
    meio = '<ul>\n' + linhas.map((l) => `  <li>${l}</li>`).join('\n') + '\n</ul>';
  } else {
    meio = `<${m}>${sel}</${m}>`;
  }
  const abertura = m === 'br' || m === 'li' ? 0 : m.length + 2;
  return {
    texto: antes + meio + depois,
    inicio: a + abertura,
    fim: m === 'br' || m === 'li' ? a + meio.length : a + abertura + sel.length,
  };
}

/** Texto puro (para contagem e para saber se está vazio). */
export function textoPuro(html: string | null): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
