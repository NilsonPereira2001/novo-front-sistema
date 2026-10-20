import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { PessoaDetalheFonte } from '../data/pessoa-detalhe-fonte';
import { PessoaDetalhe } from '../models/pessoa-detalhe.model';
import { DocumentoConfig } from '../models/perfil-config';
import { DocumentoPrevia } from './documento-previa';

type Estado =
  | { readonly status: 'carregando' }
  | { readonly status: 'pdf'; readonly url: string; readonly seguro: SafeResourceUrl }
  | { readonly status: 'previa' }
  | { readonly status: 'erro' };

/**
 * Gera e mostra um documento. Com a API real, espera um PDF (exibido num
 * quadro, com Imprimir e Baixar). No modo demonstração, mostra a prévia HTML.
 */
@Component({
  selector: 'app-documento-dialog',
  imports: [Alert, Dialog, Icon, DocumentoPrevia],
  template: `
    <app-dialog size="wide" [titulo]="doc()?.titulo ?? 'Documento'" [open]="open()" (closed)="closed.emit()">
      @switch (estado().status) {
        @case ('carregando') {
          <div class="doc-estado" role="status">
            <span class="spinner" aria-hidden="true"></span> Gerando documento…
          </div>
        }
        @case ('erro') {
          <app-alert tone="danger" heading="Não foi possível gerar o documento">
            Tente novamente em instantes.
          </app-alert>
        }
        @case ('pdf') {
          <iframe #quadro class="doc-pdf" [src]="seguro()" [title]="doc()?.titulo ?? 'Documento'"></iframe>
        }
        @case ('previa') {
          @if (demonstracao) {
            <app-alert tone="warning" heading="Prévia de demonstração">
              Modelo provisório montado com os dados da tela. O documento oficial virá do sistema
              após a integração.
            </app-alert>
          }
          <div #previa class="doc-previa">
            @if (doc(); as d) {
              <app-documento-previa [tipo]="d.tipo" [titulo]="d.titulo" [detalhe]="detalhe()" />
            }
          </div>
        }
      }

      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="closed.emit()">Fechar</button>
        @if (estado().status === 'pdf') {
          <button type="button" class="btn btn--secondary btn--sm" (click)="baixar()">
            <app-icon name="download" /> Baixar PDF
          </button>
        }
        <button
          type="button"
          class="btn btn--primary btn--sm"
          (click)="imprimir()"
          [disabled]="estado().status !== 'pdf' && estado().status !== 'previa'"
        >
          <app-icon name="printer" /> Imprimir
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .doc-estado {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-10) 0;
      color: var(--color-text-muted);
    }
    .doc-pdf {
      width: 100%;
      height: 70dvh;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }
    .doc-previa {
      margin-top: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-gray-50);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoDialog {
  readonly open = input(false);
  readonly doc = input<DocumentoConfig | null>(null);
  readonly detalhe = input.required<PessoaDetalhe>();
  readonly closed = output<void>();

  private readonly fonte = inject(PessoaDetalheFonte);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly demonstracao = this.fonte.demonstracao;
  protected readonly estado = signal<Estado>({ status: 'carregando' });
  private readonly previaRef = viewChild<ElementRef<HTMLElement>>('previa');
  private readonly quadroRef = viewChild<ElementRef<HTMLIFrameElement>>('quadro');

  constructor() {
    effect((onCleanup) => {
      const doc = this.doc();
      if (!this.open() || !doc) {
        return;
      }
      const id = untracked(this.detalhe).id;
      this.estado.set({ status: 'carregando' });
      const sub = this.fonte.documento(id, doc.tipo).subscribe({
        next: (gerado) => {
          if (gerado.formato === 'pdf') {
            const url = URL.createObjectURL(gerado.arquivo);
            this.estado.set({ status: 'pdf', url, seguro: this.sanitizer.bypassSecurityTrustResourceUrl(url) });
          } else {
            this.estado.set({ status: 'previa' });
          }
        },
        error: () => this.estado.set({ status: 'erro' }),
      });
      onCleanup(() => {
        sub.unsubscribe();
        const atual = this.estado();
        if (atual.status === 'pdf') {
          URL.revokeObjectURL(atual.url);
        }
      });
    });
  }

  protected seguro(): SafeResourceUrl | null {
    const e = this.estado();
    return e.status === 'pdf' ? e.seguro : null;
  }

  protected baixar(): void {
    const e = this.estado();
    if (e.status !== 'pdf') {
      return;
    }
    const link = document.createElement('a');
    link.href = e.url;
    link.download = `${this.doc()?.titulo ?? 'documento'}.pdf`;
    link.click();
  }

  protected imprimir(): void {
    const quadro = this.quadroRef()?.nativeElement;
    if (quadro?.contentWindow) {
      quadro.contentWindow.print();
      return;
    }
    const previa = this.previaRef()?.nativeElement;
    if (previa) {
      imprimirElemento(previa, this.doc()?.titulo ?? 'Documento');
    }
  }
}

/**
 * Imprime só o documento: copia o HTML e os estilos da página para um
 * quadro invisível e chama a impressão dele. Nada sai do navegador.
 */
function imprimirElemento(elemento: HTMLElement, titulo: string): void {
  const quadro = document.createElement('iframe');
  quadro.setAttribute('aria-hidden', 'true');
  quadro.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  const win = quadro.contentWindow;
  if (!doc || !win) {
    quadro.remove();
    return;
  }
  const estilos = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('');
  doc.open();
  doc.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>${estilos}` +
      '<style>body{margin:0;background:#fff}@page{margin:16mm}</style></head><body></body></html>',
  );
  doc.close();
  doc.body.innerHTML = elemento.innerHTML;
  const limpar = () => setTimeout(() => quadro.remove(), 500);
  win.addEventListener('afterprint', limpar, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
