---
title: "FIX-COACH-02: Auto-trigger pós-transcrição + implementar cron weekly_summary"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-04-22
tags: [story, coach-pro, debt, P2]
related: ["[[../../project/modules/coach-pro]]"]
---

# FIX-COACH-02: Auto-trigger pós-transcrição + implementar cron weekly_summary

## Objetivo
Automatizar o disparo de avaliação IA após chegada de transcrição tldv (hoje é manual) e implementar o cron de weekly_summary que está flagged mas não implementado.

## Acceptance Criteria
- [ ] AC1: Chegada de transcrição tldv dispara automaticamente `coach-evaluate` (via webhook ou trigger Supabase)
- [ ] AC2: `weekly_summary_enabled` respeitado — quando habilitado, cron envia resumo semanal por email
- [ ] AC3: Email de weekly summary chega via Resend com dados corretos de avaliações da semana
- [ ] AC4: Trigger automático não duplica avaliações se disparado mais de uma vez

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
| Agente     | dev-data-engineer (byte) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/coach-auto-trigger-weekly-summary |

## File List

## QA Results
