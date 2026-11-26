import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { Alert } from '../../../../shared/components/alert/alert';
import { FieldError } from '../../../../shared/components/form-fields/field-error';
import { SelectField } from '../../../../shared/components/form-fields/select-field';
import { TextField } from '../../../../shared/components/form-fields/text-field';
import { Icon } from '../../../../shared/components/icon/icon';
import { loadFrom } from '../../../../shared/data/load-state';
import { CadastroLookupsService } from '../../../pessoas/cadastro-membro/data/cadastro-lookups.service';
import { erroUsuarios } from '../../../usuarios/data/usuarios.service';
import { CLASSES, Classe } from '../data/convenios-api';
import { ConveniosService } from '../data/convenios.service';
import { criarConvenioForm } from './convenio-form.model';
import { daFicha, exigeValor, toPayload } from './convenio-regras';

type Carga = 'pronto' | 'carregando' | 'erro' | 'nao-encontrado';

/**
 * Cadastro e edição de convênio.
 * Rotas: /financeiro/convenios/novo · /financeiro/convenios/:id/editar
 */
@Component({
  selector: 'app-convenio-form',
  imports: [ReactiveFormsModule, RouterLink, Alert, FieldError, SelectField, TextField, Icon],
  templateUrl: './convenio-form.html',
  styleUrl: './convenio-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConvenioFormPage {
  readonly id = input<string | undefined>();

  private readonly service = inject(ConveniosService);
  private readonly lookups = inject(CadastroLookupsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly form = criarConvenioForm(inject(NonNullableFormBuilder));
  protected readonly classes = CLASSES;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return this.id() !== undefined && Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  protected readonly editando = computed(() => this.id() !== undefined);
  protected readonly carga = signal<Carga>('pronto');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  /** Classe original (edição): avisa quando muda de/para nativo. */
  protected readonly classeOriginal = signal<Classe | null>(null);

  private readonly tentar = signal(0);
  protected readonly estados = loadFrom(signal(0), () => this.lookups.estados(), this.tentar);
  protected readonly publicos = loadFrom(
    signal(0),
    () => this.service.publicos().pipe(map((l) => l.map((p) => ({ id: p.id, label: p.tipo })))),
    this.tentar,
  );
  protected readonly classe = toSignal(this.form.controls.classe.valueChanges, { initialValue: this.form.controls.classe.value });
  protected readonly exigeValor = computed(() => exigeValor(this.classe()));

  constructor() {
    effect(() => {
      if (!this.editando()) return;
      const id = this.idNumero();
      if (id === null) {
        this.carga.set('nao-encontrado');
        return;
      }
      this.carga.set('carregando');
      this.service
        .ficha(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (f) => {
            this.form.setValue(daFicha(f));
            this.classeOriginal.set(f.convenio.classe);
            this.carga.set('pronto');
          },
          error: (e: unknown) => this.carga.set((e as { status?: number })?.status === 404 ? 'nao-encontrado' : 'erro'),
        });
    });
  }

  protected escolherClasse(c: Classe): void {
    this.form.controls.classe.setValue(c);
    if (c !== 'NATIVO') this.form.controls.associadosAntigos.setValue(false);
  }
  protected tentarLookups(): void {
    this.tentar.update((n) => n + 1);
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.form.controls.valor.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.erro.set('Confira os campos destacados.');
      queueMicrotask(() => document.querySelector<HTMLElement>('.field--invalid input, .field--invalid select')?.focus());
      return;
    }
    const id = this.idNumero();
    const payload = toPayload(this.form.getRawValue(), this.editando());
    this.enviando.set(true);
    this.erro.set(null);
    if (id !== null) {
      this.service
        .editar(id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.enviando.set(false);
            void this.router.navigate(['/financeiro/convenios', id], { state: { aviso: 'Convênio atualizado.' } });
          },
          error: (e: unknown) => {
            this.enviando.set(false);
            this.erro.set(erroUsuarios(e, 'salvar o convênio'));
          },
        });
      return;
    }
    this.service
      .criar(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.enviando.set(false);
          const extra = payload.associadosAntigos ? ` Aplicado a ${r.aplicados} ${r.aplicados === 1 ? 'associado' : 'associados'} já cadastrados.` : '';
          void this.router.navigate(['/financeiro/convenios', r.ficha.convenio.id], { state: { aviso: `Convênio criado.${extra}` } });
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'criar o convênio'));
        },
      });
  }
}
