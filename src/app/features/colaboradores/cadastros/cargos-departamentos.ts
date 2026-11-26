import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { Opcao, Opcoes } from '../data/colaboradores-api';
import { ColaboradoresService } from '../data/colaboradores.service';

type Tipo = 'cargos' | 'departamentos';

/** Cargos e departamentos dos colaboradores (criar e renomear). Rota: /colaboradores/cargos */
@Component({
  selector: 'app-cargos-departamentos',
  imports: [RouterLink, Alert, Icon, LoadError],
  template: `
    <a class="back-link" routerLink="/colaboradores"><app-icon name="arrow-left" /> Colaboradores</a>
    <header class="page-header">
      <div class="page-header__text">
        <p class="page-eyebrow">Colaboradores</p>
        <h1 class="page-title">Cargos e departamentos</h1>
        <p class="page-subtitle">Os departamentos JURÍDICO e SAÚDE são usados pelo sistema e não podem ser renomeados.</p>
      </div>
    </header>
    @if (aviso(); as a) {
      <div class="aviso" role="status"><app-icon name="check-circle" /> {{ a }} <button type="button" class="link-button" (click)="aviso.set(null)">Dispensar</button></div>
    }
    @if (erroCarga(); as kind) {
      <section class="card"><app-load-error [kind]="kind" (retry)="recarregar()" /></section>
    } @else if (o(); as o) {
      <div class="grade">
        @for (b of blocos; track b.tipo) {
          <section class="card bloco" [attr.aria-labelledby]="'t-' + b.tipo">
            <h2 class="bloco__titulo" [id]="'t-' + b.tipo">{{ b.titulo }}</h2>
            <form class="novo" (submit)="criar(b.tipo, $event)">
              <label class="sr-only" [for]="'novo-' + b.tipo">Novo {{ b.singular }}</label>
              <input [id]="'novo-' + b.tipo" class="field__input" type="text" maxlength="255" [placeholder]="'Novo ' + b.singular" [value]="novo()[b.tipo]" (input)="setNovo(b.tipo, $event)" />
              <button type="submit" class="btn btn--primary btn--sm" [disabled]="enviando() || !novo()[b.tipo].trim()"><app-icon name="plus" /> Adicionar</button>
            </form>
            <ul class="lista">
              @for (x of lista(o, b.tipo); track x.id) {
                <li>
                  @if (editando()?.tipo === b.tipo && editando()?.id === x.id) {
                    <input class="field__input" type="text" maxlength="255" [attr.aria-label]="'Nome de ' + x.nome" [value]="texto()" (input)="texto.set(valor($event))" (keydown.enter)="salvar()" />
                    <button type="button" class="btn btn--primary btn--sm" (click)="salvar()" [disabled]="enviando()">Salvar</button>
                    <button type="button" class="btn btn--secondary btn--sm" (click)="editando.set(null)">Cancelar</button>
                  } @else {
                    <span class="nome">{{ x.nome }}</span>
                    <button type="button" class="btn btn--secondary btn--sm" (click)="editar(b.tipo, x)" [attr.aria-label]="'Renomear ' + x.nome"><app-icon name="pencil" /></button>
                  }
                </li>
              } @empty {
                <li class="vazio">Nenhum cadastrado.</li>
              }
            </ul>
            @if (erro()?.tipo === b.tipo) { <app-alert tone="danger">{{ erro()?.texto }}</app-alert> }
          </section>
        }
      </div>
    } @else {
      <section class="card"><span class="skeleton" style="width: 100%; height: 5rem"></span></section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-5); }
    .back-link { align-self: flex-start; margin-bottom: 0; }
    .page-header { margin-bottom: 0; }
    .aviso { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-success); border-radius: var(--radius-md);
      background: var(--color-success-soft); font-size: var(--text-sm); color: var(--color-success-text, #0f6b43); .link-button { margin-left: auto; } }
    .grade { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-5); align-items: start; }
    .bloco { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); }
    .bloco__titulo { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-navy-900); }
    .novo { display: flex; gap: var(--space-2); }
    .lista { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none;
      li { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-gray-100); } li:last-child { border-bottom: 0; } }
    .nome { flex: 1; font-size: var(--text-sm); }
    .vazio { font-size: var(--text-sm); color: var(--color-text-muted); }
    @media (max-width: 48rem) { .grade { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CargosDepartamentos {
  private readonly service = inject(ColaboradoresService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly blocos: readonly { tipo: Tipo; titulo: string; singular: string }[] = [
    { tipo: 'cargos', titulo: 'Cargos', singular: 'cargo' },
    { tipo: 'departamentos', titulo: 'Departamentos', singular: 'departamento' },
  ];
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(signal(0), () => this.service.opcoes(), this.tentar);
  private readonly atual = signal<Opcoes | null>(null);
  protected readonly o = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erroCarga = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly novo = signal<Record<Tipo, string>>({ cargos: '', departamentos: '' });
  protected readonly editando = signal<{ tipo: Tipo; id: number } | null>(null);
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<{ tipo: Tipo; texto: string } | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected lista(o: Opcoes, t: Tipo): readonly Opcao[] {
    return t === 'cargos' ? o.cargos : o.departamentos;
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected setNovo(t: Tipo, ev: Event): void {
    const v = this.valor(ev);
    this.novo.update((n) => ({ ...n, [t]: v }));
  }
  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }
  protected editar(t: Tipo, x: Opcao): void {
    this.editando.set({ tipo: t, id: x.id });
    this.texto.set(x.nome);
    this.erro.set(null);
  }
  protected criar(t: Tipo, ev: Event): void {
    ev.preventDefault();
    const nome = this.novo()[t].trim();
    if (!nome) return;
    this.enviar(t, null, nome, () => this.novo.update((n) => ({ ...n, [t]: '' })));
  }
  protected salvar(): void {
    const e = this.editando();
    if (!e || !this.texto().trim()) return;
    this.enviar(e.tipo, e.id, this.texto(), () => this.editando.set(null));
  }
  private enviar(t: Tipo, id: number | null, nome: string, depois: () => void): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .salvarCadastro(t, id, nome)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (o) => {
          this.enviando.set(false);
          this.atual.set(o);
          this.aviso.set(id ? 'Nome atualizado.' : 'Cadastrado.');
          depois();
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set({ tipo: t, texto: erroUsuarios(e, 'salvar') });
        },
      });
  }
}
