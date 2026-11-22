import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

import { ADMINISTRADOR, PERSONALIZADO, Perfil, Permissao, agruparPermissoes, idsDoPerfil, rotuloPermissao } from '../data/usuarios-api';

/**
 * Perfil de acesso + permissões. Escolher um perfil pronto marca as
 * permissões dele; mexer em qualquer caixa vira PERSONALIZADO (ao salvar,
 * se as marcadas forem exatamente as de um perfil, o perfil é mantido).
 */
@Component({
  selector: 'app-permissoes-editor',
  template: `
    <div class="editor">
      <div class="topo">
        <div class="field">
          <label class="field__label" [for]="idBase + '-perfil'">Perfil de acesso <span class="field__req" aria-hidden="true">*</span></label>
          <select class="field__input" [id]="idBase + '-perfil'" (change)="escolherPerfil($event)" [disabled]="desabilitado()">
            <option value="" [selected]="!perfil()">Selecione</option>
            @for (p of perfis(); track p.nome) {
              <option [value]="p.nome" [selected]="perfil() === p.nome">{{ rotuloPerfil(p) }}</option>
            }
          </select>
          <p class="field__hint">{{ dica() }}</p>
        </div>
        <div class="field">
          <label class="field__label" [for]="idBase + '-busca'">Filtrar permissões</label>
          <input class="field__input" type="search" [id]="idBase + '-busca'" placeholder="Ex.: jurídico, financeiro…" [value]="busca()" (input)="busca.set(valor($event))" />
          <label class="so-marcadas"><input type="checkbox" [checked]="soMarcadas()" (change)="soMarcadas.set(!soMarcadas())" /> Mostrar só as marcadas</label>
        </div>
      </div>

      <p class="contagem" aria-live="polite"><strong>{{ selecionados().length }}</strong> de {{ permissoes().length }} permissões marcadas</p>

      @if (grupos().length === 0) {
        <p class="vazio">Nenhuma permissão encontrada.</p>
      }
      <div class="grupos">
        @for (g of grupos(); track g.tipo) {
          <fieldset class="grupo" [disabled]="desabilitado()">
            <legend class="grupo__titulo">
              {{ g.tipo }} <span class="grupo__qtd">{{ marcadasNo(g.itens) }}/{{ g.itens.length }}</span>
            </legend>
            <div class="grupo__acoes">
              <button type="button" class="link-button" (click)="marcarGrupo(g.itens, true)">Marcar todas</button>
              <button type="button" class="link-button" (click)="marcarGrupo(g.itens, false)">Desmarcar</button>
            </div>
            <ul>
              @for (p of g.itens; track p.id) {
                <li>
                  <label class="perm" [title]="p.nome">
                    <input type="checkbox" [checked]="marcada(p.id)" (change)="alternar(p.id)" />
                    <span>{{ rotulo(p) }}</span>
                  </label>
                </li>
              }
            </ul>
          </fieldset>
        }
      </div>
    </div>
  `,
  styles: `
    .editor { display: flex; flex-direction: column; gap: var(--space-4); }
    .topo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
    .so-marcadas { display: inline-flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-gray-600); }
    .contagem, .vazio { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    .contagem strong { color: var(--color-text); }
    .grupos { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: var(--space-3); }
    .grupo { margin: 0; padding: var(--space-3) var(--space-4); min-width: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .grupo__titulo { padding: 0 var(--space-1); font-size: var(--text-sm); font-weight: 700; color: var(--color-navy-900); text-transform: capitalize; }
    .grupo__qtd { margin-left: var(--space-1); font-weight: 400; font-size: var(--text-xs); color: var(--color-text-muted); }
    .grupo__acoes { display: flex; gap: var(--space-3); margin-bottom: var(--space-2); font-size: var(--text-xs); }
    ul { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
    .perm { display: flex; align-items: flex-start; gap: var(--space-2); padding: 2px 0; font-size: var(--text-sm); cursor: pointer; input { margin-top: 0.2rem; } }
    @media (max-width: 40rem) { .topo { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissoesEditor {
  readonly permissoes = input.required<readonly Permissao[]>();
  readonly perfis = input.required<readonly Perfil[]>();
  readonly desabilitado = input(false);
  readonly perfil = model<string>('');
  readonly selecionados = model<readonly number[]>([]);

  private static seq = 0;
  protected readonly idBase = `perm-${++PermissoesEditor.seq}`;
  protected readonly busca = signal('');
  protected readonly soMarcadas = signal(false);

  protected readonly grupos = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const sel = new Set(this.selecionados());
    const filtradas = this.permissoes().filter(
      (p) =>
        (!this.soMarcadas() || sel.has(p.id)) &&
        (!termo || p.nome.toLowerCase().includes(termo) || (p.tipo ?? '').toLowerCase().includes(termo) || rotuloPermissao(p).toLowerCase().includes(termo)),
    );
    return agruparPermissoes(filtradas);
  });

  protected readonly dica = computed(() => {
    const p = this.perfil();
    if (p === ADMINISTRADOR) return 'Todas as permissões do sistema, inclusive gerenciar usuários.';
    if (p === PERSONALIZADO) return 'Marque as permissões abaixo.';
    if (!p) return 'Escolha um perfil pronto ou "Personalizado".';
    return 'Permissões do perfil marcadas abaixo; ajuste se precisar.';
  });

  protected rotulo(p: Permissao): string {
    return rotuloPermissao(p);
  }
  protected rotuloPerfil(p: Perfil): string {
    if (p.nome === PERSONALIZADO) return 'Personalizado';
    if (p.nome === ADMINISTRADOR) return 'Administrador (todas)';
    return `${p.nome} (${p.permissoes.length})`;
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected marcada(id: number): boolean {
    return this.selecionados().includes(id);
  }
  protected marcadasNo(itens: readonly Permissao[]): number {
    const sel = new Set(this.selecionados());
    return itens.filter((p) => sel.has(p.id)).length;
  }

  protected escolherPerfil(ev: Event): void {
    const nome = (ev.target as HTMLSelectElement).value;
    this.perfil.set(nome);
    if (nome && nome !== PERSONALIZADO) {
      this.selecionados.set(idsDoPerfil(this.perfis().find((p) => p.nome === nome), this.permissoes()));
    }
  }

  protected alternar(id: number): void {
    const atual = this.selecionados();
    this.selecionados.set(atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
    this.perfil.set(PERSONALIZADO);
  }

  protected marcarGrupo(itens: readonly Permissao[], marcar: boolean): void {
    const ids = new Set(itens.map((p) => p.id));
    const resto = this.selecionados().filter((x) => !ids.has(x));
    this.selecionados.set(marcar ? [...resto, ...ids] : resto);
    this.perfil.set(PERSONALIZADO);
  }
}
