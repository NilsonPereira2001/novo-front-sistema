import { ChangeDetectorRef, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormControl } from '@angular/forms';

import { Icon } from '../../../../shared/components/icon/icon';
import { FOTO_FORMATO, FOTO_TAMANHO_MAXIMO_BYTES } from '../data/cadastro-api';

/**
 * Seleção de foto com pré-visualização. Guarda a imagem como data URL no
 * FormControl; se e como ela vai para o backend é decidido em
 * `membro-payload.ts` conforme `FOTO_FORMATO`.
 */
@Component({
  selector: 'app-foto-field',
  imports: [Icon],
  template: `
    <div class="photo">
      <div class="photo__preview" [class.has-image]="!!control().value">
        @if (control().value; as src) {
          <img [src]="src" alt="Pré-visualização da foto selecionada" />
        } @else {
          <app-icon name="user" />
        }
      </div>
      <div class="photo__actions">
        <span class="field__label" id="foto-rotulo">Foto</span>
        <div class="photo__buttons">
          <button type="button" class="btn btn--secondary btn--sm" (click)="abrir()" aria-describedby="foto-rotulo">
            <app-icon name="plus" />
            {{ control().value ? 'Trocar foto' : 'Selecionar foto' }}
          </button>
          @if (control().value) {
            <button type="button" class="btn btn--secondary btn--sm" (click)="remover()">Remover</button>
          }
        </div>
        <p class="field__hint">JPG, PNG ou WebP, até {{ tamanhoMaximoMb }} MB.</p>
        @if (!fotoEnviada) {
          <p class="field__hint">A foto é exibida aqui, mas o envio ao servidor aguarda configuração.</p>
        }
        @if (erro()) {
          <p class="field__error" role="alert">{{ erro() }}</p>
        }
        <input
          #arquivo
          class="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          tabindex="-1"
          aria-hidden="true"
          (change)="selecionado($event)"
        />
      </div>
    </div>
  `,
  styles: `
    .photo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-5);
    }
    .photo__preview {
      display: grid;
      place-items: center;
      width: 6.5rem;
      height: 6.5rem;
      overflow: hidden;
      border: 1.5px dashed var(--color-border-strong);
      border-radius: 50%;
      background: var(--color-gray-50);
      color: var(--color-gray-400);
    }
    .photo__preview.has-image {
      border-style: solid;
      border-color: var(--color-border);
    }
    .photo__preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .photo__preview app-icon {
      width: 2.25rem;
      height: 2.25rem;
    }
    .photo__actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .photo__buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class FotoField {
  readonly control = input.required<FormControl<string | null>>();

  private readonly arquivo = viewChild.required<ElementRef<HTMLInputElement>>('arquivo');
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly erro = signal<string | null>(null);
  protected readonly tamanhoMaximoMb = FOTO_TAMANHO_MAXIMO_BYTES / (1024 * 1024);
  protected readonly fotoEnviada = FOTO_FORMATO !== null;

  protected abrir(): void {
    this.arquivo().nativeElement.click();
  }

  protected remover(): void {
    this.control().setValue(null);
    this.control().markAsDirty();
    this.arquivo().nativeElement.value = '';
    this.erro.set(null);
  }

  protected selecionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) {
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.erro.set('Escolha uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > FOTO_TAMANHO_MAXIMO_BYTES) {
      this.erro.set(`A imagem deve ter no máximo ${this.tamanhoMaximoMb} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.control().setValue(reader.result);
        this.control().markAsDirty();
        this.erro.set(null);
        // A leitura termina fora de um evento do template: avisa a tela (app sem zone.js).
        this.cdr.markForCheck();
      }
    };
    reader.onerror = () => this.erro.set('Não foi possível ler a imagem selecionada.');
    reader.readAsDataURL(file);
  }
}
