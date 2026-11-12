import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { pageTitle } from '../../../../core/config/app-title';
import { Alert } from '../../../../shared/components/alert/alert';
import { SelectField } from '../../../../shared/components/form-fields/select-field';
import { TextField } from '../../../../shared/components/form-fields/text-field';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Opcao } from '../../../../shared/data/opcao.model';
import { formatCpf } from '../../../../shared/utils/cpf';
import { applyMask } from '../../../../shared/utils/masks';
import { PessoaDTO } from '../../../pessoas/models/pessoa.dto';
import { STATUS_PROCESSO, statusProcesso } from '../data/processos-api';
import { ProcessosService, mensagemDeErro } from '../data/processos.service';
import { BuscaPessoa } from './busca-pessoa';
import { ParteForm, criarParte, criarProcessoForm, preencherProcessoForm, toProcessoPayload } from './processo-form.model';

type Carga = 'pronto' | 'carregando' | 'erro' | 'nao-encontrado';

/**
 * Cadastro e edição de processo. Rotas: /juridico/processos/novo e
 * /juridico/processos/:id/editar (o número não muda na edição).
 */
@Component({
  selector: 'app-processo-form',
  imports: [ReactiveFormsModule, RouterLink, Alert, SelectField, TextField, Icon, BuscaPessoa],
  templateUrl: './processo-form.html',
  styleUrl: './processo-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoFormPage {
  readonly id = input<string | undefined>();

  private readonly service = inject(ProcessosService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = criarProcessoForm(this.fb);
  protected readonly partes = this.form.controls.partes as FormArray<ParteForm>;
  protected readonly statusOpcoes = STATUS_PROCESSO;
  protected readonly st = statusProcesso;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  protected readonly editando = computed(() => this.id() !== undefined);
  protected readonly carga = signal<Carga>('pronto');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  /** Status vindo do tribunal que não está na lista padrão (mantido como opção). */
  protected readonly statusExtra = signal<string | null>(null);

  private readonly tentar = signal(0);
  protected readonly areas = loadFrom(signal(0), () => this.service.areas(), this.tentar);
  protected readonly tiposParte = loadFrom(signal(0), () => this.service.tiposParte(), this.tentar);
  protected readonly advogados = loadFrom(
    signal(0),
    () => this.service.advogados().pipe(map((l) => l.map((a): Opcao => ({ id: a.id, label: a.oab ? `${a.nome} (OAB ${a.oab})` : a.nome })))),
    this.tentar,
  );

  constructor() {
    effect(() => this.title.setTitle(pageTitle(this.editando() ? 'Editar processo' : 'Novo processo')));
    effect(() => {
      const id = this.idNumero();
      if (this.editando()) {
        if (id === null) this.carga.set('nao-encontrado');
        else this.carregar(id);
      }
    });
  }

  private carregar(id: number): void {
    this.carga.set('carregando');
    forkJoin({ d: this.service.detalhe(id), areas: this.service.areas() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ d, areas }) => {
          preencherProcessoForm(this.form, this.fb, d, (nome) => areas.find((a) => a.label === nome)?.id ?? null);
          const st = (d.status ?? '').toUpperCase();
          this.statusExtra.set(st && !(STATUS_PROCESSO as readonly string[]).includes(st) ? st : null);
          if (st) this.form.controls.status.setValue(st);
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

  protected adicionarParte(): void {
    this.partes.push(criarParte(this.fb));
  }

  protected removerParte(i: number): void {
    this.partes.removeAt(i);
  }

  protected vincularPessoa(i: number, p: PessoaDTO): void {
    const g = this.partes.at(i);
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
    const g = this.partes.at(i);
    g.controls.idPessoa.setValue(null);
    g.controls.cpf.updateValueAndValidity();
  }

  protected opcoesDe(s: LoadState<Opcao[]>): Opcao[] {
    return s.status === 'ready' ? s.data : [];
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.erro.set('Confira os campos destacados.');
      queueMicrotask(() => document.querySelector<HTMLElement>('.field--invalid input, .field--invalid select, .field--invalid textarea')?.focus());
      return;
    }
    const areas = this.opcoesDe(this.areas());
    const payload = toProcessoPayload(this.form, (id) => areas.find((a) => a.id === id)?.label ?? null);
    const id = this.idNumero();
    const req = this.editando() && id ? this.service.editar(id, payload) : this.service.criar(payload);
    this.enviando.set(true);
    this.erro.set(null);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.enviando.set(false);
        void this.router.navigate(['/juridico/processos', d.id], { state: { aviso: this.editando() ? 'Processo atualizado.' : 'Processo cadastrado.' } });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(mensagemDeErro(e, this.editando() ? 'salvar o processo' : 'cadastrar o processo'));
      },
    });
  }
}
