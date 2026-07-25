---
title: "FIX-COACH-02: Auto-trigger pós-transcrição + implementar cron weekly_summary"
type: story
status: done
priority: P2
complexity: M
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-07-25
tags: [story, coach-pro, debt, P2, superseded]
related: ["[[../../project/modules/coach-pro]]"]
---

# FIX-COACH-02: Auto-trigger pós-transcrição + implementar cron weekly_summary

## Objetivo
Automatizar o disparo de avaliação IA após chegada de transcrição tldv (hoje é manual) e implementar o cron de weekly_summary que está flagged mas não implementado.

## Acceptance Criteria
- [x] AC1: Chegada de transcrição tldv dispara automaticamente `coach-evaluate` (via webhook ou trigger Supabase)
- [x] AC2: `weekly_summary_enabled` respeitado — quando habilitado, cron envia resumo semanal por email
- [x] AC3: Email de weekly summary chega via Resend com dados corretos de avaliações da semana
- [x] AC4: Trigger automático não duplica avaliações se disparado mais de uma vez

## Resolução — FECHADA SEM IMPLEMENTAÇÃO (2026-07-25)

Story supersedida pela migration `20260609000000_drop_coach_pro_and_call_pro.sql`.

O módulo Coach PRO foi **completamente removido** em 2026-06-09:
- `coach-evaluate` — edge function **não existe** em `supabase/functions/`
- `coach-email` — edge function **não existe** em `supabase/functions/`
- `coach_ai_settings` — tabela **dropada** (continha `weekly_summary_enabled`, `weekly_summary_day`, `weekly_summary_hour`)
- `meeting_evaluations` — tabela **dropada** (target do auto-trigger)
- `playbooks`, `playbook_sections`, `playbook_criteria`, `playbook_templates` — todas **dropadas**
- `v_coaching_insights` — view **dropada**
- Módulo `coach` removido de `settings_system_modules`
- Módulo `coach` removido de `adm_clients.enabled_modules`

**Consequências por AC:**
- AC1: `coach-evaluate` não existe → trigger não tem target. Inimplementável.
- AC2: `coach_ai_settings.weekly_summary_enabled` não existe → coluna dropada. Inimplementável.
- AC3: `coach-email` não existe → sem mecanismo de envio. Inimplementável.
- AC4: `meeting_evaluations` não existe → sem tabela para checar idempotência. Inimplementável.

Zero implementação necessária. Zero migration criada. Story encerrada.

## Escopo

**IN:**
- Webhook handler para tldv → trigger de `coach-evaluate`
- pg_cron job para weekly_summary (verificar flag `weekly_summary_enabled` por tenant)
- Edge fn `coach-weekly-summary` ou adaptar `coach-email` existente

**OUT:**
- Refactor do modelo de playbooks/criteria
- Novas fontes de transcrição (além de tldv)

## Contexto Técnico
Coach PRO avalia reuniões via `coach-evaluate` (ElevenLabs + GPT) e envia email via Resend. Atualmente o trigger é manual — usuário precisa clicar para iniciar avaliação após reunião. `weekly_summary_enabled` existe no schema mas o cron não foi implementado. Ver `docs/smart-memory/project/modules/coach-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer (Bythak) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | fix/coach-auto-trigger-weekly-summary |
| Resolução  | Fechada sem implementação — módulo Coach PRO dropado em 20260609000000 |

## File List
- Nenhum arquivo criado ou modificado.

## QA Results

```
VEREDICTO: WAIVED
Story: FIX-COACH-02 | Data: 2026-07-25
Issue aceito: Story inimplementável — módulo Coach PRO completamente dropado.
Justificativa técnica:
  Migration 20260609000000_drop_coach_pro_and_call_pro.sql removeu:
  - coach-evaluate (edge function não existe)
  - coach-email (edge function não existe)
  - coach_ai_settings (tabela dropada — weekly_summary_enabled/day/hour ausentes)
  - meeting_evaluations (tabela dropada — target do auto-trigger)
  - playbooks, playbook_sections, playbook_criteria, playbook_templates (dropadas)
  - v_coaching_insights view (dropada)
  Todos os 4 ACs são inimplementáveis por ausência das entidades de target.
  Zero migration criada. Zero código modificado. Bythak auditou e fechou.
Ação futura: nenhuma — módulo removido por decisão arquitetural. Se Coach PRO
  for reintroduzido, esta story deve ser re-aberta com novas dependências.
```
