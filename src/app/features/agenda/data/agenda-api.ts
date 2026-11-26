/**
 * Agenda pessoal (MuralController, PR #8 do back-novo). Cada usuário só vê os próprios.
 *
 *   GET    compromissos?de=AAAA-MM-DD&ate=AAAA-MM-DD   (máx. 100 dias)
 *   GET    compromissos/proximos?limite=5
 *   POST   compromissos · PUT compromissos/{id} · DELETE compromissos/{id}
 */

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { JsonRecord, isRecord, readNumber, readString } from '../../../shared/utils/json-read';
import { dataHoraLocal } from '../../pessoas/detalhe/data/arquivo.adapter';

export const AGENDA_API = {
  lista: '/compromissos',
  proximos: '/compromissos/proximos',
  item: (id: number) => `/compromissos/${id}`,
} as const;

export type CorCompromisso = 'azul' | 'laranja' | 'verde' | 'amarelo' | 'cinza';
/** Cores da paleta de visualização (validada para daltonismo) + neutro. */
export const CORES: readonly { readonly key: CorCompromisso; readonly rotulo: string; readonly css: string }[] = [
  { key: 'azul', rotulo: 'Azul', css: 'var(--viz-serie-1)' },
  { key: 'laranja', rotulo: 'Laranja', css: 'var(--viz-serie-2)' },
  { key: 'verde', rotulo: 'Verde', css: 'var(--viz-serie-3)' },
  { key: 'amarelo', rotulo: 'Amarelo', css: 'var(--viz-serie-4)' },
  { key: 'cinza', rotulo: 'Cinza', css: 'var(--color-gray-500)' },
];

export const LEMBRETES: readonly { readonly minutos: number | null; readonly rotulo: string }[] = [
  { minutos: null, rotulo: 'Sem lembrete' },
  { minutos: 0, rotulo: 'Na hora' },
  { minutos: 15, rotulo: '15 minutos antes' },
  { minutos: 30, rotulo: '30 minutos antes' },
  { minutos: 60, rotulo: '1 hora antes' },
  { minutos: 1440, rotulo: '1 dia antes' },
];

export interface Compromisso {
  readonly id: number;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly local: string | null;
  /** "AAAA-MM-DDTHH:mm:ss" (hora local). */
  readonly inicio: string;
  readonly fim: string;
  readonly diaInteiro: boolean;
  readonly cor: CorCompromisso;
  readonly lembreteMinutos: number | null;
}

export interface CompromissoPayload {
  readonly titulo: string;
  readonly descricao: string | null;
  readonly local: string | null;
  readonly inicio: string;
  readonly fim: string;
  readonly diaInteiro: boolean;
  readonly cor: CorCompromisso;
  readonly lembreteMinutos: number | null;
}

export function corValida(v: string | null): CorCompromisso {
  return CORES.some((c) => c.key === v) ? (v as CorCompromisso) : 'azul';
}
export function cssDaCor(c: CorCompromisso): string {
  return CORES.find((x) => x.key === c)?.css ?? CORES[0].css;
}

export function toCompromisso(r: JsonRecord): Compromisso | null {
  const id = readNumber(r, ['id']);
  const titulo = readString(r, ['titulo']);
  const inicio = dataHoraLocal(r['inicio']);
  if (id === null || !titulo || !inicio) return null;
  return {
    id,
    titulo,
    descricao: readString(r, ['descricao']),
    local: readString(r, ['local']),
    inicio,
    fim: dataHoraLocal(r['fim']) ?? inicio,
    diaInteiro: r['diaInteiro'] === true,
    cor: corValida(readString(r, ['cor'])),
    lembreteMinutos: readNumber(r, ['lembreteMinutos']),
  };
}

export function toCompromissos(body: unknown): Compromisso[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return body
    .filter(isRecord)
    .map(toCompromisso)
    .filter((c): c is Compromisso => c !== null);
}

export function toCompromissoUnico(body: unknown): Compromisso {
  const c = isRecord(body) ? toCompromisso(body) : null;
  if (!c) throw new UnexpectedResponseError();
  return c;
}

// --- Datas (sempre em hora local, sem fuso) ------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "AAAA-MM-DD" → Date à meia-noite local. */
export function deIsoDia(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somarDias(iso: string, n: number): string {
  const d = deIsoDia(iso);
  d.setDate(d.getDate() + n);
  return isoDia(d);
}

/** "AAAA-MM" válido → { ano, mes }. */
export function lerMes(v: string | null | undefined): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? '');
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { ano: Number(m[1]), mes } : null;
}

export function somarMeses(ano: number, mes: number, delta: number): string {
  const i = ano * 12 + (mes - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** 6 semanas (segunda a domingo) que cobrem o mês: 42 dias "AAAA-MM-DD". */
export function gradeDoMes(ano: number, mes: number): string[] {
  const primeiro = new Date(ano, mes - 1, 1);
  const recuo = (primeiro.getDay() + 6) % 7; // segunda = 0
  const inicio = isoDia(new Date(ano, mes - 1, 1 - recuo));
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
}

/** Dias (AAAA-MM-DD) que o compromisso ocupa. */
export function diasDe(c: Pick<Compromisso, 'inicio' | 'fim'>): string[] {
  const de = c.inicio.slice(0, 10);
  const ate = c.fim.slice(0, 10) < de ? de : c.fim.slice(0, 10);
  const out: string[] = [];
  for (let d = de; d <= ate && out.length < 40; d = somarDias(d, 1)) out.push(d);
  return out;
}

/** Compromissos por dia (dia inteiro primeiro, depois pelo horário). */
export function porDia(lista: readonly Compromisso[]): Map<string, Compromisso[]> {
  const mapa = new Map<string, Compromisso[]>();
  for (const c of lista) {
    for (const d of diasDe(c)) {
      const l = mapa.get(d) ?? [];
      l.push(c);
      mapa.set(d, l);
    }
  }
  for (const l of mapa.values()) {
    l.sort((a, b) => Number(b.diaInteiro) - Number(a.diaInteiro) || a.inicio.localeCompare(b.inicio) || a.id - b.id);
  }
  return mapa;
}

/** "09:30 – 10:30", "Dia inteiro", ou com as datas quando passa de um dia. */
export function horario(c: Compromisso): string {
  const di = c.inicio.slice(0, 10);
  const df = c.fim.slice(0, 10);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  if (c.diaInteiro) return di === df ? 'Dia inteiro' : `${dm(di)} a ${dm(df)}`;
  const hi = c.inicio.slice(11, 16);
  const hf = c.fim.slice(11, 16);
  return di === df ? `${hi} – ${hf}` : `${dm(di)} ${hi} – ${dm(df)} ${hf}`;
}

/** Monta o payload a partir dos campos do formulário (data/hora separadas). */
export function toPayload(f: {
  titulo: string;
  descricao: string;
  local: string;
  data: string;
  horaInicio: string;
  dataFim: string;
  horaFim: string;
  diaInteiro: boolean;
  cor: CorCompromisso;
  lembreteMinutos: number | null;
}): CompromissoPayload {
  const dataFim = f.dataFim || f.data;
  const inicio = f.diaInteiro ? `${f.data}T00:00:00` : `${f.data}T${f.horaInicio || '09:00'}:00`;
  const fim = f.diaInteiro ? `${dataFim}T23:59:00` : `${dataFim}T${f.horaFim || f.horaInicio || '10:00'}:00`;
  return {
    titulo: f.titulo.trim(),
    descricao: f.descricao.trim() || null,
    local: f.local.trim() || null,
    inicio,
    fim,
    diaInteiro: f.diaInteiro,
    cor: f.cor,
    lembreteMinutos: f.diaInteiro ? null : f.lembreteMinutos,
  };
}

/** Uma hora depois de "HH:mm" (limitado a 23:59). */
export function maisUmaHora(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  if (Number.isNaN(h)) return '10:00';
  return h >= 23 ? '23:59' : `${pad(h + 1)}:${pad(m || 0)}`;
}
