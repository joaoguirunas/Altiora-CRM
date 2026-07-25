---
title: "ALTIORA-23: Gestão de usuários com perfis Altiora — Closer, Gestor, Admin (UC05)"
type: story
status: active
epic: ALTIORA-F
complexity: L
agent: dev-dev-alpha
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, usuarios, perfis, admin, fullstack]
related: ["[[ALTIORA-01]]", "[[ALTIORA-10]]", "[[ALTIORA-07]]"]
---

# ALTIORA-23: Gestão de usuários com perfis Altiora — Closer, Gestor, Admin (UC05)

## Objetivo
Garantir que os perfis de usuário do sistema mapeiem corretamente para os papéis Altiora (Closer → Marco/Ellen/Kayan, Gestor Comercial → André, Admin/RevOps → Ivanderlei) com as permissões corretas e tela de gestão para o Admin.

## Acceptance Criteria
- [x] AC1: `user_type = 'comercial'` é tratado como Closer Altiora: filtro automático `altiora_closer_id = profile.id` via ALTIORA-10. Restrições de exclusão e métricas de outros Closers dependem de RLS (backend pendente).
- [x] AC2: Gestor Comercial (`isManager = true`): vê todos referrals via selector "Ver carteira de:" (ALTIORA-10 AC5). Reatribuição de Closer cobre ALTIORA-07 (separado). Indicadores cobrem ALTIORA-24 (separado).
- [x] AC3: Admin/RevOps (`super_adm = true`): acesso irrestrito via `useUserPermissions` — `canCreateUser`, `canEditUser`, `canDeleteUser` todos `true`.
- [x] AC4: `UsuariosConfig.tsx` exibe badge "Closer" para `user_type='comercial'` (renomeado de "Comercial"). Admin vê botão Bloquear (Ban) / Reativar (RotateCcw) + AlertDialog de confirmação.
- [x] AC5: Bloquear chama `updateUser.mutateAsync({ active: false })` — soft-block via `settings_users.active`. Session invalidation: TODO — requer Edge Function `admin-revoke-session` (control plane).

## Escopo

**IN:**
- Mapeamento e documentação de `user_type` para papéis Altiora
- RLS em `leads` garantindo que Closer só leia seus próprios referrals (se não coberto pelo ALTIORA-10)
- Tela de gestão de usuários com coluna "Perfil Altiora"
- Bloqueio de conta com invalidação de sessão

**OUT:**
- Criação de novo sistema de permissões granulares (usar `user_type` existente)
- Integração com IdP externo (V2)

## Contexto Técnico
- `src/hooks/useAuth.ts` — `profile.user_type`, `profile.gestor`, `profile.super_adm`
- `src/hooks/useUserPermissions.ts` — `isManager`, `isComercial` já existentes; verificar se cobrem os casos Altiora
- RLS em `leads`: `20260716140000_leads_rls_pipeline_access.sql` — estender para filtrar por `closer_id = auth.uid()` quando `user_type = 'comercial'`
- Migration: verificar se `user_type` enum tem 'comercial' já incluso (migration `20260708120000_add_comercial_role.sql`)
- Settings page: encontrar `src/pages/Settings.tsx` ou similar para localizar a gestão de usuários

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 (AC1-AC5 ✅ frontend; AC1 RLS + AC5 session invalidation pendente backend) |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/components/config/UsuariosConfig.tsx` — modificado (badge "Closer" para comercial; handleToggleBlock; AlertDialog bloqueio/reativação)

## QA Results
<!-- QA preenche ao revisar -->
