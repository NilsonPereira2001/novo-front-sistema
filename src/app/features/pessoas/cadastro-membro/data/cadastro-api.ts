/**
 * Contrato das APIs usadas no cadastro de membro — único arquivo que conhece
 * caminhos e formatos do backend para esta tela.
 *
 * Os caminhos são exatamente os do Spring Boot; o prefixo `/backend` é
 * somado por `apiUrl()` (ver core/http/api-url.ts).
 */

import { HttpParams } from '@angular/common/http';

import { Opcao } from '../../../../shared/data/opcao.model';
import { JsonRecord, readString } from '../../../../shared/utils/json-read';
import { formatCpf } from '../../../../shared/utils/cpf';

export const CADASTRO_API = {
  sexos: '/sexo/todos',
  estadosCivis: '/estado/civil/todos',
  estados: '/estados/todos',
  bancos: '/bancos/todos',
  tiposPix: '/tipo/pix',
  formasPagamento: '/formas/pagamentos',
  tiposVinculo: '/listar/tipo/vinculo',
  instituicoesPorVinculo: (idVinculo: number) => `/instituicao/listar/por/vinculo/${idVinculo}`,
  /** POST com a instituição no corpo. ⚠️ Corpo assumido: `{ id }` — confirmar. */
  unidades: '/unidade/listar',
  graduacoes: '/graduacao/listar',
  quadros: '/listar/quadros',
  tiposSocio: '/tipo/socios/todos',
  convenios: '/convenios/fixos/nao/nativos/ativos',
  /** Pesquisa paginada: `filtro` + paginação do Spring. */
  empresasConveniadas: '/empresa/conveniada/todas/paginada',
  /**
   * ⚠️ PENDENTE: rota e método do controller que recebe `AssociadoNovoDTO`
   * não foram informados. Enquanto for `null`, a tela permite preencher e
   * revisar, mas não envia. Informe aqui (ex.: '/associado/salvar').
   */
  criar: null as string | null,
} as const;

/**
 * ⚠️ PENDENTE: formato esperado para `foto` (String no DTO).
 * - `null`: a foto é só pré-visualizada e NÃO é enviada (padrão até confirmar).
 * - `'data-url'`: envia `data:image/...;base64,...`.
 * - `'base64'`: envia só o conteúdo Base64, sem o prefixo `data:`.
 */
export const FOTO_FORMATO: 'data-url' | 'base64' | null = null;

/** Tamanho máximo aceito para a foto antes de converter (proteção do navegador). */
export const FOTO_TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024;

/** Quantos resultados mostrar nas buscas de indicador e empresa. */
export const BUSCA_TAMANHO = 10;

/** Corpo do POST /unidade/listar. ⚠️ Confirmar se o backend espera `{ id }`. */
export function toUnidadesBody(idInstituicao: number): { id: number } {
  return { id: idInstituicao };
}

export function toEmpresasParams(filtro: string): HttpParams {
  let params = new HttpParams().set('page', 0).set('size', BUSCA_TAMANHO);
  const texto = filtro.trim();
  if (texto) {
    params = params.set('filtro', texto);
  }
  return params;
}

/** Campos de rótulo por entidade (nomes dos atributos no backend). */
export const LABELS = {
  /** Entidade `Sexo`: `Long id`, `String sexo`. */
  sexo: ['sexo'],
  /** Entidade `FormaPagamento`: `Long id`, `String forma`. */
  formaPagamento: ['forma'],
  estado: ['nome', 'sigla', 'descricao'],
  banco: ['nome', 'descricao'],
  empresa: ['nome', 'razaoSocial', 'nomeFantasia', 'descricao'],
  convenio: ['nome', 'descricao'],
} as const;

/** Rótulo de convênio com a descrição complementar, se houver. */
export function convenioDetalhe(raw: JsonRecord, opcao: Opcao): Opcao {
  const descricao = readString(raw, ['descricao']);
  return descricao && descricao !== opcao.label ? { ...opcao, detalhe: descricao } : opcao;
}

/** Detalhe exibido na busca de indicador: CPF e tipo da pessoa. */
export function indicadorDetalhe(cpf: string | null, tipo: string | null): string | undefined {
  const partes = [cpf ? formatCpf(cpf) : null, tipo].filter((p): p is string => !!p);
  return partes.length > 0 ? partes.join(' · ') : undefined;
}
