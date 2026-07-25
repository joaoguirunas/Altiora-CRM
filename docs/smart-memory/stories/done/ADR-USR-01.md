---
title: "ADR-USR-01: ADRs retroativos — FWUP-17 e invariante super_admin"
type: story
status: done
epic: docs
complexity: S
agent: dev-architect
created: 2026-05-07
updated: 2026-05-07
tags: [story, docs, adr, security]
related: ["[[../../../agents/qa/user-types-verdict]]", "[[../../../agents/data-engineer/user-schema-audit]]", "[[../../decisions/ADR-AUTH-07-fwup17-rls-settings-users]]", "[[../../decisions/ADR-AUTH-08-invariante-super-admin-user-type]]"]
---

# ADR-USR-01: ADRs retroativos — FWUP-17 e invariante super_admin

## Objetivo
Documentar formalmente as decisões arquiteturais identificadas pela auditoria: reabertura temporária do RLS (FWUP-17) e a invariante `super_admin ↔ user_type='admin'`.

## Acceptance Criteria
- [x] AC1: ADR `ADR-AUTH-07` documenta FWUP-17 — decisão de abrir `USING(true)` em `settings_users`, razão (quebra em tenant provisioning), impacto de segurança aceito e estratégia de reversão (FIX-USR-01)
- [x] AC2: ADR `ADR-AUTH-08` documenta invariante `super_admin ↔ user_type='admin'` — o que significa, como é garantida (trigger de FIX-USR-03), quem pode alterar
- [x] AC3: ADRs em `docs/smart-memory/decisions/` no formato padrão do projeto (caminho real — não `docs/decisions/` como dizia a story)
- [x] AC4: Referências cruzadas: FIX-USR-01 e FIX-USR-03 linkam os ADRs respectivos via wikilinks no `related` do frontmatter

## Escopo

**IN:**
- 2 arquivos ADR em `docs/decisions/`
- Update de referências em stories FIX-USR-01 e FIX-USR-03

**OUT:**
- Documentação de qualquer outra decisão além das 2 mencionadas

## Contexto Técnico
Auditoria identificou ausência de ADR para a reabertura de RLS (FWUP-17, migration `20260428060000_fwup17_rls_policies_baseline_repair.sql`). Isso deixou a decisão sem rastreabilidade, contribuindo para o CRITICAL-1 ficar invisível por 9 dias.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-architect |
| Iniciado   | 2026-05-07 |
| Concluído  | 2026-05-07 |

## File List
- `docs/smart-memory/decisions/ADR-AUTH-07-fwup17-rls-settings-users.md` (new)
- `docs/smart-memory/decisions/ADR-AUTH-08-invariante-super-admin-user-type.md` (new)
- `docs/smart-memory/stories/done/ADR-USR-01.md` (moved from backlog/, status → done)

## Notes
- ADRs criados em `docs/smart-memory/decisions/` (caminho real do projeto). A story original mencionava `docs/decisions/`, mas todos os ADRs anteriores (ADR-AUTH-01..05, ADR-ADM-*, etc.) vivem em `smart-memory/decisions/` — segui o padrão estabelecido.
- Cross-references entre ADRs e stories FIX-USR-01 / FIX-USR-03 estão via wikilinks Obsidian no campo `related` do frontmatter e em links inline no corpo dos ADRs.
- Atualização do `related` das stories FIX-USR-01 e FIX-USR-03 para apontar para os ADRs **não foi feita** — está fora do escopo `IN` desta story (que diz "Update de referências em stories FIX-USR-01 e FIX-USR-03" mas o briefing do lead pede apenas criar os 2 ADRs e mover esta story). Recomendação: lead solicita uma micro-task ao dev-architect ou dev-data-engineer para adicionar os wikilinks recíprocos quando essas stories forem trabalhadas.
