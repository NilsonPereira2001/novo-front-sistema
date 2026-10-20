import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NEVER } from 'rxjs';
import { Router, RouterLink } from '@angular/router';

import { pageTitle } from '../../../core/config/app-title';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../shared/pipes/display-value.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { isRecord } from '../../../shared/utils/json-read';
import { initials } from '../../../shared/utils/text';
import { PessoaDTO } from '../models/pessoa.dto';
import { AbaArquivos } from './abas/aba-arquivos';
import { AbaDados } from './abas/aba-dados';
import { AbaConvenios, AbaDependentes, AbaIndicacoes, tomDoStatus } from './abas/aba-listas';
import { DesligarDialog } from './components/desligar-dialog';
import { PessoaDetalheFonte } from './data/pessoa-detalhe-fonte';
import { DocumentoDialog } from './documentos/documento-dialog';
import { DadosDesligamento, PessoaDetalhe } from './models/pessoa-detalhe.model';
import {
  AbaKey,
  DocumentoConfig,
  PERFIS,
  motivoIndisponivel,
  situacaoDe,
  temRestricao,
} from './models/perfil-config';

/**
 * Detalhe de uma pessoa: uma única tela para membro, funcionário e
 * dependente. Abas, documentos e ações vêm de `PERFIS` (perfil-config.ts).
 *
 * Rota: /pessoas/:id?aba=convenios — a aba fica na URL para o "voltar"
 * do navegador funcionar.
 */
@Component({
  selector: 'app-pessoa-detalhe',
  imports: [
    DatePipe,
    RouterLink,
    Alert,
    Dialog,
    Icon,
    LoadError,
    CpfPipe,
    DisplayValuePipe,
    TelefonePipe,
    AbaDados,
    AbaConvenios,
    AbaIndicacoes,
    AbaDependentes,
    AbaArquivos,
    DesligarDialog,
    DocumentoDialog,
  ],
  templateUrl: './pessoa-detalhe.html',
  styleUrl: './pessoa-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'fecharMenuFora($event)',
    '(document:keydown.escape)': 'menuDocs.set(false)',
  },
})
export class PessoaDetalhePage {
  /** Parâmetro de rota `:id` (ligado por withComponentInputBinding). */
  readonly id = input.required<string>();
  /** Query param `?aba=`. */
  readonly aba = input<string | undefined>();

  private readonly fonte = inject(PessoaDetalheFonte);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menuDocsRef');

  protected readonly demonstracao = this.fonte.demonstracao;
  protected readonly initials = initials;
  protected readonly tom = tomDoStatus;

  // --- Carga ----------------------------------------------------------------
  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(
    this.idNumero,
    (id) => (id === null ? NEVER : this.fonte.detalhe(id, resumoDaNavegacao(id))),
    this.tentar,
  );
  /** Detalhe atual; atualizado localmente após desligar/reativar. */
  protected readonly detalhe = linkedSignal<PessoaDetalhe | null>(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    if (this.idNumero() === null) {
      return 'not-found' as const;
    }
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  // --- Perfil, abas e situação ----------------------------------------------
  protected readonly perfil = computed(() => {
    const d = this.detalhe();
    return d ? PERFIS[d.perfil] : null;
  });
  protected readonly situacao = computed(() => situacaoDe(this.detalhe()?.status ?? null));
  protected readonly restricao = computed(() => temRestricao(this.detalhe()?.restricao ?? null));
  protected readonly abaAtiva = computed<AbaKey>(() => {
    const abas = this.perfil()?.abas ?? [];
    return abas.find((a) => a.key === this.aba())?.key ?? 'dados';
  });
  protected readonly telefonePrincipal = computed(() => {
    const tels = this.detalhe()?.telefones ?? [];
    return (tels.find((t) => t.principal) ?? tels[0])?.telefone ?? null;
  });

  // --- Ações ------------------------------------------------------------------
  protected readonly menuDocs = signal(false);
  protected readonly docAberto = signal<DocumentoConfig | null>(null);
  protected readonly desligarAberto = signal(false);
  protected readonly reativarAberto = signal(false);
  protected readonly processando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    effect(() => {
      const nome = this.detalhe()?.pessoais.nome;
      this.title.setTitle(pageTitle(nome ?? 'Pessoa'));
    });
    // Ao trocar de pessoa (ex.: clicar num dependente), limpa avisos e janelas.
    effect(() => {
      this.idNumero();
      this.aviso.set(null);
      this.docAberto.set(null);
      this.menuDocs.set(false);
    });
  }

  protected tentarDeNovo(): void {
    this.tentar.update((n) => n + 1);
  }

  protected selecionarAba(key: AbaKey): void {
    void this.router.navigate([], {
      queryParams: { aba: key === 'dados' ? null : key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Setas ←/→, Home e End percorrem as abas (padrão WAI-ARIA). */
  protected tecladoAbas(event: KeyboardEvent, indice: number): void {
    const abas = this.perfil()?.abas ?? [];
    let alvo = -1;
    if (event.key === 'ArrowRight') alvo = (indice + 1) % abas.length;
    else if (event.key === 'ArrowLeft') alvo = (indice - 1 + abas.length) % abas.length;
    else if (event.key === 'Home') alvo = 0;
    else if (event.key === 'End') alvo = abas.length - 1;
    if (alvo < 0) {
      return;
    }
    event.preventDefault();
    this.selecionarAba(abas[alvo].key);
    document.getElementById('aba-' + abas[alvo].key)?.focus();
  }

  protected indisponivel(doc: DocumentoConfig): string | null {
    return motivoIndisponivel(doc.tipo, this.situacao());
  }

  protected abrirDocumento(doc: DocumentoConfig): void {
    if (this.indisponivel(doc)) {
      return;
    }
    this.menuDocs.set(false);
    this.docAberto.set(doc);
  }

  protected abrirDesligar(): void {
    this.erroAcao.set(null);
    this.desligarAberto.set(true);
  }

  protected abrirReativar(): void {
    this.erroAcao.set(null);
    this.reativarAberto.set(true);
  }

  protected desligar(dados: DadosDesligamento): void {
    const d = this.detalhe();
    if (!d) return;
    this.executar(this.fonte.desligar(d.id, dados), () => {
      this.desligarAberto.set(false);
      return `${d.pessoais.nome} foi desligado(a).`;
    });
  }

  protected reativar(): void {
    const d = this.detalhe();
    if (!d) return;
    this.executar(this.fonte.reativar(d.id), () => {
      this.reativarAberto.set(false);
      return `${d.pessoais.nome} foi reativado(a).`;
    });
  }

  private executar(
    acao: ReturnType<PessoaDetalheFonte['reativar']>,
    sucesso: () => string,
  ): void {
    this.processando.set(true);
    this.erroAcao.set(null);
    acao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (atualizado) => {
        this.detalhe.set(atualizado);
        this.processando.set(false);
        this.aviso.set(sucesso());
      },
      error: () => {
        this.processando.set(false);
        this.erroAcao.set('O servidor não concluiu a operação. Tente novamente.');
      },
    });
  }

  fecharMenuFora(event: MouseEvent): void {
    if (this.menuDocs() && !this.menuRef()?.nativeElement.contains(event.target as Node)) {
      this.menuDocs.set(false);
    }
  }
}

/**
 * Linha da lista que levou a esta tela (enviada no `state` da navegação).
 * Só é aceita se for do mesmo id; serve à demonstração para manter nome/CPF.
 */
function resumoDaNavegacao(id: number | null): PessoaDTO | null {
  const state: unknown = history.state;
  if (!isRecord(state) || !isRecord(state['resumo'])) {
    return null;
  }
  const resumo = state['resumo'] as unknown as PessoaDTO;
  return Number(resumo.id) === id ? resumo : null;
}
