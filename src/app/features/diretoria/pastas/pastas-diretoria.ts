import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { lerValor } from '../../financeiro/associados/data/financeiro-api';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { DiretoriaAbas } from '../components/diretoria-abas';
import { Pasta, PastaFormValor, daPasta, proximaOrdem } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';

type Acao = { tipo: 'desativar' | 'reativar' | 'excluir'; pasta: Pasta };

/**
 * Diretoria › Pastas: cadastro das pastas (cargos) da diretoria.
 * Pasta com histórico não é excluída, só desativada; pasta ocupada não é desativada.
 * Rota: /diretoria/pastas
 */
@Component({
  selector: 'app-pastas-diretoria',
  imports: [CurrencyPipe, Alert, Dialog, Icon, LoadError, DiretoriaAbas],
  templateUrl: './pastas-diretoria.html',
  styleUrl: './pastas-diretoria.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PastasDiretoria {
  private readonly service = inject(DiretoriaService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tentar = signal(0);
  private readonly estado = loadFrom(signal(0), () => this.service.pastas(true), this.tentar);
  private readonly atual = signal<Pasta[] | null>(null);
  protected readonly pastas = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erroCarga = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly ativas = computed(() => (this.pastas() ?? []).filter((p) => p.ativa).length);
  protected readonly aviso = signal<string | null>(null);

  // Formulário (dialog)
  protected readonly editando = signal<Pasta | null>(null);
  protected readonly formAberto = signal(false);
  protected readonly valor = signal<PastaFormValor>(daPasta(null));
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly problema = computed(() => {
    const v = this.valor();
    if (!v.nome.trim()) return 'Informe o nome da pasta.';
    if (v.remuneracao.trim() && (lerValor(v.remuneracao) ?? -1) < 0) return 'Remuneração inválida. Use o formato 1.234,56.';
    if (v.ordem.trim() && !/^\d{1,3}$/.test(v.ordem.trim())) return 'Ordem: número de 0 a 999.';
    return null;
  });

  // Ações
  protected readonly acao = signal<Acao | null>(null);

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  protected abrir(p: Pasta | null): void {
    this.editando.set(p);
    this.valor.set(daPasta(p, proximaOrdem(this.pastas() ?? [])));
    this.tentou.set(false);
    this.erro.set(null);
    this.formAberto.set(true);
  }

  protected campo(k: keyof PastaFormValor, ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.valor.update((x) => ({ ...x, [k]: v }));
  }

  protected salvar(): void {
    this.tentou.set(true);
    if (this.problema() || this.enviando()) return;
    const p = this.editando();
    this.executar(p ? this.service.editarPasta(p.id, this.valor()) : this.service.criarPasta(this.valor()), p ? 'Pasta atualizada.' : 'Pasta cadastrada.', () =>
      this.formAberto.set(false),
    );
  }

  protected confirmar(): void {
    const a = this.acao();
    if (!a || this.enviando()) return;
    const obs =
      a.tipo === 'excluir' ? this.service.excluirPasta(a.pasta.id) : this.service.alterarPasta(a.pasta.id, a.tipo);
    const msg = a.tipo === 'excluir' ? `Pasta ${a.pasta.nome} excluída.` : a.tipo === 'desativar' ? `Pasta ${a.pasta.nome} desativada.` : `Pasta ${a.pasta.nome} reativada.`;
    this.executar(obs, msg, () => this.acao.set(null));
  }

  protected pedir(tipo: Acao['tipo'], pasta: Pasta): void {
    this.erro.set(null);
    this.acao.set({ tipo, pasta });
  }

  private executar(obs: Observable<Pasta[]>, mensagem: string, fechar: () => void): void {
    this.enviando.set(true);
    this.erro.set(null);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lista) => {
        this.enviando.set(false);
        this.atual.set(lista);
        this.aviso.set(mensagem);
        fechar();
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, 'salvar a pasta'));
      },
    });
  }
}
