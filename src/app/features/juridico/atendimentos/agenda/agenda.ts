import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { TelefonePipe } from '../../../../shared/pipes/telefone.pipe';
import { isRecord } from '../../../../shared/utils/json-read';
import { maiusculas } from '../../../../shared/utils/text';
import { mensagemDeErro } from '../../processos/data/processos.service';
import {
  Atendimento,
  AtendimentoDetalhe,
  ROTULO_SITUACAO,
  Situacao,
  isoDia,
  isoLocal,
  paraLocalDateTime,
  semanaDe,
  situacaoDe,
  somarDias,
} from '../data/atendimentos-api';
import { AtendimentosService } from '../data/atendimentos.service';
import { AnexosAtendimento, PessoaDoAnexo } from '../components/anexos-atendimento';

const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/**
 * Agenda de atendimentos jurídicos: semana com contagens, lista do dia e
 * ações sobre os agendados. Rota: /juridico/atendimentos?data=&colaborador=
 */
@Component({
  selector: 'app-agenda-atendimentos',
  imports: [DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, DisplayValuePipe, TelefonePipe, AnexosAtendimento],
  templateUrl: './agenda.html',
  styleUrl: './agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaAtendimentos {
  /** Query params (withComponentInputBinding). */
  readonly data = input<string | undefined>();
  readonly colaborador = input<string | undefined>();

  private readonly service = inject(AtendimentosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rotulo = ROTULO_SITUACAO;
  protected readonly hoje = isoDia(new Date());
  private readonly agora = signal(isoLocal(new Date()));

  protected readonly dia = computed(() => (/^\d{4}-\d{2}-\d{2}$/.test(this.data() ?? '') ? this.data()! : this.hoje));
  protected readonly idColaborador = computed(() => {
    const n = Number(this.colaborador());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  protected readonly semana = computed(() => semanaDe(this.dia()));

  private readonly tentar = signal(0);
  private readonly consultaDia = computed(() => ({ dia: this.dia(), col: this.idColaborador() }), { equal: (a, b) => a.dia === b.dia && a.col === b.col });
  protected readonly estado = loadFrom(this.consultaDia, (q) => this.service.listar(q.dia, q.dia, q.col), this.tentar);
  private readonly consultaSemana = computed(() => ({ de: this.semana()[0], ate: this.semana()[6], col: this.idColaborador() }), {
    equal: (a, b) => a.de === b.de && a.col === b.col,
  });
  protected readonly contagens = loadFrom(this.consultaSemana, (q) => this.service.dias(q.de, q.ate, q.col), this.tentar);
  protected readonly colaboradores = loadFrom(signal(0), () => this.service.colaboradores(), signal(0));

  protected readonly itens = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly diasSemana = computed(() => {
    const c = this.contagens();
    const mapa = c.status === 'ready' ? c.data : {};
    return this.semana().map((d, i) => {
      const x = mapa[d];
      return { data: d, nome: DIAS_SEMANA[i], numero: Number(d.slice(8)), total: x ? x.agendados + x.atendidos + x.naoAtendidos : 0, agendados: x?.agendados ?? 0 };
    });
  });
  protected readonly resumoDia = computed(() => {
    const r: Record<Situacao, number> = { agendado: 0, atrasado: 0, atendido: 0, 'nao-atendido': 0 };
    for (const a of this.itens()) r[this.situacao(a)]++;
    return r;
  });

  protected readonly aviso = signal<string | null>(null);
  protected readonly avisoTom = signal<'success' | 'warning'>('success');
  // diálogos
  protected readonly reagendarDe = signal<Atendimento | null>(null);
  protected readonly novaData = signal('');
  protected readonly naoAtendidoDe = signal<Atendimento | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly registro = signal<AtendimentoDetalhe | null>(null);
  protected readonly carregandoRegistro = signal<number | null>(null);
  protected readonly tituloRegistro = computed(() =>
    this.registro()?.atendimento.status === 'ATENDIDO' ? 'Registro do atendimento' : 'Anexos do atendimento',
  );

  constructor() {
    effect(() => {
      this.dia();
      const st: unknown = history.state;
      if (isRecord(st) && typeof st['aviso'] === 'string') {
        this.aviso.set(st['aviso']);
        this.avisoTom.set(st['avisoTom'] === 'warning' ? 'warning' : 'success');
      }
    });
  }

  protected nomeDe(c: { nome: string }): string {
    return c.nome;
  }
  protected nomePessoa(p: { nome: string }): string {
    return p.nome;
  }

  protected situacao(a: Atendimento): Situacao {
    return situacaoDe(a, this.agora());
  }

  protected irPara(dia: string): void {
    void this.router.navigate([], { queryParams: { data: dia === this.hoje ? null : dia }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected mover(dias: number): void {
    this.irPara(somarDias(this.dia(), dias));
  }
  protected escolherData(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) this.irPara(v);
  }
  protected escolherColaborador(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    void this.router.navigate([], { queryParams: { colaborador: v || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected recarregar(): void {
    this.agora.set(isoLocal(new Date()));
    this.tentar.update((n) => n + 1);
  }

  // --- Reagendar / não atendido / ver registro ---------------------------------------
  protected abrirReagendar(a: Atendimento): void {
    this.erroAcao.set(null);
    this.novaData.set((a.dataHora ?? '').slice(0, 16));
    this.reagendarDe.set(a);
  }
  protected abrirNaoAtendido(a: Atendimento): void {
    this.erroAcao.set(null);
    this.motivo.set('');
    this.naoAtendidoDe.set(a);
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected confirmarReagendar(): void {
    const a = this.reagendarDe();
    const v = this.novaData();
    if (!a || this.enviando()) return;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) || paraLocalDateTime(v) <= isoLocal(new Date())) {
      this.erroAcao.set('Escolha uma data e hora futuras.');
      return;
    }
    this.executar(this.service.reagendar(a.id, paraLocalDateTime(v)), 'reagendar', () => {
      this.reagendarDe.set(null);
      this.avisoTom.set('success');
      this.aviso.set(`Atendimento reagendado para ${v.slice(8, 10)}/${v.slice(5, 7)} às ${v.slice(11, 16)}.`);
    });
  }

  protected confirmarNaoAtendido(): void {
    const a = this.naoAtendidoDe();
    if (!a || this.enviando()) return;
    if (!this.motivo().trim()) {
      this.erroAcao.set('Informe o motivo.');
      return;
    }
    this.executar(this.service.naoAtendido(a.id, maiusculas(this.motivo().trim())), 'registrar o não comparecimento', () => {
      this.naoAtendidoDe.set(null);
      this.avisoTom.set('success');
      this.aviso.set('Atendimento marcado como não comparecido.');
    });
  }

  /** Pessoas cadastradas do atendimento aberto, para ligar o anexo a uma delas. */
  protected pessoasDoAnexo(d: AtendimentoDetalhe): PessoaDoAnexo[] {
    const out: PessoaDoAnexo[] = [];
    for (const p of d.atendimento.pessoas) {
      if (p.idPessoa && !out.some((x) => x.idPessoa === p.idPessoa)) out.push({ idPessoa: p.idPessoa, nome: p.nome });
    }
    return out;
  }

  /** Recarrega o atendimento aberto depois de enviar/remover anexo (e a contagem na lista). */
  protected anexosAlterados(): void {
    const r = this.registro();
    if (!r) return;
    this.service
      .detalhe(r.atendimento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (d) => this.registro.set(d), error: () => undefined });
    this.tentar.update((n) => n + 1);
  }

  protected verRegistro(a: Atendimento): void {
    this.carregandoRegistro.set(a.id);
    this.service
      .detalhe(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.carregandoRegistro.set(null);
          this.registro.set(d);
        },
        error: () => {
          this.carregandoRegistro.set(null);
          this.aviso.set(null);
          this.erroAcao.set('Não foi possível abrir o registro.');
        },
      });
  }

  private executar(req: ReturnType<AtendimentosService['reagendar']>, acao: string, ok: () => void): void {
    this.enviando.set(true);
    this.erroAcao.set(null);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.enviando.set(false);
        ok();
        this.recarregar();
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erroAcao.set(mensagemDeErro(e, acao));
      },
    });
  }
}
