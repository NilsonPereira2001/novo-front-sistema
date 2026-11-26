import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Page } from '../../../shared/data/page.model';
import {
  Agendamento,
  Detalhe,
  Dia,
  Ficha,
  FuncionarioElegivel,
  Paciente,
  Profissional,
  Prontuario,
  ProntuarioFormValor,
  Resumo,
  SAUDE_API,
  Servico,
  SinaisFormValor,
  toAgendamentosParams,
  toDetalhe,
  toDias,
  toFicha,
  toFuncionarios,
  toLiberado,
  toPaginaAgendamentos,
  toPaginaPacientes,
  toProfissionais,
  toProntuario,
  toProntuarioPayload,
  toResumo,
  toServicos,
  toSinaisPayload,
} from './saude-api';

@Injectable({ providedIn: 'root' })
export class SaudeService {
  private readonly http = inject(HttpClient);

  resumo(): Observable<Resumo> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.resumo)).pipe(map(toResumo));
  }

  // Pacientes
  pacientes(filtro: string, page: number, size: number): Observable<Page<Paciente>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filtro.trim()) params = params.set('filtro', filtro.trim());
    return this.http.get<unknown>(apiUrl(SAUDE_API.pacientes), { params }).pipe(map(toPaginaPacientes));
  }
  ficha(id: number): Observable<Ficha> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.paciente(id))).pipe(map(toFicha));
  }
  historico(id: number, page: number, size: number): Observable<Page<Agendamento>> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.historico(id)), { params: { page, size } }).pipe(map(toPaginaAgendamentos));
  }
  prontuario(id: number): Observable<Prontuario> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.prontuario(id))).pipe(map(toProntuario));
  }
  salvarProntuario(id: number, v: ProntuarioFormValor): Observable<Prontuario> {
    return this.http.put<unknown>(apiUrl(SAUDE_API.prontuario(id)), toProntuarioPayload(v)).pipe(map(toProntuario));
  }
  registrarSinais(id: number, v: SinaisFormValor): Observable<Prontuario> {
    return this.http.post<unknown>(apiUrl(SAUDE_API.sinais(id)), toSinaisPayload(v)).pipe(map(toProntuario));
  }

  // Serviços e profissionais
  servicos(inativos = false): Observable<Servico[]> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.servicos), { params: { inativos } }).pipe(map(toServicos));
  }
  salvarServico(id: number | null, v: { nome: string; categoria: string; orientacoes: string }): Observable<Servico[]> {
    const body = { nome: v.nome.trim().toUpperCase(), categoria: v.categoria, orientacoes: v.orientacoes.trim() || null };
    return (id === null ? this.http.post<unknown>(apiUrl(SAUDE_API.servicos), body) : this.http.put<unknown>(apiUrl(SAUDE_API.servico(id)), body)).pipe(
      map(toServicos),
    );
  }
  ativarServico(id: number, ativo: boolean): Observable<Servico[]> {
    return this.http.post<unknown>(apiUrl(SAUDE_API.servicoAtivo(id, ativo)), null).pipe(map(toServicos));
  }
  profissionais(): Observable<Profissional[]> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.profissionais)).pipe(map(toProfissionais));
  }
  funcionarios(filtro: string): Observable<FuncionarioElegivel[]> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.funcionarios), { params: { filtro } }).pipe(map(toFuncionarios));
  }
  definirServicos(idFuncionario: number, idsServicos: readonly number[]): Observable<Profissional[]> {
    return this.http.put<unknown>(apiUrl(SAUDE_API.servicosDoProfissional(idFuncionario)), { idsServicos }).pipe(map(toProfissionais));
  }

  // Agendas
  dias(f: { de: string; ate: string; idServico?: number | null; idProfissional?: number | null; soAtivos?: boolean }): Observable<Dia[]> {
    let params = new HttpParams().set('de', f.de).set('ate', f.ate).set('soAtivos', !!f.soAtivos);
    if (f.idServico) params = params.set('idServico', f.idServico);
    if (f.idProfissional) params = params.set('idProfissional', f.idProfissional);
    return this.http.get<unknown>(apiUrl(SAUDE_API.agendas), { params }).pipe(map(toDias));
  }
  liberar(v: { idProfissional: number; idServico: number; datas: readonly string[]; vagas: number }) {
    return this.http.post<unknown>(apiUrl(SAUDE_API.agendas), v).pipe(map(toLiberado));
  }
  editarDia(id: number, v: { vagas?: number; ativo?: boolean }): Observable<unknown> {
    return this.http.put<unknown>(apiUrl(SAUDE_API.agenda(id)), v);
  }

  // Agendamentos
  agendamentos(f: Parameters<typeof toAgendamentosParams>[0]): Observable<Page<Agendamento>> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.agendamentos), { params: toAgendamentosParams(f) }).pipe(map(toPaginaAgendamentos));
  }
  detalhe(id: number): Observable<Detalhe> {
    return this.http.get<unknown>(apiUrl(SAUDE_API.agendamento(id))).pipe(map(toDetalhe));
  }
  agendar(v: { idPessoa: number; idServico: number; idProfissional: number; data: string; hora: string; telefone: string; observacao: string }): Observable<Detalhe> {
    return this.http
      .post<unknown>(apiUrl(SAUDE_API.agendamentos), {
        idPessoa: v.idPessoa,
        idServico: v.idServico,
        idProfissional: v.idProfissional,
        data: v.data,
        hora: v.hora || null,
        telefone: v.telefone.trim() || null,
        modalidade: 'PRESENCIAL',
        observacao: v.observacao.trim() || null,
      })
      .pipe(map(toDetalhe));
  }
  reagendar(id: number, v: { data: string; hora: string; idProfissional: number | null }): Observable<Detalhe> {
    return this.http
      .post<unknown>(apiUrl(SAUDE_API.acao(id, 'reagendar')), { data: v.data, hora: v.hora || null, idProfissional: v.idProfissional })
      .pipe(map(toDetalhe));
  }
  cancelar(id: number, motivo: string): Observable<Detalhe> {
    return this.http.post<unknown>(apiUrl(SAUDE_API.acao(id, 'cancelar')), { motivo }).pipe(map(toDetalhe));
  }
  presenca(id: number): Observable<Detalhe> {
    return this.http.post<unknown>(apiUrl(SAUDE_API.acao(id, 'presenca')), null).pipe(map(toDetalhe));
  }
  falta(id: number, motivo: string): Observable<Detalhe> {
    return this.http.post<unknown>(apiUrl(SAUDE_API.acao(id, 'falta')), { motivo: motivo.trim() || null }).pipe(map(toDetalhe));
  }
  realizar(
    id: number,
    v: { queixaPrincipal: string; evolucaoClinica: string; diagnostico: string; cid: string; conduta: string; observacao: string; sinais: SinaisFormValor | null },
  ): Observable<Detalhe> {
    return this.http
      .post<unknown>(apiUrl(SAUDE_API.acao(id, 'realizar')), {
        queixaPrincipal: v.queixaPrincipal.trim() || null,
        evolucaoClinica: v.evolucaoClinica.trim() || null,
        diagnostico: v.diagnostico.trim() || null,
        cid: v.cid.trim().toUpperCase() || null,
        conduta: v.conduta.trim() || null,
        observacao: v.observacao.trim() || null,
        sinais: v.sinais ? toSinaisPayload(v.sinais) : null,
      })
      .pipe(map(toDetalhe));
  }
  anexar(id: number, arquivo: File): Observable<Detalhe> {
    const fd = new FormData();
    fd.append('arquivo', arquivo, arquivo.name);
    return this.http.post<unknown>(apiUrl(SAUDE_API.anexos(id)), fd).pipe(map(toDetalhe));
  }
  baixarAnexo(id: number, idArquivo: number): Observable<Blob> {
    return this.http.get(apiUrl(SAUDE_API.anexo(id, idArquivo)), { responseType: 'blob' });
  }
  removerAnexo(id: number, idArquivo: number): Observable<Detalhe> {
    return this.http.delete<unknown>(apiUrl(SAUDE_API.anexo(id, idArquivo))).pipe(map(toDetalhe));
  }
}

/** PDF e imagem abrem em nova aba; os demais são baixados. */
export function abrirArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const visualizavel = blob.type === 'application/pdf' || blob.type.startsWith('image/') || /\.(pdf|png|jpe?g)$/i.test(nome);
  const aba = visualizavel ? window.open(url, '_blank') : null;
  if (!aba) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
