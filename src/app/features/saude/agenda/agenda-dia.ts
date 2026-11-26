import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { AcaoAgendamentoDialog, AcaoDialogo } from '../components/acao-agendamento-dialog';
import { SaudeAbas } from '../components/saude-abas';
import { StatusSelo } from '../components/status-selo';
import { Agendamento, Detalhe, STATUS, emAberto, horaTexto, somarDias } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

/**
 * Agenda do dia (recepção e profissionais): quem está marcado, chegada, falta, atender.
 * Estado na URL (?data=&servico=&profissional=&status=&busca=). Rota: /saude/agenda
 */
@Component({
  selector: 'app-agenda-dia',
  imports: [DatePipe, RouterLink, Alert, Icon, LoadError, Pagination, SearchField, TelefonePipe, AcaoAgendamentoDialog, SaudeAbas, StatusSelo],
  templateUrl: './agenda-dia.html',
  styleUrl: './agenda-dia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaDia {
  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly url = injectListUrlState({ defaultSize: 100, sizeOptions: [50, 100] });
  protected readonly statusLista = STATUS;
  protected readonly hora = horaTexto;
  protected readonly emAberto = emAberto;
  protected readonly hoje = hojeIso();

  protected readonly data = computed(() => {
    const v = this.url.params().get('data') ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : this.hoje;
  });
  private num(k: string): number | null {
    const v = Number(this.url.params().get(k));
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  }
  protected readonly idServico = computed(() => this.num('servico'));
  protected readonly idProfissional = computed(() => this.num('profissional'));
  protected readonly status = computed(() => this.url.params().get('status') ?? '');

  private readonly tentar = signal(0);
  private readonly versao = signal(0);
  protected readonly servicos = loadFrom(signal(0), () => this.service.servicos(false), this.tentar);
  protected readonly profissionais = loadFrom(signal(0), () => this.service.profissionais(), this.tentar);
  protected readonly listaServicos = computed(() => {
    const e = this.servicos();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly listaProfissionais = computed(() => {
    const e = this.profissionais();
    return e.status === 'ready' ? e.data : [];
  });
  private readonly filtro = computed(
    () => ({
      de: this.data(),
      ate: this.data(),
      idServico: this.idServico(),
      idProfissional: this.idProfissional(),
      status: this.status(),
      filtro: this.url.termo(),
      page: this.url.page(),
      size: this.url.size(),
      v: this.versao(),
    }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly estado = loadFrom(this.filtro, (f) => this.service.agendamentos(f), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<Agendamento>>, Page<Agendamento> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly contagem = computed(() => {
    const pg = this.pagina();
    const c: Record<string, number> = {};
    for (const a of pg?.content ?? []) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  });
  protected readonly ehPassadoOuHoje = computed(() => this.data() <= this.hoje);

  protected readonly aviso = signal<string | null>(null);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly processando = signal<number | null>(null);
  protected readonly acao = signal<{ tipo: AcaoDialogo; agendamento: Agendamento } | null>(null);

  protected irPara(dias: number): void {
    const alvo = somarDias(this.data(), dias);
    this.url.setFilters({ data: alvo === this.hoje ? null : alvo });
  }
  protected hojeIr(): void {
    this.url.setFilters({ data: null });
  }
  protected onData(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.url.setFilters({ data: v && v !== this.hoje ? v : null });
  }
  protected onSelect(k: 'servico' | 'profissional', ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ [k]: v || null });
  }
  protected setStatus(s: string): void {
    this.url.setFilters({ status: s || null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected chegou(a: Agendamento): void {
    if (this.processando() !== null) return;
    this.processando.set(a.id);
    this.erroAcao.set(null);
    this.service
      .presenca(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.processando.set(null);
          this.aviso.set(`Chegada de ${a.paciente} registrada.`);
          this.versao.update((n) => n + 1);
        },
        error: (e: unknown) => {
          this.processando.set(null);
          this.erroAcao.set(erroUsuarios(e, 'registrar a chegada'));
        },
      });
  }

  protected acaoSalva(r: { detalhe: Detalhe; mensagem: string }): void {
    this.acao.set(null);
    this.aviso.set(r.mensagem);
    this.versao.update((n) => n + 1);
  }
}
