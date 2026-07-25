---
title: Auditoria de Resiliência — Auth, Tenant Bootstrap, Settings
author: Kronix (dev-dev-delta)
date: 2026-04-26
---

# Auditoria Adversarial de Resiliência

## Sumário

| Prioridade | Total |
|---|---|
| P0 (crítico — quebra silenciosamente ou expõe acesso indevido) | 4 |
| P1 (alto — degradação visível ou dado incorreto em produção) | 6 |
| P2 (médio — edge case, UX quebrada em condição específica) | 5 |

---

## P0 — Críticos

### P0-1: Race condition no auth init — listener nunca subscrito se getSession() > 3s

**Arquivo:** `src/hooks/useAuth.ts:248-332`

`initTimeout` dispara em 3s e faz `setIsLoading(false)`, mas o `onAuthStateChange` listener só é registrado **depois** de `await supabase.auth.getSession()` retornar. Se `getSession()` demorar mais de 3s (rede lenta, Supabase cold-start), o timeout libera a tela, mas o listener NUNCA é registrado. Resultado: o usuário vê a tela de login mesmo com sessão válida, e eventos `SIGNED_IN`, `TOKEN_REFRESHED` nunca disparam durante a sessão.

**Trigger:** Supabase Edge em cold-start (comum em tenants inativos), rede 3G.

**Fix:** Mover o `clearTimeout(initTimeout)` para ANTES de subscrever o listener, ou separar o timeout de init do timeout de subscription.

---

### P0-2: Fallback profile silencioso torna super_adm sempre false — ADM some

**Arquivo:** `src/hooks/useAuth.ts:121-147` (timeout fallback) e `src/hooks/useAuth.ts:201-226` (catch fallback)

Quando `fetchUserProfile` faz timeout (2s) ou falha com erro, o sistema cria um `fallbackProfile` com `super_adm: false`, `gestor: false`. O campo `isProvisional: true` é setado mas nenhum componente verifica esse flag para bloquear operações.

Consequência direta: **isso explica por que a área ADM sumiu.** Se a conexão com o DB do tenant estiver lenta no momento do login, o usuário super-admin recebe um perfil provisional com `super_adm: false`. O `RestrictedRoute` então chama `adm-verify-super-admin` — mas `isControlPlane` é calculado uma vez via `useMemo` com base na `sessionStorage`. Se o perfil já veio provisional, o estado `verifyState` fica em `'idle'` para sempre porque `user?.profile` existe mas `super_adm` é false no objeto — **e a verificação async do control plane nem chega a ser disparada se `isControlPlane` retornar false.**

Nenhuma tela indica ao usuário que está rodando com perfil provisional.

**Fix:** Quando `isProvisional: true`, bloquear acesso a rotas restritas até que `refreshProfile` retorne com dados reais, ou mostrar banner de aviso.

---

### P0-3: `sessionStorage._supabase_client_config` corrompido — app inicia com credentials erradas silenciosamente

**Arquivo:** `src/main.tsx:39-51` e `src/integrations/supabase/client.ts:8-17`

O bloco de parse do cache em `bootstrapClientConfig` tem `try/catch` que engole qualquer erro de parse. Se o valor estiver corrompido (ex: tab fechado a força durante write, storage quota exceeded), `JSON.parse` lança e o código pula o early-return — certo.

**Mas em `client.ts`:** se o JSON parseia sem erro mas os campos `url` ou `key` estão presentes com valores inválidos (ex: string vazia, null injetado via devtools), o `resolveConfig()` retorna `{ url: parsed.url, key: parsed.key }` com valores inválidos. O `createClient` é chamado com credenciais inválidas e o app inicia em estado completamente quebrado sem nenhum erro visível até o primeiro request falhar.

**Fix:** Validar formato de URL (starts with `https://`) e comprimento mínimo do key antes de aceitar o cache.

---

### P0-4: Multi-tab com tenants diferentes — clients cross-contaminam sessionStorage

**Arquivo:** `src/main.tsx:22-76`

`sessionStorage` é por-tab no browser (não compartilhada entre tabs), então dois tabs com tenants diferentes têm caches separados — isso é seguro.

**MAS:** `localStorage` é compartilhado entre tabs da mesma origem. O `supabase` client em `client.ts:31-37` usa `storage: localStorage`. Se o usuário abre Tab1 com `tenant-a.revos.growthsales.ai` e Tab2 com `tenant-b.revos.growthsales.ai`:

- Tab1 faz login → grava session JWT de tenant-A em `localStorage['sb-<proj_a>-auth-token']`  
- Tab2 está autenticado no tenant-B — sessionStorage tem config de B, mas `localStorage` agora tem o JWT de A também (dependendo de keys de storage)
- Supabase client usa a key `sb-{ref}-auth-token` onde `ref` é o project ref — se ambos tenants apontam para projetos diferentes, as keys são diferentes e não há conflito. **Se usarem o mesmo projeto Supabase, há cross-contamination.**

Não é confirmado que isso ocorre em produção (depende da arquitetura dos tenants), mas é um risco real não documentado.

---

## P1 — Altos

### P1-1: `adm-client-config` CORS aceita `*` — expõe mapeamento host→credenciais sem auth

**Arquivo:** `supabase/functions/adm-client-config/index.ts:3-8`

`'Access-Control-Allow-Origin': '*'` + sem autenticação no endpoint de lookup. Qualquer pessoa pode fazer POST `{ "host": "qualquercoisa.revos.growthsales.ai" }` e receber `supabase_url` + `anon_key` de qualquer tenant. A `anon_key` com RLS bem configurado é razoavelmente segura, mas expõe a topologia completa de tenants.

---

### P1-2: `auth-login` ignora `tenant_host` no body — rate limit compartilhado entre tenants

**Arquivo:** `supabase/functions/auth-login/index.ts:47,54`

O body aceita `tenant_host?` mas o campo é desestruturado e **nunca usado**. O rate limit lê `settings` da tabela sem filtrar por tenant (`.order('created_at').limit(1).maybeSingle()`). Num ambiente multi-tenant no mesmo Supabase project, o rate limit de tentativas de login é global, não por tenant. Um atacante num tenant pode consumir o limite de outro.

---

### P1-3: `RestrictedRoute` — verificação assíncrona não roda se `user.profile` for provisional

**Arquivo:** `src/components/auth/RestrictedRoute.tsx:84-116`

O `useEffect` que dispara `verifyWithControlPlane` tem condição `if (!requireSuperAdmin || !user?.profile) return`. Se o perfil é provisional (`isProvisional: true`), `user?.profile` existe e a verificação roda. Mas o token obtido via `supabaseControlPlane.auth.getSession()` pode ser o token do tenant (não do control plane) se o usuário fez login via tenant Supabase. A `verifyWithControlPlane` chamaria a edge function com um token de tenant, que retornaria 401/403, e o super-admin seria negado corretamente — mas se o token do control plane for diferente e válido, haveria falso positivo.

Mais crítico: se `user.profile` não existe (null/undefined), `verifyState` fica em `'idle'` eternamente, mas o código em linha 129 renderiza o spinner de "Verificando acesso..." infinitamente quando `verifyState === 'idle'` e `requireSuperAdmin` é true. Isso pode acontecer em race condition onde `user` existe mas `user.profile` é null momentaneamente.

---

### P1-4: `Configuracoes.tsx` — seções `api-keys` e `permissoes` não têm rota URL própria

**Arquivo:** `src/pages/Configuracoes.tsx:329-354` e `src/App.tsx:618-663`

O mapa `sectionToUrl` não contém entradas para `'api-keys'` e `'permissoes'`. Quando o usuário clica nessas seções, o código cai no `else` branch e usa `setSearchParams` com `section=api-keys`. Isso funciona internamente, mas:

1. A URL não muda para `/settings/general/api-keys`, tornando o link não-compartilhável
2. Se o usuário recarrega a página em `?section=api-keys`, `getActiveSectionFromUrl()` não encontra o valor no mapa e retorna `"geral"` — o usuário perde a seção e é redirecionado silenciosamente para Geral

O `App.tsx` também não tem rotas `settings/general/api-keys` ou `settings/general/permissoes` registradas.

---

### P1-5: `PageErrorBoundary.handleGoHome` usa `/dashboard` (rota inexistente como index)

**Arquivo:** `src/components/error-boundaries/PageErrorBoundary.tsx:56-58`

`window.location.href = '/dashboard'` redireciona para a rota legada `/dashboard` que em `App.tsx` não tem index — só `/dashboard/negocios`, `/dashboard/reunioes`. Após um crash, o usuário é redirecionado para uma tela 404 (catch-all route) em vez de para o home real (`/bipro`).

---

### P1-6: MFA guard sem timeout — se `listFactors()` ou `getAuthenticatorAssuranceLevel()` travar, `mfaChecking` fica true para sempre

**Arquivo:** `src/components/auth/ProtectedRoute.tsx:63-88`

O `checkMfa` async não tem timeout. Se o Supabase MFA API não responder, o estado `mfaChecking` fica `true` e o componente renderiza eternamente o spinner "Verificando autenticação..." sem saída para o usuário. Não há botão de bypass nem timeout de fallback.

---

## P2 — Médios

### P2-1: `getActiveSectionFromUrl()` recalculada a cada render sem memoização

**Arquivo:** `src/pages/Configuracoes.tsx:229-323`

A função é declarada inline no corpo do componente e chamada diretamente na linha 325. É recalculada em cada render. Com regex complexa e múltiplos lookups de objeto, isso é ineficiente em componentes com muitos re-renders. Impacto baixo em produção, mas é uma armadilha para futuras expansões do mapa.

---

### P2-2: `AuthProvider` força `forceShow` após 1s independente do estado

**Arquivo:** `src/components/auth/AuthProvider.tsx:14-19`

Após 1 segundo, `forceShow` é setado para true e o app é renderizado mesmo que `isLoading` ainda seja true. Isso significa que componentes filhos como `ProtectedRoute` recebem `isLoading: true` mas o spinner do `AuthProvider` já foi removido — os filhos têm seus próprios spinners. Dupla camada de loading confusa, e em redes lentas pode mostrar flash de conteúdo desprotegido por um frame antes de `ProtectedRoute` verificar.

---

### P2-3: `resolveConfig()` em `client.ts` é chamado no módulo load time — sem retry

**Arquivo:** `src/integrations/supabase/client.ts:19`

`const { url, key } = resolveConfig()` é executado quando o módulo é importado (uma vez, na inicialização). Se `bootstrapClientConfig()` ainda não completou (race na ordem de import), o client é criado com credenciais do control plane mesmo em ambiente tenant. O `main.tsx` usa dynamic import para garantir que o App é importado APÓS bootstrap, mas qualquer import direto de `client.ts` fora do ciclo de `main()` quebraria essa garantia.

---

### P2-4: `allSections` em `Configuracoes.tsx` tem campos `adminOnly` filtrados, mas nenhuma section usa o campo

**Arquivo:** `src/pages/Configuracoes.tsx:63-201, 369`

O filter `.filter((s) => !s.adminOnly || isSuperAdmin)` existe mas nenhuma das sections no `allSections` array tem a propriedade `adminOnly` definida. O TypeScript não reclama porque o tipo inferido é `{ id: string, titleKey: string, ... }` sem `adminOnly`. Isso significa que `api-keys` e `permissoes` aparecem para TODOS os gestores, não apenas super-admins, potencialmente expondo configurações sensíveis.

---

### P2-5: `adm-client-config` sem input sanitization no campo `host`

**Arquivo:** `supabase/functions/adm-client-config/index.ts:126-143`

O `host` é usado diretamente em duas queries: `.eq('slug', slug)` e `.eq('custom_domain', host)`. O Supabase client usa prepared statements, então SQL injection não é possível. Mas o campo não tem validação de comprimento máximo nem de formato de hostname. Um payload com host de 10KB causaria log spam e potencial overhead na query. Baixo impacto mas facilmente evitável.

---

## Diagnóstico: Por que a área ADM sumiu

A causa mais provável é a combinação de **P0-2 + P0-1**:

1. No login, `getSession()` demora (cold-start) → `initTimeout` dispara → `isLoading: false` com estado incompleto
2. OU: DB do tenant lento → `fetchUserProfile` faz timeout em 2s → perfil provisional criado com `super_adm: false`
3. `RestrictedRoute` com `requireSuperAdmin` detecta que `isControlPlane` pode retornar `false` se a sessão foi criada no tenant (não no control plane) — nesse caso, `verifyState` vai imediatamente para `'denied'`
4. Usuário vê "Acesso Restrito" sem saber que o problema foi temporal

**Sequência exata de falha:**
- Login em tenant subdomain → `_supabase_client_config` gravado com URL do tenant
- `isControlPlane` em `RestrictedRoute` compara `parsed.url === CONTROL_PLANE_URL` — retorna `false`
- Effect dispara, `isControlPlane` é false → `setVerifyState('denied')` imediatamente (linha 92)
- ADM inacessível enquanto o usuário estiver no subdomain do tenant

Isso é intencional como defense-in-depth, mas o problema é que usuários super-admins que DEVERIAM acessar ADM a partir do control plane domain não conseguem se tiverem sessionStorage com config de tenant (ex: depois de navegar por um tenant antes de ir para o control plane).

---

## Arquivos auditados

- `src/main.tsx`
- `src/integrations/supabase/client.ts`
- `src/hooks/useAuth.ts`
- `src/components/auth/AuthProvider.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/RestrictedRoute.tsx`
- `src/pages/Configuracoes.tsx`
- `src/App.tsx`
- `src/components/error-boundaries/PageErrorBoundary.tsx`
- `supabase/functions/adm-client-config/index.ts`
- `supabase/functions/auth-login/index.ts`
