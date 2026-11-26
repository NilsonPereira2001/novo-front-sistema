import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { AcaoAgendamentoDialog, AcaoDialogo } from '../components/acao-agendamento-dialog';
import { PacienteBusca } from '../components/paciente-busca';
import { SaudeAbas } from '../components/saude-abas';
import { StatusSelo } from '../components/status-selo';
import { Agendamento, Categoria, Detalhe, Dia, Ficha, Paciente, ROTULO_DIREITO, agruparPorData, horaTexto, somarDias } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

/**
 * Central de marcação (call center): paciente → serviço → dia com vaga → confirmar.
 * Mostra os próximos agendamentos do paciente para remarcar/cancelar na mesma ligação.
 * Rota: /saude/central
 */
@Component({
  selector: 'app-central-marcacao',
  imports: [DatePipe, LowerCasePipe, RouterLink, Alert, Icon, CpfPipe, TelefonePipe, AcaoAgendamentoDialog, PacienteBusca, SaudeAbas, StatusSelo],
  templateUrl: './central-marcacao.html',
  styleUrl: './central-marcacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentralMarcacao {
  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rotuloDireito = ROTULO_DIREITO;
  protected readonly hora = horaTexto;

  // Paciente
  protected readonly paciente = signal<Paciente | null>(null);
  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly erroFicha = signal<string | null>(null);

  // Serviço e dias
  private readonly tentar = signal(0);
  protected readonly servicos = loadFrom(signal(0), () => this.service.servicos(false), this.tentar);
  protected readonly profissionais = loadFrom(signal(0), () => this.service.profissionais(), this.tentar);
  protected readonly categoria = signal<Categoria>('CONSULTA');
  protected readonly idServico = signal<number | null>(null);
  protected readonly idProfissional = signal<number | null>(null);
  protected readonly janela = signal(30);
  protected readonly listaServicos = computed(() => {
    const e = this.servicos();
    return e.status === 'ready' ? e.data.filter((s) => s.categoria === this.categoria()) : [];
  });
  protected readonly servico = computed(() => {
    const e = this.servicos();
    return e.status === 'ready' ? (e.data.find((s) => s.id === this.idServico()) ?? null) : null;
  });
  protected readonly listaProfissionais = computed(() => {
    const e = this.profissionais();
    const id = this.idServico();
    return e.status === 'ready' && id ? e.data.filter((p) => p.servicos.some((s) => s.id === id)) : [];
  });
  private readonly consultaDias = computed(
    () => ({ idServico: this.idServico(), idProfissional: this.idProfissional(), janela: this.janela() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly dias = signal<Dia[]>([]);
  protected readonly carregandoDias = signal(false);
  protected readonly erroDias = signal(false);
  protected readonly grupos = computed(() => agruparPorData(this.dias().filter((d) => d.livres > 0)));
  protected readonly escolhido = signal<Dia | null>(null);

  // Confirmação
  protected readonly horaMarcada = signal('');
  protected readonly telefone = signal('');
  protected readonly observacao = signal('');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly marcado = signal<Detalhe | null>(null);

  // Ações nos agendamentos existentes
  protected readonly acao = signal<{ tipo: AcaoDialogo; agendamento: Agendamento } | null>(null);
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    effect(() => {
      const q = this.consultaDias();
      this.escolhido.set(null);
      if (!q.idServico) {
        this.dias.set([]);
        return;
      }
      const hoje = hojeIso();
      this.carregandoDias.set(true);
      this.erroDias.set(false);
      this.service
        .dias({ de: hoje, ate: somarDias(hoje, q.janela), idServico: q.idServico, idProfissional: q.idProfissional, soAtivos: true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (d) => {
            this.carregandoDias.set(false);
            this.dias.set(d);
          },
          error: () => {
            this.carregandoDias.set(false);
            this.erroDias.set(true);
          },
        });
    });
  }

  protected escolherPaciente(p: Paciente): void {
    this.paciente.set(p);
    this.marcado.set(null);
    this.aviso.set(null);
    this.carregarFicha(p.idPessoa);
  }

  private carregarFicha(id: number): void {
    this.ficha.set(null);
    this.erroFicha.set(null);
    this.service
      .ficha(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          this.ficha.set(f);
          if (!this.telefone()) this.telefone.set(f.telefones[0] ?? '');
        },
        error: (e: unknown) => this.erroFicha.set(erroUsuarios(e, 'carregar o paciente')),
      });
  }

  protected trocarPaciente(): void {
    this.paciente.set(null);
    this.ficha.set(null);
    this.telefone.set('');
    this.marcado.set(null);
    this.aviso.set(null);
  }

  protected setCategoria(c: Categoria): void {
    this.categoria.set(c);
    this.idServico.set(null);
    this.idProfissional.set(null);
  }
  protected onServico(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.idServico.set(v ? Number(v) : null);
    this.idProfissional.set(null);
    this.janela.set(30);
  }
  protected onProfissional(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.idProfissional.set(v ? Number(v) : null);
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  protected confirmar(): void {
    const p = this.paciente();
    const d = this.escolhido();
    if (!p || !d || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .agendar({
        idPessoa: p.idPessoa,
        idServico: d.idServico,
        idProfissional: d.idProfissional,
        data: d.data,
        hora: this.horaMarcada(),
        telefone: this.telefone(),
        observacao: this.observacao(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (det) => {
          this.enviando.set(false);
          this.marcado.set(det);
          this.escolhido.set(null);
          this.horaMarcada.set('');
          this.observacao.set('');
          this.carregarFicha(p.idPessoa);
          this.recarregarDias();
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'marcar'));
          this.recarregarDias();
        },
      });
  }

  protected novaMarcacao(): void {
    this.marcado.set(null);
  }

  protected imprimir(): void {
    window.print();
  }

  private recarregarDias(): void {
    const q = this.consultaDias();
    if (!q.idServico) return;
    const hoje = hojeIso();
    this.service
      .dias({ de: hoje, ate: somarDias(hoje, q.janela), idServico: q.idServico, idProfissional: q.idProfissional, soAtivos: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (d) => this.dias.set(d), error: () => undefined });
  }

  protected acaoSalva(r: { detalhe: Detalhe; mensagem: string }): void {
    this.acao.set(null);
    this.aviso.set(r.mensagem);
    const p = this.paciente();
    if (p) this.carregarFicha(p.idPessoa);
    this.recarregarDias();
  }
}
