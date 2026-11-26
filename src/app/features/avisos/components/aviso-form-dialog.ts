import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { Aviso, PRIORIDADES, Prioridade } from '../data/avisos-api';
import { AvisosService } from '../data/avisos.service';

/** Publicar ou editar aviso (`aviso` preenchido = edição). */
@Component({
  selector: 'app-aviso-form-dialog',
  imports: [Alert, Dialog],
  template: `
    <app-dialog [titulo]="aviso() ? 'Editar aviso' : 'Novo aviso'" [open]="open()" (closed)="fechar()" size="wide">
      <div class="form">
        <div class="field" [class.field--invalid]="tentou() && !titulo().trim()">
          <label class="field__label" for="av-titulo">Título <span class="field__req" aria-hidden="true">*</span></label>
          <input id="av-titulo" class="field__input" type="text" maxlength="150" [value]="titulo()" (input)="titulo.set(valor($event))" />
          @if (tentou() && !titulo().trim()) { <p class="field__error">Informe o título.</p> }
        </div>
        <div class="field" [class.field--invalid]="tentou() && !conteudo().trim()">
          <label class="field__label" for="av-conteudo">Aviso <span class="field__req" aria-hidden="true">*</span></label>
          <textarea id="av-conteudo" class="field__input area" rows="7" maxlength="10000" [value]="conteudo()" (input)="conteudo.set(valor($event))"></textarea>
          <p class="field__hint">{{ conteudo().length }}/10.000 · quebras de linha são mantidas.</p>
          @if (tentou() && !conteudo().trim()) { <p class="field__error">Escreva o aviso.</p> }
        </div>
        <div class="linha">
          <fieldset class="prioridades">
            <legend class="field__label">Prioridade</legend>
            @for (p of prioridades; track p.key) {
              <label class="prioridade" [attr.data-p]="p.key">
                <input type="radio" name="av-prioridade" [checked]="prioridade() === p.key" (change)="prioridade.set(p.key)" /> {{ p.rotulo }}
              </label>
            }
          </fieldset>
          <div class="field">
            <label class="field__label" for="av-expira">Sai do quadro em (opcional)</label>
            <input id="av-expira" class="field__input" type="date" [min]="hoje" [value]="expiracao()" (input)="expiracao.set(valor($event))" />
          </div>
        </div>
        <label class="check"><input type="checkbox" [checked]="fixado()" (change)="fixado.set(!fixado())" /> Fixar no topo do quadro</label>
        @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
      </div>
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="salvar()" [disabled]="enviando()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Salvando… } @else { {{ aviso() ? 'Salvar' : 'Publicar' }} }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); }
    .area { height: auto; padding: var(--space-3); resize: vertical; font-family: inherit; line-height: 1.5; }
    .linha { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 14rem); gap: var(--space-4); align-items: start; }
    .prioridades { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0; padding: 0; border: 0; min-width: 0; legend { width: 100%; margin-bottom: var(--space-2); } }
    .prioridade {
      display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border); border-radius: 999px; cursor: pointer;
      &:has(input:checked) { border-color: var(--color-primary); background: var(--color-primary-soft); }
      &[data-p='URGENTE']:has(input:checked) { border-color: var(--color-danger); background: var(--color-danger-soft); }
      &[data-p='IMPORTANTE']:has(input:checked) { border-color: var(--color-warning); background: var(--color-warning-soft); }
    }
    .check { display: inline-flex; align-items: center; gap: var(--space-2); }
    @media (max-width: 40rem) { .linha { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoFormDialog {
  readonly open = input(false);
  readonly aviso = input<Aviso | null>(null);
  readonly salvo = output<Aviso>();
  readonly closed = output<void>();

  private readonly service = inject(AvisosService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prioridades = PRIORIDADES;
  protected readonly hoje = hojeIso();
  protected readonly titulo = signal('');
  protected readonly conteudo = signal('');
  protected readonly prioridade = signal<Prioridade>('NORMAL');
  protected readonly fixado = signal(false);
  protected readonly expiracao = signal('');
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const a = this.aviso();
      this.titulo.set(a?.titulo ?? '');
      this.conteudo.set(a?.conteudo ?? '');
      this.prioridade.set(a?.prioridade ?? 'NORMAL');
      this.fixado.set(a?.fixado ?? false);
      this.expiracao.set(a?.dataExpiracao ?? '');
      this.tentou.set(false);
      this.erro.set(null);
    });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected salvar(): void {
    this.tentou.set(true);
    if (!this.titulo().trim() || !this.conteudo().trim() || this.enviando()) return;
    if (this.expiracao() && this.expiracao() < this.hoje) {
      this.erro.set('A data para sair do quadro não pode estar no passado.');
      return;
    }
    const payload = {
      titulo: this.titulo().trim(),
      conteudo: this.conteudo().trim(),
      prioridade: this.prioridade(),
      fixado: this.fixado(),
      dataExpiracao: this.expiracao() || null,
    };
    const a = this.aviso();
    this.enviando.set(true);
    this.erro.set(null);
    (a ? this.service.editar(a.id, payload) : this.service.publicar(payload)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.salvo.emit(r);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, a ? 'editar o aviso' : 'publicar o aviso'));
      },
    });
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }
}
