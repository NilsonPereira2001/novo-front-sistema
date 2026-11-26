import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { Prontuario, ProntuarioFormValor, daProntuario } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';
import { ListaItens } from './lista-itens';

/** Edição da anamnese: doença atual, hábitos, alergias, antecedentes e medicamentos em uso. */
@Component({
  selector: 'app-prontuario-dialog',
  imports: [Alert, Dialog, Icon, ListaItens],
  template: `
    <app-dialog titulo="Anamnese" size="wide" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        <div class="field">
          <label class="field__label" for="pr-doenca">Doença atual / história</label>
          <textarea id="pr-doenca" class="field__input area" rows="3" maxlength="5000" [value]="v().doencaAtual" (input)="campo('doencaAtual', $event)"></textarea>
        </div>
        <fieldset class="habitos">
          <legend class="field__label">Hábitos</legend>
          @for (h of habitos; track h.chave) {
            <div class="habito">
              <label class="check"><input type="checkbox" [checked]="v()[h.chave]" (change)="alternar(h.chave)" /> {{ h.rotulo }}</label>
              @if (v()[h.chave]) {
                <input class="field__input" type="text" maxlength="255" [attr.aria-label]="'Frequência: ' + h.rotulo" placeholder="Frequência (ex.: diário, 3x por semana)" [value]="v()[h.freq]" (input)="campo(h.freq, $event)" />
              }
            </div>
          }
        </fieldset>
        <app-lista-itens rotulo="Alergias" placeholder="Ex.: DIPIRONA" [destaque]="true" [itens]="v().alergias" (itensChange)="lista('alergias', $event)" />
        <app-lista-itens rotulo="Antecedentes pessoais (comorbidades)" placeholder="Ex.: HIPERTENSÃO" [itens]="v().antecedentesPessoais" (itensChange)="lista('antecedentesPessoais', $event)" />
        <app-lista-itens rotulo="Medicamentos em uso" placeholder="Ex.: LOSARTANA 50MG" [itens]="v().medicamentos" (itensChange)="lista('medicamentos', $event)" />
        <div class="field">
          <span class="field__label">Antecedentes familiares</span>
          @for (f of v().antecedentesFamiliares; track $index; let i = $index) {
            <div class="familiar">
              <input class="field__input" type="text" maxlength="255" placeholder="Doença" [attr.aria-label]="'Doença do familiar ' + (i + 1)" [value]="f.comorbidade" (input)="familiar(i, 'comorbidade', $event)" />
              <select class="field__input" [attr.aria-label]="'Parentesco ' + (i + 1)" (change)="familiar(i, 'idParentesco', $event)">
                <option value="" [selected]="f.idParentesco === null">Parentesco…</option>
                @for (p of prontuario()?.parentescos ?? []; track p.id) { <option [value]="p.id" [selected]="f.idParentesco === p.id">{{ p.nome }}</option> }
              </select>
              <button type="button" class="btn btn--secondary btn--sm" (click)="removerFamiliar(i)" aria-label="Remover"><app-icon name="trash" /></button>
            </div>
          }
          <button type="button" class="link-button" (click)="novoFamiliar()">+ Adicionar antecedente familiar</button>
        </div>
        @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
      </div>
      <div dialog-actions class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="salvar()" [disabled]="enviando()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Salvando… } @else { Salvar anamnese }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: var(--space-4); }
    .area { height: auto; padding: var(--space-3); resize: vertical; font-family: inherit; }
    .habitos { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; border: 0; }
    .habito { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: var(--space-3); align-items: center; }
    .check { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
    .familiar { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; gap: var(--space-2); margin-bottom: var(--space-2); }
    .acoes { display: flex; justify-content: flex-end; gap: var(--space-2); width: 100%; }
    @media (max-width: 40rem) { .habito, .familiar { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProntuarioDialog {
  readonly open = input(false);
  readonly idPessoa = input.required<number>();
  readonly prontuario = input<Prontuario | null>(null);
  readonly salvo = output<Prontuario>();
  readonly closed = output<void>();

  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly habitos = [
    { chave: 'tabagismo', freq: 'frequenciaTabagismo', rotulo: 'Tabagismo' },
    { chave: 'etilismo', freq: 'frequenciaEtilismo', rotulo: 'Etilismo (álcool)' },
    { chave: 'atividadeFisica', freq: 'frequenciaAtividade', rotulo: 'Atividade física' },
  ] as const;
  protected readonly v = signal<ProntuarioFormValor>(vazio());
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const p = this.prontuario();
      this.v.set(p ? daProntuario(p) : vazio());
      this.erro.set(null);
    });
  }

  protected campo(k: 'doencaAtual' | 'frequenciaTabagismo' | 'frequenciaEtilismo' | 'frequenciaAtividade', ev: Event): void {
    const valor = (ev.target as HTMLInputElement).value;
    this.v.update((x) => ({ ...x, [k]: valor }));
  }
  protected alternar(k: 'tabagismo' | 'etilismo' | 'atividadeFisica'): void {
    this.v.update((x) => ({ ...x, [k]: !x[k] }));
  }
  protected lista(k: 'alergias' | 'antecedentesPessoais' | 'medicamentos', itens: string[]): void {
    this.v.update((x) => ({ ...x, [k]: itens }));
  }
  protected familiar(i: number, k: 'comorbidade' | 'idParentesco', ev: Event): void {
    const valor = (ev.target as HTMLInputElement).value;
    this.v.update((x) => ({
      ...x,
      antecedentesFamiliares: x.antecedentesFamiliares.map((f, j) =>
        j !== i ? f : k === 'comorbidade' ? { ...f, comorbidade: valor } : { ...f, idParentesco: valor ? Number(valor) : null },
      ),
    }));
  }
  protected novoFamiliar(): void {
    this.v.update((x) => ({ ...x, antecedentesFamiliares: [...x.antecedentesFamiliares, { comorbidade: '', idParentesco: null }] }));
  }
  protected removerFamiliar(i: number): void {
    this.v.update((x) => ({ ...x, antecedentesFamiliares: x.antecedentesFamiliares.filter((_, j) => j !== i) }));
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .salvarProntuario(this.idPessoa(), this.v())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.enviando.set(false);
          this.salvo.emit(p);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'salvar o prontuário'));
        },
      });
  }
}

function vazio(): ProntuarioFormValor {
  return {
    doencaAtual: '',
    tabagismo: false,
    frequenciaTabagismo: '',
    etilismo: false,
    frequenciaEtilismo: '',
    atividadeFisica: false,
    frequenciaAtividade: '',
    alergias: [],
    antecedentesPessoais: [],
    antecedentesFamiliares: [],
    medicamentos: [],
  };
}
