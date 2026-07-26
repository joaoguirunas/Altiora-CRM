---
title: "FIX-COACH-01: Corrigir mismatch de nome de view (coach_meeting_evaluations vs meeting_evaluations)"
type: story
status: done
priority: P1
complexity: S
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-04-22
tags: [story, coach-pro, bug, P1]
related: ["[[../../project/modules/coach-pro]]"]
---

# FIX-COACH-01: Corrigir mismatch de nome de view (coach_meeting_evaluations vs meeting_evaluations)

## Objetivo
Unificar o nome da view/tabela de avaliações de reunião usada pelos hooks do Coach PRO — eliminar o risco de crash no Dashboard em produção.

## Acceptance Criteria
- [ ] AC1: Todos os hooks do coach-pro referenciam o mesmo nome de objeto (`meeting_evaluations` ou `coach_meeting_evaluations` — decidir qual é canônico)
- [ ] AC2: View/tabela canônica existe no schema Supabase (verificar migrations)
- [ ] AC3: Dashboard de avaliações carrega sem erro 400/500 em staging
- [ ] AC4: Se view foi renomeada, migration de rename criada e aplicada

## Escopo

**IN:**
- Auditar todos os hooks em `src/` que referenciam `coach_meeting_evaluations` ou `meeting_evaluations`
- Decidir nome canônico (preferir o que tem migration mais recente)
- Corrigir todos os usos inconsistentes
- Criar migration se necessário para alinhar schema

**OUT:**
- Refactor do modelo de dados de avaliações
- Novas features de coach

## Contexto Técnico
Descoberto no deep-dive: parte dos hooks usa `coach_meeting_evaluations` (view) e parte usa `meeting_evaluations` (tabela). Se a view não existe em algum tenant, o Dashboard crasha em runtime. Ver `docs/smart-memory/project/modules/coach-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer (Bythak) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## Resolution

**Resolved by audit, no migration needed.**

Investigation (2026-07-25):
- `grep -rn "coach_meeting_evaluations\|meeting_evaluations" src/ --include="*.ts" --include="*.tsx"` → 0 results in any hook/component (only `types.ts` stale types)
- Migration `20260609000000_drop_coach_pro_and_call_pro.sql` dropped `meeting_evaluations` table and `v_coaching_insights` view (with CASCADE)
- No Coach PRO hooks remain in `src/` — frontend was cleaned up in squad-a removal
- AC2 (view exists in schema): `meeting_evaluations` was the canonical table, now dropped by Coach Pro removal
- AC3 (dashboard loads): CoachPRO dashboard no longer exists
- The mismatch issue (`coach_meeting_evaluations` vs `meeting_evaluations`) was made irrelevant by the full Coach Pro drop

**Verdict: CLOSED — superseded by `20260609000000_drop_coach_pro_and_call_pro.sql`.**

## File List

(none — no changes needed)

## QA Results

```
VEREDICTO: WAIVED
Story: FIX-COACH-01 | Data: 2026-07-25
Issue aceito: Story supersedida — Coach PRO completamente removido.
Justificativa técnica:
  Migration 20260609000000_drop_coach_pro_and_call_pro.sql dropou a tabela
  meeting_evaluations (e view v_coaching_insights via CASCADE).
  grep src/ para coach_meeting_evaluations e meeting_evaluations → 0 resultados
  (exceto tipos gerados em types.ts, que não geram runtime crash).
  Nenhum hook, componente ou rota de Coach PRO existe no frontend.
  O mismatch de nomes que motivou a story se tornou irrelevante com o drop.
Ação futura: nenhuma — problema eliminado na raiz.
```

---
Auto-verified by dev-data-engineer (Bythak): 0 remaining references to `coach_meeting_evaluations` or hooks that read `meeting_evaluations` outside of `types.ts`.
