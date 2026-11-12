import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';

import { pageTitle } from '../../../../core/config/app-title';
import { Alert } from '../../../../shared/components/alert/alert';
import { FieldError } from '../../../../shared/components/form-fields/field-error';
import { SelectField } from '../../../../shared/components/form-fields/select-field';
import { TextField } from '../../../../shared/components/form-fields/text-field';
import { Icon } from '../../../../shared/components/icon/icon';
import { loadFrom } from '../../../../shared/data/load-state';
import { formatCpf } from '../../../../shared/utils/cpf';
import { applyMask } from '../../../../shared/utils/masks';
import { PessoaDTO } from '../../../pessoas/models/pessoa.dto';
import { mensagemDeErro } from '../../processos/data/processos.service';
import { BuscaPessoa } from '../../processos/form/busca-pessoa';
import { MODALIDADES, isoLocal } from '../data/atendimentos-api';
import { AtendimentosService } from '../data/atendimentos.service';
import { ModoAtendimento, PessoaForm, criarAtendimentoForm, criarPessoa, toAtendimentoPayload } from './atendimento-form.model';

type Carga = 'pronto' | 'carregando' | 'erro' | 'nao-encontrado' | 'encerrado';

const TITULOS: Readonly<Record<ModoAtendimento, string>> = {
  registrar: 'Registrar atendimento',
  agendar: 'Agendar atendimento',
  realizar: 'Realizar atendimento',
};

/**
 * Registro, agendamento e realização de atendimento jurídico.
 * Rotas: /juridico/atendimentos/novo?modo=registrar|agendar&data=AAAA-MM-DD
 *        /juridico/atendimentos/:id/realizar
 */
@Component({
  selector: 'app-atendimento-form',
  imports: [ReactiveFormsModule, RouterLink, Alert, FieldError, SelectField, TextField, Icon, BuscaPessoa],
  templateUrl: './atendimento-form.html',
  styleUrl: './atendimento-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtendimentoFormPage {
  readonly id = input<string | undefined>();
  readonly modo = input<string | undefined>();
  readonly data = input<string | undefined>();

  private readonly service = inject(AtendimentosService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly modoAtual = computed<ModoAtendimento>(() => (this.id() !== undefined ? 'realizar' : this.modo() === 'agendar' ? 'agendar' : 'registrar'));
  protected readonly form = criarAtendimentoForm(this.fb, () => this.modoAtual());
  protected readonly pessoas = this.form.controls.pessoas as FormArray<PessoaForm>;
  protected readonly modalidades = MODALIDADES;
  protected readonly titulo = computed(() => TITULOS[this.modoAtual()]);
  protected readonly comRelato = computed(() => this.modoAtual() !== 'agendar');

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  protected readonly carga = signal<Carga>('pronto');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly erroPessoas = signal(false);
  /** Data agendada original (modo realizar), exibida como referência. */
  protected readonly agendadoPara = signal<string | null>(null);

  private readonly tentar = signal(0);
  protected readonly tipos = loadFrom(signal(0), () => this.service.tipos(), this.tentar);
  protected readonly areas = loadFrom(signal(0), () => this.service.areas(), this.tentar);
  protected readonly colaboradores = loadFrom(signal(0), () => this.service.colaboradores(), this.tentar);
  private readonly selecionados = signal<readonly number[]>([]);

  constructor() {
    effect(() => this.title.setTitle(pageTitle(this.titulo())));
    // Modo e data inicial (novo) ou carga do agendamento (realizar).
    effect(() => {
      const modo = this.modoAtual();
      if (modo === 'realizar') {
        const id = this.idNumero();
        if (id === null) this.carga.set('nao-encontrado');
        else this.carregar(id);
        return;
      }
      const dia = this.data();
      const agora = isoLocal(new Date()).slice(0, 16);
      let inicial = agora;
      if (modo === 'agendar') {
        inicial = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia > agora.slice(0, 10) ? `${dia}T09:00` : this.proximaHora();
      }
      this.form.controls.dataHora.setValue(inicial);
      if (this.pessoas.length === 0) this.pessoas.push(criarPessoa(this.fb));
    });
  }

  private proximaHora(): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return isoLocal(d).slice(0, 16);
  }

  private carregar(id: number): void {
    this.carga.set('carregando');
    this.service
      .detalhe(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          const a = d.atendimento;
          if (a.status.toUpperCase() !== 'AGENDADO') {
            this.carga.set('encerrado');
            return;
          }
          this.agendadoPara.set(a.dataHoraAgendamento ?? a.dataHora);
          this.pessoas.clear();
          for (const p of a.pessoas) {
            this.pessoas.push(
              criarPessoa(this.fb, {
                idPessoa: p.idPessoa,
                nome: p.nome,
                cpf: p.cpf ? formatCpf(p.cpf) : '',
                telefone: p.telefone ? applyMask('telefone', p.telefone) : '',
              }),
            );
          }
          if (this.pessoas.length === 0) this.pessoas.push(criarPessoa(this.fb));
          const ids = a.colaboradores.map((c) => c.id);
          this.form.patchValue({
            dataHora: isoLocal(new Date()).slice(0, 16),
            modalidade: a.modalidade ?? 'PRESENCIAL',
            idTipo: d.idTipo,
            idArea: d.idArea,
            assunto: a.assunto ?? '',
            colaboradores: ids,
          });
          this.selecionados.set(ids);
          this.carga.set('pronto');
        },
        error: (e: unknown) => this.carga.set((e as { status?: number })?.status === 404 ? 'nao-encontrado' : 'erro'),
      });
  }

  protected recarregar(): void {
    const id = this.idNumero();
    if (id) this.carregar(id);
  }

  protected tentarLookups(): void {
    this.tentar.update((n) => n + 1);
  }

  // --- Pessoas ------------------------------------------------------------------------
  protected adicionarPessoa(): void {
    this.pessoas.push(criarPessoa(this.fb));
    this.erroPessoas.set(false);
  }
  protected removerPessoa(i: number): void {
    this.pessoas.removeAt(i);
  }
  protected vincularPessoa(i: number, p: PessoaDTO): void {
    const g = this.pessoas.at(i);
    g.patchValue({
      idPessoa: Number(p.id),
      nome: (p.nome ?? '').toUpperCase(),
      cpf: p.cpf ? formatCpf(p.cpf) : g.controls.cpf.value,
      telefone: p.telefonePrincipal ? applyMask('telefone', p.telefonePrincipal) : g.controls.telefone.value,
    });
    g.controls.cpf.updateValueAndValidity();
    g.markAsDirty();
  }
  protected desvincular(i: number): void {
    const g = this.pessoas.at(i);
    g.controls.idPessoa.setValue(null);
    g.controls.cpf.updateValueAndValidity();
  }

  // --- Colaboradores ------------------------------------------------------------------
  protected marcado(id: number): boolean {
    return this.selecionados().includes(id);
  }
  protected alternar(id: number, ev: Event): void {
    const on = (ev.target as HTMLInputElement).checked;
    const atual = this.selecionados().filter((x) => x !== id);
    const novo = on ? [...atual, id] : atual;
    this.selecionados.set(novo);
    this.form.controls.colaboradores.setValue([...novo]);
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.form.controls.dataHora.updateValueAndValidity();
    this.form.markAllAsTouched();
    this.erroPessoas.set(this.pessoas.length === 0);
    if (this.form.invalid || this.pessoas.length === 0) {
      this.erro.set(this.pessoas.length === 0 ? 'Inclua ao menos uma pessoa atendida.' : 'Confira os campos destacados.');
      queueMicrotask(() => document.querySelector<HTMLElement>('.field--invalid input, .field--invalid select, .field--invalid textarea')?.focus());
      return;
    }
    const modo = this.modoAtual();
    const payload = toAtendimentoPayload(this.form, modo);
    const id = this.idNumero();
    const req =
      modo === 'agendar' ? this.service.agendar(payload) : modo === 'realizar' && id ? this.service.realizar(id, payload) : this.service.registrar(payload);
    this.enviando.set(true);
    this.erro.set(null);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.enviando.set(false);
        const dia = payload.dataHora.slice(0, 10);
        const aviso = modo === 'agendar' ? 'Atendimento agendado.' : 'Atendimento registrado.';
        void this.router.navigate(['/juridico/atendimentos'], { queryParams: { data: dia === isoLocal(new Date()).slice(0, 10) ? null : dia }, state: { aviso } });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(mensagemDeErro(e, modo === 'agendar' ? 'agendar o atendimento' : 'registrar o atendimento'));
      },
    });
  }
}
