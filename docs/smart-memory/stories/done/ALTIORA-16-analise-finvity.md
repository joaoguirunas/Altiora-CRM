---
title: "ALTIORA-16: Análise Finvity — registrar link/anexo, dores e produtos sugeridos (UC25)"
type: story
status: done
epic: ALTIORA-D
complexity: S
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, finvity, analise, frontend]
related: ["[[ALTIORA-15]]", "[[ALTIORA-17]]", "[[ALTIORA-12]]"]
---

# ALTIORA-16: Análise Finvity — registrar link/anexo, dores e produtos sugeridos (UC25)

## Objetivo
Disponibilizar ao Closer uma seção na ficha do referral para registrar o relatório Finvity (link ou upload de PDF) junto com dores identificadas, necessidades e produtos sugeridos pela análise.

## Acceptance Criteria
- [x] AC1: Seção "Análise Finvity" exibe campos: Link do relatório Finvity (URL input com validação https://), upload de arquivo PDF (< 5MB), Dores identificadas (tags textarea), Necessidades mapeadas (tags textarea), Produtos sugeridos pela análise (multiselect com lista PRODUTOS_ALTIORA).
- [x] AC2: URL inválida (sem `https://` ou formato incorreto) exibe erro inline "URL inválida — inclua https://" e não salva.
- [x] AC3: Ao salvar, dados são persistidos em `altiora_finvity_analise` via upsert. Badge verde "Preenchido" aparece na seção quando `finvity_link` ou `finvity_arquivo_url` existe.
- [x] AC4: Seção exibe alerta laranja "Análise Finvity não registrada" quando `currentStagePosition >= 7` (R2 agendada) e análise não preenchida.
- [x] AC5: Arquivo PDF anexado via upload é armazenado em `referral-docs/{lead_id}/finvity/` no Supabase Storage e URL pública salva em `altiora_finvity_analise.finvity_arquivo_url`.

## Escopo

**IN:**
- Seção "Análise Finvity" na ficha do referral
- Input de URL com validação + upload de PDF alternativo
- Campos de dores/necessidades/produtos em `altiora_finvity_analise`
- Alerta visual quando Finvity ausente em etapa R2+

**OUT:**
- Integração com API Finvity (V2 — V1 é link/anexo manual)
- Importação automática de dados do relatório

## Contexto Técnico
- Tabela `altiora_finvity_analise`: `id, lead_id (unique), finvity_link, finvity_arquivo_url, dores_identificadas (text[]), necessidades_mapeadas (text[]), produtos_sugeridos (text[]), notas, created_at, updated_at`
- `R2_STAGE_MIN_POSITION = 7` para alerta de estágio
- `sbUntyped = supabase as unknown as SupabaseClient` para acesso sem tipos gerados

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/hooks/useAltioraFinvity.ts` — criado: `useFinvityAnalise`, `useSaveFinvityAnalise`, `useUploadFinvityArquivo`
- `src/components/negocios/AltioraFinvitySection.tsx` — criado: seção completa com view/edit mode, validação URL, upload PDF, multiselect produtos
- `src/pages/NegocioSingle.tsx` — `AltioraFinvitySection` adicionado na aba Informações quando `isAltioraPipeline`
- `supabase/migrations/20260725150000_altiora_finvity_analise.sql` — tabela `altiora_finvity_analise`

## QA Results
<!-- QA preenche ao revisar -->
