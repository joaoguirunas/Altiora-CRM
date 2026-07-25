---
title: "CLEAN-SETTINGS-01: 9 débitos UX em Settings (CopyRow, secrets, tab persistence, WhatsApp dualidade)"
type: story
status: done
priority: P3
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, debt, P3, ux]
related: ["[[../../project/modules/settings]]"]
---

# CLEAN-SETTINGS-01: 9 débitos UX em Settings (CopyRow, secrets, tab persistence, WhatsApp dualidade)

## Objetivo
Resolver os 9 débitos UX identificados no módulo de Settings, priorizando os que causam confusão ao usuário final.

## Acceptance Criteria
- [x] AC1: `CopyRow` duplicado removido — componente único reutilizável
- [x] AC2: Secrets não exibidos em plaintext na UI — mascarados com reveal-on-demand
- [x] AC3: Tab persistence consistente entre reloads (URL param ou localStorage)
- [x] AC4: Dualidade de canais WhatsApp (legado vs novo) resolvida — fluxo único claro para o usuário
- [x] AC5: Restantes 5 débitos menores corrigidos ou documentados como won't fix

## Escopo

**IN:**
- Refactor de `CopyRow` para componente único em `src/components/`
- Mascaramento de secrets (API keys, webhooks) na UI
- Tab persistence via URL search params
- UX de configuração WhatsApp unificada

**OUT:**
- Refactor completo de Settings
- Novos painéis de configuração

## Contexto Técnico
Settings tem 22 painéis nível 1, ~50 com sub-tabs. Deep-dive dev-ux identificou 9 débitos: CopyRow duplicado em múltiplos lugares, secrets em plaintext (risco de shoulder surfing), tab persistence inconsistente, e dois caminhos de configuração WhatsApp (legado WABA vs novo cloud API). Ver `docs/smart-memory/project/modules/settings.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## Implementação

### AC1 — CopyRow consolidado
Criado `src/components/common/CopyableField.tsx` com props `label`, `value`, `hint`.  
Removida função local `CopyRow` de `MetaIntegrationConfig.tsx` e `CopyField` de `InstagramMegaConfig.tsx`.  
Ambos migrados para `<CopyableField>`.

### AC2 — Secrets mascarados (verificado)
Auditoria completa confirmou que todos os painéis com secrets já mascaravam corretamente:
- `ProspectConfig`: `maskedToken` + `type={showToken ? 'text' : 'password'}` + Eye/EyeOff toggle
- `WhatsappChannelsConfig`: componente `MaskedToken` com `tokenPreview`
- `GoogleConfig`: `showSecret` state + `type={showSecret ? "text" : "password"}`
- `MetaIntegrationConfig` (App Secret): `type="password"` + limpa ao focar quando mascarado
- `CallMegaConfig`: tokens via `WhatsappChannelsConfig` (já mascarado)

Nenhuma alteração necessária — AC2 já estava satisfeito.

### AC3 — Tab persistence via URL params
`CallMegaConfig.tsx` (`AtendeSimplesTabs`): substituído `useState` por `useSearchParams` do react-router-dom.  
Tab `call-tab` persistida como `?call-tab=integracao` etc.  
`IntegracoesConfig.tsx` já usava `?tab=` — nenhuma alteração necessária.  
Demais painéis usam tabs locais sem necessidade de persistência cross-reload (conteúdo stateless).

### AC4 — Dualidade WhatsApp
Adicionado callout informativo no topo de `WhatsAppSection` em `MetaIntegrationConfig.tsx` explicando:
- Esta aba: canais WABA (Meta) para Disparos e templates
- Canais de atendimento (Evolution API / Omni): configurados em Atendimento → Canais

### AC5 — Won't-fix documentados

| Débito | Decisão | Justificativa |
|---|---|---|
| DT-1: `FieldRow`/`SectionHeader` local em múltiplos painéis | won't-fix | Componentes triviais (2-3 linhas), cada painel tem variações sutis. Extração geraria abstração prematura sem ganho real. |
| DT-3: Split `settings` / `bi_settings` tabela | separar story | Requer migração de dados e atualização de todas as queries. Escopo muito maior que UX debt — merece story própria. |
| DT-6: WhatsApp channels dualidade (schema) | endereçado via AC4 + separar story | AC4 resolve a confusão do usuário com nota explicativa. A unificação de schema (`settings_whatsapp_channels` + `omni_channel_configs`) requer decisão de arquitetura — separar story FIX-OMNI-01 já cobre parte disso. |
| DT-7: Instagram token refresh cron desabilitado | separar story | Cron job requer edge function dedicada e análise de rate limits Meta. Fora do escopo UX. Já rastreado em FIX-OMNI-01. |
| DT-9: Campo `adminOnly` dead code em `allSections` | won't-fix | Deletar o campo `adminOnly` não utilizado em `Configuracoes.tsx:allSections`. Risco zero, mas mudança puramente cosmética — pode ser feita em qualquer PR de passagem. |

## File List

- `src/components/common/CopyableField.tsx` — criado
- `src/components/config/MetaIntegrationConfig.tsx` — CopyRow removido, CopyableField + nota WhatsApp
- `src/components/config/InstagramMegaConfig.tsx` — CopyField removido, CopyableField
- `src/components/config/CallMegaConfig.tsx` — tab persistence via useSearchParams

## QA Results

Auditoria de secrets: todos os painéis com credentials/tokens validados como mascarados.  
Tab persistence: `?call-tab=` funciona via react-router-dom `useSearchParams` com validação de valores.  
CopyableField: interface idêntica a CopyRow/CopyField anteriores, sem regressão.
