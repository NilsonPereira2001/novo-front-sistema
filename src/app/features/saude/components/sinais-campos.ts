import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';

import { SinaisFormValor, faixaImc, imc, numeroBr } from '../data/saude-api';

/** Campos de sinais vitais (usado no atendimento e no prontuário). Calcula o IMC na hora. */
@Component({
  selector: 'app-sinais-campos',
  template: `
    <div class="grade">
      <div class="field"><label class="field__label" [for]="id + '-pa'">Pressão arterial</label><input [id]="id + '-pa'" class="field__input" type="text" maxlength="20" placeholder="120/80" [value]="valor().pressaoArterial" (input)="set('pressaoArterial', $event)" /></div>
      <div class="field"><label class="field__label" [for]="id + '-fc'">Freq. cardíaca (bpm)</label><input [id]="id + '-fc'" class="field__input" type="text" inputmode="numeric" maxlength="20" [value]="valor().frequenciaCardiaca" (input)="set('frequenciaCardiaca', $event)" /></div>
      <div class="field"><label class="field__label" [for]="id + '-t'">Temperatura (°C)</label><input [id]="id + '-t'" class="field__input" type="text" inputmode="decimal" maxlength="20" placeholder="36,5" [value]="valor().temperatura" (input)="set('temperatura', $event)" /></div>
      <div class="field"><label class="field__label" [for]="id + '-s'">Saturação (%)</label><input [id]="id + '-s'" class="field__input" type="text" inputmode="numeric" maxlength="20" [value]="valor().saturacao" (input)="set('saturacao', $event)" /></div>
      <div class="field"><label class="field__label" [for]="id + '-p'">Peso (kg)</label><input [id]="id + '-p'" class="field__input" type="text" inputmode="decimal" maxlength="7" [value]="valor().peso" (input)="set('peso', $event)" /></div>
      <div class="field"><label class="field__label" [for]="id + '-a'">Altura (m)</label><input [id]="id + '-a'" class="field__input" type="text" inputmode="decimal" maxlength="5" placeholder="1,70" [value]="valor().altura" (input)="set('altura', $event)" /></div>
    </div>
    @if (imcAtual() !== null) {
      <p class="imc">IMC <strong>{{ imcAtual() }}</strong> · {{ faixa() }}</p>
    }
  `,
  styles: `
    .grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
    .imc { margin: var(--space-2) 0 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    @media (max-width: 40rem) { .grade { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SinaisCampos {
  readonly valor = model.required<SinaisFormValor>();
  protected readonly id = `sv-${++proximo}`;
  protected readonly imcAtual = computed(() => imc(numeroBr(this.valor().peso), numeroBr(this.valor().altura)));
  protected readonly faixa = computed(() => faixaImc(this.imcAtual()));

  protected set(k: keyof SinaisFormValor, ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.valor.update((x) => ({ ...x, [k]: v }));
  }
}

let proximo = 0;
