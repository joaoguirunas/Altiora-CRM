---
title: "ALTIORA-25: Alertas — referrals parados ou sem próxima ação (UC15)"
type: story
status: done
epic: ALTIORA-F
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, alertas, pendencias, frontend]
related: ["[[ALTIORA-03]]", "[[ALTIORA-10]]", "[[ALTIORA-11]]", "[[ALTIORA-24]]"]
---

# ALTIORA-25: Alertas — referrals parados ou sem próxima ação (UC15)

## Acceptance Criteria
- [x] AC1: Painel "Pendências Altiora" em Negocios.tsx (visível apenas Gestor/Admin) lista 3 categorias: "Sem Closer", "Sem próxima ação", "Parados".
- [x] AC2: Cada item tem ações rápidas: "Atribuir Closer" (callback), "Definir ação" (callback), "Ver ficha" (navigate).
- [x] AC3: Polling de 30s via refetchInterval no useAltioraPendencias.
- [x] AC4: Badge com contagem de pendências no header do painel.
- [x] AC5: DIAS_PARADO_DEFAULT = 3 (TODO: configuração via Settings page — V2).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/hooks/useAltioraPendencias.ts` — useAltioraPendencias (3 categorias, polling 30s), useAltioraPendenciasCount
- `src/components/negocios/AltioraPendenciasPanel.tsx` — painel com seções, rows com hover actions
- `src/pages/Negocios.tsx` — painel adicionado após Kanban/Lista para isAltiora && isManager

## QA Results
<!-- QA preenche ao revisar -->
