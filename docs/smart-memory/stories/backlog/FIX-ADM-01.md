---
title: "FIX-ADM-01: Rollback em adm-create-user + remover hints de secrets em plaintext"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, adm-control-plane, debt, P2, security]
related: ["[[../../project/modules/adm-control-plane]]"]
---

# FIX-ADM-01: Rollback em adm-create-user + remover hints de secrets em plaintext

## Objetivo
Adicionar rollback transacional na edge fn `adm-create-user` (hoje deixa órfãos em caso de falha) e remover os hints de secrets de 12 chars que ficam em plaintext no banco.

## Acceptance Criteria
- [ ] AC1: `adm-create-user` tem rollback explícito — se qualquer step falhar, todos os registros parciais são removidos
- [ ] AC2: Nenhum hint de secret em plaintext (12 chars) armazenado em `adm_clients` ou tabelas relacionadas
- [ ] AC3: Criação de usuário falha graciosamente com mensagem de erro clara (sem órfãos no banco)
- [ ] AC4: Migration de limpeza de hints existentes criada (ou estratégia documentada)

## Escopo

**IN:**
- `supabase/functions/adm-create-user/index.ts` — adicionar try/catch + cleanup em caso de erro
- Remover ou mascarar completamente os hints de secrets (não apenas os 12 chars)
- Verificar se outros flows de criação (adm-create-tenant?) têm o mesmo problema

**OUT:**
- Refactor completo do fluxo de onboarding
- Mudança no sistema de pgcrypto para secrets

## Contexto Técnico
Deep-dive adm-control-plane: `adm-create-user` sem rollback deixa usuários parcialmente criados em falhas de rede. Hints de secrets em plaintext (12 chars visíveis) violariam políticas de segurança. Ver `docs/smart-memory/project/modules/adm-control-plane.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-architect (zael) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/adm-create-user-rollback |

## File List

## QA Results
