import { CurrencyPipe, DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../core/config/app-title';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { hojeIso } from '../../../shared/utils/datas';
import { isRecord } from '../../../shared/utils/json-read';
import { applyMask } from '../../../shared/utils/masks';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { FichaColaborador, PessoaDados, tempoDeCasa } from '../data/colaboradores-api';
import { ColaboradoresService } from '../data/colaboradores.service';

/**
 * Ficha do colaborador: vínculo, dados pessoais, contato, banco, acesso ao sistema, serviços
 * de saúde e outros vínculos. Ações: editar, desligar (data e motivo) e reativar.
 * Rota: /colaboradores/:id
 */
@Component({
  selector: 'app-colaborador-ficha',
  imports: [CurrencyPipe, DatePipe, LowerCasePipe, RouterLink, Alert, Dialog, Icon, LoadError, CpfPipe, TelefonePipe],
  templateUrl: './colaborador-ficha.html',
  styleUrl: './colaborador-ficha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColaboradorFicha {
  readonly id = input<string | undefined>();

  private readonly service = inject(ColaboradoresService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly hoje = hojeIso();
  protected readonly tempo = tempoDeCasa;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => this.service.ficha(id ?? 0), this.tentar);
  private readonly atual = signal<FichaColaborador | null>(null);
  protected readonly f = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });

  protected readonly aviso = signal<string | null>(null);
  protected readonly dialogo = signal<'desligar' | 'reativar' | null>(null);
  protected readonly dataDeslig = signal(hojeIso());
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly mostrarBanco = signal(false);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
    effect(() => {
      const f = this.f();
      this.title.setTitle(pageTitle(f ? `${f.colaborador.nome} · Colaborador` : 'Colaborador'));
    });
  }

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  protected endereco(p: PessoaDados): string {
    const partes = [
      [p.logradouro, p.numero].filter(Boolean).join(', '),
      p.complemento,
      p.bairro,
      [p.cidade, p.uf].filter(Boolean).join('/'),
      p.cep ? 'CEP ' + applyMask('cep', p.cep) : null,
    ].filter((x) => !!x);
    return partes.length ? partes.join(' · ') : '—';
  }

  /** Conta com os últimos dígitos à vista (o resto aparece ao clicar em "Mostrar"). */
  protected mascarar(v: string | null): string {
    if (!v) return '—';
    if (this.mostrarBanco()) return v;
    const t = v.trim();
    return t.length <= 3 ? '•••' : '•••' + t.slice(-3);
  }

  protected abrir(d: 'desligar' | 'reativar'): void {
    this.dataDeslig.set(hojeIso());
    this.motivo.set('');
    this.erroAcao.set(null);
    this.dialogo.set(d);
  }

  protected confirmar(f: FichaColaborador): void {
    const d = this.dialogo();
    if (!d || this.enviando()) return;
    if (d === 'desligar') {
      if (!this.dataDeslig() || !this.motivo().trim()) {
        this.erroAcao.set('Informe a data e o motivo do desligamento.');
        return;
      }
      if (f.funcional.dataAdmissao && this.dataDeslig() < f.funcional.dataAdmissao) {
        this.erroAcao.set('O desligamento não pode ser antes da admissão.');
        return;
      }
    }
    this.enviando.set(true);
    this.erroAcao.set(null);
    const obs = d === 'desligar' ? this.service.desligar(f.colaborador.id, this.dataDeslig(), this.motivo()) : this.service.reativar(f.colaborador.id);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (x) => {
        this.enviando.set(false);
        this.dialogo.set(null);
        this.atual.set(x);
        this.aviso.set(d === 'desligar' ? 'Colaborador desligado.' : 'Colaborador reativado.');
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erroAcao.set(erroUsuarios(e, d === 'desligar' ? 'desligar' : 'reativar'));
      },
    });
  }
}
