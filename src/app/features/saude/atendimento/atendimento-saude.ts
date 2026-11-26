import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../core/config/app-title';
import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { AcaoAgendamentoDialog, AcaoDialogo } from '../components/acao-agendamento-dialog';
import { SinaisCampos } from '../components/sinais-campos';
import { StatusSelo } from '../components/status-selo';
import { Detalhe, Ficha, SINAIS_VAZIO, SinaisFormValor, emAberto, horaTexto, problemaCid, temSinais } from '../data/saude-api';
import { SaudeService, abrirArquivo } from '../data/saude.service';

/**
 * Atendimento: detalhe do agendamento, chegada/falta/cancelamento e, para quem tem acesso clínico,
 * o registro (queixa, sinais vitais, evolução, diagnóstico, CID, conduta) e os anexos (resultados, laudos).
 * Rota: /saude/atendimentos/:id
 */
@Component({
  selector: 'app-atendimento-saude',
  imports: [DatePipe, RouterLink, Alert, Icon, LoadError, CpfPipe, TelefonePipe, AcaoAgendamentoDialog, SinaisCampos, StatusSelo],
  templateUrl: './atendimento-saude.html',
  styleUrl: './atendimento-saude.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtendimentoSaude {
  readonly id = input<string | undefined>();

  private readonly service = inject(SaudeService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly hora = horaTexto;
  protected readonly emAberto = emAberto;
  protected readonly hoje = hojeIso();

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => this.service.detalhe(id ?? 0), this.tentar);
  protected readonly atual = signal<Detalhe | null>(null);
  protected readonly d = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });
  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly alergias = computed(() => this.ficha()?.alergias ?? []);
  protected readonly podeAtender = computed(() => {
    const d = this.d();
    return !!d && d.clinico && emAberto(d.agendamento.status) && (d.agendamento.dataHora ?? '').slice(0, 10) <= this.hoje;
  });

  // Registro clínico
  protected readonly queixa = signal('');
  protected readonly evolucao = signal('');
  protected readonly diagnostico = signal('');
  protected readonly cid = signal('');
  protected readonly conduta = signal('');
  protected readonly observacao = signal('');
  protected readonly sinais = signal<SinaisFormValor>({ ...SINAIS_VAZIO });
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly problemaCid = computed(() => problemaCid(this.cid()));
  protected readonly processando = signal(false);
  protected readonly acao = signal<AcaoDialogo | null>(null);

  // Anexos
  protected readonly enviandoAnexo = signal(false);
  protected readonly abrindo = signal<number | null>(null);
  protected readonly erroAnexo = signal<string | null>(null);

  constructor() {
    effect(() => {
      const d = this.d();
      this.title.setTitle(pageTitle(d ? `Atendimento · ${d.agendamento.paciente ?? ''}` : 'Atendimento'));
    });
    // Ficha do paciente (alergias em destaque) quando o detalhe chega.
    effect(() => {
      const idPessoa = this.d()?.agendamento.idPessoa ?? null;
      if (!idPessoa || this.ficha()?.idPessoa === idPessoa) return;
      this.service
        .ficha(idPessoa)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (f) => this.ficha.set(f), error: () => undefined });
    });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  protected chegou(d: Detalhe): void {
    if (this.processando()) return;
    this.processando.set(true);
    this.erroAcao.set(null);
    this.service
      .presenca(d.agendamento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (x) => {
          this.processando.set(false);
          this.atual.set(x);
          this.aviso.set('Chegada registrada.');
        },
        error: (e: unknown) => {
          this.processando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'registrar a chegada'));
        },
      });
  }

  protected finalizar(d: Detalhe): void {
    this.tentou.set(true);
    const exame = d.agendamento.categoria === 'EXAME';
    if (this.enviando() || this.problemaCid() || (!exame && !this.evolucao().trim())) return;
    this.enviando.set(true);
    this.erroAcao.set(null);
    this.service
      .realizar(d.agendamento.id, {
        queixaPrincipal: this.queixa(),
        evolucaoClinica: this.evolucao(),
        diagnostico: this.diagnostico(),
        cid: this.cid(),
        conduta: this.conduta(),
        observacao: this.observacao(),
        sinais: temSinais(this.sinais()) ? this.sinais() : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (x) => {
          this.enviando.set(false);
          this.atual.set(x);
          this.aviso.set('Atendimento registrado.');
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'registrar o atendimento'));
        },
      });
  }

  protected anexar(d: Detalhe, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const arquivo = el.files?.[0];
    el.value = '';
    if (!arquivo || this.enviandoAnexo()) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      this.erroAnexo.set('O arquivo pode ter no máximo 10 MB.');
      return;
    }
    this.enviandoAnexo.set(true);
    this.erroAnexo.set(null);
    this.service
      .anexar(d.agendamento.id, arquivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (x) => {
          this.enviandoAnexo.set(false);
          this.atual.set(x);
        },
        error: (e: unknown) => {
          this.enviandoAnexo.set(false);
          this.erroAnexo.set(erroUsuarios(e, 'anexar o arquivo'));
        },
      });
  }

  protected abrir(d: Detalhe, idArquivo: number, nome: string): void {
    if (this.abrindo() !== null) return;
    this.abrindo.set(idArquivo);
    this.service
      .baixarAnexo(d.agendamento.id, idArquivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => {
          this.abrindo.set(null);
          abrirArquivo(b, nome);
        },
        error: () => {
          this.abrindo.set(null);
          this.erroAnexo.set('Não foi possível abrir o arquivo.');
        },
      });
  }

  protected remover(d: Detalhe, idArquivo: number): void {
    this.service
      .removerAnexo(d.agendamento.id, idArquivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (x) => this.atual.set(x), error: (e: unknown) => this.erroAnexo.set(erroUsuarios(e, 'remover o arquivo')) });
  }

  protected acaoSalva(r: { detalhe: Detalhe; mensagem: string }): void {
    this.acao.set(null);
    this.atual.set(r.detalhe);
    this.aviso.set(r.mensagem);
  }

  protected tamanho(b: number | null): string {
    if (b === null) return '';
    return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }
}
