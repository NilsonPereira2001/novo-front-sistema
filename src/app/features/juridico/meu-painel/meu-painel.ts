import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Barras } from '../../../shared/components/charts/barras';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { Atendimento, ROTULO_SITUACAO, Situacao, isoLocal, situacaoDe } from '../atendimentos/data/atendimentos-api';
import { ColunasMensais, SerieMensal } from '../painel/components/colunas-mensais';
import { nomeMes, variacao } from '../painel/painel-juridico-api';
import { formatarCnj } from '../processos/data/processos-api';
import {
  MEU_PAINEL_API,
  PainelAdvogado,
  ProcessoItem,
  diasSemMovimentar,
  haQuanto,
  hora,
  nomesAtendidos,
  painelDoAdvogadoApi,
  primeiroNome,
  saudacao,
  textoRanking,
  toPainelAdvogado,
} from './meu-painel-api';

type Metrica = 'atendimentos' | 'processos' | 'movimentacoes';

/**
 * Painel do advogado: o dia (atendimentos), a carteira de processos, movimentações,
 * audiências e a evolução mês a mês.
 *   /juridico/meu-painel                 do usuário logado
 *   /juridico/advogados/:id/painel       de um advogado (gestão; id do funcionário)
 */
@Component({
  selector: 'app-meu-painel',
  imports: [DatePipe, RouterLink, Barras, Icon, LoadError, ColunasMensais],
  templateUrl: './meu-painel.html',
  styleUrl: './meu-painel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeuPainelPage {
  private readonly http = inject(HttpClient);

  /** Da rota `/juridico/advogados/:id/painel`; ausente = painel do usuário logado. */
  readonly id = input<string | undefined>();
  private readonly idAdvogado = computed(() => {
    const v = Number(this.id());
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  });
  protected readonly proprio = computed(() => this.id() === undefined);

  protected readonly periodos = [6, 12, 24] as const;
  protected readonly meses = signal<number>(12);
  protected readonly metrica = signal<Metrica>('atendimentos');
  protected readonly metricas: readonly { key: Metrica; nome: string }[] = [
    { key: 'atendimentos', nome: 'Atendimentos' },
    { key: 'processos', nome: 'Processos novos' },
    { key: 'movimentacoes', nome: 'Movimentações' },
  ];
  private readonly series: Readonly<Record<Metrica, readonly SerieMensal[]>> = {
    atendimentos: [
      { key: 'atendidos', nome: 'Atendidos', cor: 'var(--viz-serie-1)' },
      { key: 'naoAtendidos', nome: 'Não compareceu', cor: 'var(--viz-serie-2)' },
    ],
    processos: [{ key: 'processos', nome: 'Processos cadastrados', cor: 'var(--viz-serie-1)' }],
    movimentacoes: [{ key: 'movimentacoes', nome: 'Movimentações', cor: 'var(--viz-serie-1)' }],
  };
  protected readonly serieAtual = computed(() => this.series[this.metrica()]);
  protected readonly tituloMetrica = computed(
    () =>
      ({
        atendimentos: 'Atendimentos jurídicos de que participou, por mês',
        processos: 'Processos sob sua responsabilidade, pelo mês de cadastro',
        movimentacoes: 'Movimentações nos processos sob sua responsabilidade, por mês',
      })[this.metrica()],
  );

  protected readonly cnj = formatarCnj;
  protected readonly hora = hora;
  protected readonly nomes = nomesAtendidos;
  protected readonly rotuloSituacao = ROTULO_SITUACAO;
  private readonly agora = new Date();
  private readonly agoraIso = isoLocal(this.agora);
  protected readonly hojeIso = this.agoraIso.slice(0, 10);
  protected readonly mesAtual = nomeMes(this.agora.getFullYear(), this.agora.getMonth() + 1);

  private readonly tentar = signal(0);
  private readonly consulta = computed(() => ({ id: this.idAdvogado(), proprio: this.proprio(), meses: this.meses() }));
  protected readonly estado = loadFrom(
    this.consulta,
    (c) =>
      this.http
        .get<unknown>(apiUrl(c.proprio || c.id === null ? MEU_PAINEL_API : painelDoAdvogadoApi(c.id)), {
          params: new HttpParams().set('meses', c.meses),
        })
        .pipe(map(toPainelAdvogado)),
    this.tentar,
  );
  private ultimo: PainelAdvogado | null = null;
  protected readonly dados = computed(() => {
    const e = this.estado();
    if (e.status === 'ready') this.ultimo = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimo : null;
  });
  protected readonly recarregando = computed(() => this.estado().status === 'loading' && this.dados() !== null);
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  /** 404 no próprio painel = o usuário não é advogado ativo. */
  protected readonly naoEhAdvogado = computed(() => this.proprio() && this.erro() === 'not-found');

  protected readonly titulo = computed(() => {
    const d = this.dados();
    if (this.proprio()) return d ? `${saudacao(this.agora.getHours())}, ${primeiroNome(d.advogado.nome)}` : 'Meu painel';
    return d?.advogado.nome ?? 'Painel do advogado';
  });
  protected readonly varAtendidos = computed(() => {
    const t = this.dados()?.totais;
    return t ? variacao(t.atendidosNoMes, t.atendidosMesAnterior) : null;
  });
  protected readonly ranking = computed(() => {
    const t = this.dados()?.totais;
    return t ? textoRanking(t.posicaoRanking, t.participantesRanking) : '';
  });
  protected readonly somaMetrica = computed(() => {
    const d = this.dados();
    if (!d) return 0;
    const keys = this.serieAtual().map((s) => s.key);
    return d.evolucao.reduce((s, m) => s + keys.reduce((x, k) => x + (m.valores[k] ?? 0), 0), 0);
  });

  /** Cadastro da primeira pessoa atendida (para abrir a ficha jurídica). */
  protected idPessoa(a: Atendimento): number | null {
    return a.pessoas.length > 0 ? a.pessoas[0].idPessoa : null;
  }

  protected situacao(a: Atendimento): Situacao {
    return situacaoDe(a, this.agoraIso);
  }

  /** Só o próprio advogado registra pelo painel; a gestão usa a agenda. */
  protected podeRegistrar(a: Atendimento): boolean {
    const s = this.situacao(a);
    return this.proprio() && (s === 'agendado' || s === 'atrasado');
  }

  protected parado(p: ProcessoItem): string {
    return haQuanto(diasSemMovimentar(p, this.agora));
  }

  /** "2026-11-20" → Date ao meio-dia (evita virar o dia por fuso). */
  protected dia(iso: string | null): Date | null {
    return iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null;
  }

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
