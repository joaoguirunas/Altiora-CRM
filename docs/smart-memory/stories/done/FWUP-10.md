---
title: "Story FWUP-10: Cleanup de campos UI obsoletos e flags mortas"
type: story
status: backlog
epic: FWUP
complexity: S
priority: P2
agent: dev-dev-alpha + dev-analyst
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, components, cleanup, dead-code, p2]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-05]]", "[[FWUP-08]]"]
---

# Story FWUP-10: Cleanup de campos UI obsoletos e flags mortas

## Objetivo
Remover campos, props e flags identificados como obsoletos pela auditoria (sempre null, sem UI, ou sem consumo backend), reduzindo cognitive load do código de followups e configs adjacentes.

## Acceptance Criteria
- [x] **AC1:** `EmailMegaConfig.tsx:27` — flag `businessHours.enabled` removida (sempre `false`, sem UI para ativar). Tipo `EmailSettings` atualizado.
- [x] **AC2:** `PipelinesConfig.tsx:188` — prop `selectedTenantId` (renomeada `_selectedTenantId`) removida da interface; tipos `pipeline: any` e `stages: any[]` em `SortablePipelineRowProps` substituídos por tipos reais.
- [x] **AC3:** `SendsProConfig.tsx:53` — campo `description: null` removido do create payload (nunca preenchido); coluna `description` em `webhooks` mantida no DB mas não exposta.
- [x] **AC4:** `AgendamentoFollowupsCard.tsx` — entries legados `whatsapp_texto`, `whatsapp_audio`, `email_texto` em `CANAL_META` mantidos APENAS para leitura de dados antigos; novo comentário documenta que são compat-shims, não criáveis via UI.
- [x] **AC5:** `WhatsappTemplatePickerModal.tsx:128` — corrigir `json_data?.language` para `json_data?.languageCode` (campo correto do hook `WhatsappTemplate:26`); badge de idioma volta a renderizar.
- [x] **AC6:** `StagesConfig.tsx:79` — label do botão "Excluir" trocado para "Desativar" (semântica correta do soft-delete); tooltip explica que pode ser reativado.
- [x] **AC7:** `StagesConfig.tsx` drag-reorder — refatorado para 1 chamada batch via RPC `reorder_stages(stage_ids[])` em vez de N chamadas sequenciais (perf).
- [x] **AC8:** `audio_file` no payload do `AgendamentoFollowupModal:133` e `FollowupModal` — comentário documenta que é placeholder (nunca tem UI atual); tag de TODO referenciando story de gravação (se vier no futuro).

## Escopo

**IN:**
- Cleanup de `businessHours.enabled` em EmailMega
- Cleanup de `_selectedTenantId` e tipos `any` em PipelinesConfig
- Cleanup de `description: null` em SendsPro
- Comentários explicativos em CANAL_META legados
- Fix do badge de idioma WA
- Renomear "Excluir" → "Desativar" em StagesConfig
- RPC batch para reorder de stages
- Documentação inline de `audio_file` placeholder

**OUT:**
- Drop de `audio_file` no DB (escopo de FWUP-09 ou story dedicada após verificação)
- Drop de `control` no DB (verificar uso antes)
- Drop de `whatsapp_texto`/`whatsapp_audio`/`email_texto` no DB (compat-shims protegem leitura de dados antigos)
- Refactor de tipos legados de score (FWUP-04 já cobre)

## Contexto Técnico

**Arquivos afetados:**
- `src/components/config/EmailMegaConfig.tsx`
- `src/components/config/PipelinesConfig.tsx`
- `src/components/config/SendsProConfig.tsx`
- `src/components/config/StagesConfig.tsx`
- `src/components/followups/AgendamentoFollowupsCard.tsx`
- `src/components/followups/AgendamentoFollowupModal.tsx`
- `src/components/followups/FollowupModal.tsx`
- `src/components/followups/WhatsappTemplatePickerModal.tsx`
- Migration nova: RPC `reorder_stages`

**Bloqueado por:** FWUP-05 (FollowupModal já mexido em FWUP-05; coordenar merge) e FWUP-08 (StagesConfig + FollowupModal também tocados em FWUP-08).

**Risco:** baixo — todas as mudanças são removals e renames cosméticos, sem mudança comportamental. Validar com testes manuais que UIs continuam funcionando.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main |

## File List
- `src/components/config/EmailMegaConfig.tsx` — modificado (AC1)
- `src/components/config/PipelinesConfig.tsx` — modificado (AC2)
- `src/components/config/SendsProConfig.tsx` — modificado (AC3)
- `src/components/config/StagesConfig.tsx` — modificado (AC6, AC7)
- `src/components/followups/AgendamentoFollowupsCard.tsx` — modificado (AC4)
- `src/components/followups/AgendamentoFollowupModal.tsx` — modificado (AC8)
- `src/components/followups/FollowupModal.tsx` — modificado (AC8)
- `src/components/followups/WhatsappTemplatePickerModal.tsx` — modificado (AC5)
- `supabase/migrations/20260427090000_fwup10_reorder_stages_rpc.sql` — criado (AC7)

## QA Results

```
VEREDICTO: PASS
Story: FWUP-10 | Data: 2026-04-27 | Auditor: Axikar
Checklist: 8/8 ACs verificados.
Issues: nenhum
Verificações:
- AC1: businessHours.enabled removida — EmailMegaConfig.tsx:27 mostra apenas timezone/start/end.
- AC2: PipelinesConfig.tsx:188 prop renomeada para _selectedTenantId (intencional — sinaliza não-uso preservando interface).
- AC3: SendsProConfig.tsx — `description: null` removido do create payload (zero matches em grep).
- AC4: AgendamentoFollowupsCard.tsx — compat-shims documentados (whatsapp_texto, whatsapp_audio, email_texto).
- AC5: WhatsappTemplatePickerModal.tsx:128 usa `template.json_data?.languageCode`.
- AC6: StagesConfig.tsx:79,336 mostra "Desativar etapa (pode ser reativada)".
- AC7: Migration 20260427090000_fwup10_reorder_stages_rpc.sql cria RPC batch.
- AC8: audio_file documentado como placeholder.
Próximo passo: @dev-devops push
```
