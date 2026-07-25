---
title: Wave Plan — Backlog Priorizado
type: ops
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [ops, wave-plan, backlog, prioritization]
related: ["[[../stories/BACKLOG]]", "[[../shared-context]]"]
---

# Wave Plan — Priorização do Backlog

**Gerado por:** Zaelor (dev-architect) · 2026-07-25  
**Base:** 65 arquivos em `docs/smart-memory/stories/backlog/`  
**Regra de prioridade:** FIX críticos > ALTIORA restantes > AUTH-V2 > SENDS fixes > sim/seed > BI/REL > ARCH

---

## 🔍 Diagnóstico: Stories Obsoletas no Backlog

> **Ação de limpeza necessária:** os arquivos abaixo ainda estão em `backlog/` mas já foram concluídos. Devem ser movidos para `done/` ou removidos.

| Arquivo em backlog/ | Status real | Fonte de verdade |
|---|---|---|
| `FIX-SENDS-01.md` | ✅ done | Frontmatter próprio: `status: done` |
| `CLEAN-SENDS-MIGRATION-01.md` | ✅ done | Frontmatter próprio: `status: done` |
| `SENDS-IMPORT-02.md` | ✅ done | Frontmatter próprio: `status: done` |
| `AUTH-V2-01.md` | ✅ done | done/ folder: `status: done` (2026-04-26) |
| `AUTH-V2-09.md` | ✅ done | done/ folder: `status: done` (2026-04-24) |
| `FIX-OMNI-01.md` | ✅ done | done/ folder: `status: done` (2026-04-23) |
| `FIX-SCH-02.md` | ✅ done | done/ folder: `status: done` (2026-04-23) |
| `FIX-SP-01.md` | ✅ done | done/ folder: `status: done` (2026-04-23) |
| `ALTIORA-08-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-17-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-18-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-20-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-21-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-22-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-24-*.md` | ✅ done | done/ folder: `status: done` |
| `ALTIORA-25-*.md` | ✅ done | done/ folder: `status: done` |

> **Stories ativas** (em progresso, não entram nas waves):
> - `FIX-SENDS-FIRST-MSG-01.md` — status: active (P0, L)
> - `bi-2-insights-enterprise.md` — status: in-progress
> - `bi-3-comercial-enterprise.md` — status: ready-for-qa
> - `bi-4-revops-marketing-enterprise.md` — status: ready-for-qa

---

## 🌊 Wave 1 — Imediato (10 stories)

**Critério:** ACs claros e testáveis, sem dependências bloqueantes externas, S ou M complexity.  
**Capacidade sugerida:** 2–3 devs em paralelo, ~5–8 dias.

| # | Story | Complexidade | Prioridade | Assignee | Justificativa |
|---|---|---|---|---|---|
| 1 | **FIX-PP-01** — Corrigir edge fns prospect-scorer + prospect-commit (v1 schema) | M | 🔴 P0 | dev-data-engineer | Prospect PRO completamente quebrado em produção para campanhas v1. Nenhuma dep. |
| 2 | **FIX-COACH-01** — Fix mismatch view coach_meeting_evaluations vs meeting_evaluations | S | 🟠 P1 | dev-data-engineer | Crash em produção no Dashboard Coach. 1 migration trivial. Nenhuma dep. |
| 3 | **FIX-SENDS-FILTER-01** — Corrigir filtro person_status ignorado em filter-leads-for-send | S | 🟠 P1 | dev-dev-beta | Bug crítico: campanhas com filtro de status retornam zero contatos. Fix 5 linhas. |
| 4 | **FIX-SENDS-FILTER-02** — Corrigir has_more com count real em filter-leads-for-send | S | 🟠 P1 | dev-dev-beta | Mesmo arquivo que FILTER-01. Bundlar na mesma PR. |
| 5 | **FIX-SENDS-DISPATCH-01** — Atomic claim em sends-dispatch-batch via UPDATE+RETURNING | M | 🟠 P1 | dev-dev-beta | Race condition causa envio duplicado de mensagens. Fix padrão compare-and-swap. |
| 6 | **FIX-SENDS-CRON-LEGACY-URLS** — Sanear 3 crons com URLs legadas (google-cal, meetings, conversion-send) | S | 🟠 P1 | dev-data-engineer | Crons Schedule PRO/SENDS podem estar falhando silenciosamente há semanas. |
| 7 | **FIX-SENDS-UI-01** — Não sobrescrever started_at ao retomar disparo pausado | S | 🟡 P2 | dev-dev-alpha | Fix trivial em DisparoControls.tsx (isResume check). 10 linhas. |
| 8 | **FIX-SENDS-UI-02** — Corrigir timezone em scheduled_at ao criar disparo agendado | S | 🟡 P2 | dev-dev-alpha | Fix trivial: `.toISOString()` na montagem da data. Bundlar com UI-01. |
| 9 | **ARCH-RBAC-02** — Drop completo do sistema RBAC granular (tenant_roles) | S | 🟠 P1 | dev-data-engineer | ADR-AUTH-09 decidido. Tabelas vazias em prod. Zero callers dos 8 gates. Execução segura. |
| 10 | **AUTH-V2-08** — CSP + COOP/COEP headers no Vercel | S | 🟡 P2 | dev-dev-gamma | Apenas vercel.json. Independente de tudo. Quick win de segurança. |

**Parallelism sugerido:**
```
Byte (dev-data-engineer): FIX-PP-01 → FIX-SENDS-CRON-LEGACY-URLS → ARCH-RBAC-02 → FIX-COACH-01
Rex  (dev-dev-beta):      FIX-SENDS-FILTER-01 + FIX-SENDS-FILTER-02 (bundle) → FIX-SENDS-DISPATCH-01
Aria (dev-dev-alpha):     FIX-SENDS-UI-01 + FIX-SENDS-UI-02 (bundle)
Sera (dev-dev-gamma):     AUTH-V2-08
```

---

## 🌊 Wave 2 — Médio Prazo (10 stories)

**Critério:** M complexity ou dependências leves resolvidas na Wave 1. Alta relevância operacional.

| # | Story | Complexidade | Prioridade | Assignee | Dep. | Justificativa |
|---|---|---|---|---|---|---|
| 1 | **FIX-SENDS-STATUS-BRIDGE-01** — Bridge delivered/read Meta → sends_contacts | M | 🟠 P1 | dev-dev-beta + dev-data-engineer | Nenhuma (schema `messages.delivered_at` precisa ser confirmado first) | Fecha gap de tracking de entrega em campanhas. |
| 2 | **FIX-SENDS-FE-VALIDATION** — 3 gaps cross-layer FE↔BE no SENDS PRO (template APPROVED, variables_map, handleAtivar) | M | 🟡 P2 | dev-dev-alpha | Nenhuma (confirmar `meta_template_status` populado) | Impede usuário de criar campanhas inválidas que falham silenciosamente. |
| 3 | **FIX-SENDS-DISPATCH-02** — Reduzir retry delays inline para prevenir timeout em batch | S | 🟡 P2 | dev-dev-beta | DISPATCH-01 (Wave 1) | Após fix de race condition, otimizar delays. |
| 4 | **FIX-IG-AUT-02** — UI Automações IG: distinguir 'comentário não chegou' de 'chegou e não bateu' | S | 🟡 P2 | dev-dev-alpha | Nenhuma | Quick UX fix, independente. |
| 5 | **FIX-AUTH-01** — Hardening auth: fallbackProfile, rate limit login, remover stubs legados | M | 🟡 P2 | dev-dev-beta | Nenhuma | Segurança. Remover `crm_tenants`, `useTenants` obsoletos. |
| 6 | **FIX-ADM-01** — Rollback em adm-create-user + remover hints de secrets em plaintext | M | 🟡 P2 | dev-dev-beta | Nenhuma | Segurança. Evita usuários órfãos em falhas. |
| 7 | **FIX-COACH-02** — Auto-trigger pós-transcrição + cron weekly_summary | M | 🟡 P2 | dev-data-engineer | Nenhuma | Fecha loop automático de avaliações Coach. |
| 8 | **FIX-BI-01** — OAuth token refresh BI + localizar edge fn TikTok sync | M | 🟡 P2 | dev-analyst | Nenhuma | Dados de BI desatualizados por token expirado. |
| 9 | **ALTIORA-12** — Atualizar etapa com campos obrigatórios por transição (UC20) | L | 🟠 P1 | dev-dev-gamma | ⚠️ ALTIORA-01 (DB schema, em done/ com status backlog — verificar completude) | Workflow core do pipeline Altiora. Blocker potencial: confirmar ALTIORA-01 antes de iniciar. |
| 10 | **sim-1** — Dados de configuração base (pipelines, stages, usuários demo) | M | 🟠 P1 | dev-data-engineer | Nenhuma | Base para toda a cadeia sim-2..6. Desbloqueia apresentação comercial. |

---

## 🌊 Wave 3 — Dependentes e Complexos (15 stories)

**Critério:** Dependem de Wave 1/2, maior complexidade, ou domain-specific.

| # | Story | Complexidade | Prioridade | Assignee | Dep. |
|---|---|---|---|---|---|
| 1 | **sim-2** — ~100 leads + ~30 empresas com 30 dias de histórico | L | 🟠 P1 | dev-data-engineer | sim-1 |
| 2 | **sim-3** — Mínimo 50 conversas WhatsApp/Instagram | L | 🟠 P1 | dev-data-engineer | sim-1 |
| 3 | **sim-4** — 20+ vendas fechadas + 15+ perdidas + pipeline ativo | M | 🟠 P1 | dev-data-engineer | sim-1 |
| 4 | **sim-5** — 40+ reuniões correlacionadas com funil | M | 🟠 P1 | dev-data-engineer | sim-1 |
| 5 | **sim-6** — 6 campanhas Meta+Google + 30 dias de spend + ROAS | L | 🟠 P1 | dev-data-engineer | sim-1 |
| 6 | **AUTH-V2-03** — MFA opcional via TOTP (Supabase Auth) | L | 🟡 P2 | dev-dev-alpha | Nenhuma (mas longa) |
| 7 | **FIX-SENDS-IMPORT-03** — Criar lead para contatos existentes quando create_leads=true | M | 🟡 P2 | dev-dev-beta | Nenhuma |
| 8 | **FIX-SENDS-IMPORT-04** — Dedup e insert em bulk para imports >1000 contatos | L | 🟡 P2 | dev-dev-beta | Nenhuma |
| 9 | **FIX-SENDS-IMPORT-05** — Campos personalizados de negócio/lead visíveis no FieldMapper | S | 🟡 P2 | dev-dev-gamma | Nenhuma |
| 10 | **FIX-SENDS-IMPORT-06** — Reintroduzir input estático de lead_control no ImportListaTab | S | 🟡 P2 | dev-dev-gamma | Nenhuma |
| 11 | **FIX-SCORE-01** — Atualizar types.ts score-pro, remover as any, re-avaliação assíncrona | M | 🟡 P2 | dev-analyst | Nenhuma |
| 12 | **bi-1-voice-sanitizer** — markdownToVoiceText() + sumarizador semântico para ElevenLabs TTS | M | 🟠 P1 | dev-dev-alpha | Nenhuma |
| 13 | **BI-VOICE-04** — Integração final voz↔tools + telemetria + UI feature gate | M | 🟠 P1 | dev-dev-alpha | BI-VOICE-02/03 (em active) |
| 14 | **SENDS-FIX-01** — Auditoria completa de quebras no módulo SENDS PRO | M | 🟠 P1 | dev-dev-delta | Nenhuma (mas serve como input para outros fixes) |
| 15 | **SENDS-IMPORT-01** — Simplificar fluxo de importação — remover templates prontos | S | 🟡 P2 | dev-dev-gamma | Nenhuma |

---

## 🌊 Wave 4 — Tech Debt e Infraestrutura (12 stories)

**Critério:** Baixa prioridade funcional, alta dívida técnica, REL pipeline, observabilidade.

| # | Story | Complexidade | Prioridade | Assignee | Dep. |
|---|---|---|---|---|---|
| 1 | **REL-04** — Migration Discipline: lint-migrations.js + CI block + dry-run | M | 🟠 P1 | dev-devops + dev-data-engineer | Nenhuma (primeiro da sequência REL) |
| 2 | **REL-01** — Versioned Releases: release.json + adm_releases + GH Action tag | M | 🟠 P1 | dev-data-engineer + dev-devops | REL-04 |
| 3 | **REL-02** — ADM "Atualizar Cliente" UI — botão + bulk + modal + Realtime status | L | 🟠 P1 | dev-dev-alpha + dev-ux | REL-01 |
| 4 | **REL-03** — Drift Detection cron + Self-Healing Repair button | M | 🟡 P2 | dev-dev-beta + dev-data-engineer | REL-01 |
| 5 | **REL-05** — Schema Baseline Squashing — script + arquivamento + onboarding rápido | M | 🟡 P2 | dev-data-engineer | REL-01 |
| 6 | **OBS-DISPATCH-HEALTH-01** — View v_dispatch_health + RPC + DispatchHealthCard UI | M | 🟢 P3 | dev-data-engineer + dev-dev-alpha | FIX-SENDS-STATUS-BRIDGE-01 (Wave 2) |
| 7 | **FUP-AUTO-01** — Agendamento automático de follow-up via agente IA | M | medium | dev-dev-beta | Nenhuma imediata |
| 8 | **FWUP-18b** — Hardening buckets storage: MIME types + path-prefix policies | S | 🟠 P1 | dev-dev-gamma | Nenhuma |
| 9 | **CLEAN-CRM-01** — Round-robin, alias PT/EN, corrigir useMotivosPerda | S | 🟢 P3 | dev-dev-gamma | Nenhuma |
| 10 | **CLEAN-SENDS-01** — Tipos gerados sends_contacts + FK stage_ids/template_id | S | 🟢 P3 | dev-dev-gamma | Nenhuma |
| 11 | **FIX-ADM-01** *(se não feito na W2)* | M | 🟡 P2 | dev-dev-beta | — |
| 12 | **AUTH-V2-03** *(se não feito na W3)* | L | 🟡 P2 | dev-dev-alpha | — |

---

## 📊 Mapa de Assignees

| Agente | Wave 1 | Wave 2 | Wave 3+ |
|---|---|---|---|
| **dev-data-engineer** | FIX-PP-01, FIX-COACH-01, FIX-SENDS-CRON, ARCH-RBAC-02 | FIX-SENDS-STATUS-BRIDGE, FIX-COACH-02, sim-1 | sim-2..6, REL-04, REL-01 |
| **dev-dev-beta** | FIX-SENDS-FILTER-01/02, FIX-SENDS-DISPATCH-01 | FIX-SENDS-STATUS-BRIDGE, FIX-SENDS-DISPATCH-02, FIX-AUTH-01, FIX-ADM-01 | FIX-SENDS-IMPORT-03/04, FUP-AUTO-01, REL-03 |
| **dev-dev-alpha** | FIX-SENDS-UI-01/02 | FIX-SENDS-FE-VALIDATION, FIX-IG-AUT-02 | AUTH-V2-03, bi-1, BI-VOICE-04, REL-02 |
| **dev-dev-gamma** | AUTH-V2-08 | ALTIORA-12 | FIX-SENDS-IMPORT-05/06, SENDS-IMPORT-01, FWUP-18b, CLEAN-CRM-01, CLEAN-SENDS-01 |
| **dev-analyst** | — | FIX-BI-01 | FIX-SCORE-01 |
| **dev-dev-delta** | — | — | SENDS-FIX-01 |
| **dev-devops** | — | — | REL-04 |

---

## ⚠️ Blockers e Alertas

### ALTIORA-01 — Status Ambíguo
- Arquivo `done/ALTIORA-01-db-schema-pipeline-altiora.md` tem `status: backlog` (não done).
- ALTIORA-12 (Wave 2) depende de ALTIORA-01 estar completo.
- **Ação:** verificar com o lead se ALTIORA-01 foi aplicado ou ainda precisa de implementação antes de iniciar ALTIORA-12.

### FIX-SENDS-FIRST-MSG-01 — Em Active
- Story P0 de observabilidade de delivery já está ativa. Não duplicar esforço.
- FIX-SENDS-STATUS-BRIDGE-01 (Wave 2) é complementar — verificar overlap com o que está sendo feito.

### sim-* — Tenant Alvo
- Stories sim-* apontam para `wotuyxscsfralqpoiyfv` (tenant antigo, desconectado em 2026-07-25).
- Verificar se devem ser adaptadas para o novo banco `dtsmbqrzyxhjjjvpjfjd` antes de executar.

### AUTH-V2-01 / AUTH-V2-09 — Já Done
- Arquivos presentes em backlog/ mas já concluídos em done/.
- Não devem entrar em nenhuma wave — remover de backlog/ ou marcar como done.

---

## 📈 Resumo de Velocidade

| Wave | Stories | S | M | L | XL | Complexidade Total |
|---|---|---|---|---|---|---|
| Wave 1 | 10 | 8 | 2 | 0 | 0 | Baixa |
| Wave 2 | 10 | 2 | 7 | 1 | 0 | Média |
| Wave 3 | 15 | 4 | 6 | 4 | 0 | Média-Alta |
| Wave 4 | 12 | 4 | 7 | 1 | 0 | Média |
| **Total** | **47** | **18** | **22** | **6** | **0** | |

> Note: 3 stories do backlog/ são done (FIX-SENDS-01, CLEAN-SENDS-MIGRATION-01, SENDS-IMPORT-02) e 5 já têm cópias done em done/ (AUTH-V2-01, AUTH-V2-09, FIX-OMNI-01, FIX-SCH-02, FIX-SP-01). Não entram nas waves.
