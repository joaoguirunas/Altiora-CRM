---
title: "AUDIT-FIX-11: P1 UX — Navegação mobile e parâmetros de settings"
type: story
status: done
epic: AUDIT-FIX
complexity: S
agent: dev-ux + dev-alpha
created: 2026-04-26
updated: 2026-04-26
tags: [story, ux, navigation, p1]
related: ["[[../../audit/navigation]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-11: P1 UX — Navegação mobile e parâmetros de settings

## Objetivo
Corrigir navegação mobile quebrada e parâmetros de settings ignorados.

## Acceptance Criteria
- [ ] AC1: `MobilePerfil` não navega para rota desktop `/settings`
- [ ] AC2: `VoiceChatButton` usa `?section=ia` em vez de `?tab=ia`
- [ ] AC3: Super-admin tem item ADM pré-warmed após login (não precisa navegar para /adm primeiro)
- [ ] AC4: `P1-04` — `_adm_verified_` populado no login

## Escopo

**IN:**
- `src/pages/mobile/MobilePerfil.tsx:44` — criar `/m/settings` mínimo ou remover botão
- `src/components/bi/VoiceChatButton.tsx:170` — corrigir `?tab=ia` → `?section=ia`
- `src/components/auth/AuthProvider.tsx` ou login flow — pré-warm `_adm_verified_` para super-admin

**OUT:**
- Consolidação de Settings (AUDIT-FIX-06)

## Status
⏳ Backlog
