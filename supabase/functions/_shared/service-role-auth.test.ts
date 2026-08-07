import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { bearerToken, isServiceRoleJwt, isServiceRoleToken } from './service-role-auth.ts';

/** Monta um JWT não assinado com o payload dado (só as claims importam aqui). */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

const SERVICE_JWT = jwt({ iss: 'supabase', role: 'service_role' });
const ANON_JWT = jwt({ iss: 'supabase', role: 'anon' });
const USER_JWT = jwt({ iss: 'supabase', role: 'authenticated', sub: 'abc' });

Deno.test('isServiceRoleJwt aceita role=service_role e rejeita os demais', () => {
  assertEquals(isServiceRoleJwt(SERVICE_JWT), true);
  assertEquals(isServiceRoleJwt(ANON_JWT), false);
  assertEquals(isServiceRoleJwt(USER_JWT), false);
});

Deno.test('isServiceRoleJwt rejeita entrada malformada', () => {
  for (const bad of [null, undefined, '', 'nao-e-jwt', 'a.b', 'a.b.c.d', 'a.!!!.c']) {
    assertEquals(isServiceRoleJwt(bad), false, `deveria rejeitar: ${bad}`);
  }
});

Deno.test('isServiceRoleToken aceita a chave nova (sb_secret_) via env', () => {
  const secret = 'sb_secret_exemplo_para_teste';
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', secret);
  try {
    assertEquals(isServiceRoleToken(secret), true);
    assertEquals(isServiceRoleToken('sb_secret_outra_qualquer'), false);
  } finally {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  }
});

Deno.test('isServiceRoleToken aceita o JWT legado do pg_cron mesmo com env na chave nova', () => {
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_exemplo_para_teste');
  try {
    // Este é o caso que quebrava: pg_cron manda JWT legado, env tem sb_secret_.
    assertEquals(isServiceRoleToken(SERVICE_JWT), true);
    assertEquals(isServiceRoleToken(ANON_JWT), false);
  } finally {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  }
});

Deno.test('isServiceRoleToken nao autentica token vazio quando a env esta ausente', () => {
  // Regressão: `token === (env ?? '')` fazia '' === '' e liberava service-role
  // para um header `Authorization: Bearer ` vazio.
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  assertEquals(isServiceRoleToken(''), false);
  assertEquals(isServiceRoleToken(null), false);
  assertEquals(isServiceRoleToken(undefined), false);
});

Deno.test('bearerToken extrai o token e rejeita header invalido', () => {
  assertEquals(bearerToken('Bearer abc123'), 'abc123');
  assertEquals(bearerToken('Bearer   abc123  '), 'abc123');
  assertEquals(bearerToken('Bearer '), null);
  assertEquals(bearerToken('Bearer'), null);
  assertEquals(bearerToken('Basic abc123'), null);
  assertEquals(bearerToken(null), null);
});
