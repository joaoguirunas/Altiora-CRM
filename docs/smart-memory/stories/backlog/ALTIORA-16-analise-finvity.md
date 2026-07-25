---
title: "ALTIORA-16: Análise Finvity — registrar link/anexo, dores e produtos sugeridos (UC25)"
type: story
status: backlog
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
- [ ] AC1: Na ficha do referral em etapa "Análise Finvity" ou posterior, seção "Análise Finvity" exibe campos: Link do relatório Finvity (URL input com validação https://), Ou upload de arquivo PDF (< 5MB via storage existente), Dores identificadas (textarea), Necessidades mapeadas (textarea), Produtos sugeridos pela análise (multiselect idêntico ao de ALTIORA-15).
- [ ] AC2: URL inválida (sem `https://` ou formato incorreto) exibe erro inline "URL inválida" e não salva.
- [ ] AC3: Ao salvar, o campo `link_finvity` é persistido em `lead_field_values` e o ícone de "Finvity preenchido" aparece na ficha (badge verde na seção).
- [ ] AC4: Seção exibe mensagem "Análise Finvity não registrada" com destaque laranja quando o referral está em etapa "R2 agendada" ou posterior sem o campo preenchido — alerta visual, não bloqueio.
- [ ] AC5: Arquivo PDF anexado via upload é armazenado no Supabase Storage em bucket `referral-docs/{lead_id}/finvity/` e a URL pública é salva em `lead_field_values`.

## Escopo

**IN:**
- Seção "Análise Finvity" na ficha do referral
- Input de URL com validação + upload de PDF alternativo
- Campos de dores/necessidades/produtos em `lead_field_values`
- Alerta visual quando Finvity ausente em etapa R2+

**OUT:**
- Integração com API Finvity (V2 — V1 é link/anexo manual)
- Importação automática de dados do relatório

## Contexto Técnico
- `src/components/negocios/NegocioArquivos.tsx` — upload existente; reaproveitar lógica de storage
- `lead_field_definitions` campos: `link_finvity`, `dores_finvity`, `necessidades_finvity`, `produtos_sugeridos_finvity` — criar no ALTIORA-01
- Bucket Supabase: verificar se `referral-docs` existe; criar se necessário via migration de storage policy
- Condição de alerta: `stage_position >= posição "R2 agendada"` E `lead_field_values` sem `link_finvity`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
