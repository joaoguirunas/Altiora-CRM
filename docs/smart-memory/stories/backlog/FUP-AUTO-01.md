---
id: FUP-AUTO-01
title: FUP Programado — Agendamento automático de follow-up via agente IA
status: backlog
wave: 2
priority: medium
created: 2026-05-03
---

# FUP-AUTO-01 — FUP Programado via agente IA

## Contexto

Atualmente os FUPs são manuais ou via cadências fixas. O agente IA precisa conseguir cadastrar FUPs programados automaticamente — ex: "não tenho interesse agora, fale comigo em 3 meses" → agente agenda o FUP sem intervenção humana.

## Objetivo

Permitir que o agente IA agende FUPs programados com 3 tipos:
1. **Etapas CRM** — mover lead para etapa específica do kanban em data futura
2. **Agendamento** — criar reunião/encontro agendado (já parcialmente existe via `criar_agendamento`)
3. **Programado** — enviar template WhatsApp em data/hora específica

## Interface

Nova seção no painel de FUP com opção "Programado" — permite ao humano configurar e ao agente disparar via tool.

## Requisitos técnicos (a detalhar em Onda 2)

- **Tool nova**: `agendar_fup(data, tipo, mensagem|template_id|etapa_id)` — a ser criada no `ai-agent-execute`
- **Integração Omni Pro / Schedule Pro**: verificar se o agendamento de templates WhatsApp é via Omni Pro ou Schedule Pro
- **Supabase**: tabela/coluna de fila de FUPs programados (INSERT/UPDATE only — sem ALTER/CREATE de schema sem aprovação)
- **UI**: interface no painel de FUP para visualizar e criar FUPs programados

## Casos de uso imediatos

- Lead com "timing inadequado" (6 meses): agente registra FUP em vez de só bloquear IA
- Lead que pediu contato em data específica
- Nurturing automático de leads frios

## **Why:** 
O `bloquear_ia` atual é permanente — leads com timing inadequado são perdidos em vez de nutridos. FUP programado resolve o gap entre "agora não" e "perdido".

## **How to apply:**
Quando planejar Onda 2, esta é a primeira story a detalhar. Resolve também a dúvida em aberto sobre `bloquear_ia` para timing inadequado no prompt João Guirunas.
