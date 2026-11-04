import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { PessoaDTO } from '../../models/pessoa.dto';
import { PessoaDetalhe } from '../models/pessoa-detalhe.model';
import { perfilDoTipo } from '../models/perfil-config';
import { toPessoaDetalheDeAssociado } from './associado.adapter';
import { PessoaDetalheDemo } from './pessoa-detalhe.demo';

/**
 * Endpoints de detalhe.
 *
 * `GET /associado/pessoa/{idPessoa}` (AssociadoController.buscarAssociadoPorPessoa):
 * recebe o **id da Pessoa** — o mesmo da lista e das rotas `/pessoas/:id` —
 * e devolve a entidade `Associado` com `pessoa`. 404 = pessoa não é associado.
 */
export const DETALHE_API = {
  associadoPorPessoa: ((idPessoa: number) => `/associado/pessoa/${idPessoa}`) as
    | ((idPessoa: number) => string)
    | null,
};

/**
 * Fonte usada pela tela: os dados cadastrais do associado vêm da API (assim
 * que `DETALHE_API.associadoPorPessoa` for configurada); funcionário,
 * dependente, abas, documentos e ações seguem na demonstração até terem
 * endpoints próprios.
 */
@Injectable()
export class PessoaDetalheIntegrada extends PessoaDetalheDemo {
  private readonly http = inject(HttpClient);

  override detalhe(id: number, resumo?: PessoaDTO | null): Observable<PessoaDetalhe> {
    const rota = DETALHE_API.associadoPorPessoa;
    const perfil = resumo ? perfilDoTipo(resumo.tipo) : 'membro';
    // Registros criados pela demonstração (dependentes/indicados fictícios) não existem no backend.
    if (!rota || perfil !== 'membro' || this.ehFicticio(id)) {
      return super.detalhe(id, resumo);
    }
    return this.http.get<unknown>(apiUrl(rota(id))).pipe(
      map((raw) => {
        const detalhe = toPessoaDetalheDeAssociado(raw);
        if (!detalhe) {
          throw new UnexpectedResponseError();
        }
        // Guarda para as abas/ações de demonstração operarem sobre os dados reais.
        return this.salvar(detalhe);
      }),
    );
  }
}
