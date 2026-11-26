import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CompromissoDialog } from '../components/compromisso-dialog';
import { Compromisso, cssDaCor, gradeDoMes, horario, isoDia, lerMes, porDia, somarMeses } from '../data/agenda-api';
import { AgendaService } from '../data/agenda.service';

const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
/** Quantos compromissos aparecem dentro da célula antes do "+N". */
const MAX_NA_CELULA = 3;

/**
 * Agenda pessoal: calendário do mês e a lista do dia escolhido.
 * Só o próprio usuário vê. Rota: /agenda?mes=AAAA-MM&dia=AAAA-MM-DD
 */
@Component({
  selector: 'app-minha-agenda',
  imports: [Alert, Icon, LoadError, CompromissoDialog],
  templateUrl: './minha-agenda.html',
  styleUrl: './minha-agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinhaAgenda {
  readonly mes = input<string | undefined>();
  readonly dia = input<string | undefined>();

  private readonly service = inject(AgendaService);
  private readonly router = inject(Router);
  protected readonly semana = SEMANA;
  protected readonly horario = horario;
  protected readonly cor = cssDaCor;
  protected readonly max = MAX_NA_CELULA;
  protected readonly hoje = isoDia(new Date());

  protected readonly mesAtual = computed(() => lerMes(this.mes()) ?? lerMes(this.diaSelecionado().slice(0, 7))!);
  protected readonly diaSelecionado = computed(() => {
    const d = this.dia();
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const m = lerMes(this.mes());
    return m && `${m.ano}-${String(m.mes).padStart(2, '0')}` !== this.hoje.slice(0, 7) ? `${m.ano}-${String(m.mes).padStart(2, '0')}-01` : this.hoje;
  });
  protected readonly grade = computed(() => {
    const m = this.mesAtual();
    return gradeDoMes(m.ano, m.mes);
  });
  protected readonly titulo = computed(() => {
    const m = this.mesAtual();
    return `${MESES[m.mes - 1]} de ${m.ano}`;
  });

  private readonly tentar = signal(0);
  private readonly periodo = computed(() => ({ de: this.grade()[0], ate: this.grade()[41] }), { equal: (a, b) => a.de === b.de });
  protected readonly estado = loadFrom(this.periodo, (p) => this.service.periodo(p.de, p.ate), this.tentar);
  private ultimo: Compromisso[] = [];
  protected readonly lista = computed(() => {
    const e = this.estado();
    if (e.status === 'ready') this.ultimo = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimo : [];
  });
  protected readonly mapa = computed(() => porDia(this.lista()));
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly celulas = computed(() => {
    const m = this.mesAtual();
    const prefixo = `${m.ano}-${String(m.mes).padStart(2, '0')}`;
    const mapa = this.mapa();
    return this.grade().map((d) => {
      const itens = mapa.get(d) ?? [];
      return { data: d, numero: Number(d.slice(8)), foraDoMes: !d.startsWith(prefixo), itens, mais: Math.max(0, itens.length - MAX_NA_CELULA) };
    });
  });
  protected readonly doDia = computed(() => this.mapa().get(this.diaSelecionado()) ?? []);
  protected readonly tituloDia = computed(() => {
    const d = this.diaSelecionado();
    const data = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
    const nome = `${DIAS_SEMANA_LONGO[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`;
    return d === this.hoje ? `Hoje · ${nome}` : nome;
  });

  // Diálogo
  protected readonly dialogAberto = signal(false);
  protected readonly editando = signal<Compromisso | null>(null);
  protected readonly dataNova = signal('');
  protected readonly aviso = signal<string | null>(null);

  protected irPara(mes: string | null, dia: string | null): void {
    void this.router.navigate([], { queryParams: { mes, dia }, replaceUrl: true });
  }
  protected mover(delta: number): void {
    const m = this.mesAtual();
    this.irPara(somarMeses(m.ano, m.mes, delta), null);
  }
  protected irHoje(): void {
    this.irPara(null, null);
  }
  protected selecionar(d: string): void {
    if (d === this.hoje) this.irPara(null, null);
    else this.irPara(d.slice(0, 7), d);
  }
  /** Setas do teclado na grade: ←→ um dia, ↑↓ uma semana. */
  protected teclado(ev: KeyboardEvent, i: number): void {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const passo = passos[ev.key];
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.selecionar(this.grade()[i]);
      return;
    }
    if (!passo) return;
    ev.preventDefault();
    const alvo = i + passo;
    if (alvo >= 0 && alvo < 42) {
      this.selecionar(this.grade()[alvo]);
      queueMicrotask(() => document.getElementById('dia-' + this.grade()[alvo])?.focus());
    }
  }

  protected novo(data?: string): void {
    this.editando.set(null);
    this.dataNova.set(data ?? this.diaSelecionado());
    this.dialogAberto.set(true);
  }
  protected abrir(c: Compromisso, ev?: Event): void {
    ev?.stopPropagation();
    this.editando.set(c);
    this.dialogAberto.set(true);
  }
  protected salvo(r: { acao: 'criado' | 'editado' | 'excluido'; data: string }): void {
    this.dialogAberto.set(false);
    this.aviso.set(r.acao === 'excluido' ? 'Compromisso excluído.' : r.acao === 'criado' ? 'Compromisso criado.' : 'Compromisso atualizado.');
    if (r.acao !== 'excluido') this.selecionar(r.data);
    this.tentar.update((n) => n + 1);
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected rotuloCelula(c: { data: string; itens: readonly Compromisso[] }): string {
    const d = c.data;
    const qtd = c.itens.length;
    return `${Number(d.slice(8))}/${d.slice(5, 7)}: ${qtd === 0 ? 'sem compromissos' : qtd === 1 ? '1 compromisso' : qtd + ' compromissos'}`;
  }
}
