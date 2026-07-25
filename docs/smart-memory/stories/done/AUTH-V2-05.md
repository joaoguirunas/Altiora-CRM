---
title: "AUTH-V2-05: Renomear useSimpleAuthSingleTenant → useAuth"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, refactor, P3]
related: ["[[../../project/modules/auth-tenant-bootstrap]]"]
---

# AUTH-V2-05: Renomear useSimpleAuthSingleTenant → useAuth

## Objetivo
Remover o nome legado `useSimpleAuthSingleTenant` do codebase, renomeando o arquivo e o hook para `useAuth`.

## Acceptance Criteria
- [x] AC1: `src/hooks/useAuth.ts` criado com toda a lógica (antigo useSimpleAuthSingleTenant.ts); `useSimpleAuthSingleTenant.ts` virou shim re-exportando de `useAuth.ts`
- [x] AC2: Export do hook de implementação renomeado: `useAuthLogic` (interno ao provider); `useAuth` permanece como o hook de contexto canônico
- [x] AC3: `SimpleAuthProvider.tsx` → shim re-exportando de `AuthProvider.tsx`; `AuthProvider.tsx` criado com export `AuthProvider`
- [x] AC4: `grep -r "useSimpleAuth\|SimpleAuthProvider" src/` retorna apenas os shims de compatibilidade
- [x] AC5: TypeScript compila sem erros após renomeação — 26 arquivos de import atualizados

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `src/hooks/useAuth.ts` (criado — lógica canônica)
- `src/hooks/useSimpleAuthSingleTenant.ts` (shim de compatibilidade)
- `src/components/auth/AuthProvider.tsx` (criado)
- `src/components/auth/SimpleAuthProvider.tsx` (shim de compatibilidade)
- `src/App.tsx` (import atualizado para AuthProvider)
- 26 arquivos de src/ com imports atualizados de useSimpleAuthSingleTenant → useAuth

## QA Results
<!-- QA preenche ao revisar -->
