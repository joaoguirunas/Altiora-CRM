---
title: Module Deep-Dives — Index
type: index
status: active
agent: team-os
created: 2026-04-22
updated: 2026-04-22
tags: [modules, index]
related: ["[[../modules]]", "[[../overview]]", "[[../architecture]]"]
---

# Module Deep-Dives — rev-os

Cada arquivo aqui é uma documentação granular de um módulo: visão · rotas · componentes · hooks · edge functions · schema · fluxos Mermaid · integrações · débito técnico · stories candidatas. Profundidade alvo: "novo dev abre e produz em 1 dia".

Para o **mapa de alto nível** dos módulos, ver [[../modules]]. Para a **arquitetura geral**, ver [[../architecture]].

## Foundational

| Doc | Tamanho | Owner | O que cobre |
|---|---|---|---|
| [[adm-control-plane]] | 31 KB / 532 L | dev-architect | Catálogo de tenants em `adm_clients`, sync de migrations, secrets cifrados (pgcrypto + hints 12 chars), super-admin only, GitHub Actions CI/CD, RPCs SECURITY DEFINER, splitStatements parser, IPv6 workaround |
| [[auth-tenant-bootstrap]] | 33 KB / 547 L | dev-architect | Hostname→sessionStorage→React mount, `useSimpleAuth`, guards (`ProtectedRoute`/`ModuleProtectedRoute`/`RestrictedRoute`), RLS strategy completa (4 padrões), role gates `super_admin && isControlPlane`, deprecation de `extractTenantId` unsigned (ADR-PP-03) |

## Produtos PRO

| Doc | Tamanho | Owner | O que cobre |
|---|---|---|---|
| [[bi-pro]] | 16 KB / 244 L | dev-analyst | Dashboard executivo (4 abas Insights/RevOps/Comercial/Marketing), attribution Meta+Google+TikTok, conversion tracking via pg_cron, chat LLM + ElevenLabs TTS |
| [[crm-pro]] | 19 KB / 313 L | dev-dev-gamma | Pipelines Kanban, lifecycle de leads, lead_field_values hierárquicos, atribuição de time, split legado (`crm_*`) vs moderno |
| [[sends-pro]] | 20 KB / 337 L | dev-dev-gamma | Broadcast multi-canal, query builder dinâmico (filter-leads-for-send), batch dispatch, import CSV, integração com OMNI |
| [[prospect-pro]] | 18 KB / 315 L | dev-data-engineer | Prospecção B2B, enrichment chain (Explorium/Apollo/PDL), scoring IA, commit ao CRM, dedup por email/phone. **🔴 P0 BUG flagado** |
| [[schedule-pro]] | 23 KB / 306 L | dev-dev-beta | Public booking, capability tokens HMAC (ADR-SP-02), Google Cal/Teams/Zoom integration, transcripts (tldv), atomic single-use tokens (INSERT ON CONFLICT) |
| [[omni-pro]] | 23 KB / 337 L | dev-dev-beta | WhatsApp/IG/TikTok webhooks (HMAC), AI agent (14 tools mapeadas), message_buffer + ai_processing_lock, omni-delivery-engine, dead-letter |
| [[form-pro-lp]] | 18 KB / 299 L | dev-dev-alpha | Form Builder simples + LP Builder visual com 22 tipos de bloco (Zod), lp-submit (no JWT, rate limit, dedup, post-submit actions), score binding |
| [[call-pro]] | 19 KB / 291 L | dev-dev-alpha | Dialer + popup global, integração **Atende Simples** (telefonia, HMAC-SHA1 + idempotência), webhooks ciclo de chamada, ElevenLabs TTS + agent sync |
| [[coach-pro]] | 20 KB / — | dev-data-engineer | Avaliação IA de reuniões (novo 2026-04-22), playbooks/sections/criteria, integração tldv→coach-evaluate→coach-email (Resend) |
| [[score-pro]] | 14 KB / 224 L | dev-analyst | Motor de qualificação por JSONB matrix (categories × items → score_number), aplicação inteira em lp-submit via containment query (@>) |

## Cross-cutting

| Doc | Tamanho | Owner | O que cobre |
|---|---|---|---|
| [[settings]] | 34 KB / 547 L | dev-ux | 22 painéis nível 1, ~50+ com sub-tabs, IntegracoesConfig com 10 sub-tabs OAuth, 4 padrões UI documentados, 20 hooks de configuração, fluxo OAuth canônico |

## Inventário de bugs e débito técnico (16 itens consolidados)

| Severidade | Módulo | Item |
|---|---|---|
| 🔴 P0 | prospect-pro | edge fns `prospect-scorer` + `prospect-commit` referenciam `prospect_people.establishment_id` (schema v1) — **quebradas pra campanhas `version=1`** |
| 🟠 P1 | sends-pro | Loop de disparo roda no **browser** (setInterval) — para se aba fecha, retoma manual |
| 🟠 P1 | coach-pro | Hooks consultam `coach_meeting_evaluations` (view) que pode não existir; outros usam `meeting_evaluations`. Risco de Dashboard quebrar runtime |
| 🟠 P1 | schedule-pro | Capability token usando `user_id` no lugar de `tenant_id` (linha 108) |
| 🟡 P2 | omni-pro | `whatsapp-outbound` sem action tokens (viola ADR-SP-02) |
| 🟡 P2 | omni-pro | Instagram token refresh DISABLED |
| 🟡 P2 | bi-pro | OAuth tokens sem refresh; TikTok sync edge fn não localizada |
| 🟡 P2 | score-pro | `types.ts` desatualizado — todos hooks com `as any`; re-avaliação assíncrona não implementada |
| 🟡 P2 | adm-control-plane | Órfãos em `adm-create-user` sem rollback; hints de secrets em plaintext (12 chars) |
| 🟡 P2 | schedule-pro | Double-booking possível (GCal não importado não bloqueia slots); Zoom sem refresh; `meeting_evaluations` sem RLS tenant-scoped |
| 🟡 P2 | coach-pro | Trigger automático pós-transcrição não implementado (manual only); cron `weekly_summary_enabled` não implementado |
| 🟡 P2 | auth-tenant-bootstrap | `fallbackProfile` permissivo em timeout 2s; sem MFA; sem rate limit no login; vestígios `crm_tenants`/`useTenants`/`useTenantContext` stub |
| 🟢 P3 | crm-pro | Sem round-robin automático identificado (só atribuição manual); aliases PT/EN; `useMotivosPerda` fora padrão TanStack Query |
| 🟢 P3 | omni-pro | Schema duplo `messages` / `crm_messages` (legacy não removido); PDF extraction incompleto |
| 🟢 P3 | settings | 9 débitos UX (CopyRow duplicado, secrets plaintext, tab persistence inconsistente, dualidade WhatsApp channels) |
| 🟢 P3 | sends-pro | `sends_contacts` sem tipos gerados; `stage_ids`/`template_id` sem FK |
| 🟢 P3 | adm-control-plane | Catálogo de módulos inconsistente (9 vs 11); `adm_audit_log` sem índices visíveis; `management_token` sem rotação |

## Stories candidatas catalogadas

Aproximadamente **40+ stories** foram propostas pelos teammates ao longo dos deep-dives, agrupadas por módulo:

- **ADM-V3-01 → 10** (10 stories — adm-control-plane)
- **AUTH-V2-01 → 12** (12 stories — auth-tenant-bootstrap)
- **US-CFG-01 → 08** (8 stories — settings)
- **CP-XX** (call-pro débitos: TODO CP-11 word_spotting → AI Agent, BI stats client-side → RPC)
- **PROSPECT P0** (audit + redirect branches v1)
- (mais espalhadas por bi-pro, omni-pro, schedule-pro, coach-pro, sends-pro)

**Próximo ciclo natural:** rodar `/team-os *plan` priorizando o P0 do prospect + os 3 P1 (sends loop browser, coach view mismatch, schedule capability token tenant_id), depois o backlog médio.

## ADRs sugeridos

Aproximadamente **9 ADRs** foram sugeridos pelos teammates, complementando os 3 ADRs já referenciados no código (SP-01, SP-02, SP-05):

- **ADM-01 → 04** (4 ADRs — adm-control-plane)
- **AUTH-01 → 04** (4 ADRs — auth-tenant-bootstrap)
- **PP-03** (server-verified tenant_id — referenciado mas arquivo ainda não existe)

## Métricas

- **13 deep-dives** entregues
- **4.731 linhas** totais / **~270 KB**
- **7 teammates** trabalhando em paralelo (~10 min wall-clock pra fase 2)
- Lead synthesis: este arquivo + atualizações de INDEX/modules/teams-log

---

**Relacionados:** [[../modules]] · [[../architecture]] · [[../overview]] · [[../tech-stack]] · [[../conventions]] · [[../../agents/data-engineer/schema]] · [[../../agents/ux/components]] · [[../../shared-context]]
