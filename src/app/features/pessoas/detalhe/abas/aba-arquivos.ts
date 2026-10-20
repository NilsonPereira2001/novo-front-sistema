import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { PessoaDetalheFonte } from '../data/pessoa-detalhe-fonte';
import { ArquivoPessoa } from '../models/pessoa-detalhe.model';

/** ⚠️ Categorias provisórias — confirmar a lista com o backend. */
const CATEGORIAS = ['Documentos pessoais', 'Comprovantes', 'Contratos', 'Outros'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const TIPOS_ACEITOS = '.pdf,.png,.jpg,.jpeg';

export function tamanhoLegivel(bytes: number | null): string {
  if (bytes === null) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Aba "Arquivos": documentos anexados à pessoa (enviar, baixar, remover). */
@Component({
  selector: 'app-aba-arquivos',
  imports: [DatePipe, Alert, Dialog, Icon, LoadError, DisplayValuePipe],
  template: `
    <div class="arquivos__barra">
      <div class="arquivos__envio">
        <label class="sr-only" for="categoria-arquivo">Categoria do arquivo</label>
        <select id="categoria-arquivo" class="field__select arquivos__categoria" [value]="categoria()" (change)="categoria.set($any($event.target).value)">
          @for (c of categorias; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
        <input #arquivo type="file" class="sr-only" [accept]="tiposAceitos" (change)="selecionou($event)" tabindex="-1" aria-hidden="true" />
        <button type="button" class="btn btn--primary btn--sm" (click)="arquivo.click()" [disabled]="enviando()">
          @if (enviando()) {
            <span class="spinner" aria-hidden="true"></span> Enviando…
          } @else {
            <app-icon name="upload" /> Enviar arquivo
          }
        </button>
      </div>
      <p class="field__hint">PDF, PNG ou JPG de até 10 MB.</p>
    </div>

    @if (aviso(); as a) {
      <app-alert [tone]="a.tom">{{ a.texto }}</app-alert>
    }

    @switch (estado().status) {
      @case ('error') {
        <app-load-error [kind]="erro()!" (retry)="recarregar()" />
      }
      @case ('ready') {
        @if (itens().length === 0) {
          <div class="state">
            <span class="state__icon"><app-icon name="folder" /></span>
            <p class="state__title">Nenhum arquivo</p>
            <p class="state__text">Envie documentos para mantê-los junto ao cadastro.</p>
          </div>
        } @else {
          <ul class="arquivos__lista">
            @for (a of itens(); track a.id) {
              <li class="arquivo">
                <span class="arquivo__icone" aria-hidden="true"><app-icon name="file-text" /></span>
                <span class="arquivo__info">
                  <strong class="arquivo__nome">{{ a.nome }}</strong>
                  <span class="arquivo__meta">
                    {{ a.categoria | displayValue }} · {{ tamanho(a.tamanho) }} ·
                    {{ (a.enviadoEm | date: 'dd/MM/yyyy HH:mm') ?? '—' }}
                    @if (a.enviadoPor) {
                      · {{ a.enviadoPor }}
                    }
                  </span>
                </span>
                <span class="arquivo__acoes">
                  <button type="button" class="icon-btn" (click)="baixar(a)" [attr.aria-label]="'Baixar ' + a.nome" [disabled]="baixando() === a.id">
                    <app-icon name="download" />
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" (click)="paraRemover.set(a)" [attr.aria-label]="'Remover ' + a.nome">
                    <app-icon name="trash" />
                  </button>
                </span>
              </li>
            }
          </ul>
        }
      }
      @default {
        <div class="lista-carregando" aria-busy="true" aria-label="Carregando arquivos">
          <span class="skeleton"></span><span class="skeleton"></span>
        </div>
      }
    }

    <app-dialog titulo="Remover arquivo" [open]="paraRemover() !== null" (closed)="paraRemover.set(null)">
      @if (paraRemover(); as a) {
        <p>Remover <strong>{{ a.nome }}</strong>? Esta ação não pode ser desfeita.</p>
      }
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="paraRemover.set(null)">Cancelar</button>
        <button type="button" class="btn btn--danger btn--sm" (click)="remover()" [disabled]="removendo()">
          <app-icon name="trash" /> Remover
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .arquivos__barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
    }
    .arquivos__envio {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .arquivos__categoria {
      width: auto;
      height: 2.25rem;
      font-size: var(--text-sm);
    }
    .arquivos__lista {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .arquivo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
    }
    .arquivo + .arquivo {
      border-top: 1px solid var(--color-gray-100);
    }
    .arquivo__icone {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-sm);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .arquivo__info {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .arquivo__nome {
      overflow: hidden;
      font-size: var(--text-sm);
      color: var(--color-navy-900);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .arquivo__meta {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
    .arquivo__acoes {
      display: flex;
      gap: var(--space-1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbaArquivos {
  readonly pessoaId = input.required<number>();
  private readonly fonte = inject(PessoaDetalheFonte);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categorias = CATEGORIAS;
  protected readonly tiposAceitos = TIPOS_ACEITOS;
  protected readonly tamanho = tamanhoLegivel;

  protected readonly categoria = signal(CATEGORIAS[0]);
  protected readonly enviando = signal(false);
  protected readonly baixando = signal<number | null>(null);
  protected readonly removendo = signal(false);
  protected readonly paraRemover = signal<ArquivoPessoa | null>(null);
  protected readonly aviso = signal<{ tom: 'success' | 'danger'; texto: string } | null>(null);

  protected readonly tentar = signal(0);
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected readonly estado = loadFrom(this.pessoaId, (id) => this.fonte.arquivos(id), this.tentar);
  /** Lista local: começa com a carregada e reflete envios/remoções. */
  protected readonly itens = linkedSignal(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  protected selecionou(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) {
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      this.aviso.set({ tom: 'danger', texto: 'O arquivo passa de 10 MB. Escolha um arquivo menor.' });
      return;
    }
    if (!/\.(pdf|png|jpe?g)$/i.test(arquivo.name)) {
      this.aviso.set({ tom: 'danger', texto: 'Formato não aceito. Envie PDF, PNG ou JPG.' });
      return;
    }
    this.enviando.set(true);
    this.aviso.set(null);
    this.fonte
      .enviarArquivo(this.pessoaId(), arquivo, this.categoria())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (novo) => {
          this.itens.update((lista) => [novo, ...lista]);
          this.aviso.set({ tom: 'success', texto: `"${novo.nome}" foi enviado.` });
          this.enviando.set(false);
        },
        error: () => {
          this.aviso.set({ tom: 'danger', texto: 'Não foi possível enviar o arquivo. Tente novamente.' });
          this.enviando.set(false);
        },
      });
  }

  protected baixar(arquivo: ArquivoPessoa): void {
    this.baixando.set(arquivo.id);
    this.fonte
      .baixarArquivo(this.pessoaId(), arquivo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = arquivo.nome;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.baixando.set(null);
        },
        error: () => {
          this.aviso.set({ tom: 'danger', texto: 'Não foi possível baixar o arquivo.' });
          this.baixando.set(null);
        },
      });
  }

  protected remover(): void {
    const arquivo = this.paraRemover();
    if (!arquivo) {
      return;
    }
    this.removendo.set(true);
    this.fonte
      .removerArquivo(this.pessoaId(), arquivo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.itens.update((lista) => lista.filter((a) => a.id !== arquivo.id));
          this.aviso.set({ tom: 'success', texto: `"${arquivo.nome}" foi removido.` });
          this.removendo.set(false);
          this.paraRemover.set(null);
        },
        error: () => {
          this.aviso.set({ tom: 'danger', texto: 'Não foi possível remover o arquivo.' });
          this.removendo.set(false);
          this.paraRemover.set(null);
        },
      });
  }
}
