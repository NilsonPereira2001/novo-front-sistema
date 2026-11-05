/**
 * Contrato dos arquivos da pessoa (ArquivoPessoaController, prefixo `files`).
 *
 *   GET    files/pessoa/{idPessoa}   → List<ArquivoPessoaDTO>
 *          { id, dataImportacao (LocalDateTime), nome, tamanho (String, bytes), departamento (nome) }
 *   POST   files/upload               multipart: pessoaId, arquivo, departamentoId, nome
 *   GET    files/api/file/{id}        → conteúdo do arquivo
 *   DELETE files/{id}                 → 204 / 404
 *   GET    departamento/todos         → List<Departamento> { id, nome }
 */

import { isRecord, readNumber, readString } from '../../../../shared/utils/json-read';
import { ArquivoPessoa } from '../models/pessoa-detalhe.model';

export const ARQUIVOS_API = {
  listar: (idPessoa: number) => `/files/pessoa/${idPessoa}`,
  enviar: '/files/upload',
  baixar: (idArquivo: number) => `/files/api/file/${idArquivo}`,
  remover: (idArquivo: number) => `/files/${idArquivo}`,
  departamentos: '/departamento/todos',
} as const;

const TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function toArquivoPessoa(raw: unknown): ArquivoPessoa | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readNumber(raw, ['id']);
  const nome = readString(raw, ['nome']);
  if (id === null || !Number.isSafeInteger(id) || !nome) {
    return null;
  }
  const tamanho = Number(raw['tamanho']);
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  return {
    id,
    nome,
    categoria: readString(raw, ['departamento']),
    tipo: TIPOS[extensao] ?? null,
    tamanho: raw['tamanho'] !== null && raw['tamanho'] !== undefined && Number.isFinite(tamanho) ? tamanho : null,
    enviadoEm: dataHoraLocal(raw['dataImportacao'] ?? raw['data_importacao']),
    enviadoPor: null,
  };
}

/**
 * `LocalDateTime` (sem fuso, hora do servidor): "2026-11-05T16:14:03.123"
 * ou [2026, 11, 5, 16, 14, 3, 123000000]. Sai em ISO sem fuso, que o
 * DatePipe interpreta como hora local.
 */
export function dataHoraLocal(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 19);
  }
  if (Array.isArray(value) && value.length >= 5 && value.every((n) => Number.isInteger(n))) {
    const [y, m, d, h, mi, sec = 0] = value as number[];
    const p = (n: number) => String(n).padStart(2, '0');
    return `${y}-${p(m)}-${p(d)}T${p(h)}:${p(mi)}:${p(sec)}`;
  }
  return null;
}

/** Corpo multipart do upload (o navegador define o boundary). */
export function toUploadBody(idPessoa: number, arquivo: File, idDepartamento: number): FormData {
  const body = new FormData();
  body.append('pessoaId', String(idPessoa));
  body.append('arquivo', arquivo, arquivo.name);
  body.append('departamentoId', String(idDepartamento));
  body.append('nome', arquivo.name);
  return body;
}

/** Mais recentes primeiro. */
export function ordenarArquivos(lista: ArquivoPessoa[]): ArquivoPessoa[] {
  return [...lista].sort((a, b) => (b.enviadoEm ?? '').localeCompare(a.enviadoEm ?? '') || b.id - a.id);
}
