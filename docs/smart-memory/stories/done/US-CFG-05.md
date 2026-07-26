---
title: "US-CFG-05: Central de Notificações — preferências por canal e evento"
type: story
status: done
epic: settings
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, notifications, P3]
related: ["[[../../project/modules/settings]]"]
---

# US-CFG-05: Central de Notificações — preferências por canal e evento

## Objetivo
Permitir que cada usuário configure quais eventos geram notificações e por qual canal (in-app, email, WhatsApp), substituindo a ausência atual de preferências granulares.

## Acceptance Criteria
- [x] AC1: Nova rota Settings > Notificações exibe matriz de preferências: linhas = tipos de evento, colunas = canais (in-app, email, WhatsApp) — switches
- [x] AC2: Tipos de evento: lead_assigned, followup_due, meeting_scheduled, coach_evaluation_ready, transcript_ready, word_spotting_triggered
- [x] AC3: Preferências salvas em tabela `user_notification_preferences` (user_id, event_type, channel, enabled) — RLS: usuário lê/escreve apenas suas próprias preferências
- [x] AC4: Hook `useNotificationPreferences()` exposto — consumido pelo sistema de envio existente antes de disparar notificação
- [x] AC5: Toggle global "Pausar todas as notificações" por X horas (1h, 4h, 8h, 24h) salvo em `user_notification_preferences.snoozed_until`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## File List

- `supabase/migrations/20260423005000_user_notification_preferences.sql` — tabela + enum notification_event_type + notification_channel + RLS
- `src/hooks/useNotificationPreferences.ts` — useNotificationPreferences, useUpdateNotificationPreference, useSnoozeNotifications + exports ALL_EVENT_TYPES/ALL_CHANNELS/EVENT_LABELS/CHANNEL_LABELS
- `src/components/config/NotificacoesConfig.tsx` — SnoozeBanner (pausa global) + PreferencesMatrix (grid switches por evento/canal)
- `src/pages/Configuracoes.tsx` — lazy import + nav entry "notificacoes" (Bell icon) + renderContent case

## QA Results
<!-- QA preenche ao revisar -->
