import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../../core/config/app-title';
import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { TelefonePipe } from '../../../../shared/pipes/telefone.pipe';
import { tamanhoLegivel } from '../../../pessoas/detalhe/abas/aba-arquivos';
import { AnexosAtendimento, PessoaDoAnexo } from '../../atendimentos/components/anexos-atendimento';
import { ANEXO_TIPOS_ACEITOS, Atendimento, AtendimentoDetalhe, ROTULO_SITUACAO, Situacao, isoLocal, problemaDoAnexo, situacaoDe } from '../../atendimentos/data/atendimentos-api';
import { AtendimentosService } from '../../atendimentos/data/atendimentos.service';
import { formatarCnj, statusProcesso } from '../../processos/data/processos-api';
import { mensagemDeErro } from '../../processos/data/processos.service';
import { ArquivoJuridico, FichaJuridica, estadoComPessoa } from '../data/pessoas-juridico-api';
import { PessoasJuridicoService } from '../data/pessoas-juridico.service';

type Aba = 'processos' | 'atendimentos' | 'arquivos';

/**
 * Ficha jurídica da pessoa: resumo, processos em que é parte, atendimentos,
 * arquivos do jurídico (anexar/abrir/remover) e procuração.
 * Rota: /juridico/pessoas/:id
 */
@Component({
  selector: 'app-pessoa-juridica',
  imports: [DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, CpfPipe, DisplayValuePipe, TelefonePipe, AnexosAtendimento],
  templateUrl: './pessoa-juridica.html',
  styleUrl: './pessoa-juridica.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoaJuridicaPage {
  readonly id = input<string | undefined>();

  private readonly service = inject(PessoasJuridicoService);
  private readonly atendimentosService = inject(AtendimentosService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly cnj = formatarCnj;
  protected readonly st = statusProcesso;
  protected readonly rotulo = ROTULO_SITUACAO;
  protected readonly tipos = ANEXO_TIPOS_ACEITOS;
  protected readonly agora = isoLocal(new Date());

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  protected readonly estado = loadFrom(this.idNumero, (id) => this.service.ficha(id ?? 0), this.tentar);
  private ultimo: FichaJuridica | null = null;
  protected readonly ficha = computed(() => {
    const e = this.estado();
    if (e.status === 'ready') this.ultimo = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimo : null;
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });
  /** Navegação para os formulários já com a pessoa. */
  protected readonly comPessoa = computed(() => {
    const f = this.ficha();
    return f ? estadoComPessoa(f.pessoa) : null;
  });

  protected readonly aba = signal<Aba>('processos');
  protected readonly abas: readonly { key: Aba; titulo: string; icon: 'scale' | 'message-square' | 'file-text' }[] = [
    { key: 'processos', titulo: 'Processos', icon: 'scale' },
    { key: 'atendimentos', titulo: 'Atendimentos', icon: 'message-square' },
    { key: 'arquivos', titulo: 'Arquivos', icon: 'file-text' },
  ];

  protected readonly aviso = signal<{ texto: string; tom: 'success' | 'danger' } | null>(null);

  // Procuração
  protected readonly gerandoProcuracao = signal(false);
  protected readonly pendenciasAbertas = signal(false);

  // Arquivos
  protected readonly descricao = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroArquivo = signal<string | null>(null);
  protected readonly abrindo = signal<number | null>(null);
  protected readonly removerDe = signal<ArquivoJuridico | null>(null);
  protected readonly removendo = signal(false);

  // Registro de atendimento
  protected readonly registro = signal<AtendimentoDetalhe | null>(null);
  protected readonly carregandoRegistro = signal<number | null>(null);
  protected readonly tituloRegistro = computed(() =>
    this.registro()?.atendimento.status === 'ATENDIDO' ? 'Registro do atendimento' : 'Atendimento',
  );

  constructor() {
    effect(() => {
      const f = this.ficha();
      this.title.setTitle(pageTitle(f ? `${f.pessoa.nome} · Jurídico` : 'Ficha jurídica'));
    });
  }

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected selecionarAba(a: Aba): void {
    this.aba.set(a);
  }
  protected tecladoAbas(ev: KeyboardEvent, i: number): void {
    const passo = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!passo) return;
    ev.preventDefault();
    const prox = this.abas[(i + passo + this.abas.length) % this.abas.length];
    this.aba.set(prox.key);
    queueMicrotask(() => document.getElementById('aba-' + prox.key)?.focus());
  }

  protected situacao(a: Atendimento): Situacao {
    return situacaoDe(a, this.agora);
  }
  protected nomeDe(c: { nome: string }): string {
    return c.nome;
  }
  protected tamanho(b: number | null): string {
    return tamanhoLegivel(b);
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  /** "2026-11-20" → Date ao meio-dia (evita virar o dia por fuso). */
  protected dia(iso: string | null): Date | null {
    return iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null;
  }

  // --- Procuração --------------------------------------------------------------------
  protected procuracao(f: FichaJuridica, forcar = false): void {
    if (f.pendenciasProcuracao.length && !forcar) {
      this.pendenciasAbertas.set(true);
      return;
    }
    this.pendenciasAbertas.set(false);
    this.gerandoProcuracao.set(true);
    this.service
      .procuracao(f.pessoa.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.gerandoProcuracao.set(false);
          abrirArquivo(blob, `procuracao-${f.pessoa.nome.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        },
        error: () => {
          this.gerandoProcuracao.set(false);
          this.aviso.set({ texto: 'Não foi possível gerar a procuração. Confira o cadastro da pessoa e tente novamente.', tom: 'danger' });
        },
      });
  }

  // --- Arquivos ----------------------------------------------------------------------
  protected escolheu(ev: Event, idPessoa: number): void {
    const input = ev.target as HTMLInputElement;
    const arquivos = [...(input.files ?? [])];
    input.value = '';
    if (!arquivos.length) return;
    const problemas = arquivos.map((f) => [f, problemaDoAnexo(f)] as const).filter(([, p]) => p !== null);
    this.erroArquivo.set(problemas.length ? problemas.map(([f, p]) => `${f.name}: ${p}`).join(' ') : null);
    const aceitos = arquivos.filter((f) => problemaDoAnexo(f) === null);
    // A descrição só vale quando é um arquivo só.
    this.enviar(aceitos, idPessoa, aceitos.length === 1 ? this.descricao().trim() : '', 0);
  }

  private enviar(arquivos: File[], idPessoa: number, descricao: string, enviados: number): void {
    const [primeiro, ...resto] = arquivos;
    if (!primeiro) {
      this.enviando.set(false);
      if (enviados) {
        this.descricao.set('');
        this.aviso.set({ texto: enviados === 1 ? 'Arquivo anexado.' : `${enviados} arquivos anexados.`, tom: 'success' });
        this.recarregar();
      }
      return;
    }
    this.enviando.set(true);
    this.service
      .anexar(idPessoa, primeiro, descricao || null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.enviar(resto, idPessoa, '', enviados + 1),
        error: (e: unknown) => {
          this.erroArquivo.set(`${primeiro.name}: ${mensagemDeErro(e, 'anexar o arquivo')}`);
          this.enviar(resto, idPessoa, '', enviados);
        },
      });
  }

  protected abrir(idPessoa: number, a: ArquivoJuridico): void {
    this.abrindo.set(a.id);
    this.service
      .baixar(idPessoa, a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.abrindo.set(null);
          abrirArquivo(blob, a.nome);
        },
        error: () => {
          this.abrindo.set(null);
          this.erroArquivo.set('Não foi possível abrir o arquivo.');
        },
      });
  }

  protected confirmarRemocao(idPessoa: number): void {
    const a = this.removerDe();
    if (!a || this.removendo()) return;
    this.removendo.set(true);
    this.service
      .remover(idPessoa, a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removendo.set(false);
          this.removerDe.set(null);
          this.aviso.set({ texto: 'Arquivo removido.', tom: 'success' });
          this.recarregar();
        },
        error: (e: unknown) => {
          this.removendo.set(false);
          this.removerDe.set(null);
          this.erroArquivo.set(mensagemDeErro(e, 'remover o arquivo'));
        },
      });
  }

  // --- Registro de atendimento -------------------------------------------------------
  protected verRegistro(a: Atendimento): void {
    this.carregandoRegistro.set(a.id);
    this.atendimentosService
      .detalhe(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.carregandoRegistro.set(null);
          this.registro.set(d);
        },
        error: () => {
          this.carregandoRegistro.set(null);
          this.aviso.set({ texto: 'Não foi possível abrir o atendimento.', tom: 'danger' });
        },
      });
  }

  protected pessoasDoAnexo(d: AtendimentoDetalhe): PessoaDoAnexo[] {
    const out: PessoaDoAnexo[] = [];
    for (const p of d.atendimento.pessoas) {
      if (p.idPessoa && !out.some((x) => x.idPessoa === p.idPessoa)) out.push({ idPessoa: p.idPessoa, nome: p.nome });
    }
    return out;
  }

  protected anexosAlterados(): void {
    const r = this.registro();
    if (r) {
      this.atendimentosService
        .detalhe(r.atendimento.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (d) => this.registro.set(d), error: () => undefined });
    }
    this.recarregar();
  }
}

/** PDF e imagem abrem em nova aba; os demais são baixados. */
function abrirArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const visualizavel = blob.type === 'application/pdf' || blob.type.startsWith('image/') || /\.(pdf|png|jpe?g)$/i.test(nome);
  const aba = visualizavel ? window.open(url, '_blank') : null;
  if (!aba) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
