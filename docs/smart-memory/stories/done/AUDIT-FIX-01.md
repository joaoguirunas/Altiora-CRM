---
title: "AUDIT-FIX-01: P0 Rotas — Eliminar 404s e tela em branco pós-login"
type: story
status: done
epic: AUDIT-FIX
complexity: M
agent: dev-alpha
created: 2026-04-26
updated: 2026-04-26
tags: [story, routing, p0, sprint-1]
related: ["[[../../audit/routes]]", "[[../../audit/navigation]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-01: P0 Rotas — Eliminar 404s e tela em branco pós-login

## Objetivo
Corrigir todos os P0 de roteamento que causam tela em branco após login e 404s em fluxos críticos.

## Causa raiz
CR-1 (`/dashboard` sem index), CR-3 (Settings com 2 fontes de verdade divergentes).

## Acceptance Criteria
- [ ] AC1: Login bem-sucedido redireciona para `/bipro` com conteúdo visível
- [ ] AC2: `PageErrorBoundary.handleGoHome` navega para `/bipro`
- [ ] AC3: "Configurar WhatsApp" em CriarDisparo abre `/settings/general/integracoes`
- [ ] AC4: Botão voltar em Brandbook navega para `/settings/general/outros`
- [ ] AC5: Clicar numa empresa na listagem abre `EmpresaSingle` sem 404
- [ ] AC6: "Editar no Form PRO" navega para `/lp`
- [ ] AC7: Rota `/m/lp` não quebra o bundle mobile
- [ ] AC8: Hooks stub não retornam `[]` silenciosamente

## Escopo

**IN:**
- `src/App.tsx` — adicionar `<Route index→/bipro>` em `/dashboard`
- `src/components/auth/LoginPage.tsx` — trocar navigate('/dashboard') → '/bipro'
- `src/components/auth/ProtectedRoute.tsx` — trocar navigate('/dashboard') → '/bipro'
- `src/pages/GoogleOAuthCallback.tsx` — trocar navigate('/dashboard') → '/bipro'
- `src/pages/MicrosoftOAuthCallback.tsx` — trocar navigate('/dashboard') → '/bipro'
- `src/components/errors/PageErrorBoundary.tsx` — corrigir handleGoHome
- `src/pages/CriarDisparo.tsx:392` — trocar rota WhatsApp
- `src/pages/Brandbook.tsx:183` — trocar rota volta
- `src/pages/Clientes.tsx:611,656` — corrigir navigate('/crm/empresas/:id')
- `src/App.tsx` — adicionar Route para EmpresaSingle em /crm
- `src/components/config/FormProConfig.tsx:368` — trocar /form-pro → /lp
- `src/pages/mobile/MobileLpPro.tsx` — comentar rota /m/lp até implementação
- Remover/corrigir stubs: `useNegociosPaginados`, `useDashboardNegocios`, `useAtualizarPessoa`

**OUT:**
- Refatoração arquitetural de Settings (AUDIT-FIX-06)
- Implementação de MobileLpPro do zero

## Status
🔄 Em execução — dev-alpha
