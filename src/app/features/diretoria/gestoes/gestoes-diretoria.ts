import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';

import { TERMOS } from '../../../core/config/terminologia';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { applyMask } from '../../../shared/utils/masks';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { AssociadoPicker } from '../components/associado-picker';
import { DiretoriaAbas } from '../components/diretoria-abas';
import { Elegivel, Gestao, GestaoFormValor, problemaGestao } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';

/**
 * Diretoria › Gestões: mandatos (nome, período, presidente e vice) e qual é a atual da empresa.
 * Presidente e vice são associados ativos. Rota: /diretoria/gestoes
 */
@Component({
  selector: 'app-gestoes-diretoria',
  imports: [DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, AssociadoPicker, DiretoriaAbas],
  templateUrl: './gestoes-diretoria.html',
  styleUrl: './gestoes-diretoria.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestoesDiretoria {
  private readonly service = inject(DiretoriaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly termos = TERMOS;

  private readonly tentar = signal(0);
  private readonly estado = loadFrom(signal(0), () => this.service.gestoes(), this.tentar);
  private readonly atual = signal<Gestao[] | null>(null);
  protected readonly gestoes = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erroCarga = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly aviso = signal<string | null>(null);

  protected readonly editando = signal<Gestao | null>(null);
  protected readonly aberto = signal(false);
  protected readonly valor = signal<GestaoFormValor>(vazio());
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly problema = computed(() => problemaGestao(this.valor()));
  protected readonly confirmandoAtual = signal<Gestao | null>(null);

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  protected abrir(g: Gestao | null): void {
    this.editando.set(g);
    this.valor.set(
      g
        ? {
            nome: g.nome,
            inicio: g.inicio ?? '',
            fim: g.fim ?? '',
            presidente: g.idPresidente ? { id: g.idPresidente, nome: g.presidente ?? '—' } : null,
            vice: g.idVicePresidente ? { id: g.idVicePresidente, nome: g.vicePresidente ?? '—' } : null,
          }
        : vazio(),
    );
    this.tentou.set(false);
    this.erro.set(null);
    this.aberto.set(true);
  }

  protected campo(k: 'nome' | 'inicio' | 'fim', ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.valor.update((x) => ({ ...x, [k]: v }));
  }

  protected pessoa(papel: 'presidente' | 'vice', e: Elegivel | null): void {
    this.valor.update((x) => ({ ...x, [papel]: e ? { id: e.idAssociado, nome: e.nome, detalhe: e.cpf ? applyMask('cpf', e.cpf) : null } : null }));
  }

  protected salvar(): void {
    this.tentou.set(true);
    if (this.problema() || this.enviando()) return;
    const g = this.editando();
    this.executar(
      g ? this.service.editarGestao(g.id, this.valor()) : this.service.criarGestao(this.valor()),
      g ? 'Gestão atualizada.' : 'Gestão cadastrada.',
      () => this.aberto.set(false),
    );
  }

  protected tornarAtual(): void {
    const g = this.confirmandoAtual();
    if (!g || this.enviando()) return;
    this.executar(this.service.definirAtual(g.id), `${g.nome} agora é a gestão atual.`, () => this.confirmandoAtual.set(null));
  }

  private executar(obs: Observable<Gestao[]>, mensagem: string, fechar: () => void): void {
    this.enviando.set(true);
    this.erro.set(null);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (l) => {
        this.enviando.set(false);
        this.atual.set(l);
        this.aviso.set(mensagem);
        fechar();
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, 'salvar a gestão'));
      },
    });
  }
}

function vazio(): GestaoFormValor {
  return { nome: '', inicio: '', fim: '', presidente: null, vice: null };
}
