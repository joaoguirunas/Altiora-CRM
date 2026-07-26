---
title: Auditoria de Inconsistências de Código
type: audit
agent: dev-analyst
created: 2026-04-26
updated: 2026-04-26
tags: [audit, code-quality, typescript, hooks, edge-functions]
related: ["[[../project/tech-stack]]"]
---

# Auditoria de Inconsistências de Código

**Data:** 2026-04-26  
**Escopo:** 727 arquivos TS/TSX + 90 edge functions  
**Total issues:** P0: 4 · P1: 9 · P2: 11

---

## P0 — Quebra em produção

### P0-1: MobileLpPro importa módulos que não existem

**Arquivo:** `src/pages/mobile/MobileLpPro.tsx`  
**Imports quebrados:**
- `@/components/lp/LpPageEditor` — arquivo não existe em disco
- `@/hooks/useLpPages` — arquivo não existe em disco
- `@/hooks/useLpTemplates` — arquivo não existe em disco

**Impacto cascata:** Outros arquivos também importam `LpBlock`/`LpPageContent` de `useLpTemplates` como tipo:
- `src/types/ab-testing.ts`
- `src/lp-core/utils/thumbnail-generator.ts`
- `src/lp-core/utils/block-optimization.ts`
- `src/lp-core/components/BlockListPerformanceMonitor.tsx`
- `src/lp-core/components/VirtualBlockList.tsx`

A rota `/m/lp` está definida em `MobileShell` mas o componente quebra ao carregar — usuários mobile não conseguem acessar LP Pro.

---

### P0-2: Hooks críticos usando `// @ts-nocheck` em código de produção

18 arquivos desabilitam cheques de tipo inteiramente com `// @ts-nocheck`, incluindo hooks centrais:

| Arquivo | Relevância |
|---|---|
| `src/hooks/useLeads.ts` | Hook central do CRM |
| `src/hooks/useSettings.ts` | Configurações do tenant |
| `src/hooks/useUsersNew.ts` | Gestão de usuários |
| `src/hooks/useTeamsNew.ts` | Equipes |
| `src/hooks/useAtribuicaoNegocio.ts` | Atribuição de negócios |
| `src/hooks/useAgendamentos.ts` | Agendamentos |
| `src/hooks/useSchedules.ts` | Schedules |
| `src/hooks/useDashboardLeadsConversao.ts` | Dashboard KPIs |
| `src/hooks/useTeamMembers.ts` | Membros de equipe |
| `src/hooks/useDashboardAgendamentos.ts` | Dashboard agendamentos |
| `src/hooks/useWhatsappTemplates.ts` | Templates WhatsApp |
| `src/hooks/useConsultorDisponibilidade.ts` | Disponibilidade |
| `src/hooks/useNegocioNotas.ts` | Notas de negócios |
| `src/hooks/useIncrementarContadorResumo.ts` | Contador resumo |
| `src/pages/Conversas.tsx` | Página principal Conversas |
| `src/pages/FinalizarCadastro.tsx` | Onboarding |
| `src/components/conversas/CannedResponsesModal.tsx` | Respostas prontas |

O TypeScript não reporta erros nesses arquivos — bugs de tipo são invisíveis.

---

### P0-3: Hooks stub mascarando código morto

3 hooks retornam apenas stubs e nunca implementam funcionalidade real:

```
src/hooks/useNegociosPaginados.ts  → apenas re-exporta useStubsAll
src/hooks/useDashboardNegocios.ts  → apenas re-exporta useStubsAll
src/hooks/useAtualizarPessoa.ts    → apenas re-exporta useStubsAll
```

Qualquer componente que use `useNegociosPaginados` está silenciosamente recebendo dados vazios (`data: []`, `isLoading: false`). Isso mascara ausência de dados sem exibir erros.

---

### P0-4: ANON key duplicada em múltiplos arquivos (drift de credencial)

A chave anon do control plane está hardcoded em 4 locais distintos:
- `src/integrations/supabase/client.ts:6`
- `src/hooks/useUsersNew.ts:7`
- `src/pages/PublicFormPage.tsx:9`
- `src/pages/DataDeletionPage.tsx:10`

**Risco:** Uma rotação de chave não atualiza todos os lugares, causando falha silenciosa em produção. `useUsersNew.ts` usa a chave diretamente em `fetch()` (não via client centralizado), então não pega a chave resolvida de `sessionStorage`.

---

## P1 — Degradação funcional / dívida técnica alta

### P1-1: Tipos `Usuario` definidos 4 vezes com shapes diferentes

| Arquivo | Campos principais |
|---|---|
| `src/types/usuarios.ts` | `nome`, `gestor`, `consultor`, `ativo`, `super_adm`, `user_type` |
| `src/hooks/useAtribuicaoNegocio.ts` | `nome`, `email`, `ativo`, `gestor` |
| `src/hooks/useTimes.ts` | `nome`, `email`, `ativo` |
| `src/components/disparos/steps/LeadFiltersStep.tsx` | local inline |

Tipo em `useUsersNew.ts` usa shape diferente com `name` (snake_case inglês), `is_manager`, `active`, `is_super_admin` — mapeamento legacy nos campos `nome`, `gestor`, `super_adm` para compatibilidade.

---

### P1-2: 30 eslint-disable-exhaustive-deps em 17 arquivos

Arquivo mais crítico: `CallProActiveCallPopup.tsx` com 5 supressões consecutivas em efeitos que controlam chamada ativa (estado de ligação em tempo real).

Arquivos afetados:
- `CallProActiveCallPopup.tsx` (5 supressões)
- `BIProInsightsTab.tsx` (4 supressões)
- `MobileBiPro.tsx` (4 supressões)
- `ProspectStepPessoas.tsx`, `ProspectStepEmpresas.tsx`, `ProspectEditModal.tsx`
- `RestrictedRoute.tsx`, `FormBuilderSimulation.tsx`, `FormBuilderSettings.tsx`
- `NovaReuniaoWizardModal.tsx`, `VoiceChatButton.tsx`, `CallProFloatingPanel.tsx`
- `ClienteSingle.tsx`, `ProspectSingle.tsx`, `EmpresaSingle.tsx`, `Reunioes.tsx`, `NegocioSingle.tsx`

---

### P1-3: Padrão inconsistente — React Query vs Supabase direto para mesmo recurso

204 arquivos usam React Query. 36 usam `supabase.from()` diretamente. Conflito no mesmo domínio:

- `useCompanyRelations.ts`: executa todas as queries com `supabase.from()` direto sem React Query (sem cache, sem invalidação, sem devtools)
- Outros hooks do mesmo domínio (ex: empresas) usam React Query

---

### P1-4: `useUsersNew.ts` duplica CONTROL_PLANE_KEY ao invés de usar cliente centralizado

`useUsersNew.ts:107-112` faz fetch direto para `create-tenant-user` com a chave hardcoded, ignorando o client centralizado em `integrations/supabase/client.ts`. Se o tenant tiver configuração customizada em sessionStorage, essa chamada vai para o control plane com a chave errada.

---

### P1-5: `MobileLpPro` importado no App.tsx mas nunca roteado

`MobileLpPro` é importado no App.tsx mas não aparece em nenhuma rota `/m/*`. O bundle inclui o componente (com imports quebrados) sem nunca renderizá-lo.

---

### P1-6: `ConversasDemo` exposta em rota de produção

`/conversas/demo` renderiza `ConversaDemoEduardo` — componente de teste com dados simulados que importa `useSimularConversa`. A rota está ativa e protegida apenas por módulo (`conversas`), não por feature flag. Qualquer usuário com acesso ao módulo pode navegar para ela.

---

### P1-7: `PerformanceMonitor` de debug incluído em DashLayout de produção

`src/components/layout/DashLayout.tsx:755` renderiza `<PerformanceMonitor />` incondicionalmente. O componente está em `src/components/debug/` — não é provável que seja destinado à produção permanentemente.

---

### P1-8: `useStubsAll.ts` — 352 linhas de stubs com `: any` pervasivo

O arquivo `useStubsAll.ts` é importado por `usePessoas.ts` via `export * from './useStubsAll'`, o que significa que qualquer consumidor de `usePessoas` recebe todos os exports de stubs poluindo o namespace. O `stubResponse` tem tipo `any` e retorna arrays vazios para todas as propriedades.

---

### P1-9: `tsconfig.json` desativa proteções críticas de TypeScript

```json
"noImplicitAny": false,
"noUnusedParameters": false,
"noUnusedLocals": false,
"strictNullChecks": false
```

`strictNullChecks: false` é especialmente perigoso — possíveis `null` / `undefined` nunca são detectados pelo compilador, e o projeto tem 399 usos de `: any` + 222 `as any`.

---

## P2 — Inconsistências de padrão / manutenibilidade

### P2-1: Chaves anon hardcoded com datas de expiração diferentes

`DataDeletionPage.tsx` usa uma chave com `iat: 1735154798, exp: 2050730798` (gerada ~Dez/2024).  
`client.ts` e `useUsersNew.ts` usam outra com `iat: 1750129924, exp: 2065705924` (gerada ~Jun/2025).  
Duas chaves distintas para o mesmo projeto — potencial drift.

---

### P2-2: Edge functions que existem mas não são invocadas pelo frontend

As seguintes funções existem em `supabase/functions/` e não são chamadas pelo frontend (algumas são webhooks/cron legítimos, mas algumas podem ser órfãs):

**Provavelmente legítimas (webhooks externos / cron):**
`call-pro-webhook`, `meta-inbound`, `whatsapp-inbound`, `tiktok-inbound`, `tldv-webhook`, `coach-weekly-summary`, `followup-status-callback`, `send-status-callback`, `send-invite-email`, `send-meeting-confirmation`, `bi-sync-google-ads`, `bi-sync-meta-ads`, `tiktok-token-refresh`, `instagram-*`, `google-cal-upsert-event`, `google-cal-pull-event`, `zoom-*`, `ms-teams-upsert-event`

**Suspeitos de serem órfãos (sem chamada identificável):**
- `gemini-live-token` — chamado via `fetch()` direto em `useGeminiLive.ts` (não via `invoke`) ✓ confirmado ativo
- `adm-verify-super-admin` — chamado via `fetch()` direto em `RestrictedRoute.tsx` ✓ confirmado ativo
- `conversion-fetch-platforms` — chamado via `fetch()` direto em `useConversionConfig.ts` ✓ confirmado ativo
- `prospect-search-companies/people`, `prospect-enrich-*`, `prospect-scorer`, `prospect-commit` — chamados dinamicamente via `useProspectActions.ts` ✓ confirmados ativos
- `create-tenant-user` — chamado via `fetch()` direto em `useUsersNew.ts` ✓ confirmado ativo

**Realmente sem chamada identificável:**
`adm-health-check`, `adm-health-check-batch`, `adm-rotate-management-token`, `data-deletion`, `elevenlabs-agent-sync`, `omni-retry-dead-letter`, `score-re-evaluate`, `sends-dispatch-batch`, `omni-channel-health-check`

---

### P2-3: `useSettingsCompat.ts` é apenas re-export de `useSettings`

Wrapper de compatibilidade sem documentação de quando pode ser removido.

---

### P2-4: Tipos duplicados — `UsuarioTime`

`src/types/usuarios.ts` e `src/hooks/useAtribuicaoNegocio.ts` exportam `UsuarioTime` com shapes ligeiramente diferentes.

---

### P2-5: `useAgenteTeste.ts` não tem consumidores identificáveis

Nenhum import de `useAgenteTeste` fora do próprio arquivo. O hook existe mas parece ser código morto — a funcionalidade de testes foi migrada para `CentralDeTestes` que usa `useProspectActions`.

---

### P2-6: `useSimularConversa.ts` usado apenas por `ConversaDemoEduardo.tsx`

Arquivo de simulação de conversa cujo único consumidor é o componente demo (P1-6 acima). Se o demo for removido, o hook torna-se código morto.

---

### P2-7: Página `Brandbook` presente em rotas mas sem link na navegação

`/brandbook` tem rota definida mas não aparece em `DashLayout` sidebar. Acessível apenas por URL direta.

---

### P2-8: `useFollowups` em `useStubsAll.ts` — stub exportado como se fosse hook real

`useStubsAll.ts:276` exporta `useFollowups` como stub. Qualquer componente que importe de `useFollowups` e na verdade receber o stub via re-export não verá erro — recebe array vazio silenciosamente.

---

### P2-9: 399 usos de `: any` + 222 `as any` — concentrados em hooks críticos

Os 18 arquivos com `@ts-nocheck` explicam parte, mas há usos explícitos em arquivos sem nocheck:
- `useLeads.ts`: `mutationFn: async (lead: any)`, `metadata?: any`
- `useConversas.ts`, `useAgenteTeste.ts`, `CallProActiveCallPopup.tsx`

---

### P2-10: `CONTROL_PLANE_URL` hardcoded em 2 arquivos separados

`src/integrations/supabase/client.ts` e `src/hooks/useUsersNew.ts` definem independentemente:
```ts
const CONTROL_PLANE_URL = 'https://ohzwetkaazgxafubzvop.supabase.co';
```
`useUsersNew.ts` deveria importar de `client.ts` onde `CONTROL_PLANE_URL` já é exportado.

---

### P2-11: `useCalendarConnectionsHealth` — 1 referência externa (provavelmente obsoleto)

`useCalendarConnectionsHealth` tem apenas 1 referência fora do próprio arquivo. Verificar se ainda é necessário.

---

## Resumo executivo

| Prioridade | Issues | Descrição síntese |
|---|---|---|
| **P0** | 4 | Imports quebrados (MobileLpPro), ts-nocheck em hooks centrais, stubs mascarando dados vazios, drift de credencial |
| **P1** | 9 | 4 tipos `Usuario` divergentes, 30 supressões de exhaustive-deps, React Query vs Supabase direto inconsistente, demo em produção, debug em produção |
| **P2** | 11 | Código morto, duplicações de constantes, edge functions sem chamada identificável, tsconfig sem strict |

**Achado mais crítico:** `MobileLpPro.tsx` importa 3 arquivos que não existem em disco (`LpPageEditor`, `useLpPages`, `useLpTemplates`) e esses mesmos tipos inexistentes vazam para 5 outros arquivos no `lp-core`. A rota mobile `/m/lp` falha silenciosamente.
