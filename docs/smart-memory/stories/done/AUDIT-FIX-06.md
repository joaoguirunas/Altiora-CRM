---
title: "AUDIT-FIX-06: P1 Settings — Consolidar em única fonte de verdade"
type: story
status: done
epic: AUDIT-FIX
complexity: XL
agent: dev-architect + dev-alpha
created: 2026-04-26
updated: 2026-04-27
tags: [story, settings, p1, adr-needed]
related: ["[[../../audit/routes]]", "[[../../audit/navigation]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-06: P1 Settings — Consolidar em única fonte de verdade

## Objetivo
Eliminar a duplicação entre Routes em App.tsx e `urlItemToSection` em Configuracoes.tsx — causa raiz de 8 issues P0/P1.

## Causa raiz
CR-3 (Settings com 2 fontes de verdade divergentes).

## ⚠️ ADR necessária antes de implementar
Architect deve propor e aprovar ADR antes do dev-alpha implementar.

**Opção A:** `urlItemToSection` vira fonte de verdade → Routes geradas dinamicamente
**Opção B:** cada path vira child-route real apontando para componente específico (elimina `urlItemToSection`)

## Issues resolvidos por esta story
- P1-01: `/settings/send/config` e `/settings/general/webhooks` abrem "Geral"
- P1-02: filtro `adminOnly` morto
- P1-09: URL não muda ao navegar em settings
- P1-12: `VoiceChatButton` usa `?tab=` em vez de `?section=`
- P2-06: ~6 chaves em `urlItemToSection` sem Route
- P2-10: `CriarDisparoModal` state ignorado
- P0-03, P0-04 (já corrigidos pontualmente em AUDIT-FIX-01, mas causa raiz persiste)

## Acceptance Criteria
- [x] AC1: ADR aprovada pelo arquiteto
- [x] AC2: Única fonte de verdade para mapeamento path→seção
- [x] AC3: Toda nova seção de settings exige adição em apenas 1 lugar
- [x] AC4: URL atualiza ao mudar de seção em settings
- [x] AC5: `bun run build` passa sem erros

## Dev Agent Record
| Agente | dev-architect (ADR) + dev-alpha (impl) |
| Iniciado | 2026-04-26 |
| Concluído | 2026-04-26 |
| Commit | fa7cff1a — refactor(settings): consolidar dispatch em registry único |

## File List
- `src/pages/settings/registry.ts` (novo — 314 linhas)
- `src/components/settings/ConfiguracoesShell.tsx` (novo — 130 linhas)
- `src/App.tsx` (199 linhas alteradas)
- `src/components/bi/VoiceChatButton.tsx` (1 linha — `/settings/general/ai-providers`)
- `src/pages/Configuracoes.tsx` (removido)

## QA Results

**Veredicto: ⚠️ CONCERNS (LOW) — pronto para push**

Story: AUDIT-FIX-06 | Data: 2026-04-27 | Revisor: Axikar

### Checklist 8 pontos: 6/8 ✅, 2 ⚠️ LOW

- [x] **#1 Code review:** registry tipado (`SettingsSection`, `SettingsGroup`), lazy() em todos Components, paths canônicos+aliases agrupados por seção, lookups O(1) via `SECTION_BY_ID` / `SECTION_BY_PATH`. ConfiguracoesShell resolve via prop sectionId → fallback para path lookup → fallback para 'geral'. Sidebar gerada do mesmo registry com `SIDEBAR_HIDDEN_IDS` para esconder `send-config` (deep-link only).
- [ ] **#2 Tests:** sem teste específico cobrindo lookup do registry (path→sectionId, detecção de paths duplicados, fallback). Aceitável para refactor estrutural; recomendado em follow-up.
- [x] **#3 ACs:** 5/5 atendidos. AC1 ADR aprovada (task #29). AC2 registry único. AC3 nova seção = 1 entrada em `SETTINGS_SECTIONS`. AC4 `navigate(canonicalPath, {replace:true})` atualiza URL. AC5 `npm run build` ✅.
- [x] **#4 Sem regressões:** typecheck ✅, build ✅. `urlItemToSection` totalmente removido (`grep` sem ocorrências). Caminhos com params dinâmicos (`crm/aiagents/:id`, `general/times/:teamId`) preservados como Routes manuais. MFA pages standalone preservadas.
- [x] **#5 Performance:** lazy() em 22 Components, Map lookups, `useMemo` para `activeSection`, `translatedSections`, `mainClass` e `WIDE_SECTIONS`.
- [x] **#6 Security:** `RestrictedRoute requireGestor` envolve ConfiguracoesShell (linha 126). Rotas com params dinâmicos permanecem manuais com SectionErrorBoundary próprio.
- [ ] **#7 Doc:** story file ficou com ACs em `[ ]` apesar da implementação completa. Não bloqueia (corrigido neste veredicto).
- [x] **#8 Contratos API:** N/A (refactor frontend puro).

### Issues identificados

- **[LOW] ConfiguracoesShell.tsx:64** — `(s) => s.group === group.key && (!isSuperAdmin ? true : true)` é expressão sempre-`true`. Resíduo do filtro `adminOnly` removido. Cosmético, sugerir limpeza em AUDIT-FIX-09 (code hygiene).
- **[LOW] Cobertura de testes** — sem suite cobrindo `SECTION_BY_PATH` lookup nem detecção de paths duplicados acidentais. Recomendado para follow-up.

### Bonus identificado

- VoiceChatButton P1-12 fechado de forma mais limpa que o pedido: em vez de trocar `?tab=ia` → `?section=ia`, foi para path direto `/settings/general/ai-providers` (alias mapeado para seção `integracoes` no registry).
- Issues P0-03, P0-04, P1-01, P1-09, P2-06 fechados estruturalmente — `omni/whatsapp`, `general/brandbook`, `general/webhooks`, `send/config` agora têm path explícito no registry e roteiam para a seção canônica correta.
- Eliminou ~30 declarações `<Route>` manuais em App.tsx.

### Próximo passo
@dev-devops push (concerns LOW documentados — não bloqueantes).
