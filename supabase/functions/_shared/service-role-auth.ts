/**
 * Guard canônico de autenticação service-role para edge functions.
 *
 * Depois da migração para as novas API keys do Supabase, DUAS gerações de
 * credencial service-role circulam neste projeto ao mesmo tempo:
 *
 *   1. `sb_secret_…` — é o valor que o runtime injeta em
 *      SUPABASE_SERVICE_ROLE_KEY. É o que uma edge function apresenta quando
 *      chama outra (ver ai-agent-execute → google-cal-upsert-event).
 *      NÃO é um JWT: não tem claims para inspecionar, só dá para comparar.
 *
 *   2. JWT legado com claim `role: "service_role"` — é o que o pg_cron/pg_net
 *      apresenta, vindo de `current_setting('app.service_role_key')` ou
 *      hardcoded em migrations antigas.
 *
 * Um guard que aceite só uma das formas rejeita silenciosamente metade dos
 * chamadores legítimos com 401. Este aceita as duas.
 *
 * Sobre a assinatura do JWT: não é verificada aqui — o gateway do Supabase já
 * validou (as funções são deployadas SEM --no-verify-jwt). Só lemos a claim.
 */

/** True quando `token` é um JWT cuja claim `role` é `service_role`. */
export function isServiceRoleJwt(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

/**
 * True quando `token` é uma credencial service-role válida, em qualquer das
 * duas gerações de chave.
 *
 * O `envKey &&` não é redundante: sem ele, um ambiente sem
 * SUPABASE_SERVICE_ROLE_KEY faria `'' === ''` e um header `Authorization:
 * Bearer ` (vazio) passaria como service-role — bypass de autenticação.
 */
export function isServiceRoleToken(token: string | null | undefined): boolean {
  if (!token) return false;

  const envKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (envKey && token === envKey) return true;

  return isServiceRoleJwt(token);
}

/** Extrai o token de um header Authorization: Bearer <token>. */
export function bearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}
