import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../../shared/components/alert/alert';
import { Icon } from '../../../../shared/components/icon/icon';
import { tamanhoLegivel } from '../../../pessoas/detalhe/abas/aba-arquivos';
import { mensagemDeErro } from '../../processos/data/processos.service';
import { ANEXO_TIPOS_ACEITOS, Anexo, problemaDoAnexo } from '../data/atendimentos-api';
import { AtendimentosService } from '../data/atendimentos.service';

/** Arquivo escolhido e ainda não enviado (enviado depois de salvar o atendimento). */
export interface AnexoPendente {
  readonly arquivo: File;
  readonly idPessoa: number | null;
}

/** Pessoa cadastrada que pode "receber" o anexo (fica também nos arquivos dela). */
export interface PessoaDoAnexo {
  readonly idPessoa: number;
  readonly nome: string;
}

/**
 * Anexos do atendimento: lista os já enviados (abrir/remover) e adiciona novos.
 * - Com `idAtendimento` e `enviarNaHora`: envia assim que o arquivo é escolhido.
 * - Sem isso: guarda em `pendentes`, e quem usa envia depois de salvar.
 */
@Component({
  selector: 'app-anexos-atendimento',
  imports: [DatePipe, Alert, Icon],
  template: `
    <div class="anexos">
      @if (anexos().length === 0 && pendentes().length === 0) {
        <p class="vazio">Nenhum anexo.</p>
      }
      @if (anexos().length || pendentes().length) {
        <ul class="lista">
          @for (a of anexos(); track a.id) {
            <li class="anexo">
              <app-icon name="file-text" />
              <span class="anexo__info">
                <button type="button" class="link-button anexo__nome" (click)="abrir(a)" [disabled]="abrindo() === a.id">{{ a.nome }}</button>
                <small>
                  {{ tamanho(a.tamanho) }}@if (a.dataImportacao) { · {{ a.dataImportacao | date: 'dd/MM/yyyy HH:mm' }} }
                  · {{ a.nomePessoa ? a.nomePessoa : 'Geral' }}
                </small>
              </span>
              @if (podeRemover()) {
                <button type="button" class="icon-btn" (click)="remover(a)" [disabled]="removendo() === a.id" [attr.aria-label]="'Remover ' + a.nome"><app-icon name="trash" /></button>
              }
            </li>
          }
          @for (p of pendentes(); track p.arquivo; let i = $index) {
            <li class="anexo anexo--pendente">
              <app-icon name="upload" />
              <span class="anexo__info">
                <span class="anexo__nome">{{ p.arquivo.name }}</span>
                <small>{{ tamanho(p.arquivo.size) }} · será enviado ao salvar</small>
              </span>
              @if (pessoas().length) {
                <label class="sr-only" [for]="idBase + '-ref-' + i">Referente a</label>
                <select class="field__input anexo__ref" [id]="idBase + '-ref-' + i" (change)="mudarReferencia(i, $event)">
                  <option value="" [selected]="p.idPessoa === null">Geral (atendimento)</option>
                  @for (pe of pessoas(); track pe.idPessoa) {
                    <option [value]="pe.idPessoa" [selected]="p.idPessoa === pe.idPessoa">{{ pe.nome }}</option>
                  }
                </select>
              }
              <button type="button" class="icon-btn" (click)="tirar(i)" [attr.aria-label]="'Tirar ' + p.arquivo.name"><app-icon name="x" /></button>
            </li>
          }
        </ul>
      }

      <div class="adicionar">
        @if (enviarNaHora() && pessoas().length) {
          <label class="sr-only" [for]="idBase + '-ref'">Referente a</label>
          <select class="field__input anexo__ref" [id]="idBase + '-ref'" (change)="referenciaNova.set(numero($event))">
            <option value="">Geral (atendimento)</option>
            @for (pe of pessoas(); track pe.idPessoa) { <option [value]="pe.idPessoa">{{ pe.nome }}</option> }
          </select>
        }
        <button type="button" class="btn btn--secondary btn--sm" (click)="seletor.click()" [disabled]="enviando()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Enviando… } @else { <app-icon name="upload" /> Adicionar anexo }
        </button>
        <input #seletor type="file" class="sr-only" multiple [accept]="tipos" (change)="escolheu($event)" tabindex="-1" aria-hidden="true" />
        <span class="dica">PDF, imagem ou Word, até 10 MB cada.</span>
      </div>
      @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
    </div>
  `,
  styles: `
    .anexos { display: flex; flex-direction: column; gap: var(--space-3); font-size: var(--text-sm); }
    .vazio, .dica { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }
    .dica { font-size: var(--text-xs); }
    .lista { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    .anexo {
      display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface);
      > app-icon { flex: none; color: var(--color-text-muted); }
    }
    .anexo--pendente { border-style: dashed; }
    .anexo__info { display: flex; flex-direction: column; flex: 1; min-width: 0; small { color: var(--color-text-muted); font-size: var(--text-xs); } }
    .anexo__nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; max-width: 100%; }
    .anexo__ref { width: auto; max-width: 14rem; height: 2rem; padding-block: 0; font-size: var(--text-xs); }
    .adicionar { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
    @media (max-width: 600px) { .anexo { flex-wrap: wrap; } .anexo__ref { max-width: none; flex: 1; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnexosAtendimento {
  readonly idAtendimento = input<number | null>(null);
  readonly anexos = input<readonly Anexo[]>([]);
  readonly pessoas = input<readonly PessoaDoAnexo[]>([]);
  readonly podeRemover = input(true);
  readonly enviarNaHora = input(false);
  readonly pendentes = model<readonly AnexoPendente[]>([]);
  /** Um anexo foi enviado ou removido no servidor. */
  readonly alterado = output<void>();

  private static seq = 0;
  protected readonly idBase = `anexos-${++AnexosAtendimento.seq}`;
  private readonly service = inject(AtendimentosService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tipos = ANEXO_TIPOS_ACEITOS;
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly removendo = signal<number | null>(null);
  protected readonly abrindo = signal<number | null>(null);
  protected readonly referenciaNova = signal<number | null>(null);
  private readonly imediato = computed(() => this.enviarNaHora() && this.idAtendimento() !== null);

  protected tamanho(b: number | null): string {
    return tamanhoLegivel(b);
  }
  protected numero(ev: Event): number | null {
    return Number((ev.target as HTMLSelectElement).value) || null;
  }

  protected escolheu(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const arquivos = [...(input.files ?? [])];
    input.value = '';
    if (!arquivos.length) return;
    const recusados = arquivos.map((f) => [f, problemaDoAnexo(f)] as const).filter(([, p]) => p !== null);
    this.erro.set(recusados.length ? recusados.map(([f, p]) => `${f.name}: ${p}`).join(' ') : null);
    const aceitos = arquivos.filter((f) => problemaDoAnexo(f) === null);
    if (!aceitos.length) return;
    if (this.imediato()) this.enviar(aceitos, this.referenciaNova());
    else this.pendentes.update((l) => [...l, ...aceitos.map((arquivo) => ({ arquivo, idPessoa: null }))]);
  }

  protected mudarReferencia(i: number, ev: Event): void {
    const idPessoa = this.numero(ev);
    this.pendentes.update((l) => l.map((p, j) => (j === i ? { ...p, idPessoa } : p)));
  }

  protected tirar(i: number): void {
    this.pendentes.update((l) => l.filter((_, j) => j !== i));
  }

  /** Envia um por vez (o backend aceita até 10 MB por requisição). */
  private enviar(arquivos: File[], idPessoa: number | null): void {
    const id = this.idAtendimento();
    const [primeiro, ...resto] = arquivos;
    if (id === null || !primeiro) {
      this.enviando.set(false);
      this.alterado.emit();
      return;
    }
    this.enviando.set(true);
    this.service
      .anexar(id, primeiro, idPessoa)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.enviar(resto, idPessoa),
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(`${primeiro.name}: ${mensagemDeErro(e, 'enviar o anexo')}`);
          this.alterado.emit();
        },
      });
  }

  protected remover(a: Anexo): void {
    const id = this.idAtendimento();
    if (id === null) return;
    this.removendo.set(a.id);
    this.erro.set(null);
    this.service
      .removerAnexo(id, a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removendo.set(null);
          this.alterado.emit();
        },
        error: (e: unknown) => {
          this.removendo.set(null);
          this.erro.set(mensagemDeErro(e, 'remover o anexo'));
        },
      });
  }

  protected abrir(a: Anexo): void {
    const id = this.idAtendimento();
    if (id === null) return;
    this.abrindo.set(a.id);
    this.service
      .baixarAnexo(id, a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.abrindo.set(null);
          abrirArquivo(blob, a.nome);
        },
        error: () => {
          this.abrindo.set(null);
          this.erro.set('Não foi possível abrir o anexo.');
        },
      });
  }
}

/** PDF e imagem abrem em nova aba; os demais são baixados. */
function abrirArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const visualizavel = /\.(pdf|png|jpe?g)$/i.test(nome);
  const aba = visualizavel ? window.open(url, '_blank') : null;
  if (!aba) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
