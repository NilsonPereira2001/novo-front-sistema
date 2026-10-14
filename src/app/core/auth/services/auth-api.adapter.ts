/**
 * ============================================================================
 * ADAPTADOR DO CONTRATO DE AUTENTICAÇÃO
 * ============================================================================
 *
 * Este é o ÚNICO arquivo que conhece o formato do backend Spring Boot.
 * Se o contrato mudar, ajuste apenas as funções abaixo; o serviço, os guards
 * e a tela não precisam mudar.
 *
 * Contrato confirmado (AuthProfController, POST /api/auth/login):
 *  - Entrada: `@RequestParam username` e `@RequestParam password`.
 *  - 200: LoginResponseDTO com o JWT (gerado pelo TokenService).
 *  - 401: credenciais inválidas | 403: usuário inativo/bloqueado | 500: erro interno.
 *
 * ⚠️ Ainda a confirmar: os campos exatos do LoginResponseDTO. A leitura abaixo
 * aceita os nomes mais comuns e, para o usuário, também lê o `sub` do JWT.
 * Nenhum dado é inventado: se nem o token nem o usuário forem encontrados,
 * o login falha com erro "inesperado" em vez de simular um usuário.
 */

import { HttpParams } from '@angular/common/http';

import { AuthSession, AuthUser, LoginCredentials } from '../models/auth.models';

/**
 * Corpo enviado ao endpoint de login.
 *
 * O backend lê os campos com `@RequestParam`, então enviamos como
 * `application/x-www-form-urlencoded` no CORPO da requisição (o Angular define
 * esse Content-Type ao receber HttpParams). Nunca na URL, para a senha não
 * ficar registrada em logs de servidor ou proxy.
 */
export function toLoginRequest(credentials: LoginCredentials): HttpParams {
  return new HttpParams()
    .set('username', credentials.username)
    .set('password', credentials.password);
}

/**
 * Converte a resposta do login (ou do endpoint de sessão) em `AuthSession`.
 * Retorna `null` se a resposta não tiver o mínimo necessário.
 */
export function toAuthSession(body: unknown): AuthSession | null {
  if (!isRecord(body)) {
    return null;
  }

  // ⚠️ Confirmar: nome do campo do token, se houver.
  const accessToken = pickString(body, ['accessToken', 'token']);

  // ⚠️ Confirmar: dados do usuário podem vir aninhados (`user`, `usuario`) ou na raiz.
  const userSource = pickRecord(body, ['user', 'usuario']) ?? body;
  const user = toAuthUser(userSource, accessToken);

  if (!user) {
    return null;
  }

  return {
    user,
    accessToken,
    expiresAt: accessToken ? readJwtExpiration(accessToken) : null,
  };
}

function toAuthUser(source: Record<string, unknown>, token: string | null): AuthUser | null {
  const claims = token ? readJwtPayload(token) : null;

  const username =
    pickString(source, ['username', 'login', 'email', 'cpf']) ??
    (claims ? pickString(claims, ['sub', 'username']) : null);

  if (!username) {
    return null;
  }

  const name = pickString(source, ['name', 'nome']) ?? username;
  const id = pickString(source, ['id']) ?? pickNumberAsString(source, ['id']);
  const roles =
    pickStringArray(source, ['roles', 'perfis', 'authorities']) ??
    (claims ? pickStringArray(claims, ['roles', 'authorities', 'scope']) : null) ??
    [];

  return { id, name, username, roles };
}

// ---------------------------------------------------------------------------
// JWT: leitura apenas para saber a expiração e exibir dados.
// A assinatura NÃO é verificada aqui — quem garante a validade é o backend.
// ---------------------------------------------------------------------------

export function readJwtExpiration(token: string): number | null {
  const payload = readJwtPayload(token);
  const exp = payload?.['exp'];
  return typeof exp === 'number' ? exp * 1000 : null;
}

function readJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      Array.from(atob(padded), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Utilitários de leitura segura
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return null;
}

function pickNumberAsString(
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}

function pickRecord(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Lê uma lista de perfis. Aceita `["ADMIN"]`, `[{ authority: "ADMIN" }]`
 * (formato do Spring Security) ou `"ADMIN USER"` (claim `scope`).
 */
function pickStringArray(
  source: Record<string, unknown>,
  keys: readonly string[],
): string[] | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.split(/\s+/);
    }
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === 'string' ? item : isRecord(item) ? pickString(item, ['authority', 'name']) : null,
        )
        .filter((item): item is string => item !== null);
    }
  }
  return null;
}
