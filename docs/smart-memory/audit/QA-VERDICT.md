---
title: Veredicto QA — Auditoria Geral rev-os
type: qa-verdict
verdict: FAIL
agent: dev-qa
created: 2026-04-26
updated: 2026-04-26
tags: [qa, verdict, audit]
related: ["[[routes]]", "[[resilience]]", "[[navigation]]", "[[inconsistencies]]", "[[database]]"]
---

# Veredicto QA: Auditoria Geral rev-os

## Veredicto: ❌ FAIL

**Resumo:** Sistema em produção apresenta **15 issues P0** convergentes em 5 áreas de auditoria, com múltiplas confirmações cruzadas (mesmo bug visto de ângulos diferentes). Bloqueios de UX após login (`/dashboard` sem index), 404s em fluxos críticos (criação de disparo, listagem de empresas, mobile LP), drift de credencial em 4 arquivos, hooks centrais sob `@ts-nocheck` mascarando bugs de tipo, e fragilidade arquitetural em Settings (duas fontes de verdade divergentes). Áreas estruturais (RLS, multi-tenant bootstrap, schema moderno) estão saudáveis no project-per-tenant; o débito está concentrado em routing, code hygiene e governance de credenciais.

**Contagem consolidada após dedup:** **15 P0 · 25 P1 · 28 P2** (de 17/29/33 originais antes da consolidação por causa raiz).

---

## Causas raiz comuns identificadas (cross-report)

Issues que aparecem em múltiplos relatórios refletindo o mesmo problema:

| # | Causa raiz | Aparece em | Issues unificadas |
|---|---|---|---|
| **CR-1** | `/dashboard` sem `<Route index>` | routes, navigation, resilience | P0-1 (routes) + P1-1 (nav) + P1-5 (resil) |
| **CR-2** | ADM "sumiu" — combinação profile provisional + `isControlPlane` static + defense-in-depth subdomain | routes, navigation, resilience | P0-2 (routes) + P1-3 (nav) + P0-2 (resil) |
| **CR-3** | Settings com 2 fontes de verdade (Routes em App.tsx vs `urlItemToSection`) | routes, navigation, resilience | P0-3/4 (routes) + P0-1, P1-4, P2-1 (nav) + P1-4, P2-4 (resil) |
| **CR-4** | CONTROL_PLANE credentials hardcoded em 4 arquivos | inconsistencies, resilience | P0-4 (incons) + P0-3 (resil) + P1-1 (resil CORS) |
| **CR-5** | Schema legado crm_* paralelo ao moderno sem migration | database, inconsistencies | P0-2/3 (db) + P1-2 (db) + P1-3 (db realtime) + P0-1/2 (incons) |
| **CR-6** | TypeScript safety net desligado (`@ts-nocheck` + tsconfig sem strictNullChecks) | inconsistencies | P0-2 (incons) + P1-9 (incons) |
| **CR-7** | Auth init com timeouts não-coordenados (initTimeout 3s, profile 2s, sem timeout MFA) | resilience | P0-1, P0-2, P1-6 (resil) |

---

## Issues Consolidados

### P0 — Crítico (corrigir antes de qualquer novo desenvolvimento)

| # | Área | Problema | Causa raiz | Responsável sugerido |
|---|---|---|---|---|
| **P0-01** | Routing/UX | `/dashboard` sem `<Route index>` — login bem-sucedido cai em tela em branco; PageErrorBoundary `handleGoHome` também usa `/dashboard` e crasha em 404 após qualquer crash | CR-1 | dev-alpha |
| **P0-02** | Routing/Auth | ADM invisível na sidebar — combinação de profile provisional com `super_adm:false`, `isControlPlane` calculado via `useMemo([])` uma vez, e bloqueio intencional em subdomain de tenant. Nenhum aviso ao usuário | CR-2 | dev-alpha + dev-beta |
| **P0-03** | Routing/UX | `/settings/omni/whatsapp` em `CriarDisparo.tsx:392` — rota não existe no router → 404 hard no fluxo de disparo | CR-3 | dev-alpha |
| **P0-04** | Routing/UX | `/settings/general/brandbook` em `Brandbook.tsx:183` — Route não declarada → 404 | CR-3 | dev-alpha |
| **P0-05** | Routing/UX | `/crm/empresas/:id` em `Clientes.tsx:611,656` — Route não declarada apesar de `EmpresaSingle.tsx` existir → 404 ao clicar empresa | dev-alpha |
| **P0-06** | Routing/UX | `/form-pro?tab=forms` em `FormProConfig.tsx:368` — rota inexistente; módulo correto é `/lp` | dev-alpha |
| **P0-07** | Frontend | `MobileLpPro.tsx` importa 3 módulos que não existem em disco (`LpPageEditor`, `useLpPages`, `useLpTemplates`) — tipos vazam para 5 arquivos em `lp-core/`. `/m/lp` quebra | dev-alpha |
| **P0-08** | Code hygiene | 18 arquivos com `// @ts-nocheck` incluindo `useLeads`, `useSettings`, `useUsersNew`, `useTeamsNew`, `useAgendamentos` — bugs de tipo invisíveis em hooks centrais | CR-6 | dev-analyst + dev-alpha |
| **P0-09** | Code hygiene | 3 hooks stub mascarando código morto (`useNegociosPaginados`, `useDashboardNegocios`, `useAtualizarPessoa` retornam `useStubsAll`) — componentes recebem `data:[]` silenciosamente sem aviso | dev-alpha |
| **P0-10** | Security | CONTROL_PLANE anon key hardcoded em 4 arquivos com 2 valores diferentes (`client.ts`, `useUsersNew.ts`, `PublicFormPage.tsx`, `DataDeletionPage.tsx`) — rotação de chave não cobre todos os locais | CR-4 | dev-delta |
| **P0-11** | Auth | Race condition `useAuth.ts:248-332` — `initTimeout` (3s) libera UI antes do `onAuthStateChange` listener subscrever em redes lentas. Eventos `SIGNED_IN`/`TOKEN_REFRESHED` perdidos | CR-7 | dev-beta |
| **P0-12** | Auth | Fallback profile silencioso seta `super_adm:false` quando `fetchUserProfile` faz timeout — `isProvisional:true` setado mas nenhum componente verifica → super-admin perde acesso silenciosamente | CR-7 | dev-beta |
| **P0-13** | Auth | `_supabase_client_config` corrompido inicia app com credentials inválidas — `client.ts` não valida formato de URL nem comprimento mínimo de key. Falha silenciosa até primeiro request | CR-4 | dev-delta |
| **P0-14** | Database | 2 pares de migrations com timestamp duplicado e conteúdo diferente (`20260319100001`, `20260319100002`). Supabase CLI local pula uma das duas | dev-data-engineer |
| **P0-15** | Database | RLS `USING(true)` em 18+ tabelas crm_* legadas no baseline — seguro só em project-per-tenant. Tenant provisionado com baseline.sql sem client-migrations.json fica sem isolamento. Migration `20260312170000` corrige só `crm_tenants`, não `crm_leads/pessoas/empresas` | CR-5 | dev-data-engineer |

### P1 — Alto (próximo sprint)

| # | Área | Problema | Causa raiz | Responsável |
|---|---|---|---|---|
| **P1-01** | Routing | `/settings/send/config` e `/settings/general/webhooks` têm Route mas sem mapping em `urlItemToSection` → cai em "Geral" sem aviso | CR-3 | dev-alpha |
| **P1-02** | Routing | Filtro `adminOnly` morto em `Configuracoes.tsx:369` — nenhum item declara `adminOnly:true`. Sections sensíveis (`api-keys`, `permissoes`) aparecem para qualquer gestor | CR-3 | dev-alpha |
| **P1-03** | Routing | `getRestrictedSidebarItems` retorna `[]` — função morta nunca chamada | dev-alpha |
| **P1-04** | Auth/UX | Super-admin pré-warming inexistente — `_adm_verified_${userId}` só popula no primeiro `/adm`. UX esquisita: clica menu, vê "Acesso Restrito" | CR-2 | dev-beta |
| **P1-05** | Routing | `isControlPlane` em DashLayout `useMemo([])` static — não relê quando profile chega. Race condition silenciosa | CR-2 | dev-alpha |
| **P1-06** | Backend | `adm-client-config` CORS `*` sem auth — qualquer um faz lookup de `host → tenant credentials` | CR-4 | dev-beta + dev-delta |
| **P1-07** | Backend | `auth-login` ignora `tenant_host` recebido — rate limit global cross-tenant. Atacante num tenant consome limite de outro | dev-beta |
| **P1-08** | Auth | `RestrictedRoute` infinito em `'idle'` se `user.profile` for null momentaneamente — spinner eterno | CR-7 | dev-beta |
| **P1-09** | Auth/UX | `Configuracoes.tsx` `sectionToUrl` sem entradas para `api-keys`/`permissoes` — URL não muda, recarregar perde a seção | CR-3 | dev-alpha |
| **P1-10** | Routing/UX | `PageErrorBoundary.handleGoHome` redireciona para `/dashboard` (404) após crash | CR-1 | dev-alpha |
| **P1-11** | Auth | MFA guard sem timeout em `ProtectedRoute.tsx:63-88` — `listFactors`/`getAAL` travado = spinner eterno sem bypass | CR-7 | dev-beta |
| **P1-12** | UX | `VoiceChatButton.tsx:170` usa `?tab=ia` mas Configuracoes lê `?section=` — param ignorado | CR-3 | dev-alpha |
| **P1-13** | UX/Mobile | `MobilePerfil.tsx:44` navega para `/settings` (rota desktop) — loop de redirect ou cai em `/m/bi` | dev-alpha |
| **P1-14** | Code hygiene | 4 definições de tipo `Usuario` divergentes (`types/usuarios.ts`, `useAtribuicaoNegocio`, `useTimes`, `LeadFiltersStep` inline) | dev-analyst |
| **P1-15** | Code hygiene | 30 `eslint-disable-exhaustive-deps` em 17 arquivos (5 consecutivos em `CallProActiveCallPopup` controlando estado de chamada em tempo real) | dev-analyst |
| **P1-16** | Code hygiene | React Query vs `supabase.from()` direto inconsistente para mesmo domínio — `useCompanyRelations` direto, outros via Query | dev-analyst |
| **P1-17** | Code hygiene | `useUsersNew.ts` duplica `CONTROL_PLANE_URL`/key + `fetch` direto em vez de client centralizado — ignora tenant config em sessionStorage | CR-4 | dev-alpha |
| **P1-18** | Code hygiene | `MobileLpPro` importado em App.tsx mas nunca roteado — bundle inclui código morto com imports quebrados | dev-alpha |
| **P1-19** | Security | `/conversas/demo` em produção protegida só por módulo (`conversas`) — qualquer usuário com acesso pode acessar dados simulados | dev-alpha + dev-delta |
| **P1-20** | Code hygiene | `<PerformanceMonitor />` de debug renderizado incondicionalmente em `DashLayout.tsx:755` | dev-alpha |
| **P1-21** | Code hygiene | `useStubsAll.ts` (352 linhas, `: any` pervasivo) re-exportado via `usePessoas.ts` — pollution + dados vazios silenciosos | dev-analyst |
| **P1-22** | Code hygiene | `tsconfig.json` desliga `noImplicitAny`, `strictNullChecks`, `noUnusedLocals` — 399 `: any` + 222 `as any` | CR-6 | dev-analyst |
| **P1-23** | Database | 101 `DROP TABLE/COLUMN` sem `IF EXISTS` — re-execução ou tenant fora de ordem aborta migration | dev-data-engineer |
| **P1-24** | Database | Schema legado crm_* paralelo ao moderno (clients_people, leads, etc.) sem migration de dados — Edge usa moderno, frontend usa ambos | CR-5 | dev-architect + dev-data-engineer |
| **P1-25** | Database | `RealtimeContext` subscreve crm_* com `tenant_id=eq.X` mas tabelas podem ter `tenant_id NULL` no novo schema → 0 eventos, UI não invalida | CR-5 | dev-architect |

### P2 — Médio (backlog)

| # | Área | Problema | Responsável |
|---|---|---|---|
| **P2-01** | Routing | `/dashboard` vs `/bipro` — duplicação confusa, sidebar usa `/bipro`, redirects pós-login usam `/dashboard` | dev-alpha |
| **P2-02** | Routing | `getPageTitle()` em DashLayout com mapeamento manual frágil — qualquer rota nova precisa lembrar | dev-alpha |
| **P2-03** | Routing | `path === '/dashboard'` em `DashLayout.tsx:518` — código morto residual | dev-alpha |
| **P2-04** | Routing | MFA paths inconsistentes (`/mfa-verify` raiz vs `/settings/mfa-setup`) | dev-alpha |
| **P2-05** | Mobile | `Navigate to="/m/bi"` hardcoded — tenant sem módulo `dashboard` ativo fica preso em `MobileModuleGuard` | dev-alpha |
| **P2-06** | Routing | ~6 chaves em `urlItemToSection` sem Route declarada (`crm.elevenlabs`, `omni.meta`, `omni.whatsapp-meta`, `schedule.google`, etc.) | dev-alpha |
| **P2-07** | Routing | `/dashboard/negocios/:id` legacy + `/crm/kanban/:id` moderno — 7 componentes ainda usam legacy | dev-alpha |
| **P2-08** | UX | `ScheduleTabNav` leva ao `/settings/schedule/automacoes` — transição abrupta de Schedule pra Configurações | dev-ux |
| **P2-09** | UX | `VoicePlayerBar` navega `/settings/general/integracoes` sem tab específica | dev-ux |
| **P2-10** | UX | `CriarDisparoModal` state `{ openSection: 'importacao-exportacao' }` ignorado silenciosamente | dev-alpha |
| **P2-11** | UX | `Brandbook` botão volta para "Outros" em settings — confuso | dev-ux |
| **P2-12** | Mobile | `MobileDashboard.tsx` existe mas não é roteado | dev-alpha |
| **P2-13** | Auth | `getActiveSectionFromUrl` recalculado a cada render sem memoização | dev-alpha |
| **P2-14** | Auth | `AuthProvider` `forceShow` 1s força render mesmo com `isLoading:true` — flash de conteúdo possível | dev-beta |
| **P2-15** | Auth | `resolveConfig` em `client.ts` chamado no module load sem retry — qualquer import direto fora do `main()` quebra garantia | dev-delta |
| **P2-16** | Auth | `adm-client-config` sem validação de comprimento do `host` — log spam possível com payload 10KB | dev-delta |
| **P2-17** | Code hygiene | `useSettingsCompat` re-export sem doc de quando remover | dev-analyst |
| **P2-18** | Code hygiene | `useAgenteTeste` sem consumidores externos — código morto provável | dev-analyst |
| **P2-19** | Code hygiene | `useSimularConversa` só usado por `ConversaDemoEduardo` — se P1-19 resolver, vira código morto | dev-analyst |
| **P2-20** | UX | `/brandbook` sem link na navegação — só URL direta | dev-ux |
| **P2-21** | Code hygiene | `useFollowups` exportado como stub de `useStubsAll` | dev-analyst |
| **P2-22** | Code hygiene | 9 edge functions sem chamada identificável (`adm-health-check`, `omni-retry-dead-letter`, `score-re-evaluate`, `sends-dispatch-batch`, etc.) — confirmar antes de remover | dev-analyst + dev-beta |
| **P2-23** | Code hygiene | `CONTROL_PLANE_URL` duplicado em 2 arquivos | CR-4 → dev-alpha |
| **P2-24** | Code hygiene | `useCalendarConnectionsHealth` 1 ref externa — provável obsoleto | dev-analyst |
| **P2-25** | Database | Triggers `track_leads_changes`, `track_meeting_changes`, `track_leads_updates_changes` — corrigidos em migration duplicada (P0-14) | dev-data-engineer |
| **P2-26** | Database | `book_meeting()` overload com colunas inexistentes — droppado se cleanup rodar | dev-data-engineer |
| **P2-27** | Database | `prospect_audit_log.establishment_id` — coluna mantida sem FK nem índice | dev-data-engineer |
| **P2-28** | Database | `_meta_debug` sem RLS até `20260312` — tenants antigos sem migration ficam expostos | dev-data-engineer |

---

## Plano de Ação Recomendado

### Sprint de Correção 1 — P0 críticos (1 semana)

**Objetivo:** Eliminar 404s visíveis e bloqueios de fluxo.

1. [P0-01] Adicionar `<Route index element={<Navigate to="/bipro" replace />} />` em `/dashboard` + corrigir `PageErrorBoundary.handleGoHome` (P1-10) — **dev-alpha** — 2P
2. [P0-03/04/05/06] Corrigir 4 navigates 404 (`/settings/omni/whatsapp`, `/settings/general/brandbook`, `/crm/empresas/:id`, `/form-pro`) — **dev-alpha** — 3P
3. [P0-07] Investigar imports quebrados em `MobileLpPro.tsx` — decidir: restaurar arquivos missing OU desabilitar rota `/m/lp` OU implementar — **dev-alpha** — 3P
4. [P0-09] Remover 3 hooks stub e seus imports — **dev-alpha** — 1P
5. [P0-14] Renomear timestamps duplicados em `migrations-manifest.json` para únicos — **dev-data-engineer** — 1P
6. [P0-15] SQL no banco vivo `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename IN ('crm_leads','crm_pessoas','crm_empresas')` — confirmar estado real e corrigir se `USING(true)` — **dev-data-engineer** — 2P

**Estimativa total:** 12P (~1 semana com 1 dev focado)

---

### Sprint de Correção 2 — P0 governance/auth (1 semana)

**Objetivo:** Fechar buracos de governance de credenciais e race conditions de auth.

7. [P0-10 + CR-4] Centralizar `CONTROL_PLANE_URL` + key em `client.ts` único, refatorar `useUsersNew.ts`, `PublicFormPage.tsx`, `DataDeletionPage.tsx` para importar — **dev-delta** — 3P
8. [P0-11] Reordenar `useAuth.ts` — subscrever listener ANTES do `getSession()` await, ou separar timeouts — **dev-beta** — 3P
9. [P0-12] Bloquear acesso a rotas restritas quando `isProvisional:true`, com banner de aviso. Adicionar `refreshProfile` automático até obter dados reais — **dev-beta** — 3P
10. [P0-13] Validar formato URL + comprimento de key em `client.ts:resolveConfig()` — **dev-delta** — 1P
11. [P0-02] Investigar real do user `joaoguirunasramos@gmail.com` no control plane (`SELECT super_adm FROM profiles WHERE email = ?`). Fix UX da sidebar (transformar `isControlPlane` em `useMemo([user?.profile?.id])` ou state reativo). Adicionar pré-warm de `_adm_verified_` no login — **dev-alpha + dev-beta** — 5P

**Estimativa total:** 15P (~1 semana com 2 devs)

---

### Sprint de Correção 3 — P0 code hygiene (1 semana)

**Objetivo:** Restaurar safety net de TypeScript.

12. [P0-08 + CR-6] Auditar 18 arquivos com `@ts-nocheck` priorizando `useLeads`, `useSettings`, `useUsersNew`. Plano: começar pelos hooks centrais, criar tipos faltantes, remover nocheck um por vez. **NÃO** ligar `strictNullChecks` agora (escopo separado, P1-22). — **dev-analyst + dev-alpha** — 8P

**Estimativa total:** 8P (~1 semana focado)

---

### Sprint P1 (próxima onda — 2 semanas)

**Routing/Settings:**
- [P1-01,02,03] Limpeza de Settings — remover Routes sem mapping, eliminar filtro `adminOnly` morto, deletar `getRestrictedSidebarItems` vazio.
- [P1-12,13] Fix params inconsistentes (`?tab=ia` → `?section=`) e mobile navigate.
- [P1-19] Mover `/conversas/demo` atrás de feature flag ou super-admin only.
- [P1-20] Remover `<PerformanceMonitor />` de produção (mover atrás de `import.meta.env.DEV`).

**Backend security:**
- [P1-06] `adm-client-config` — adicionar JWT/header secret (não pode ser totalmente público no fluxo bootstrap; rate limit + log de host suspeito).
  > **Design proposto (2026-04-27, Rex):** HMAC-SHA256 com secret estática não é viável — a secret ficaria exposta no bundle frontend, tornando a proteção ilusória. A abordagem correta requer um **token opaco emitido server-side**: (1) cliente solicita um `bootstrap-challenge` token a um endpoint leve e autenticado (ex: via `anon` key apenas, com rate limit por IP, sem body — só retorna um token JWT curto de 60s); (2) `bootstrapClientConfig()` inclui esse token no header `X-Bootstrap-Token`; (3) `adm-client-config` valida a assinatura JWT com a secret do Deno env antes de retornar credentials. Estimativa: ~4h (novo edge fn `adm-bootstrap-challenge` + ajuste em `main.tsx` + validação em `adm-client-config`). Alternativa mais simples: adicionar `require_mfa: false` e retornar apenas `enabled_modules` sem `anon_key` na resposta pública — mover `anon_key` para um segundo request autenticado pós-login. Assignar ao time após ADR de bootstrap security.
- [P1-07] `auth-login` — usar `tenant_host` no rate limit por tenant.

**Auth resilience:**
- [P1-08] Fallback de `RestrictedRoute` quando `user.profile` é null por > 5s.
- [P1-11] Timeout de 5s no MFA guard com botão "Recarregar".

**Database:**
- [P1-23] Auditar 101 DROPs sem IF EXISTS — converter os de maior risco (drop de tabela inteira).
- [P1-24,25] **Decisão arquitetural pendente** — definir estratégia: migrar dados crm_* → moderno OU descontinuar moderno OU manter dual. Sem decisão, débito cresce. — **dev-architect**

**Code hygiene:**
- [P1-14,16,17,18,21] Consolidação de tipos `Usuario`, refactor `useCompanyRelations` para React Query, deletar `MobileLpPro` import morto, refatorar `useStubsAll` re-export.
- [P1-15] Auditar 30 `eslint-disable-exhaustive-deps` priorizando `CallProActiveCallPopup` (estado de chamada em tempo real).

---

### Backlog P2 (priorização contínua)

P2s majoritariamente são limpeza de código e UX polish. Recomendação: pegar 2-3 P2 por sprint junto com features novas.

**Decisão arquitetural recomendada (out-of-scope desta auditoria):**
- **ADR sugerida:** Consolidar Settings em ÚNICA fonte de verdade (Routes em App.tsx OU `urlItemToSection` em Configuracoes — não ambos). 8 issues (P0-03, P0-04, P1-01, P1-02, P1-09, P1-12, P2-06, P2-10) descenderam de CR-3. Owner: **dev-architect**.
- **ADR sugerida:** Estratégia de migração schema crm_* → moderno (clients_people, leads). 5 issues descenderam de CR-5. Owner: **dev-architect + dev-data-engineer**.

---

## Áreas em bom estado (NÃO está quebrado)

Resultados positivos das 5 auditorias:

1. **Multi-tenant bootstrap** — `main.tsx` + `bootstrapClientConfig` funciona corretamente; `client.ts` lê sessionStorage síncrono OK; race conditions estão documentadas e mitigadas. **Único gap:** validação de cache corrompido (P0-13).
2. **RLS no schema moderno** — tabelas `clients_people`, `leads`, `meetings`, `messages`, `prospect_*` têm RLS com JWT claim correto. RLS no project-per-tenant é defense-in-depth adequada.
3. **Edge functions arquitetura** — 90+ edge fns bem organizadas por domínio, action tokens HMAC (ADR-SP-02) sólidos, capability tokens para booking público corretos, rate limiting DB-backed em endpoints públicos (lp-submit) presente.
4. **Realtime infra** — heartbeat 45s, exponential backoff, reconnect logic em `RealtimeContext` é bem arquitetada. Único bug é semântico (subscrição em tabelas com tenant_id NULL — P1-25).
5. **TanStack Query setup** — staleTime/gcTime agressivos, retry: 1, refetchOnWindowFocus: false. Cache strategy adequada. Inconsistências são apenas de adoção (P1-16), não de configuração.
6. **Mobile shell strategy** — redirect-based para `/m/*` com `MobileShell` + `MobileBottomTabs` é uma decisão arquitetural correta. Bugs são pontuais (P0-07, P1-13, P2-05, P2-12).
7. **Webhooks externos** — HMAC-SHA256 em Meta, TikTok, validação correta em `whatsapp-inbound`, `tiktok-inbound`. Padrão `verify_jwt=false` justificado.
8. **Vault/secrets** — `secret_access_log`, service-role credentials em vault, ADR-SP-05 implementado.
9. **Migration system core** — `client-migrations.json` + `adm-sync-client` com `order_index` UUID-based é sólido. Apenas 2 timestamps duplicados precisam fix (P0-14), não falha sistêmica.
10. **Indexação de tabelas críticas** — `crm_leads` (6 índices compostos), `crm_messages`, `meetings`, `prospect_people` (6 índices parciais), `sends_contacts` cobertos adequadamente.

---

## Conclusão

**Veredicto FAIL formal** — sistema NÃO pode receber novo desenvolvimento até:

1. **Mínimo (P0-01 a P0-06, P0-09, P0-14):** Bug fixes mecânicos que eliminam 404s e tela em branco. Estimativa: 1 semana.
2. **Recomendado (P0-10 a P0-13):** Fechar governance de credenciais e race conditions de auth antes de qualquer feature crítica nova. Estimativa: +1 semana.
3. **Ideal (P0-08, P0-15):** Auditar `@ts-nocheck` em hooks centrais e confirmar RLS real do banco vivo. Estimativa: +1-2 semanas.

**Nenhum P0 é "WAIVED" candidate** — todos têm impacto direto em produção (UX quebrada, security ou data integrity).

**Próximos passos sugeridos:**
- Architect (Zaelor) abrir ADRs para CR-3 (Settings) e CR-5 (Schema crm_* vs moderno).
- Analyst (Lyra) priorizar plano de remoção de `@ts-nocheck` por hook crítico.
- Chief decidir alocação de devs entre os 3 sprints de correção.

---

**Issued by:** Axikar — QA Master  
**Date:** 2026-04-26  
**Verdict:** ❌ **FAIL** — 15 P0 · 25 P1 · 28 P2 (após dedup por causa raiz)
