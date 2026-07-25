---
title: "Backlog Status Map — 2026-04-26"
type: research
agent: dev-analyst
created: 2026-04-26
updated: 2026-04-26
tags: [research, backlog, sprint-planning]
related: ["[[../../stories/BACKLOG]]", "[[../../shared-context]]"]
---

# Backlog Status Map — 2026-04-26

**Solicitado por:** team-os (lead)
**Escopo:** Todas as stories em `stories/backlog/` + decisions pendentes + reconciliação com `done/` e `active/`

---

## 1. Reconciliação: Status Real vs. Frontmatter

> **Alerta:** O diretório `stories/backlog/` não reflete o estado atual. Várias stories têm `status: backlog` no frontmatter mas já foram concluídas (existem em `stories/done/`) ou estão em voo (`stories/active/`). A tabela abaixo usa o status real.

### Stories em `backlog/` com status desatualizado

| Story | Status no backlog/ | Status real | Evidência |
|---|---|---|---|
| FIX-SP-01 | backlog | **done** | `stories/done/FIX-SP-01.md` status: done |
| FIX-OMNI-01 | backlog | **done** | `stories/done/FIX-OMNI-01.md` status: done |
| FIX-SCH-02 | backlog | **done** | `stories/done/FIX-SCH-02.md` status: done |
| CALL-PRO-01 | backlog | **done** | `stories/done/CALL-PRO-01.md` status: done |
| AUTH-V2-09 | backlog | **done** | `stories/done/AUTH-V2-09.md` status: done |
| FIX-SENDS-01 | backlog | **done** (provável) | Dev record: Concluído 2026-04-23; todos os 5 ACs marcados [x] |

---

## 2. Tabela Completa do Backlog (stories/backlog/)

| Story ID | Título | Epic | Prioridade | Complexidade | Status Real | Dependências |
|---|---|---|---|---|---|---|
| **FIX-PP-01** | Fix prospect-scorer + prospect-commit (schema v1 quebrado) | — | **P0** | M | backlog | nenhuma |
| **FIX-COACH-01** | Fix mismatch view coach_meeting_evaluations | — | **P1** | S | backlog | nenhuma |
| **FIX-SENDS-01** | Mover dispatch loop browser → pg_cron | — | P1 | L | **done** (provável) | nenhuma |
| **FIX-SP-01** | Capability token user_id → tenant_id | — | P1 | S | **done** | nenhuma |
| **REL-01** | Versioned Releases — release.json + GH Action | release-pipeline-v1 | **P1** | M | backlog | nenhuma (foundational) |
| **REL-02** | ADM UI — botão Atualizar cliente + bulk | release-pipeline-v1 | P1 | L | backlog | REL-01 |
| **REL-04** | Migration Discipline — lint + CI block | release-pipeline-v1 | **P1** | M | backlog | nenhuma (paralelo a REL-01) |
| **AUTH-V2-01** | Substituir extractTenantId por supabase.auth.getUser | auth-v2 | P1 | M | backlog | nenhuma |
| **ADM-V3-02** | Rollback compensatório em adm-create-user | adm-v3 | P1 (tags) | M | backlog | nenhuma |
| **FIX-ADM-01** | Rollback adm-create-user + remover secrets plaintext | — | P2 | M | backlog (atribuído: zael) | nenhuma |
| **FIX-AUTH-01** | Hardening auth — fallbackProfile, rate limit, stubs | — | P2 | M | backlog (atribuído: zael) | nenhuma (após FIX-ADM-01 por zael) |
| **FIX-BI-01** | OAuth token refresh BI + TikTok sync edge fn | — | P2 | M | backlog (atribuído: lyra) | nenhuma |
| **FIX-SCORE-01** | Atualizar types score-pro, remover as any | — | P2 | M | backlog (atribuído: lyra) | nenhuma (após FIX-BI-01 por lyra) |
| **FIX-COACH-02** | Auto-trigger pós-transcrição + cron weekly_summary | — | P2 | M | backlog | FIX-COACH-01 |
| **FIX-OMNI-01** | Action tokens whatsapp-outbound + IG refresh | — | P2 | M | **done** | nenhuma |
| **FIX-SCH-02** | Double-booking, Zoom refresh, RLS meeting_evaluations | — | P2 | M | **done** | nenhuma |
| **AUTH-V2-03** | MFA TOTP via Supabase Auth (backend hooks) | auth-v2 | P2 | L | backlog | nenhuma |
| **AUTH-V2-08** | CSP + COOP/COEP headers Vercel | auth-v2 | P2 | S | backlog | nenhuma |
| **AUTH-V2-09** | Rate limit login via edge function intermediária | auth-v2 | P2 | M | **done** | nenhuma |
| **CALL-PRO-01** | word_spotting → AI Agent + BI stats para RPC | — | P2 | M | **done** | nenhuma |
| **ADM-V3-04** | Cache server-side em adm-client-config (Deno KV) | adm-v3 | P3 | M | backlog | nenhuma |
| **ADM-V3-08** | UI badge drift schema por tenant no ADM | adm-v3 | P3 | S | backlog | REL-01 (conceito de version) |
| **CLEAN-CRM-01** | Round-robin, alias PT/EN, useMotivosPerda | — | P3 | S | backlog | nenhuma |
| **CLEAN-SENDS-01** | Tipos gerados sends_contacts + FK | — | P3 | S | backlog | nenhuma |
| **REL-03** | Drift Detection cron + Self-Healing Repair | release-pipeline-v1 | P2 | M | backlog | REL-01; idealmente REL-04 |
| **REL-05** | Schema Baseline Squashing | release-pipeline-v1 | P2 | M | backlog | REL-01 + REL-04; idealmente REL-03 |
| **ADM-V3-01** | Unificar ALL_MODULES — constante única | adm-v3 | P2 (tags) | S | backlog | nenhuma |

---

## 3. Stories em Voo Atualmente (stories/active/)

| Story ID | Título | Prioridade |
|---|---|---|
| **AUTH-V2-03c** | Step-up Auth (AAL2 Challenge + Recovery Login) | high |
| **AUTH-V2-09** | Rate limit login (conflito: também em done/) | P2 |
| **BI-VOICE-00** | Provider Gemini em settings_ai_providers | P2 |
| **BI-VOICE-01** | Edge fn gemini-live-token (conflito: também em done/) | P2 |
| **BI-VOICE-03** | Tools BI integration — function calling sobre RPCs | P2 |

> **Nota:** AUTH-V2-09 e BI-VOICE-01 aparecem simultaneamente em `active/` e `done/` — inconsistência de status a resolver.

---

## 4. Stories Concluídas (stories/done/) — Referência

Done: ADM-V3-03, ADM-V3-05/06/07/09/10, ADR-STUBS-01, AUTH-V2-02/03b/04/05/06/07/09/10/11/12, BI-VOICE-01, CALL-PRO-01, CLEAN-OMNI-01, CLEAN-SETTINGS-01, FIX-OMNI-01, FIX-SCH-02, FIX-SETTINGS-02, FIX-SP-01, US-CFG-01/02/03/04/05/06/07/08.

---

## 5. Decisions (ADRs) — Todas Accepted

Nenhum ADR com status `pending` ou `proposed` encontrado. Todos os 12 ADRs em `decisions/` têm `status: accepted`. Não há decisão bloqueando o backlog.

---

## 6. Clusters / Epics — Prontidão para Sprint

### Epic: `release-pipeline-v1` (REL-01 a REL-05)
**Estado:** Nenhuma story iniciada. REL-01 e REL-04 são foundational e podem iniciar imediatamente em paralelo. REL-02, REL-03, REL-05 dependem de REL-01.
**Pronto para iniciar:** REL-01 + REL-04 (paralelo, zero blockers).

### Epic: `auth-v2`
**Estado:** AUTH-V2-01, AUTH-V2-03, AUTH-V2-08 ainda no backlog. AUTH-V2-09 done. AUTH-V2-03c em voo (step-up auth).
**Pronto para iniciar:** AUTH-V2-01 (elimina extractTenantId — hardening crítico), AUTH-V2-08 (CSP — S, sem deps).

### Epic: `adm-v3`
**Estado:** ADM-V3-01, ADM-V3-02, ADM-V3-04, ADM-V3-08 no backlog. Múltiplas (05/06/07/09/10) já concluídas.
**Pronto para iniciar:** ADM-V3-01 (S, refactor modular, zero deps), ADM-V3-02 (M, rollback compensatório — similar a FIX-ADM-01 mas mais cirúrgico).

### Cluster: FIX urgentes remanescentes
- **FIX-PP-01 (P0):** Schema v1 quebrado em prospect — blocker de produção. Já atribuído a byte. Zero deps.
- **FIX-COACH-01 (P1):** Crash em runtime no Dashboard de avaliações. Zero deps. Desbloqueia FIX-COACH-02.
- **FIX-ADM-01 + FIX-AUTH-01:** Atribuídos a zael. Zero deps externos.
- **FIX-BI-01 + FIX-SCORE-01:** Atribuídos a lyra. Zero deps externos.

---

## 7. Mapa de Blockers

```
FIX-PP-01       →  (nada bloqueia, mas deve ser tratado primeiro — P0)
FIX-COACH-01    →  desbloqeia FIX-COACH-02
REL-01          →  desbloqueia REL-02, REL-03, REL-05, ADM-V3-08
REL-04          →  recomendado antes de REL-03 e REL-05
REL-03          →  recomendado antes de REL-05
```

Stories sem nenhum blocker e prontas para execução imediata: FIX-PP-01, FIX-COACH-01, REL-01, REL-04, AUTH-V2-01, AUTH-V2-08, ADM-V3-01, ADM-V3-02, CLEAN-CRM-01, CLEAN-SENDS-01, FIX-ADM-01, FIX-AUTH-01, FIX-BI-01, FIX-SCORE-01, AUTH-V2-03.

---

## 8. Top-5 por Impacto × Viabilidade — Próximo Sprint

| # | Story | Razão |
|---|---|---|
| **1** | **FIX-PP-01 (P0)** | Única P0 ativa — prospect-scorer quebrado em produção para todos os tenants com campanhas v1. Impacto direto em receita. Complexity M, zero deps. Já tem agente (byte). |
| **2** | **REL-01 (P1)** | Foundational para o epic de maior valor estratégico (release pipeline). Desbloqueia REL-02 (UI de update), REL-03 (drift) e REL-05 (squash). Complexity M, zero deps. |
| **3** | **FIX-COACH-01 (P1)** | P1 de crash em runtime no Coach Dashboard — bug visível ao usuário final. Complexity S (menor esforço do backlog P1). Desbloqueia FIX-COACH-02. Zero deps. |
| **4** | **AUTH-V2-01 (P1)** | Substitui `extractTenantId` inseguro (unsigned JWT decode) — vulnerabilidade de segurança ativa em todas as edge fns que o usam. Complexity M, zero deps. Alinhado com ADR-PP-03. |
| **5** | **REL-04 (P1)** | Paralelo a REL-01 — lint de migrations no CI bloqueia merges com migrations sem idempotência. Complexity M, zero deps. Reduz risco de regressões em todo o pipeline de schema futuro. |

**Honourable mention:** ADM-V3-01 (S, zero deps, elimina inconsistência de catálogo de módulos que afeta ADM e useSystemModules — baixo risco, alto valor de code health).

---

## 9. Anomalias Identificadas

1. **Frontmatter desatualizado em backlog/:** 6 stories marcadas como `backlog` já estão em `done/` (FIX-SP-01, FIX-OMNI-01, FIX-SCH-02, CALL-PRO-01, AUTH-V2-09) ou concluídas pelo dev (FIX-SENDS-01). Recomendo que o lead atualize `status: done` nos frontmatters ou mova os arquivos.
2. **Duplicatas em active/ + done/:** AUTH-V2-09 e BI-VOICE-01 aparecem em ambos os diretórios — indicam movimentação incompleta.
3. **Shared-context desatualizado:** O board em `shared-context.md` (2026-04-23) lista FIX-OMNI-01, FIX-SCH-02, FIX-SP-01 como "em progresso", mas já estão done.
4. **FIX-SENDS-01 vs FIX-COACH-02:** FIX-COACH-02 depende de FIX-COACH-01, que ainda está no backlog — não pode avançar.
5. **ADM-V3-02 vs FIX-ADM-01:** Têm sobreposição de escopo (rollback em adm-create-user). ADM-V3-02 é mais focado (apenas rollback); FIX-ADM-01 adiciona remoção de secrets em plaintext. Devem ser tratados como uma única entrega ou verificar se FIX-ADM-01 absorve ADM-V3-02.

---

## Fontes

- `docs/smart-memory/stories/backlog/` — 25 stories (todas lidas)
- `docs/smart-memory/stories/done/` — 32 stories (listagem)
- `docs/smart-memory/stories/active/` — 5 stories
- `docs/smart-memory/decisions/` — 12 ADRs (todos accepted)
- `docs/smart-memory/shared-context.md` — status board 2026-04-23
- `docs/smart-memory/project/overview.md` — contexto geral
