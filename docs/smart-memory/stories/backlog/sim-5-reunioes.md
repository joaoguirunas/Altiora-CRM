---
title: "Story sim-5: Reuniões e agendamentos"
type: story
status: backlog
epic: joao-guirunas-sim-dados-apresentacao
complexity: M
agent: dev-architect
created: 2026-05-02
updated: 2026-05-10
tags: [story, simulation, joao-guirunas-demo, seed, schedule]
related: ["[[../BACKLOG]]", "[[sim-1-dados-config-base]]", "[[sim-2-leads-contacts]]", "[[sim-4-deals-vendas]]"]
---

# Story sim-5: Reuniões e agendamentos

## Objetivo
Popular `meetings` (e opcionalmente `meeting_records`) com agenda realista do módulo SCHEDULE PRO: reuniões passadas (realizadas, no-shows, canceladas), reuniões hoje, e reuniões futuras agendadas — vinculadas aos leads de sim-2 e correlacionadas com o funil de sim-4.

## Acceptance Criteria
- [ ] AC1: **Mínimo 40 reuniões** em `meetings`, vinculadas a `lead_id` (subset dos leads de sim-2). Pelo menos 20 leads únicos têm reunião.
- [ ] AC2: **Distribuição temporal**:
  - **Passadas (~25)**: entre `2026-04-01` e `2026-05-01`, mix de status `realized`, `no_show`, `canceled`.
  - **Hoje (~5)**: `start_time` no dia `2026-05-02`, status `confirmed`.
  - **Futuras (~10)**: entre `2026-05-03` e `2026-05-15`, status `scheduled`/`confirmed`.
- [ ] AC3: **Status mix realista** entre passadas: 60% `realized`, 20% `no_show`, 15% `canceled`, 5% `rescheduled`.
- [ ] AC4: **Meeting types diversificados**: 50% `discovery`, 25% `demo`, 15% `closing`, 10% `followup`.
- [ ] AC5: **Atribuição a usuários demo** distribuída entre os 3 (`user_id`); horários úteis realistas (entre 09:00 e 18:00 BRT, evitar fim de semana exceto poucos casos).
- [ ] AC6: **Correlação com vendas de sim-4**: dos 20 leads `won`, ao menos 15 tenham reunião `realized` antes do `won_at`. Demonstra "reunião → fechamento".
- [ ] AC7: **No-shows / canceladas correlacionadas com losts**: dos 18 leads `lost`, ao menos 5 tenham reunião com status `no_show` ou `canceled` (motivo de perda "Não respondeu").
- [ ] AC8: **Mínimo 10 reuniões** com `zoom_join_url` ou `id_calendar` preenchido (URLs fake mas com formato correto, ex.: `https://us02web.zoom.us/j/87654321234?pwd=demo`).
- [ ] AC9: **Mínimo 5 reuniões realized** com entrada em `meeting_records` contendo `transcript_text` (ao menos 1–2 parágrafos PT-BR realistas) e `duration_sec` (1800–3600s). Alimenta CoachPRO se demonstrado.
- [ ] AC10: Script idempotente; 100% no tenant `wotuyxscsfralqpoiyfv`.

## Escopo

**IN:**
- Arquivo SQL `supabase/seeds/sim-5-reunioes.sql`.
- INSERT em `meetings` com `lead_id`, `user_id`, `start_time`, `end_time`, `status`, `meeting_type`, `tenant_id`.
- INSERT em `meeting_records` para subset (5+) com transcript text mock realista.
- Opcional: 1–2 entries em `meeting_followup_queue` para demonstrar queue ativa.

**OUT:**
- Conexões reais Google Cal / Teams / Zoom (`user_calendar_connections`) — não há credenciais reais.
- Avaliações CoachPRO (`meeting_evaluations`, `evaluation_section_results`, etc.) — escopo separado se necessário (sim-7 futura).
- Eventos sincronizados de calendário externo (`google_cal_events`) — fora do MVP.
- Booking público (capability tokens, `booking_token_jti_usage`) — não relevante para demo histórica.
- Schedule automations triggered — assumir que as automações já existem mas nada precisa rodar para a demo.

## Contexto Técnico

**Tabela principal:** `meetings`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid | gen_random_uuid() |
| lead_id | uuid | FK → leads (de sim-2) |
| user_id | uuid | FK → settings_users (de sim-1) |
| start_time / end_time | timestamptz | duração 30–60 min |
| status | text | scheduled/confirmed/realized/no_show/canceled/rescheduled |
| source | text | NULL para criadas pelo CRM, 'google' para externas (deixar NULL aqui) |
| meeting_type | text | discovery/demo/closing/consulting/mentoring/qbr/followup/other |
| zoom_join_url | text | URL fake formato Zoom |
| id_calendar / google_meet_link | text | opcional |
| tenant_id | uuid | `wotuyxscsfralqpoiyfv` |

**Tabela secundária:** `meeting_records`
| Coluna | Notas |
|---|---|
| meeting_id | FK obrigatório |
| transcript_text | 1-2 parágrafos PT-BR mock |
| duration_sec | 1800–3600 |
| audio_url | URL fake opcional |
| highlights | text[] com 2-3 highlights mock ("Cliente demonstrou interesse em plano enterprise", "Pediu follow-up em 1 semana") |

**Estratégia de implementação:**
```sql
-- 1. Pegar leads que serão "reunidos"
WITH leads_com_reuniao AS (
  SELECT id, status, won_at, created_at,
         ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM leads
  WHERE tenant_id = 'wotuyxscsfralqpoiyfv'
    AND (status = 'won' OR status = 'lost' OR random() < 0.4)
  LIMIT 30
),
usuarios_demo AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM settings_users
  WHERE tenant_id = 'wotuyxscsfralqpoiyfv'
)
INSERT INTO meetings (lead_id, user_id, start_time, end_time, status, meeting_type, tenant_id, ...)
SELECT
  l.id,
  (SELECT id FROM usuarios_demo WHERE rn = ((l.rn % 3) + 1)),
  -- start_time: para wons, antes do won_at; para losts, alguns no_show
  CASE
    WHEN l.status = 'won' THEN l.won_at - INTERVAL '5 days' + (random() * INTERVAL '3 days')
    ELSE l.created_at + INTERVAL '2 days' + (random() * INTERVAL '5 days')
  END,
  -- end_time: +30/60min
  ...
  CASE
    WHEN l.status = 'won' THEN 'realized'
    WHEN l.status = 'lost' AND random() < 0.3 THEN 'no_show'
    ELSE 'realized'
  END,
  ...
FROM leads_com_reuniao l;
```

**Dependências:**
- **Bloqueada por** sim-1 (users), sim-2 (leads), sim-4 (status won/lost para correlação).

**Atenção a constraints:**
- `meetings_zoom_meeting_id_idx` UNIQUE WHERE not null — usar zoom_meeting_id único por reunião se preencher (`'demo_zoom_' || meeting.id`).
- `meeting_records.tldv_meeting_id` UNIQUE WHERE not null — deixar NULL para evitar conflitos.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
