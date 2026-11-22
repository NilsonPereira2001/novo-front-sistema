import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Page } from '../../../shared/data/page.model';
import { mensagemAmigavel } from '../../pessoas/cadastro-membro/data/cadastro-erro';
import {
  AcaoStatus,
  Elegivel,
  FiltroUsuarios,
  NovoUsuarioPayload,
  Perfil,
  Permissao,
  ResumoUsuarios,
  SenhaGerada,
  USUARIOS_API,
  UsuarioDetalhe,
  UsuarioItem,
  toDetalhe,
  toElegiveis,
  toListaParams,
  toPaginaUsuarios,
  toPerfis,
  toPermissoes,
  toResumo,
  toSenhaGerada,
} from './usuarios-api';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  listar(f: FiltroUsuarios): Observable<Page<UsuarioItem>> {
    return this.http.get<unknown>(apiUrl(USUARIOS_API.lista), { params: toListaParams(f) }).pipe(map(toPaginaUsuarios));
  }
  resumo(): Observable<ResumoUsuarios> {
    return this.http.get<unknown>(apiUrl(USUARIOS_API.resumo)).pipe(map(toResumo));
  }
  elegiveis(): Observable<Elegivel[]> {
    return this.http.get<unknown>(apiUrl(USUARIOS_API.elegiveis)).pipe(map(toElegiveis));
  }
  permissoes(): Observable<Permissao[]> {
    return this.http.get<unknown>(apiUrl(USUARIOS_API.permissoes)).pipe(map(toPermissoes));
  }
  perfis(): Observable<Perfil[]> {
    return this.http.get<unknown>(apiUrl(USUARIOS_API.perfis)).pipe(map(toPerfis));
  }
  detalhe(id: number): Observable<UsuarioDetalhe> {
    return this.http.get<unknown>(apiUrl(USUARIOS_API.detalhe(id))).pipe(map(toDetalhe));
  }
  criar(p: NovoUsuarioPayload): Observable<SenhaGerada> {
    return this.http.post<unknown>(apiUrl(USUARIOS_API.lista), p).pipe(map(toSenhaGerada));
  }
  alterarAcesso(id: number, perfil: string, idsPermissoes: readonly number[]): Observable<UsuarioDetalhe> {
    return this.http.put<unknown>(apiUrl(USUARIOS_API.acesso(id)), { perfil, idsPermissoes }).pipe(map(toDetalhe));
  }
  redefinirSenha(id: number, enviarEmail: boolean): Observable<SenhaGerada> {
    return this.http.post<unknown>(apiUrl(USUARIOS_API.redefinirSenha(id)), { enviarEmail }).pipe(map(toSenhaGerada));
  }
  alterarStatus(id: number, acao: AcaoStatus): Observable<UsuarioDetalhe> {
    return this.http.post<unknown>(apiUrl(USUARIOS_API.acao(id, acao)), null).pipe(map(toDetalhe));
  }
}

/** Mensagem para o usuário: as regras do backend (400/403/404/409) vêm em texto. */
export function erroUsuarios(e: unknown, acao: string): string {
  if (e instanceof HttpErrorResponse) {
    if ([400, 403, 404, 409].includes(e.status)) {
      return mensagemAmigavel(e.error) ?? (e.status === 403 ? `Seu usuário não tem permissão para ${acao}.` : `O servidor recusou: ${acao}.`);
    }
    if (e.status === 0) return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
  }
  return `Não foi possível ${acao}. Tente novamente.`;
}
