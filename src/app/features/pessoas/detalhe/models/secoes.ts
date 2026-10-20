import { formatCurrency, formatDate } from '@angular/common';

import { TERMOS } from '../../../../core/config/terminologia';
import { IconName } from '../../../../shared/components/icon/icon';
import { formatCpf } from '../../../../shared/utils/cpf';
import { applyMask } from '../../../../shared/utils/masks';
import { formatTelefone } from '../../../../shared/utils/telefone';
import { PessoaDetalhe } from './pessoa-detalhe.model';

export interface Campo {
  readonly rotulo: string;
  /** Já formatado para exibição ("—" quando vazio). */
  readonly valor: string;
  /** Link interno opcional (ex.: indicador, titular). */
  readonly link?: readonly (string | number)[];
  /** Ocupa a linha inteira (endereço, motivo...). */
  readonly largo?: boolean;
}

export interface Secao {
  readonly titulo: string;
  readonly icon: IconName;
  readonly campos: readonly Campo[];
}

const VAZIO = '—';

/**
 * Seções exibidas na aba "Dados" e na ficha. Uma única fonte para as duas,
 * para a ficha impressa nunca divergir da tela.
 */
export function secoesDe(p: PessoaDetalhe, locale: string): Secao[] {
  const txt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : VAZIO);
  const data = (v: string | null | undefined) => (v ? formatDate(v, 'dd/MM/yyyy', locale) : VAZIO);
  const dinheiro = (v: number | null | undefined) =>
    v === null || v === undefined ? VAZIO : formatCurrency(v, locale, 'R$', 'BRL');

  const ps = p.pessoais;
  const secoes: Secao[] = [
    {
      titulo: 'Dados pessoais',
      icon: 'user',
      campos: [
        { rotulo: 'Nome completo', valor: txt(ps.nome), largo: true },
        { rotulo: 'CPF', valor: formatCpf(ps.cpf) || VAZIO },
        { rotulo: 'RG', valor: txt(ps.rg) },
        ...(p.perfil === 'membro' ? [{ rotulo: 'Nome de guerra', valor: txt(ps.nomeGuerra) }] : []),
        { rotulo: 'Data de nascimento', valor: data(ps.dataNascimento) },
        { rotulo: 'Sexo', valor: txt(ps.sexo) },
        { rotulo: 'Estado civil', valor: txt(ps.estadoCivil) },
        { rotulo: 'Naturalidade', valor: txt(ps.naturalidade) },
        { rotulo: 'E-mail', valor: txt(ps.email) },
        { rotulo: 'Nome do pai', valor: txt(ps.nomePai) },
        { rotulo: 'Nome da mãe', valor: txt(ps.nomeMae) },
      ],
    },
  ];

  if (p.titular) {
    secoes.push({
      titulo: 'Titular',
      icon: 'users',
      campos: [
        { rotulo: `${TERMOS.membro} titular`, valor: p.titular.nome, link: ['/pessoas', p.titular.id] },
        { rotulo: 'Parentesco', valor: txt(p.titular.parentesco) },
      ],
    });
  }

  const contatos: Campo[] = p.telefones.length
    ? p.telefones.map((t, i) => ({
        rotulo: t.principal ? 'Telefone principal' : `Telefone ${i + 1}`,
        valor: formatTelefone(t.telefone) || VAZIO,
      }))
    : [{ rotulo: 'Telefones', valor: 'Nenhum telefone cadastrado' }];
  const e = p.endereco;
  secoes.push({
    titulo: 'Endereço e contatos',
    icon: 'home',
    campos: [
      {
        rotulo: 'Endereço',
        valor: e
          ? [e.logradouro, e.numero, e.complemento].filter((x) => x && x.trim()).join(', ') || VAZIO
          : VAZIO,
        largo: true,
      },
      { rotulo: 'Bairro', valor: txt(e?.bairro) },
      { rotulo: 'Cidade / UF', valor: e ? [e.cidade, e.estado].filter(Boolean).join(' / ') || VAZIO : VAZIO },
      { rotulo: 'CEP', valor: e?.cep ? applyMask('cep', e.cep) : VAZIO },
      ...contatos,
    ],
  });

  if (p.vinculo) {
    const v = p.vinculo;
    secoes.push({
      titulo: 'Dados funcionais',
      icon: 'briefcase',
      campos: [
        { rotulo: 'Tipo de vínculo', valor: txt(v.tipoVinculo) },
        { rotulo: 'Instituição', valor: txt(v.instituicao) },
        { rotulo: 'Matrícula', valor: txt(ps.matricula) },
        { rotulo: 'Unidade', valor: txt(v.unidade) },
        { rotulo: 'Graduação', valor: txt(v.graduacao) },
        { rotulo: 'Quadro', valor: txt(v.quadro) },
        { rotulo: 'Data de incorporação', valor: data(v.dataIncorporacao) },
        ...(v.empresaConveniada ? [{ rotulo: 'Empresa conveniada', valor: v.empresaConveniada }] : []),
      ],
    });
  }

  if (p.funcional) {
    const f = p.funcional;
    secoes.push({
      titulo: 'Dados funcionais',
      icon: 'briefcase',
      campos: [
        { rotulo: 'Matrícula', valor: txt(ps.matricula) },
        { rotulo: 'Cargo', valor: txt(f.cargo) },
        { rotulo: 'Setor', valor: txt(f.setor) },
        { rotulo: 'Data de admissão', valor: data(f.dataAdmissao) },
      ],
    });
  }

  if (p.adesao) {
    const a = p.adesao;
    secoes.push({
      titulo: 'Adesão',
      icon: 'badge-check',
      campos: [
        { rotulo: 'Tipo de sócio', valor: txt(a.tipoSocio) },
        { rotulo: 'Forma de pagamento', valor: txt(a.formaPagamento) },
        { rotulo: 'Primeira adesão', valor: data(a.primeiraAdesao) },
        { rotulo: 'Última adesão', valor: data(a.ultimaAdesao) },
        { rotulo: 'Código de cadastramento', valor: txt(a.codigoCadastramento) },
        { rotulo: 'Crédito', valor: dinheiro(a.valorCredito) },
        a.indicador
          ? { rotulo: 'Indicado por', valor: a.indicador.nome, link: ['/pessoas', a.indicador.id] }
          : { rotulo: 'Indicado por', valor: VAZIO },
      ],
    });
  }

  if (p.bancarios) {
    const b = p.bancarios;
    secoes.push({
      titulo: 'Dados bancários',
      icon: 'receipt',
      campos: [
        { rotulo: 'Banco', valor: txt(b.banco) },
        { rotulo: 'Tipo de conta', valor: txt(b.tipoConta) },
        { rotulo: 'Agência', valor: txt(b.agencia) },
        { rotulo: 'Conta', valor: txt(b.numeroConta) },
        { rotulo: 'Tipo de Pix', valor: txt(b.tipoPix) },
        { rotulo: 'Chave Pix', valor: txt(b.chavePix) },
      ],
    });
  }

  if (p.desligamento) {
    secoes.push({
      titulo: 'Desligamento',
      icon: 'power',
      campos: [
        { rotulo: 'Data do desligamento', valor: data(p.desligamento.data) },
        { rotulo: 'Motivo', valor: txt(p.desligamento.motivo), largo: true },
      ],
    });
  }

  return secoes;
}
