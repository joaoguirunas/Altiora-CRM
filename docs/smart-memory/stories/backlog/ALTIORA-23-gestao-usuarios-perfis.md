---
title: "ALTIORA-23: Gestão de usuários com perfis Altiora — Closer, Gestor, Admin (UC05)"
type: story
status: backlog
epic: ALTIORA-F
complexity: L
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, usuarios, perfis, admin, fullstack]
related: ["[[ALTIORA-01]]", "[[ALTIORA-10]]", "[[ALTIORA-07]]"]
---

# ALTIORA-23: Gestão de usuários com perfis Altiora — Closer, Gestor, Admin (UC05)

## Objetivo
Garantir que os perfis de usuário do sistema mapeiem corretamente para os papéis Altiora (Closer → Marco/Ellen/Kayan, Gestor Comercial → André, Admin/RevOps → Ivanderlei) com as permissões corretas e tela de gestão para o Admin.

## Acceptance Criteria
- [ ] AC1: Perfil `user_type = 'comercial'` é tratado como Closer Altiora: vê somente seus referrals (ALTIORA-10), pode registrar contato/reuniões/R1/R2/R3 mas não pode excluir registros nem ver métricas de outros Closers.
- [ ] AC2: Perfil mapeado como Gestor Comercial Altiora (verificar via `gestor = true` ou novo `user_type = 'gestor_comercial'`): vê todos os referrals do pipeline Altiora, pode reatribuir Closer, pode encerrar como Perdido e Reabrir, pode acessar indicadores (ALTIORA-24).
- [ ] AC3: Admin/RevOps (`super_adm = true`): acesso irrestrito, pode corrigir dados, gerenciar usuários, ver integração (ALTIORA-07).
- [ ] AC4: Tela de gestão de usuários (existente em Settings) lista os usuários do tenant Altiora com coluna "Perfil Altiora" e botão "Editar perfil" — Admin pode criar, bloquear e reativar contas, com registro em `auth_events_log`.
- [ ] AC5: Usuário bloqueado (`ativo = false`) não consegue fazer login — sessão existente é invalidada pelo Supabase Auth ao revogar o token (via `supabase.auth.admin.signOut` ou RLS que retorna 401).

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
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
