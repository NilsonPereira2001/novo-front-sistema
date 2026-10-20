import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { TERMOS } from '../../../../core/config/terminologia';
import { onlyDigits } from '../../../../shared/utils/cpf';
import { PessoaDTO } from '../../models/pessoa.dto';
import {
  ArquivoPessoa,
  ConvenioDoMembro,
  DadosDesligamento,
  DependenteResumo,
  DocumentoGerado,
  Indicacao,
  PerfilPessoa,
  PessoaDetalhe,
  TipoDocumento,
} from '../models/pessoa-detalhe.model';
import { perfilDoTipo, situacaoDe } from '../models/perfil-config';
import { PessoaDetalheFonte } from './pessoa-detalhe-fonte';

/**
 * ⚠️ DADOS FICTÍCIOS — somente para desenvolver e validar a tela enquanto os
 * endpoints de detalhe não existem. Nada aqui chama o backend e nada é salvo:
 * as ações (desligar, reativar, enviar arquivo) alteram apenas a memória do
 * navegador e somem ao recarregar.
 *
 * Remover este arquivo quando `PessoaDetalheApi` for implementada.
 */

const LATENCIA_MS = 350;

const NOMES = [
  'Maria das Graças Souza',
  'José Carlos Albuquerque',
  'Ana Paula Ferreira Lima',
  'Antônio Marcos Silva',
  'Francisca Helena Rocha',
  'Paulo Roberto Cavalcante',
  'Juliana Mendes Barros',
  'Ricardo Henrique Tavares',
];
const FILHOS = ['Lucas', 'Beatriz', 'Pedro', 'Sofia', 'Miguel', 'Laura'];

/** CPF com dígitos verificadores válidos, derivado do id (determinístico). */
function cpfFicticio(seed: number): string {
  const base = String(100000000 + ((seed * 7919) % 899999999)).slice(0, 9).split('').map(Number);
  const dv = (nums: number[]) => {
    const soma = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join('');
}

const espera = <T>(valor: T): Observable<T> => of(valor).pipe(delay(LATENCIA_MS));

@Injectable()
export class PessoaDetalheDemo extends PessoaDetalheFonte {
  readonly demonstracao = true;

  private readonly pessoas = new Map<number, PessoaDetalhe>();
  private readonly listaArquivos = new Map<number, ArquivoPessoa[]>();
  private readonly conteudos = new Map<number, Blob>();
  private proximoArquivo = 1;

  detalhe(id: number, resumo?: PessoaDTO | null): Observable<PessoaDetalhe> {
    return espera(this.obter(id, resumo));
  }

  convenios(id: number): Observable<ConvenioDoMembro[]> {
    const p = this.obter(id);
    if (p.perfil !== 'membro') {
      return espera([]);
    }
    const desde = p.adesao?.primeiraAdesao?.slice(0, 10) ?? '2023-02-01';
    const status = situacaoDe(p.status) === 'desligado' ? 'CANCELADO' : 'ATIVO';
    return espera([
      { id: 1, nome: 'Plano odontológico', fixo: true, valor: 32.9, dataAdesao: desde, status },
      { id: 2, nome: 'Seguro de vida em grupo', fixo: true, valor: 18.5, dataAdesao: desde, status },
      { id: 3, nome: 'Farmácia conveniada', fixo: false, valor: null, dataAdesao: '2024-06-12', status },
    ]);
  }

  indicacoes(id: number): Observable<Indicacao[]> {
    const p = this.obter(id);
    if (p.perfil !== 'membro' || id % 3 === 2) {
      return espera([]); // alguns sem indicações, para ver o estado vazio
    }
    return espera(
      [1, 2].map((k) => {
        const indicado = this.obter(800000 + id * 10 + k);
        return {
          id: indicado.id,
          nome: indicado.pessoais.nome,
          cpf: indicado.pessoais.cpf,
          dataCadastro: indicado.dataCadastro,
          status: indicado.status,
        };
      }),
    );
  }

  dependentes(id: number): Observable<DependenteResumo[]> {
    const p = this.obter(id);
    if (p.perfil !== 'membro') {
      return espera([]);
    }
    return espera(
      this.idsDependentes(id).map((depId) => {
        const d = this.obter(depId);
        return {
          id: d.id,
          nome: d.pessoais.nome,
          cpf: d.pessoais.cpf,
          parentesco: d.titular?.parentesco ?? null,
          dataNascimento: d.pessoais.dataNascimento,
          status: d.status,
        };
      }),
    );
  }

  arquivos(id: number): Observable<ArquivoPessoa[]> {
    return espera([...this.arquivosDe(id)]);
  }

  enviarArquivo(id: number, arquivo: File, categoria: string): Observable<ArquivoPessoa> {
    const novo: ArquivoPessoa = {
      id: this.proximoArquivo++,
      nome: arquivo.name,
      categoria,
      tipo: arquivo.type || null,
      tamanho: arquivo.size,
      enviadoEm: new Date().toISOString(),
      enviadoPor: 'Você',
    };
    this.conteudos.set(novo.id, arquivo);
    this.listaArquivos.set(id, [novo, ...this.arquivosDe(id)]);
    return espera(novo);
  }

  baixarArquivo(id: number, arquivoId: number): Observable<Blob> {
    const conteudo =
      this.conteudos.get(arquivoId) ??
      new Blob(['Arquivo fictício da demonstração.'], { type: 'text/plain' });
    return espera(conteudo);
  }

  removerArquivo(id: number, arquivoId: number): Observable<void> {
    this.listaArquivos.set(
      id,
      this.arquivosDe(id).filter((a) => a.id !== arquivoId),
    );
    this.conteudos.delete(arquivoId);
    return espera(undefined);
  }

  desligar(id: number, dados: DadosDesligamento): Observable<PessoaDetalhe> {
    const p = this.obter(id);
    if (situacaoDe(p.status) === 'desligado') {
      return throwError(() => new Error('já desligado'));
    }
    return espera(this.salvar({ ...p, status: 'DESLIGADO', desligamento: { ...dados } }));
  }

  reativar(id: number): Observable<PessoaDetalhe> {
    const p = this.obter(id);
    const adesao = p.adesao ? { ...p.adesao, ultimaAdesao: new Date().toISOString() } : undefined;
    return espera(this.salvar({ ...p, status: 'ATIVO', desligamento: null, adesao }));
  }

  documento(_id: number, _tipo: TipoDocumento): Observable<DocumentoGerado> {
    return espera({ formato: 'previa-demonstracao' });
  }

  // --- Geração dos registros fictícios ---------------------------------------

  private salvar(p: PessoaDetalhe): PessoaDetalhe {
    this.pessoas.set(p.id, p);
    return p;
  }

  private obter(id: number, resumo?: PessoaDTO | null): PessoaDetalhe {
    return this.pessoas.get(id) ?? this.salvar(this.gerar(id, resumo));
  }

  private idsDependentes(titularId: number): number[] {
    return [1, 2].map((k) => 900000 + titularId * 10 + k);
  }

  private gerar(id: number, resumo?: PessoaDTO | null): PessoaDetalhe {
    if (id >= 900000) {
      return this.gerarDependente(id);
    }
    const perfil: PerfilPessoa = resumo ? perfilDoTipo(resumo.tipo) : 'membro';
    if (perfil === 'dependente') {
      return this.gerarDependente(id, resumo);
    }

    const nome = resumo?.nome?.trim() || NOMES[id % NOMES.length];
    const status = resumo?.status ?? (id % 4 === 0 ? 'DESLIGADO' : 'ATIVO');
    const desligado = situacaoDe(status) === 'desligado';
    const telefonePrincipal = resumo?.telefonePrincipal ? onlyDigits(resumo.telefonePrincipal) : '82999' + String(100000 + (id % 899999)).slice(0, 6);
    const primeiroNome = nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const base: PessoaDetalhe = {
      id,
      perfil,
      tipoNome: resumo?.tipo ?? (perfil === 'funcionario' ? 'FUNCIONARIO' : TERMOS.membro.toUpperCase()),
      status,
      restricao: typeof resumo?.restricao === 'string' ? resumo.restricao : id % 5 === 0 ? 'INADIMPLENTE' : 'NÃO',
      foto: null,
      dataCadastro: resumo?.dataCadastro ?? '2023-02-01T13:20:00Z',
      pessoais: {
        nome,
        cpf: resumo?.cpf ?? cpfFicticio(id),
        nomeGuerra: perfil === 'membro' ? nome.split(' ').slice(-1)[0] : null,
        dataNascimento: '1984-07-19',
        sexo: id % 2 === 0 ? 'Masculino' : 'Feminino',
        estadoCivil: 'Casado(a)',
        email: `${primeiroNome}.exemplo@email.com`,
        rg: String(2000000 + id),
        naturalidade: 'Maceió/AL',
        nomePai: 'Severino Souza',
        nomeMae: 'Josefa Souza',
        matricula: perfil === 'membro' ? String(100000 + id) : `F-${String(id).padStart(4, '0')}`,
      },
      endereco: {
        cep: '57020000',
        logradouro: 'Rua do Comércio',
        numero: String(100 + (id % 400)),
        complemento: 'Apto 201',
        bairro: 'Centro',
        cidade: 'Maceió',
        estado: 'Alagoas',
      },
      telefones: [
        { telefone: telefonePrincipal, principal: true },
        { telefone: '8233214455', principal: false },
      ],
      bancarios: {
        banco: 'Caixa Econômica Federal',
        tipoConta: 'Corrente',
        agencia: '0055',
        numeroConta: `${10000 + id}-3`,
        tipoPix: 'CPF',
        chavePix: resumo?.cpf ?? cpfFicticio(id),
      },
    };

    if (perfil === 'funcionario') {
      return {
        ...base,
        funcional: { cargo: 'Assistente administrativo', setor: 'Atendimento', dataAdmissao: '2022-03-14' },
      };
    }

    // Membro: registra também os dependentes, para os links funcionarem.
    this.idsDependentes(id).forEach((depId, i) =>
      this.pessoas.has(depId) ? null : this.salvar(this.gerarDependente(depId, null, { id, nome }, i)),
    );

    return {
      ...base,
      vinculo: {
        tipoVinculo: 'MILITAR',
        instituicao: 'Polícia Militar de Alagoas',
        unidade: '1º Batalhão de Polícia Militar',
        graduacao: 'Cabo',
        quadro: 'QPMP-0',
        dataIncorporacao: '2008-05-02',
        empresaConveniada: null,
      },
      adesao: {
        tipoSocio: 'Efetivo',
        formaPagamento: 'Desconto em folha',
        primeiraAdesao: '2023-02-01T13:20:00Z',
        ultimaAdesao: '2023-02-01T13:20:00Z',
        codigoCadastramento: `CAD-${String(id).padStart(6, '0')}`,
        valorCredito: 0,
        indicador: id < 800000 ? { id: id + 7, nome: NOMES[(id + 7) % NOMES.length] } : null,
      },
      desligamento: desligado
        ? { data: '2026-03-10', motivo: `Solicitação do próprio ${TERMOS.membroMin}.` }
        : null,
    };
  }

  private gerarDependente(
    id: number,
    resumo?: PessoaDTO | null,
    titular?: { id: number; nome: string },
    indice = id % 2,
  ): PessoaDetalhe {
    const titularId = titular?.id ?? (id >= 900000 ? Math.floor((id - 900000) / 10) : id + 1);
    const titularNome = titular?.nome ?? this.obter(titularId).pessoais.nome;
    const sobrenome = titularNome.split(' ').slice(-1)[0];
    const filho = indice % 2 === 0;
    const nome = resumo?.nome?.trim() || (filho ? `${FILHOS[id % FILHOS.length]} ${sobrenome}` : `Cláudia ${sobrenome}`);
    return {
      id,
      perfil: 'dependente',
      tipoNome: resumo?.tipo ?? 'DEPENDENTE',
      status: resumo?.status ?? 'ATIVO',
      restricao: 'NÃO',
      foto: null,
      dataCadastro: resumo?.dataCadastro ?? '2023-02-01T13:25:00Z',
      pessoais: {
        nome,
        cpf: resumo?.cpf ?? cpfFicticio(id),
        nomeGuerra: null,
        dataNascimento: filho ? '2012-09-03' : '1987-11-25',
        sexo: filho ? 'Masculino' : 'Feminino',
        estadoCivil: filho ? 'Solteiro(a)' : 'Casado(a)',
        email: null,
        rg: null,
        naturalidade: 'Maceió/AL',
        nomePai: filho ? titularNome : null,
        nomeMae: null,
        matricula: null,
      },
      endereco: null,
      telefones: resumo?.telefonePrincipal ? [{ telefone: onlyDigits(resumo.telefonePrincipal), principal: true }] : [],
      bancarios: null,
      titular: { id: titularId, nome: titularNome, parentesco: filho ? 'Filho(a)' : 'Cônjuge' },
    };
  }

  private arquivosDe(id: number): ArquivoPessoa[] {
    let lista = this.listaArquivos.get(id);
    if (!lista) {
      const p = this.obter(id);
      const base = [
        { nome: 'Documento de identidade.pdf', categoria: 'Documentos pessoais', tamanho: 482_133 },
        { nome: 'Comprovante de residência.pdf', categoria: 'Comprovantes', tamanho: 215_904 },
      ];
      if (p.perfil === 'membro') {
        base.push({ nome: 'Contrato de adesão assinado.pdf', categoria: 'Contratos', tamanho: 1_204_551 });
      }
      lista = base.map((a) => ({
        ...a,
        id: this.proximoArquivo++,
        tipo: 'application/pdf',
        enviadoEm: '2023-02-01T14:02:00Z',
        enviadoPor: 'Atendimento',
      }));
      this.listaArquivos.set(id, lista);
    }
    return lista;
  }
}
