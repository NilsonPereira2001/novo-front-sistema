import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { loadFrom } from '../../../shared/data/load-state';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { SaudeAbas } from '../components/saude-abas';
import { Dia, diaSemana, diasDoMes } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

const NOMES_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Saúde › Agendas: liberar dias de atendimento (vagas por dia) para um profissional/serviço
 * e ajustar vagas ou bloquear dias. Rota: /saude/agendas
 */
@Component({
  selector: 'app-agendas-saude',
  imports: [DatePipe, RouterLink, Alert, Icon, SaudeAbas],
  templateUrl: './agendas-saude.html',
  styleUrl: './agendas-saude.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendasSaude {
  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly semana = NOMES_SEMANA;
  protected readonly hoje = hojeIso();

  private readonly tentar = signal(0);
  protected readonly profissionais = loadFrom(signal(0), () => this.service.profissionais(), this.tentar);
  protected readonly listaProfissionais = computed(() => {
    const e = this.profissionais();
    return e.status === 'ready' ? e.data.filter((p) => p.servicos.length > 0) : [];
  });
  protected readonly idProfissional = signal<number | null>(null);
  protected readonly idServico = signal<number | null>(null);
  protected readonly profissional = computed(() => this.listaProfissionais().find((p) => p.idFuncionario === this.idProfissional()) ?? null);

  // Mês exibido
  protected readonly ano = signal(new Date().getFullYear());
  protected readonly mes = signal(new Date().getMonth() + 1);
  protected readonly diasMes = computed(() => diasDoMes(this.ano(), this.mes()));
  /** Espaços antes do dia 1 para alinhar com o dia da semana. */
  protected readonly vazios = computed(() => Array.from({ length: diaSemana(this.diasMes()[0]) }, (_, i) => i));
  protected readonly selecionados = signal<ReadonlySet<string>>(new Set());
  protected readonly vagas = signal(10);

  // Dias já liberados no mês (para o profissional/serviço escolhidos)
  protected readonly dias = signal<Dia[]>([]);
  protected readonly carregando = signal(false);
  protected readonly porData = computed(() => {
    const m = new Map<string, Dia>();
    for (const d of this.dias()) if (d.idServico === this.idServico()) m.set(d.data, d);
    return m;
  });
  private readonly versao = signal(0);

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly editando = signal<number | null>(null);
  protected readonly vagasEdit = signal(0);

  constructor() {
    effect(() => {
      const idProf = this.idProfissional();
      const mesIni = this.diasMes()[0];
      const mesFim = this.diasMes()[this.diasMes().length - 1];
      this.versao();
      if (!idProf) {
        this.dias.set([]);
        return;
      }
      this.carregando.set(true);
      this.service
        .dias({ de: mesIni, ate: mesFim, idProfissional: idProf })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (d) => {
            this.carregando.set(false);
            this.dias.set(d);
          },
          error: () => {
            this.carregando.set(false);
            this.dias.set([]);
          },
        });
    });
  }

  protected onProfissional(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    const id = v ? Number(v) : null;
    this.idProfissional.set(id);
    const p = this.listaProfissionais().find((x) => x.idFuncionario === id);
    this.idServico.set(p?.servicos.length === 1 ? p.servicos[0].id : null);
    this.selecionados.set(new Set());
  }
  protected onServico(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.idServico.set(v ? Number(v) : null);
    this.selecionados.set(new Set());
  }
  protected onVagas(ev: Event): void {
    const n = Number((ev.target as HTMLInputElement).value);
    this.vagas.set(Number.isInteger(n) ? n : 0);
  }

  protected mudarMes(delta: number): void {
    let m = this.mes() + delta;
    let a = this.ano();
    if (m < 1) {
      m = 12;
      a--;
    }
    if (m > 12) {
      m = 1;
      a++;
    }
    this.mes.set(m);
    this.ano.set(a);
    this.selecionados.set(new Set());
  }
  protected nomeMes(): string {
    return new Date(this.ano(), this.mes() - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  protected alternar(data: string): void {
    if (data < this.hoje || this.porData().has(data)) return;
    const s = new Set(this.selecionados());
    if (s.has(data)) s.delete(data);
    else s.add(data);
    this.selecionados.set(s);
  }
  /** Marca no mês todos os dias da semana escolhida (ex.: todas as terças). */
  protected marcarSemana(dow: number): void {
    const s = new Set(this.selecionados());
    const alvo = this.diasMes().filter((d) => diaSemana(d) === dow && d >= this.hoje && !this.porData().has(d));
    const todos = alvo.every((d) => s.has(d));
    for (const d of alvo) {
      if (todos) s.delete(d);
      else s.add(d);
    }
    this.selecionados.set(s);
  }
  protected diaUtil(data: string): boolean {
    const w = diaSemana(data);
    return w !== 0 && w !== 6;
  }
  protected numDia(data: string): number {
    return Number(data.slice(8, 10));
  }

  protected liberar(): void {
    const idProf = this.idProfissional();
    const idServ = this.idServico();
    const datas = [...this.selecionados()].sort();
    if (!idProf || !idServ || datas.length === 0 || this.enviando()) return;
    if (this.vagas() < 1 || this.vagas() > 200) {
      this.erro.set('Vagas por dia: de 1 a 200.');
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .liberar({ idProfissional: idProf, idServico: idServ, datas, vagas: this.vagas() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.enviando.set(false);
          this.selecionados.set(new Set());
          this.aviso.set(`${r.criados} ${r.criados === 1 ? 'dia liberado' : 'dias liberados'}${r.jaExistiam ? ` (${r.jaExistiam} já existiam)` : ''}.`);
          this.versao.update((n) => n + 1);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'liberar a agenda'));
        },
      });
  }

  protected editar(d: Dia): void {
    this.editando.set(d.id);
    this.vagasEdit.set(d.vagas);
    this.erro.set(null);
  }
  protected salvarVagas(d: Dia): void {
    this.alterarDia(d, { vagas: this.vagasEdit() }, 'Vagas atualizadas.');
  }
  protected bloquear(d: Dia, ativo: boolean): void {
    this.alterarDia(d, { ativo }, ativo ? 'Dia desbloqueado.' : 'Dia bloqueado: não recebe mais marcações.');
  }
  private alterarDia(d: Dia, v: { vagas?: number; ativo?: boolean }, msg: string): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .editarDia(d.id, v)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.editando.set(null);
          this.aviso.set(msg);
          this.versao.update((n) => n + 1);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'alterar o dia'));
        },
      });
  }
  protected valorNum(ev: Event): number {
    const n = Number((ev.target as HTMLInputElement).value);
    return Number.isInteger(n) ? n : 0;
  }
}
