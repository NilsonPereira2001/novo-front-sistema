import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { formatDate } from '@angular/common';

import { BRANDING } from '../../../../core/config/branding';
import { TERMOS } from '../../../../core/config/terminologia';
import { formatCpf } from '../../../../shared/utils/cpf';
import { PessoaDetalhe, TipoDocumento } from '../models/pessoa-detalhe.model';
import { PERFIS } from '../models/perfil-config';
import { secoesDe } from '../models/secoes';

/**
 * ⚠️ PRÉVIA DE DEMONSTRAÇÃO. Os documentos oficiais (texto jurídico,
 * cláusulas, assinatura) devem vir do backend. Aqui só se monta a estrutura
 * com os dados da tela, para validar o fluxo de geração e impressão.
 */
@Component({
  selector: 'app-documento-previa',
  template: `
    <article class="doc">
      <header class="doc__cabecalho">
        <p class="doc__entidade">{{ entidade }}</p>
        <h1 class="doc__titulo">{{ titulo() }}</h1>
      </header>

      @switch (tipo()) {
        @case ('declaracao-vinculo') {
          <p class="doc__texto">
            Declaramos, para os devidos fins, que <strong>{{ p().pessoais.nome }}</strong>, inscrito(a)
            no CPF sob o nº {{ cpf() }}{{ matricula() }}, mantém vínculo ativo com esta instituição na
            condição de {{ rotulo() }}{{ desde() }}.
          </p>
          <p class="doc__texto">Por ser verdade, firmamos a presente declaração.</p>
        }
        @case ('ficha') {
          @for (s of secoes(); track s.titulo) {
            <section class="doc__secao">
              <h2>{{ s.titulo }}</h2>
              <dl>
                @for (c of s.campos; track c.rotulo) {
                  <div [class.largo]="c.largo"><dt>{{ c.rotulo }}</dt><dd>{{ c.valor }}</dd></div>
                }
              </dl>
            </section>
          }
        }
        @default {
          <section class="doc__secao">
            <h2>Partes</h2>
            <p class="doc__texto">
              <strong>{{ entidade }}</strong>, doravante INSTITUIÇÃO, e
              <strong>{{ p().pessoais.nome }}</strong>, CPF {{ cpf() }}{{ matricula() }}, doravante
              {{ termos.membro.toUpperCase() }}.
            </p>
          </section>
          @if (tipo() === 'contrato-desligamento' && p().desligamento; as d) {
            <section class="doc__secao">
              <h2>Desligamento</h2>
              <p class="doc__texto">
                Data: {{ data(d.data) }}. Motivo informado: {{ d.motivo || '—' }}
              </p>
            </section>
          }
          <section class="doc__secao">
            <h2>Cláusulas</h2>
            <p class="doc__aviso">
              O texto das cláusulas virá do modelo de contrato da instituição, fornecido pelo
              sistema quando a integração estiver pronta.
            </p>
          </section>
        }
      }

      <footer class="doc__rodape">
        <p>Emitido em {{ hoje }}.</p>
        <div class="doc__assinaturas">
          @if (tipo() !== 'declaracao-vinculo' && tipo() !== 'ficha') {
            <div class="doc__assinatura">{{ p().pessoais.nome }}</div>
          }
          <div class="doc__assinatura">{{ entidade }}</div>
        </div>
      </footer>
    </article>
  `,
  styles: `
    .doc {
      max-width: 48rem;
      margin: 0 auto;
      padding: var(--space-8, 2rem);
      background: #fff;
      color: #111;
      font-size: 0.875rem;
      line-height: 1.6;
    }
    .doc__cabecalho {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #0a1730;
      text-align: center;
    }
    .doc__entidade {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4a5668;
    }
    .doc__titulo {
      margin-top: 0.25rem;
      font-size: 1.25rem;
      font-weight: 800;
      text-transform: uppercase;
      color: #0a1730;
    }
    .doc__texto {
      margin: 0 0 1rem;
      text-align: justify;
    }
    .doc__secao {
      margin-bottom: 1.25rem;
      break-inside: avoid;
    }
    .doc__secao h2 {
      margin-bottom: 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid #d6dce5;
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #0a1730;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem 1rem;
      margin: 0;
    }
    dl .largo {
      grid-column: 1 / -1;
    }
    dt {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #627084;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .doc__aviso {
      padding: 0.75rem 1rem;
      border: 1px dashed #b6c0cd;
      border-radius: 6px;
      color: #4a5668;
      font-style: italic;
    }
    .doc__rodape {
      margin-top: 2.5rem;
    }
    .doc__assinaturas {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2rem 4rem;
      margin-top: 3.5rem;
    }
    .doc__assinatura {
      min-width: 14rem;
      padding-top: 0.375rem;
      border-top: 1px solid #111;
      font-size: 0.75rem;
      text-align: center;
    }
    @media (max-width: 600px) {
      .doc {
        padding: 1rem;
      }
      dl {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoPrevia {
  readonly tipo = input.required<TipoDocumento>();
  readonly detalhe = input.required<PessoaDetalhe>();
  readonly titulo = input.required<string>();

  private readonly locale = inject(LOCALE_ID);
  protected readonly termos = TERMOS;
  protected readonly entidade = inject(BRANDING).tenant.name;
  protected readonly hoje = formatDate(new Date(), "d 'de' MMMM 'de' y", this.locale);

  protected readonly p = this.detalhe;
  protected readonly secoes = computed(() => secoesDe(this.detalhe(), this.locale));
  protected readonly rotulo = computed(() => PERFIS[this.detalhe().perfil].rotulo.toLowerCase());
  protected readonly cpf = computed(() => formatCpf(this.detalhe().pessoais.cpf) || '—');
  protected readonly matricula = computed(() => {
    const m = this.detalhe().pessoais.matricula;
    return m ? `, matrícula ${m}` : '';
  });
  protected readonly desde = computed(() => {
    const d = this.detalhe();
    const inicio = d.adesao?.primeiraAdesao ?? d.funcional?.dataAdmissao ?? null;
    return inicio ? ` desde ${this.data(inicio)}` : '';
  });

  protected data(v: string | null): string {
    return v ? formatDate(v, 'dd/MM/yyyy', this.locale) : '—';
  }
}
