---
title: "Story SENDS-FIX-01: Auditoria completa de quebras no módulo SENDS PRO"
type: story
status: done
epic: SENDS
complexity: M
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-07-25
tags: [story, sends-pro, audit, fix]
related: ["[[../../project/modules/sends-pro]]", "[[SENDS-IMPORT-01]]", "[[SENDS-IMPORT-02]]"]
---

# Story SENDS-FIX-01: Auditoria completa de quebras no módulo SENDS PRO

## Objetivo
Conduzir auditoria sistemática end-to-end do módulo SENDS PRO (frontend, hooks, edge functions, schema, integrações) para identificar todas as quebras, comportamentos divergentes, inconsistências de tipo e regressões — produzindo um relatório classificado por severidade e um plano de correção priorizado.

## Acceptance Criteria

- [x] AC1: Documento `docs/smart-memory/project/audit-sends-pro.md` criado contendo inventário completo de findings, cada um com: (a) severidade `P0|P1|P2|P3`, (b) componente/arquivo afetado com `file:linha`, (c) descrição do problema, (d) cenário de reprodução, (e) proposta de correção em uma linha.
- [x] AC2: Auditoria cobre os 5 vetores do módulo (referência: [[../../project/modules/sends-pro]] §2-§7):
  1. **Páginas e wizard** — `Disparos.tsx`, `CriarDisparo.tsx`, todas as tabs e steps em `src/components/disparos/`
  2. **Hooks de dados** — `useSends`, `useSend`, `useFilterLeads`, `useSendDispatch`, `useSendContacts`, `useImportarLista`, `useSendWebhooks`
  3. **Edge functions** — `filter-leads-for-send`, `send-dispatch-worker`, `sends-import-contacts`, `send-status-callback`, `dispara-webhook`
  4. **Schema/RLS** — `sends`, `sends_contacts`, `sends_import_sessions`, `sends_webhooks`; integridade referencial em `template_id`, `stage_ids`, `wa_channel_id`
  5. **Integrações** — Meta Graph (WA outbound + callback), SMTP/SendGrid (email), Twilio (SMS/voice), OMNI PRO bridge
- [x] AC3: Para cada finding `P0` ou `P1`, há um trecho de código real anexado no relatório (snippet de 5-15 linhas com `file:linha`) ilustrando a quebra.
- [x] AC4: Relatório inclui seção "Reproduções verificadas" — lista de bugs que delta confirmou via runtime (logs, console, query no DB), distintos dos detectados apenas por análise estática.
- [x] AC5: Relatório inclui seção "Tabela de regressões cruzadas" mapeando: feature do SENDS afetada × módulo dependente quebrado (ex.: "Filtro de Q-fields no wizard" × "filter-leads-for-send aceita apenas q1-q6, q19, q21-q22").
- [x] AC6: Relatório lista débito técnico já catalogado em [[../../project/modules/sends-pro]] §9 e marca quais ainda são reproduzíveis na main atual (commit hash registrado).
- [x] AC7: Para cada finding, há sugestão de qual story criar (ex.: "FIX-SENDS-DISPATCH-01: tratar caso de wa_channel_id ausente no send-dispatch-worker") OU vinculação a story já existente no backlog ([[../../stories/BACKLOG.md]]).
- [x] AC8: Relatório termina com sumário executivo (≤ 200 palavras) classificando o estado de saúde do módulo: `verde | amarelo | vermelho` por vetor (1-5 acima) e recomendação de prioridade global.

## Escopo

**IN:**
- Leitura completa do código-fonte do módulo (todos os arquivos listados nas seções 2-5 do deep-dive)
- Reprodução manual via UI de pelo menos: criar disparo filtrado, criar disparo importado (CSV pequeno), iniciar disparo, pausar, validar webhook, verificar callback de status (mock se necessário)
- Inspeção de logs do Supabase Edge Functions Dashboard para erros recentes em `filter-leads-for-send`, `send-dispatch-worker`, `sends-import-contacts`, `send-status-callback`
- Queries de sanity no DB do tenant `wotuyxscsfralqpoiyfv`: contagem de `sends_contacts.status='failed'` recentes, `sends.status='running'` órfãos, `sends_import_sessions.status='processing'` órfãos
- Relatório em `docs/smart-memory/project/audit-sends-pro.md` com frontmatter padrão (type: audit, agent: dev-dev-delta)
- Atualização do INDEX.md em `docs/smart-memory/INDEX.md` (se existir) com link para o novo relatório

**OUT:**
- Execução das correções — findings viram stories separadas no backlog (criadas pelo Zaelor após review)
- Refatoração ampla do módulo (ex.: mover dispatch para servidor — já está em [[FIX-SENDS-01]])
- Análise de performance ou load testing
- Análise de UX (delegada ao dev-ux quando relevante)
- Stories já existentes no backlog (CLEAN-SENDS-01, FIX-SENDS-01) — apenas referenciar

## Contexto Técnico

**Pontos de atenção conhecidos (módulo deep-dive §9):**
- Loop de disparo no frontend (`useSendDispatch` via setInterval) — risco de aborto silencioso
- `sends_contacts` sem tipos gerados — cast `(supabase as any)` em todos os hooks
- `sends.template_id` sem FK — risco de referência a template deletado
- `sends.stage_ids` sem FK no array — risco de stage órfão
- Filtros Q-field incompletos (apenas q1-q6, q19, q21-q22)
- `send-dispatch-worker` sem retry automático de `failed`
- `scheduled_at` sem cron server-side
- `send-status-callback` por shared secret (não JWT)

**Heurísticas para auditoria:**
1. Grep por `as any` em `src/hooks/useSend*.ts` e `src/hooks/useImportar*.ts` — todo cast suspeito é candidato a finding
2. Grep por `console.error`, `throw new Error` em edge functions — fluxos de erro silencioso
3. Verificar `try { ... } catch {}` (catch vazio engolindo erros) em `sends-import-contacts/index.ts` (sabidamente presente em L379)
4. Conferir `useEffect` cleanup em `useSendDispatch` — se `stopDispatch()` está sendo chamado consistentemente
5. Verificar paginação em `useSendContacts` — se há limite implícito que oculta contatos
6. Verificar se `filter_config` (jsonb snapshot dos filtros) é re-aplicável após mudança de schema dos filtros

**Ferramentas:**
- `gh api` para commits recentes do diretório `src/components/disparos/` e `supabase/functions/sends-*`
- `git log --since="60 days ago" -- src/components/disparos/ supabase/functions/send*` para identificar zonas de churn
- DevTools Network tab durante fluxo de criação/disparo
- Supabase Studio: SQL editor para queries de sanity

**Coordenação:**
- Delta executa esta auditoria standalone — não depende das stories SENDS-IMPORT-01 ou SENDS-IMPORT-02 estarem completas
- Findings que sobreponham com SENDS-IMPORT-01/02 devem ser marcados explicitamente como "endereçado por: SENDS-IMPORT-XX"
- Ao concluir, delta envia SendMessage para o team-lead com link para o relatório e sumário executivo

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Kronix (dev-dev-delta) |
| Iniciado   | 2026-04-30 |
| Concluído  | 2026-04-30 |
| Branch     | main |

## File List
- `docs/smart-memory/project/audit-sends-pro.md` — relatório de auditoria 406 linhas, estado AMARELO, 5 findings P1/P2 ativos

## QA Results
<!-- QA preenche ao revisar -->
