---
title: "AUTH-V2-04: Centralizar PUBLIC_ROUTES em src/utils/constants.ts"
type: story
status: done
epic: auth-v2
complexity: S
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, refactor, P3]
related: ["[[../../project/modules/auth-tenant-bootstrap]]"]
---

# AUTH-V2-04: Centralizar PUBLIC_ROUTES em src/utils/constants.ts

## Objetivo
Eliminar duplicação de listas de rotas públicas entre `AppContent` e outros pontos do código, centralizando em uma única constante importável.

## Acceptance Criteria
- [x] AC1: `src/utils/constants.ts` exporta `PUBLIC_ROUTES: string[]` com todas as rotas públicas
- [x] AC2: `AppContent` em `App.tsx` importa `isPublicRoute` de constants e usa `isPublicRoute(location.pathname)`
- [x] AC3: Sem lista de rotas duplicada em ProtectedRoute (não usava lista — usava checks pontuais, OK)
- [x] AC4: Array `PUBLIC_ROUTES` local em `App.tsx` removido
- [x] AC5: Nenhuma regressão — mesmas rotas cobertas

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `src/utils/constants.ts` (PUBLIC_ROUTES + isPublicRoute adicionados)
- `src/App.tsx` (PUBLIC_ROUTES local removido, importa isPublicRoute de constants)

## QA Results
<!-- QA preenche ao revisar -->
