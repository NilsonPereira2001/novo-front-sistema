import { DatePipe, DecimalPipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../core/config/app-title';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { AcaoAgendamentoDialog, AcaoDialogo } from '../components/acao-agendamento-dialog';
import { ProntuarioDialog } from '../components/prontuario-dialog';
import { SinaisCampos } from '../components/sinais-campos';
import { StatusSelo } from '../components/status-selo';
import { Agendamento, Detalhe, Ficha, Prontuario, ROTULO_DIREITO, SINAIS_VAZIO, SinaisFormValor, emAberto, horaTexto, temSinais } from '../data/saude-api';
import { SaudeService, abrirArquivo } from '../data/saude.service';

type Aba = 'agendamentos' | 'prontuario';

/**
 * Ficha do paciente na saúde: dados, direito, alergias, agendamentos e (com SAUDE_PRONTUARIO)
 * o prontuário com anamnese, sinais vitais, evoluções e resultados. Rota: /saude/pacientes/:id
 */
@Component({
  selector: 'app-paciente-ficha',
  imports: [
    DatePipe, DecimalPipe, LowerCasePipe, RouterLink, Alert, Dialog, Icon, LoadError, Pagination, CpfPipe, TelefonePipe,
    AcaoAgendamentoDialog, ProntuarioDialog, SinaisCampos, StatusSelo,
  ],
  templateUrl: './paciente-ficha.html',
  styleUrl: './paciente-ficha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacienteFicha {
  readonly id = input<string | undefined>();

  private readonly service = inject(SaudeService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rotuloDireito = ROTULO_DIREITO;
  protected readonly hora = horaTexto;
  protected readonly emAberto = emAberto;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly versao = signal(0);
  private readonly chave = computed(() => ({ id: this.idNumero(), v: this.versao() }), { equal: (a, b) => a.id === b.id && a.v === b.v });
  private readonly estado = loadFrom(this.chave, (k) => this.service.ficha(k.id ?? 0), this.tentar);
  protected readonly f = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });

  protected readonly aba = signal<Aba>('agendamentos');
  protected readonly aviso = signal<string | null>(null);

  // Histórico
  protected readonly paginaHist = signal(0);
  private readonly consultaHist = computed(() => ({ id: this.idNumero(), p: this.paginaHist(), v: this.versao() }), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  protected readonly historico = loadFrom(this.consultaHist, (q) => this.service.historico(q.id ?? 0, q.p, 15), this.tentar);
  protected readonly paginaH = computed<Page<Agendamento> | null>(() => {
    const e = this.historico();
    return e.status === 'ready' ? e.data : null;
  });
  protected readonly acao = signal<{ tipo: AcaoDialogo; agendamento: Agendamento } | null>(null);

  // Prontuário
  protected readonly prontuario = signal<Prontuario | null>(null);
  protected readonly erroProntuario = signal<string | null>(null);
  protected readonly carregandoPr = signal(false);
  protected readonly editandoPr = signal(false);
  protected readonly sinaisAberto = signal(false);
  protected readonly sinais = signal<SinaisFormValor>({ ...SINAIS_VAZIO });
  protected readonly salvandoSinais = signal(false);
  protected readonly erroSinais = signal<string | null>(null);
  protected readonly abrindo = signal<number | null>(null);
  protected readonly evolucaoAberta = signal<number | null>(null);

  constructor() {
    effect(() => {
      const f = this.f();
      this.title.setTitle(pageTitle(f ? `${f.nome} · Saúde` : 'Paciente'));
    });
  }

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected abrirAba(a: Aba, f: Ficha): void {
    this.aba.set(a);
    if (a === 'prontuario' && !this.prontuario() && f.podeVerProntuario) this.carregarProntuario(f.idPessoa);
  }

  private carregarProntuario(id: number): void {
    this.carregandoPr.set(true);
    this.erroProntuario.set(null);
    this.service
      .prontuario(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.carregandoPr.set(false);
          this.prontuario.set(p);
        },
        error: (e: unknown) => {
          this.carregandoPr.set(false);
          this.erroProntuario.set(erroUsuarios(e, 'abrir o prontuário'));
        },
      });
  }

  protected prontuarioSalvo(p: Prontuario): void {
    this.editandoPr.set(false);
    this.prontuario.set(p);
    this.aviso.set('Anamnese salva.');
    this.versao.update((n) => n + 1);
  }

  protected abrirSinais(): void {
    this.sinais.set({ ...SINAIS_VAZIO });
    this.erroSinais.set(null);
    this.sinaisAberto.set(true);
  }

  protected salvarSinais(f: Ficha): void {
    if (this.salvandoSinais()) return;
    if (!temSinais(this.sinais())) {
      this.erroSinais.set('Informe ao menos um sinal vital.');
      return;
    }
    this.salvandoSinais.set(true);
    this.erroSinais.set(null);
    this.service
      .registrarSinais(f.idPessoa, this.sinais())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.salvandoSinais.set(false);
          this.sinaisAberto.set(false);
          this.prontuario.set(p);
          this.aviso.set('Sinais vitais registrados.');
        },
        error: (e: unknown) => {
          this.salvandoSinais.set(false);
          this.erroSinais.set(erroUsuarios(e, 'registrar os sinais vitais'));
        },
      });
  }

  protected abrirResultado(idAtendimento: number, idArquivo: number, nome: string): void {
    if (this.abrindo() !== null) return;
    this.abrindo.set(idArquivo);
    this.service
      .baixarAnexo(idAtendimento, idArquivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => {
          this.abrindo.set(null);
          abrirArquivo(b, nome);
        },
        error: () => {
          this.abrindo.set(null);
          this.erroProntuario.set('Não foi possível abrir o arquivo.');
        },
      });
  }

  protected acaoSalva(r: { detalhe: Detalhe; mensagem: string }): void {
    this.acao.set(null);
    this.aviso.set(r.mensagem);
    this.versao.update((n) => n + 1);
  }
}
