import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';

/**
 * Mostra a senha provisória uma única vez (não fica guardada em lugar nenhum
 * do front). No primeiro acesso o sistema pede a troca.
 */
@Component({
  selector: 'app-senha-dialog',
  imports: [Alert, Dialog, Icon, CpfPipe],
  template: `
    <app-dialog [titulo]="titulo()" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        <p>Repasse estes dados para <strong>{{ nome() }}</strong>. A senha aparece só agora; depois, apenas redefinindo.</p>
        <dl class="dados">
          <div><dt>Usuário</dt><dd class="cell-mono">{{ login() | cpf }}</dd></div>
          <div>
            <dt>Senha provisória</dt>
            <dd class="senha">
              <code>{{ senha() }}</code>
              <button type="button" class="btn btn--secondary btn--sm" (click)="copiar(senha(), 'senha')">
                <app-icon [name]="copiado() === 'senha' ? 'check-circle' : 'clipboard-list'" /> {{ copiado() === 'senha' ? 'Copiada' : 'Copiar' }}
              </button>
            </dd>
          </div>
        </dl>
        @if (emailEnviado()) {
          <app-alert tone="success">A senha também foi enviada para o e-mail cadastrado.</app-alert>
        }
        <p class="nota">No primeiro acesso o sistema vai pedir para criar uma senha pessoal.</p>
        <button type="button" class="link-button" (click)="copiar(instrucoes(), 'tudo')">
          {{ copiado() === 'tudo' ? 'Instruções copiadas' : 'Copiar instruções de acesso' }}
        </button>
      </div>
      <div dialog-actions>
        <button type="button" class="btn btn--primary btn--sm" (click)="fechar()">Entendi</button>
      </div>
    </app-dialog>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); p { margin: 0; } }
    .dados { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: var(--color-gray-50); }
    .dados dt { font-size: var(--text-xs); color: var(--color-text-muted); }
    .dados dd { margin: 0; font-size: var(--text-base, 1rem); font-weight: 600; }
    .senha { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
    code { padding: var(--space-1) var(--space-3); border: 1px dashed var(--color-primary); border-radius: var(--radius-sm); background: var(--color-surface); font-size: 1.15rem; letter-spacing: 0.08em; user-select: all; }
    .nota { color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SenhaDialog {
  readonly open = input(false);
  readonly titulo = input('Senha provisória');
  readonly nome = input('');
  readonly login = input('');
  readonly senha = input('');
  readonly emailEnviado = input(false);
  readonly closed = output<void>();

  protected readonly copiado = signal<'senha' | 'tudo' | null>(null);
  protected readonly instrucoes = computed(
    () =>
      `Acesso ao sistema\nUsuário: ${this.login()} (seu CPF)\nSenha provisória: ${this.senha()}\nNo primeiro acesso, crie sua senha pessoal.`,
  );

  protected copiar(texto: string, qual: 'senha' | 'tudo'): void {
    void navigator.clipboard?.writeText(texto).then(
      () => {
        this.copiado.set(qual);
        setTimeout(() => this.copiado.set(null), 2500);
      },
      () => this.copiado.set(null),
    );
  }

  protected fechar(): void {
    this.copiado.set(null);
    this.closed.emit();
  }
}
