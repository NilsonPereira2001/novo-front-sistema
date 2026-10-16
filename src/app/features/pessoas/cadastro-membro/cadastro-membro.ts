import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  ElementRef,
  Signal,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, distinctUntilChanged, finalize, of } from 'rxjs';

import { TERMOS } from '../../../core/config/terminologia';
import { Alert } from '../../../shared/components/alert/alert';
import { SelectField } from '../../../shared/components/form-fields/select-field';
import { TextField } from '../../../shared/components/form-fields/text-field';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Opcao } from '../../../shared/data/opcao.model';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { applyMask } from '../../../shared/utils/masks';
import { normalizeKey } from '../../../shared/utils/text';
import { BuscaSelect } from './components/busca-select';
import { ConveniosField } from './components/convenios-field';
import { FotoField } from './components/foto-field';
import { TelefonesField } from './components/telefones-field';
import { CadastroLookupsService } from './data/cadastro-lookups.service';
import {
  CADASTRO_ERRO_MENSAGENS,
  CadastroErro,
  CadastroMembroService,
  toCadastroErro,
} from './data/cadastro-membro.service';
import { createMembroForm } from './form/membro-form';
import { toAssociadoNovoPayload } from './form/membro-payload';

type EtapaKey =
  | 'pessoais'
  | 'endereco'
  | 'telefones'
  | 'bancarios'
  | 'vinculo'
  | 'adesao'
  | 'familia'
  | 'revisao';

interface Etapa {
  readonly key: EtapaKey;
  readonly titulo: string;
  readonly descricao: string;
}

type Envio =
  | { readonly status: 'idle' }
  | { readonly status: 'enviando' }
  | { readonly status: 'sucesso' }
  | { readonly status: 'erro'; readonly erro: CadastroErro };

interface Lookup {
  readonly state: () => LoadState<Opcao[]>;
  readonly retry: () => void;
}

/**
 * Cadastro de membro (associado/afiliado) em etapas, com revisão antes do
 * envio. O estado do formulário fica em `membro-form.ts` e o JSON enviado
 * é montado por `toAssociadoNovoPayload` (contrato AssociadoNovoDTO).
 */
@Component({
  selector: 'app-cadastro-membro',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Alert,
    Icon,
    SelectField,
    TextField,
    BuscaSelect,
    ConveniosField,
    FotoField,
    TelefonesField,
    CpfPipe,
    TelefonePipe,
  ],
  templateUrl: './cadastro-membro.html',
  styleUrl: './cadastro-membro.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class CadastroMembro {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lookups = inject(CadastroLookupsService);
  private readonly service = inject(CadastroMembroService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly topo = viewChild.required<ElementRef<HTMLElement>>('topo');

  protected readonly termos = TERMOS;
  protected readonly form = createMembroForm(this.fb);
  protected readonly envioDisponivel = this.service.envioDisponivel;

  protected readonly etapas: readonly Etapa[] = [
    { key: 'pessoais', titulo: 'Dados pessoais', descricao: 'Identificação e documentos' },
    { key: 'endereco', titulo: 'Endereço', descricao: 'Onde a pessoa reside' },
    { key: 'telefones', titulo: 'Telefones', descricao: 'Contatos telefônicos' },
    { key: 'bancarios', titulo: 'Dados bancários', descricao: 'Conta, Pix e pagamento' },
    { key: 'vinculo', titulo: 'Dados funcionais', descricao: 'Vínculo e instituição' },
    { key: 'adesao', titulo: 'Adesão e convênios', descricao: 'Tipo de sócio e convênios' },
    { key: 'familia', titulo: 'Dados familiares', descricao: 'Filiação' },
    { key: 'revisao', titulo: 'Revisão', descricao: 'Confira antes de salvar' },
  ];
  protected readonly etapaAtual = signal(0);
  protected readonly envio = signal<Envio>({ status: 'idle' });
  /** Aviso exibido quando o usuário tenta avançar/salvar com erros. */
  protected readonly avisoErros = signal(false);

  // --- Listas vindas da API (cada uma falha de forma independente) ----------
  protected readonly sexos = this.lookup(() => this.lookups.sexos());
  protected readonly estadosCivis = this.lookup(() => this.lookups.estadosCivis());
  protected readonly tiposPessoa = this.lookup(() => this.lookups.tiposPessoa());
  protected readonly estados = this.lookup(() => this.lookups.estados());
  protected readonly bancos = this.lookup(() => this.lookups.bancos());
  protected readonly tiposPix = this.lookup(() => this.lookups.tiposPix());
  protected readonly formasPagamento = this.lookup(() => this.lookups.formasPagamento());
  protected readonly tiposVinculo = this.lookup(() => this.lookups.tiposVinculo());
  protected readonly graduacoes = this.lookup(() => this.lookups.graduacoes());
  protected readonly quadros = this.lookup(() => this.lookups.quadros());
  protected readonly tiposSocio = this.lookup(() => this.lookups.tiposSocio());
  protected readonly convenios = this.lookup(() => this.lookups.convenios());

  // --- Dependências: tipo de vínculo → instituição → unidade ----------------
  private readonly vinculo = this.form.controls.vinculo.controls;
  protected readonly idVinculo = toSignal(
    this.vinculo.tipoVinculo.valueChanges.pipe(distinctUntilChanged()),
    { initialValue: null },
  );
  protected readonly idInstituicao = toSignal(
    this.vinculo.instituicao.valueChanges.pipe(distinctUntilChanged()),
    { initialValue: null },
  );
  /**
   * Regra de negócio: unidade, graduação, quadro, data de incorporação e
   * matrícula só se aplicam quando o tipo de vínculo é MILITAR (pelo nome
   * vindo de GET /listar/tipo/vinculo, sem diferenciar maiúsculas/acentos).
   */
  protected readonly militar = computed(() => this.ehMilitar(this.idVinculo()));
  protected readonly apenasMilitar = 'Disponível apenas para vínculo militar.';

  protected readonly instituicoes = this.dependente(this.idVinculo, (id) =>
    this.lookups.instituicoesPorVinculo(id),
  );
  /** Unidades só são consultadas para vínculo militar. */
  private readonly idInstituicaoMilitar = computed(() =>
    this.militar() ? this.idInstituicao() : null,
  );
  protected readonly unidades = this.dependente(this.idInstituicaoMilitar, (id) =>
    this.lookups.unidadesPorInstituicao(id),
  );

  // Buscas remotas (funções passadas aos campos de busca)
  protected readonly buscarIndicadores = (termo: string) => this.lookups.buscarIndicadores(termo);
  protected readonly buscarEmpresas = (termo: string) => this.lookups.buscarEmpresas(termo);

  constructor() {
    // Trocar o vínculo invalida instituição e unidade; trocar a instituição invalida a unidade.
    this.vinculo.tipoVinculo.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((idVinculo) => {
        this.vinculo.instituicao.setValue(null);
        this.vinculo.unidade.setValue(null);
        // Saindo de MILITAR, os dados militares deixam de valer e são descartados.
        if (!this.ehMilitar(idVinculo)) {
          this.vinculo.matricula.setValue('');
          this.vinculo.graduacao.setValue(null);
          this.vinculo.quadro.setValue(null);
          this.vinculo.dataIncorporacao.setValue('');
        }
      });
    this.vinculo.instituicao.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.vinculo.unidade.setValue(null));
  }

  // --- Navegação entre etapas -------------------------------------------------
  protected get etapa(): Etapa {
    return this.etapas[this.etapaAtual()];
  }

  protected get naRevisao(): boolean {
    return this.etapa.key === 'revisao';
  }

  protected irPara(index: number): void {
    if (index < 0 || index >= this.etapas.length) {
      return;
    }
    this.avisoErros.set(false);
    this.etapaAtual.set(index);
    this.topo().nativeElement.scrollIntoView({ block: 'start' });
  }

  protected proxima(): void {
    const key = this.etapa.key;
    if (key !== 'revisao') {
      const secao = this.form.controls[key];
      secao.markAllAsTouched();
      if (secao.invalid) {
        this.avisoErros.set(true);
        return;
      }
    }
    this.irPara(this.etapaAtual() + 1);
  }

  protected anterior(): void {
    this.irPara(this.etapaAtual() - 1);
  }

  protected etapaComErro(key: EtapaKey): boolean {
    if (key === 'revisao') {
      return false;
    }
    const secao = this.form.controls[key];
    return secao.invalid && secao.touched;
  }

  // --- Envio ------------------------------------------------------------------
  protected salvar(): void {
    if (this.envio().status === 'enviando' || this.envio().status === 'sucesso') {
      return; // evita envio duplicado
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const primeira = this.etapas.findIndex((e) => this.etapaComErro(e.key));
      this.irPara(primeira >= 0 ? primeira : 0);
      this.avisoErros.set(true);
      return;
    }

    const payload = toAssociadoNovoPayload(this.form.getRawValue());
    this.envio.set({ status: 'enviando' });
    this.service
      .criar(payload)
      .pipe(
        finalize(() => {
          if (this.envio().status === 'enviando') {
            this.envio.set({ status: 'idle' });
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.envio.set({ status: 'sucesso' });
          this.form.markAsPristine();
        },
        error: (error: unknown) => this.envio.set({ status: 'erro', erro: toCadastroErro(error) }),
      });
  }

  protected mensagemErro(erro: CadastroErro): string {
    return erro.mensagem ?? CADASTRO_ERRO_MENSAGENS[erro.kind];
  }

  protected novoCadastro(): void {
    this.form.reset();
    this.form.controls.telefones.clear();
    this.envio.set({ status: 'idle' });
    this.irPara(0);
  }

  protected cancelar(): void {
    void this.router.navigate(['/pessoas']);
  }

  /** Usado pelo guard de saída: confirma antes de descartar dados preenchidos. */
  podeSair(): boolean {
    if (!this.form.dirty || this.envio().status === 'sucesso') {
      return true;
    }
    return window.confirm('Descartar o cadastro? Os dados preenchidos serão perdidos.');
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty && this.envio().status !== 'sucesso') {
      event.preventDefault();
    }
  }

  // --- Revisão ----------------------------------------------------------------
  protected rotulo(lookup: Lookup, id: number | null): string {
    if (id === null) {
      return '—';
    }
    const s = lookup.state();
    return s.status === 'ready' ? (s.data.find((o) => o.id === id)?.label ?? '—') : '—';
  }

  protected texto(value: string | null | undefined): string {
    return value && value.trim() ? value.trim() : '—';
  }

  protected cep(value: string): string {
    return value ? applyMask('cep', value) : '—';
  }

  protected conveniosSelecionados(): string {
    const ids = this.form.controls.adesao.controls.convenios.value;
    if (ids.length === 0) {
      return '—';
    }
    return ids.map((id) => this.rotulo(this.convenios, id)).join(', ');
  }

  // --- Auxiliares ---------------------------------------------------------------
  private ehMilitar(idVinculo: number | null): boolean {
    if (idVinculo === null) {
      return false;
    }
    const s = this.tiposVinculo.state();
    const label = s.status === 'ready' ? s.data.find((o) => o.id === idVinculo)?.label : null;
    return normalizeKey(label) === 'MILITAR';
  }

  private lookup(fn: () => Observable<Opcao[]>): Lookup {
    const attempt = signal(0);
    const state = loadFrom(signal(null), fn, attempt);
    return { state, retry: () => attempt.update((n) => n + 1) };
  }

  /** Lista que depende de outra seleção: sem seleção, fica vazia e sem requisição. */
  private dependente(id: Signal<number | null>, fn: (id: number) => Observable<Opcao[]>): Lookup {
    const attempt = signal(0);
    const state = loadFrom(id, (value) => (value === null ? of([]) : fn(value)), attempt);
    return { state, retry: () => attempt.update((n) => n + 1) };
  }
}
