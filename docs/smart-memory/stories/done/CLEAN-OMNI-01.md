---
title: "CLEAN-OMNI-01: Remover schema legado crm_messages + completar PDF extraction"
type: story
status: done
priority: P3
complexity: S
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-23
tags: [story, omni-pro, debt, P3]
related: ["[[../../project/modules/omni-pro]]"]
---

# CLEAN-OMNI-01: Remover schema legado crm_messages + completar PDF extraction

## Objetivo
Remover o schema legado `crm_messages` (substituído por `messages`) e completar a extração de conteúdo de PDFs no Omni PRO.

## Acceptance Criteria
- [x] AC1: `crm_messages` não é mais referenciado em nenhum arquivo de código (queries, hooks, edge fns)
- [x] AC2: Migration de drop de `crm_messages` criada (com verificação de que está vazia/migrada)
- [x] AC3: PDF extraction retorna texto do conteúdo do arquivo, não apenas metadados
- [x] AC4: Nenhuma regressão no histórico de mensagens Omni

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | clean/omni-legacy-schema |

## File List

- `supabase/functions/data-export-request/index.ts` — query migrada de crm_messages → messages
- `supabase/functions/whatsapp-inbound/index.ts` — extractPdfText melhorado + integrado no handler
- `src/contexts/RealtimeContext.tsx` — subscription crm_messages removida; handler branch removida

## Resultado

**Commit:** `f893b12a`

**AC1 (código limpo):**
- `data-export-request`: substituído `.from("crm_messages")` por `.from("messages")`, campo `canal` → `channel`, arquivo CSV renomeado de `crm_messages.csv` → `messages.csv`
- `RealtimeContext.tsx`: removida subscription de `postgres_changes` para tabela `crm_messages` (não existe mais); removida branch `payload.table === 'crm_messages'` no handler
- `useConversas.ts`: campo `crm_messages_id` no payload de webhook externo foi mantido — é contrato de API com sistemas externos, não uma query ao banco

**AC2 (migration drop):**
- `crm_messages` já foi dropada em `20251006011101_3ff414d9...-ok.sql` (`DROP TABLE IF EXISTS ... CASCADE`). Não foi recriada após outubro 2025. Nenhuma migration adicional necessária.

**AC3 (PDF extraction):**
- `extractPdfText` agora recebe `openaiKey?: string` opcional
- Se disponível: chama GPT-4o-mini vision com o PDF em base64 — extrai texto completo (até 4000 chars)
- Fallback: regex scan do stream raw do PDF (método anterior)
- Document handler em `whatsapp-inbound`: para `mime_type === 'application/pdf'`, chama `extractPdfText` e usa resultado como `content` com prefixo `[PDF: {filename}]\n{texto}` para contexto do AI agent

**AC4 (sem regressão):**
- Histórico de mensagens usa tabela `messages` — não foi tocado
- Realtime de `messages` continua funcionando; a subscription `crm_messages` era dead code

## QA Results
