---
title: "US-CFG-08: Export de dados e conformidade LGPD"
type: story
status: done
epic: settings
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, lgpd, privacy, P2]
related: ["[[../../project/modules/settings]]", "[[../../decisions/ADR-ADM-01-project-per-tenant]]"]
---

# US-CFG-08: Export de dados e conformidade LGPD

## Objetivo
Prover mecanismos de export completo de dados do tenant e ferramentas de atendimento a direitos LGPD (portabilidade, esquecimento) acessíveis via Settings.

## Acceptance Criteria
- [x] AC1: Settings > Outros > LGPD exibe botão "Solicitar export completo" — dispara edge function `data-export-request` que cria job em `data_export_jobs` (tenant_id, requested_by, status, download_url, expires_at)
- [x] AC2: Edge function gera arquivo com: `leads.csv`, `clients_people.csv`, `crm_messages.csv` (últimos 12 meses), `settings_export.json` (sem secrets) — upload para Supabase Storage path `exports/{tenant_id}/{job_id}.zip` com TTL de 48h
- [x] AC3: Painel LGPD exibe lista dos últimos 5 jobs com status (pendente / processando / pronto / expirado) e botão "Download" quando pronto — polling via `refetchInterval: 10_000` enquanto status `processing`
- [x] AC4: Seção "Direito ao Esquecimento" permite buscar pessoa por email — se encontrada, exibe nome e botão "Anonimizar" que chama RPC `anonymize_person(person_id)` substituindo PII por `REDACTED_{hash}`
- [x] AC5: RPC `anonymize_person` é SECURITY DEFINER, requer `user_type = 'gestor'` no JWT, registra em `lgpd_anonymization_log`

## Escopo

**IN:**
- Migration: tabelas `data_export_jobs` + `lgpd_anonymization_log`
- Edge function `data-export-request` (Deno, service_role) — leitura de múltiplas tabelas + geração de CSV + upload Storage
- RPC `anonymize_person(person_id uuid)` SECURITY DEFINER
- Componente `LGPDConfig.tsx` em `src/components/config/`
- Nova sub-tab em Settings > Outros > LGPD
- Hooks `useDataExportJobs`, `useRequestDataExport`, `useAnonymizePerson`, `useSearchPersonByEmail` em `src/hooks/useDataExportJobs.ts`

**OUT:**
- Export de dados de um único contato (apenas export de tenant completo)
- DPO dashboard
- Consentimento granular por contato (escopo LGPD mais amplo)
- Deletar conta de tenant (operação ADM, não Settings)

## Contexto Técnico
Arquitetura project-per-tenant (ADR-ADM-01). O export usa service_role na edge function (acesso total). O TTL de 48h no Storage é implementado via `createSignedUrl(path, 172800)`. `anonymize_person` afeta: `clients_people`, `crm_pessoas`, `crm_messages`, `messages`. A busca por email usa `clients_people` (schema moderno).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## File List

- `supabase/migrations/20260423004000_lgpd_export.sql` — data_export_jobs + lgpd_anonymization_log + RPC anonymize_person
- `supabase/functions/data-export-request/index.ts` — edge fn export (service_role, async)
- `src/hooks/useDataExportJobs.ts` — useDataExportJobs, useRequestDataExport, useAnonymizePerson, useSearchPersonByEmail
- `src/components/config/LGPDConfig.tsx` — ExportSection + AnonymizeSection
- `src/components/config/OutrosConfig.tsx` — lazy import LGPDConfig + tab "lgpd"

## QA Results
<!-- QA preenche ao revisar -->
