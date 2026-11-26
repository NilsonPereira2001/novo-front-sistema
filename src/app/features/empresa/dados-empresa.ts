import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { Alert } from '../../shared/components/alert/alert';
import { Dialog } from '../../shared/components/dialog/dialog';
import { TextField } from '../../shared/components/form-fields/text-field';
import { Icon } from '../../shared/components/icon/icon';
import { LoadError } from '../../shared/components/load-error/load-error';
import { loadFrom } from '../../shared/data/load-state';
import { TelefonePipe } from '../../shared/pipes/telefone.pipe';
import { applyMask } from '../../shared/utils/masks';
import { notFutureDateValidator, telefoneValidator } from '../../shared/validators/brazil.validators';
import { requiredTrimmed } from '../../shared/validators/text.validators';
import { isCnpjValido } from '../financeiro/convenios/form/convenio-regras';
import { CadastroLookupsService } from '../pessoas/cadastro-membro/data/cadastro-lookups.service';
import { erroUsuarios } from '../usuarios/data/usuarios.service';
import { SedeDialog } from './components/sede-dialog';
import { TermoEditor } from './components/termo-editor';
import { DadosEmpresa, SIGLA_MAX, Sede, TipoImagem, TipoTermo, daEmpresa, enderecoDaSede, linkSite, problemaImagem } from './data/empresa-api';
import { EmpresaService } from './data/empresa.service';

const cnpjValidator = (c: AbstractControl): ValidationErrors | null => {
  const d = String(c.value ?? '').replace(/\D/g, '');
  return d === '' || isCnpjValido(d) ? null : { cnpj: true };
};

/**
 * Administração › Dados da empresa: identificação, imagens (logo dos e-mails e cabeçalho
 * dos relatórios), sedes, termos de adesão/desligamento e a gestão atual.
 * Rota: /administracao/empresa
 */
@Component({
  selector: 'app-dados-empresa',
  imports: [DatePipe, ReactiveFormsModule, Alert, Dialog, Icon, LoadError, TextField, TelefonePipe, SedeDialog, TermoEditor],
  templateUrl: './dados-empresa.html',
  styleUrl: './dados-empresa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DadosEmpresaPage {
  private readonly service = inject(EmpresaService);
  private readonly lookups = inject(CadastroLookupsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly tentar = signal(0);
  private readonly estado = loadFrom(signal(0), () => this.service.dados(), this.tentar);
  protected readonly estados = loadFrom(signal(0), () => this.lookups.estados(), this.tentar);
  /** Versão mais recente devolvida por uma ação (todas devolvem os dados completos). */
  private readonly atual = signal<DadosEmpresa | null>(null);
  protected readonly d = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erroCarga = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  protected readonly siglaMax = SIGLA_MAX;
  protected readonly endereco = enderecoDaSede;
  protected readonly linkSite = linkSite;
  protected readonly aviso = signal<string | null>(null);

  // Identificação
  protected readonly form = this.fb.group({
    nome: ['', [requiredTrimmed, Validators.maxLength(255)]],
    sigla: ['', Validators.maxLength(SIGLA_MAX)],
    cnpj: ['', cnpjValidator],
    dataFundacao: ['', notFutureDateValidator],
    site: ['', Validators.maxLength(255)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    telefone: ['', telefoneValidator],
  });
  protected readonly editandoDados = signal(false);
  protected readonly salvandoDados = signal(false);
  protected readonly erroDados = signal<string | null>(null);

  // Imagens
  protected readonly imagens = computed(() => {
    const d = this.d();
    const lista: readonly { tipo: TipoImagem; titulo: string; uso: string; src: string | null }[] = [
      { tipo: 'logo', titulo: 'Logo', uso: 'Aparece nos e-mails enviados pelo sistema.', src: d?.logo ?? null },
      { tipo: 'cabecalho', titulo: 'Cabeçalho dos relatórios', uso: 'Topo dos PDFs: fichas, requerimentos, extratos e recibos.', src: d?.cabecalho ?? null },
    ];
    return lista;
  });
  protected readonly enviandoImagem = signal<TipoImagem | null>(null);
  protected readonly erroImagem = signal<{ tipo: TipoImagem; texto: string } | null>(null);

  // Sedes
  protected readonly sedeAberta = signal(false);
  protected readonly sedeEditada = signal<Sede | null>(null);
  protected readonly removendo = signal<Sede | null>(null);
  protected readonly acaoSede = signal<number | null>(null);
  protected readonly erroSede = signal<string | null>(null);

  // Termos
  protected readonly termo = signal<TipoTermo>('adesao');

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  private aplicar(dados: DadosEmpresa, mensagem: string): void {
    this.atual.set(dados);
    this.aviso.set(mensagem);
  }

  protected cnpj(v: string | null): string {
    const d = (v ?? '').replace(/\D/g, '');
    return d.length === 14 ? applyMask('documento', d) : (v ?? '—');
  }

  // --- Identificação -----------------------------------------------------------------

  protected editarDados(d: DadosEmpresa): void {
    this.form.reset(daEmpresa(d));
    this.erroDados.set(null);
    this.editandoDados.set(true);
  }

  protected salvarDados(): void {
    if (this.salvandoDados()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvandoDados.set(true);
    this.erroDados.set(null);
    this.service
      .salvar(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.salvandoDados.set(false);
          this.editandoDados.set(false);
          this.aplicar(d, 'Dados da empresa salvos.');
        },
        error: (e: unknown) => {
          this.salvandoDados.set(false);
          this.erroDados.set(erroUsuarios(e, 'salvar os dados da empresa'));
        },
      });
  }

  // --- Imagens -----------------------------------------------------------------------

  protected escolherImagem(tipo: TipoImagem, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const arquivo = el.files?.[0];
    el.value = '';
    if (!arquivo || this.enviandoImagem()) return;
    const problema = problemaImagem(arquivo);
    if (problema) {
      this.erroImagem.set({ tipo, texto: problema });
      return;
    }
    this.erroImagem.set(null);
    this.enviandoImagem.set(tipo);
    this.service
      .enviarImagem(tipo, arquivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.enviandoImagem.set(null);
          this.aplicar(d, tipo === 'logo' ? 'Logo atualizada.' : 'Cabeçalho dos relatórios atualizado.');
        },
        error: (e: unknown) => {
          this.enviandoImagem.set(null);
          this.erroImagem.set({ tipo, texto: erroUsuarios(e, 'enviar a imagem') });
        },
      });
  }

  // --- Sedes -------------------------------------------------------------------------

  protected abrirSede(s: Sede | null): void {
    this.sedeEditada.set(s);
    this.sedeAberta.set(true);
  }

  protected sedeSalva(r: { dados: DadosEmpresa; mensagem: string }): void {
    this.sedeAberta.set(false);
    this.aplicar(r.dados, r.mensagem);
  }

  protected tornarPrincipal(s: Sede): void {
    if (this.acaoSede() !== null) return;
    this.acaoSede.set(s.id);
    this.erroSede.set(null);
    this.service
      .definirPrincipal(s.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.acaoSede.set(null);
          this.aplicar(d, `${s.nome} agora é a sede principal.`);
        },
        error: (e: unknown) => {
          this.acaoSede.set(null);
          this.erroSede.set(erroUsuarios(e, 'definir a sede principal'));
        },
      });
  }

  protected pedirRemocao(s: Sede): void {
    this.erroSede.set(null);
    this.removendo.set(s);
  }

  protected remover(): void {
    const s = this.removendo();
    if (!s || this.acaoSede() !== null) return;
    this.acaoSede.set(s.id);
    this.service
      .removerSede(s.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.acaoSede.set(null);
          this.removendo.set(null);
          this.aplicar(d, `Sede ${s.nome} removida.`);
        },
        error: (e: unknown) => {
          this.acaoSede.set(null);
          this.erroSede.set(erroUsuarios(e, 'remover a sede'));
        },
      });
  }

  protected termoSalvo(r: { dados: DadosEmpresa; mensagem: string }): void {
    this.aplicar(r.dados, r.mensagem);
  }
}
