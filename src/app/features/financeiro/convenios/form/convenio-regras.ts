/** Regras do convênio sem dependência do Angular (testáveis isoladamente). */
import { applyMask } from '../../../../shared/utils/masks';
import { isCpfValido } from '../../../../shared/validators/brazil.validators';
import { lerValor } from '../../associados/data/financeiro-api';
import { Classe, ConvenioPayload, FichaConvenio } from '../data/convenios-api';

export function isCnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const s = pesos.reduce((t, p, i) => t + Number(base[i]) * p, 0);
    return s % 11 < 2 ? 0 : 11 - (s % 11);
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calc(d, p1);
  const dv2 = calc(d, [6, ...p1]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

/** null = ok; vazio também é ok (campo opcional). */
export function problemaDocumento(valor: string): 'documento' | null {
  const d = valor.replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 11) return isCpfValido(d) ? null : 'documento';
  if (d.length === 14) return isCnpjValido(d) ? null : 'documento';
  return 'documento';
}

/** Nativo e fixo exigem valor > 0. */
export function exigeValor(classe: Classe): boolean {
  return classe === 'NATIVO' || classe === 'FIXO';
}

export interface ConvenioFormValor {
  nome: string;
  nomeFantasia: string;
  tipo: string;
  cpfcnpj: string;
  classe: Classe;
  valor: string;
  relancaPendencia: boolean;
  associadosAntigos: boolean;
  idPublico: number | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  idEstado: number | null;
}

const txt = (v: string): string | null => (v.trim() ? v.trim().toUpperCase() : null);
const dig = (v: string): string | null => v.replace(/\D/g, '') || null;

export function toPayload(v: ConvenioFormValor, editando: boolean): ConvenioPayload {
  const nativo = v.classe === 'NATIVO';
  return {
    nome: v.nome.trim().toUpperCase(),
    nomeFantasia: txt(v.nomeFantasia),
    tipo: v.tipo || null,
    cpfcnpj: dig(v.cpfcnpj),
    nativo,
    fixo: nativo || v.classe === 'FIXO',
    relancaPendencia: v.relancaPendencia,
    // Só vale para o obrigatório e só na criação.
    associadosAntigos: !editando && nativo && v.associadosAntigos,
    idPublico: v.idPublico,
    valor: lerValor(v.valor),
    cep: dig(v.cep),
    logradouro: txt(v.logradouro),
    numero: txt(v.numero),
    complemento: txt(v.complemento),
    bairro: txt(v.bairro),
    cidade: txt(v.cidade),
    idEstado: v.idEstado,
  };
}

/** Valores do formulário a partir da ficha (edição). */
export function daFicha(f: FichaConvenio): ConvenioFormValor {
  const c = f.convenio;
  const e = f.endereco;
  const doc = c.cpfcnpj ?? '';
  return {
    nome: c.nome,
    nomeFantasia: c.nomeFantasia ?? '',
    tipo: c.tipo ?? '',
    cpfcnpj: doc ? applyMask('documento', doc) : '',
    classe: c.classe,
    valor: c.valor === null ? '' : c.valor.toFixed(2).replace('.', ','),
    relancaPendencia: c.relancaPendencia,
    associadosAntigos: false,
    idPublico: c.publico?.id ?? null,
    cep: e.cep ? applyMask('cep', e.cep) : '',
    logradouro: e.logradouro ?? '',
    numero: e.numero ?? '',
    complemento: e.complemento ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    idEstado: e.idEstado,
  };
}
