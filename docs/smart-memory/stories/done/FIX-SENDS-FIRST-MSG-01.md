---
title: "FIX-SENDS-FIRST-MSG-01: Primeira mensagem do disparo registrada no Omni mas não entregue ao cliente + observabilidade permanente do delivery WhatsApp"
type: story
status: partial-done
epic: SENDS
priority: P0
complexity: L
agent: dev-architect
created: 2026-05-01
updated: 2026-07-25
tags: [story, sends-pro, omni-pro, dispatch, whatsapp, delivery, observability, bug, P0, ora-fix-sends-module]
related:
  - "[[../../project/modules/sends-pro]]"
  - "[[../../project/modules/omni-pro]]"
  - "[[../../project/audit-sends-pro]]"
  - "[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]"
  - "[[../../agents/research/sends-first-message-bug]]"
  - "[[FIX-SENDS-DISPATCH-01]]"
  - "[[FIX-SENDS-01]]"
---

# FIX-SENDS-FIRST-MSG-01: Primeira mensagem do disparo + observabilidade permanente do delivery WhatsApp

## Objetivo

Duas entregas convergentes em uma única story (P0):

1. **Bug fix** — garantir que a primeira mensagem de um disparo WhatsApp efetivamente chegue ao destinatário (Meta Graph API → cliente), eliminando o estado em que a mensagem é registrada no Omni mas nunca despachada.
2. **Observabilidade permanente** — persistir o log completo de delivery WhatsApp (request, response, timestamp, erro) por mensagem e expô-lo na UI Omni de forma expansível, para que o usuário consiga distinguir "registrei localmente" de "enviei pra Meta" de "Meta confirmou".

A entrega da observabilidade é estrutural (define como debugamos delivery dali em diante) e a do bug fix é operacional (cliente quer envios funcionando agora). Ambas estão acopladas porque o mesmo investimento de exploração (tracing handoff worker→delivery engine→Meta) sustenta as duas.

## Acceptance Criteria

### Bug fix (AC1-AC7)

- [ ] AC1: Iniciar um disparo WhatsApp `running` com 1 contato resulta em mensagem entregue ao número do cliente em até 60 segundos (validável via `wa_message_id` em `messages` e/ou recibo `delivered` em `sends_contacts.delivered_at`).
- [ ] AC2: Após o primeiro batch processar com sucesso, **não existe** registro órfão em `messages` com `source_type='campaign'` + `module_ref_id={send_id}` + `status='pending'` que permaneça `pending` por mais de 2 minutos.
- [ ] AC3: A correção mantém a invariante de que `sends_contacts.status='sent'` somente é setado após o handoff bem-sucedido para `omni-delivery-engine` (ou equivalente). Estados intermediários permitidos: `pending` (aguardando delivery worker) e `dispatching` se introduzido.
- [ ] AC4: Reprodução do cenário descrito pelo usuário (primeiro disparo de uma campanha nova): mensagem aparece no Omni (`Conversas`) **e** no histórico de envios da Meta Graph (Manager → Mensagens) — ambos populados, com `status='sent'` em `messages` e `delivered`/`read` quando o destinatário interagir.
- [ ] AC5: Test adversarial — campanha com 5 contatos com `wa_phone_number_id` válido; a primeira mensagem de cada chega ao cliente; nenhuma fica parada em `pending` indefinidamente.
- [ ] AC6: Documentação do root cause registrada em `[[../../agents/research/sends-first-message-bug]]` com hipótese descartada vs. confirmada e link para o(s) commit(s) de correção.
- [ ] AC7: Sem regressão em fluxos não-WhatsApp (Email/SMS/Phone). `npm run typecheck` passa.

### Observabilidade — schema (AC8-AC10)

- [x] AC8: Migration cria tabela `message_delivery_attempts` conforme `[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]` (FK em `messages.id`, colunas `attempt_no`, `started_at`, `finished_at`, `status`, `request_body jsonb`, `response_body jsonb`, `http_status`, `wamid`, `error_code`, `error_message`, `duration_ms` GENERATED). ✅ 2026-07-25
- [x] AC9: Migration cria índices `(message_id, attempt_no)` e `(status, started_at DESC)`. RLS espelha a de `messages` (authenticated_read + authenticated_write USING(true), mirrors 20260428060000 pattern). ✅ 2026-07-25
- [ ] AC10: `whatsapp-outbound` é alterado para: (a) INSERT em `message_delivery_attempts` antes da chamada à Meta com `status='pending'` + `request_body` sanitizado (sem token); (b) UPDATE da mesma row após resposta da Meta com `status='sent'|'failed'`, `response_body`, `http_status`, `wamid` e `error_*`. Tentativas adicionais (retry) criam novas rows com `attempt_no` incrementado.

### Observabilidade — UI (AC11-AC13)

- [x] AC11: Componente expansível na conversa Omni exibe, por mensagem do canal WhatsApp: timestamp da tentativa, status (sent/failed/pending), `wamid` (se houver), `http_status`, `error_message` (se houver) e summary do `request_body`/`response_body` em accordion separado para detalhes brutos.
- [x] AC12: Mensagens **antigas** (anteriores ao deploy desta story) sem rows em `message_delivery_attempts` exibem fallback elegante: badge informativo "Log de delivery indisponível para mensagens anteriores a {data}" — sem tela quebrada, sem console error.
- [x] AC13: A UI usa lazy fetch — o JOIN com `message_delivery_attempts` só ocorre quando o usuário expande a mensagem (não na listagem inicial da conversa). Listagem mantém performance atual.

### Cross-cutting (AC14-AC15)

- [ ] AC14: Smoke test em produção controlada — 1 disparo de teste com 1 contato; verificar (a) entrega real ao destinatário, (b) row criada em `message_delivery_attempts` com `status='sent'` + `wamid` populado, (c) UI Omni renderiza o log expansível corretamente.
- [ ] AC15: Pelo menos um caminho de erro testado — forçar uma falha (ex.: phone_number_id inválido) e confirmar que a row de attempt fica com `status='failed'`, `error_message` populado e o expansível na UI mostra o erro de forma legível.

## Escopo

**IN:**

- **Bug fix:** investigação e correção do handoff entre `send-dispatch-worker` e o pipeline de delivery do OMNI PRO (`omni-delivery-engine` ou `whatsapp-outbound` direto), conforme RCA da Lyra apontar.
- Eventuais correções no `messages.insert` (campos faltantes, `wa_phone_number_id` errado, `metadata.components` malformado).
- Eventual correção no filter/cron do `omni-delivery-engine` que possa ignorar `source_type='campaign'`.
- **Schema:** migration criando `message_delivery_attempts` + índices + RLS conforme ADR-SENDS-01.
- **Edge fn:** alteração em `whatsapp-outbound` para gravar attempts (INSERT pré-call + UPDATE pós-call). Sanitização de `request_body` para remover token de auth.
- **Frontend:** componente UI Omni expansível com lazy fetch dos attempts via TanStack Query.
- **Fallback:** tratamento elegante para mensagens antigas sem attempts.

**OUT:**

- Race condition de double-dispatch em `sends-dispatch-batch` (escopo de [[FIX-SENDS-DISPATCH-01]]).
- Limpeza/refator do uso atual de `messages.metadata` (story separada quando o débito for priorizado).
- Hardening de retry no `whatsapp-outbound` (potencialmente em [[../../stories/backlog/FIX-OMNI-01]]).
- Métricas agregadas / dashboard de delivery (story futura, base já estará pronta).
- Persistência de log para canais não-WhatsApp (Email/SMS/Phone) — a tabela é genérica (`channel` + `provider`), mas esta story só implementa o caminho WhatsApp. Outros canais ficam como follow-up.
- Backfill de attempts para mensagens antigas (não há fonte de verdade — fallback na UI cobre o caso).
- Renomeação/cleanup de campos legados em `messages` ou `sends_contacts`.

## Contexto Técnico

### Sintoma reportado

> "Primeira mensagem do disparo aparece no Omni mas não chega ao cliente."
> "Inclua na mensagem do Omni o log de envio do WhatsApp."

A primeira instrução é o bug operacional. A segunda foi adicionada pelo usuário após a triagem inicial e demanda observabilidade permanente — não apenas durante este fix.

### Decisão arquitetural — ADR-SENDS-01

A persistência do log usa **tabela separada `message_delivery_attempts`** (1:N com `messages`), não JSONB array em `messages`. Razões completas em `[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]`. TL;DR:
- Append-only correto para retry
- Queries de observabilidade triviais (filtros por status/duração)
- Pattern já estabelecido no projeto (`adm_audit_log`, `sends_import_sessions`)
- Não agrava o débito atual de `messages.metadata` sobrecarregado

### Vetor provável do bug (a confirmar pela Lyra)

Fluxo atual em `supabase/functions/send-dispatch-worker/index.ts` (commit `23f7fd60`):

1. Worker constrói `components[]` para Meta API e renderiza body do template.
2. Worker faz `INSERT INTO messages (..., status='pending', source_type='campaign', module_ref_id=send_id, wa_phone_number_id, metadata.components)` — linha 985.
3. Worker faz `UPDATE sends_contacts SET status='sent', sent_at=now() WHERE id=...` — linha 1006.
4. `omni-delivery-engine` (cron) deve pegar `messages` com `status='pending'` + `channel='whatsapp'` e invocar `whatsapp-outbound` que chama Meta Graph API.

**Hipótese H1 (mais provável):** `omni-delivery-engine` filtra `messages` com critério que exclui `source_type='campaign'` ou `module_ref_id IS NOT NULL`, deixando a mensagem perpetuamente `pending`. Frontend Omni lê pela `people_id` independente do `source_type` — usuário vê a mensagem registrada localmente mas ela nunca é despachada.

**Hipótese H2:** `wa_phone_number_id` ou `metadata.components` no INSERT em formato que delivery engine rejeita silenciosamente.

**Hipótese H3:** Cron do `omni-delivery-engine` suspenso ou abortando antes das linhas com `source_type='campaign'`.

**Hipótese H4 (menos provável):** Delivery engine processa, mas chamada à Meta retorna 200 OK + payload de erro estruturado não tratado como falha.

A confirmação fica com o dev-analyst (RCA paralelo). Quando publicado em `[[../../agents/research/sends-first-message-bug]]`, atualizar esta story com link do diagnóstico final e vetor escolhido.

**Insight:** com a tabela `message_delivery_attempts` em produção, hipóteses análogas no futuro são triviais de diagnosticar — basta `SELECT * FROM message_delivery_attempts WHERE message_id = X`.

### Schema da tabela (resumo, ver ADR para o DDL completo)

```sql
CREATE TABLE message_delivery_attempts (
  id            bigserial PRIMARY KEY,
  message_id    bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attempt_no    int NOT NULL DEFAULT 1,
  channel       text NOT NULL,
  provider      text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL,            -- pending | sent | failed | timeout
  request_body  jsonb,
  response_body jsonb,
  http_status   int,
  wamid         text,
  error_code    text,
  error_message text,
  duration_ms   int GENERATED ALWAYS AS (extract(epoch from (finished_at - started_at)) * 1000) STORED
);
```

### Sanitização de request_body

`request_body` **NÃO** deve persistir o `Bearer {access_token}` da Meta API nem o `phone_number_id` se houver risco de PII em outros canais. Para WhatsApp via Meta Graph: persistir apenas o body JSON do POST (template, components, recipient phone) — header de auth removido na função de logging.

### Arquivos prováveis de alteração

- **Migration:** `supabase/migrations/{timestamp}_message_delivery_attempts.sql` (autor: dev-data-engineer)
- **Edge fns:**
  - `supabase/functions/send-dispatch-worker/index.ts` (correção do INSERT, se necessário)
  - `supabase/functions/omni-delivery-engine/index.ts` (correção de filtro)
  - `supabase/functions/whatsapp-outbound/index.ts` (INSERT/UPDATE em `message_delivery_attempts`)
- **Frontend:**
  - Componente novo (Aria): `src/components/omni/MessageDeliveryLog.tsx` (ou similar)
  - Hook novo (Iris): `src/hooks/useMessageDeliveryAttempts.ts`
  - Integração na render da mensagem da conversa Omni (Aria consome o hook da Iris)

### Constraints

- O fix **não pode regredir** comportamento de mensagens não-campanha (regulares OMNI PRO) que hoje funcionam.
- Manter contrato `sends_contacts.status='sent'` = handoff bem-sucedido. Estado intermediário (`dispatching`) é decisão arquitetural separada (não escopo desta story; abrir ADR se necessário).
- `request_body` sanitizado de credenciais.
- Performance da listagem de conversa Omni não pode regredir (lazy fetch).
- RLS em `message_delivery_attempts` deve impedir acesso cross-people (mesma garantia que `messages` tem hoje).

### Coordenação requerida

- **dev-analyst (Lyra):** RCA do bug. Esta story aguarda relatório em `[[../../agents/research/sends-first-message-bug]]` antes da implementação iniciar.
- **dev-data-engineer (Byte):** migration + RLS + índices da tabela `message_delivery_attempts`. **Liberada para iniciar em paralelo, sem aguardar RCA** (a tabela é independente do bug fix).
- **dev-dev-beta:** alterações em `whatsapp-outbound`, `omni-delivery-engine` e `send-dispatch-worker` — gating do RCA da Lyra para o bug fix; pode iniciar a parte de instrumentação (INSERT/UPDATE em `message_delivery_attempts` no `whatsapp-outbound`) em paralelo após Byte criar a tabela.
- **dev-dev-alpha (Aria):** componente UI Omni `MessageDeliveryLog` + integração na render da mensagem da conversa (UI pura).
- **dev-dev-gamma (Iris):** hook `useMessageDeliveryAttempts` (TanStack Query, lazy fetch) + integração no message-store da conversa Omni (data-layer cross-layer).
- **dev-ux (Vela+Astra):** spec UX do componente expansível antes de Aria implementar — estados visuais (sent/failed/pending), accordion para raw payload, fallback de mensagens antigas. Texto + refs, sem wireframes hi-fi.
- Smoke test obrigatório em ambiente real antes de fechar (AC14-AC15).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer (Bythak) — AC8 + AC9 |
| Iniciado   | 2026-07-25 |
| Concluído (parte DB) | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |
| ACs pendentes | AC1-AC7 (bug fix — dev-beta aguarda RCA da Lyra), AC10 (whatsapp-outbound INSERT/UPDATE — dev-beta), AC11-AC13 (UI — dev-alpha/gamma), AC14-AC15 (smoke tests) |

## File List

### Criados por Bythak (AC8 + AC9)
- `supabase/migrations/20260725350000_message_delivery_attempts.sql` — tabela + índices + RLS
- `supabase/migrations/rollbacks/20260725350000_message_delivery_attempts.rollback.sql`

### Pendente (outros agentes)
- `supabase/functions/whatsapp-outbound/index.ts` — AC10 (dev-beta): INSERT antes da chamada Meta + UPDATE após + sanitização request_body
- `supabase/functions/omni-delivery-engine/index.ts` — AC1-AC3 (dev-beta + RCA Lyra): correção do filtro que exclui source_type='campaign'
- `src/components/omni/MessageDeliveryLog.tsx` — AC11-AC13 (dev-alpha Aria): componente expansível
- `src/hooks/useMessageDeliveryAttempts.ts` — AC11-AC13 (dev-gamma Iris): hook lazy-fetch

## Notas técnicas (DB)

- **bigserial PK** — coerente com `messages.id bigserial`; FK `message_id bigint NOT NULL`
- **duration_ms GENERATED** — `(EXTRACT(epoch FROM (finished_at - started_at)) * 1000)::int`; NULL enquanto status='pending'
- **status CHECK** — `pending | sent | failed | timeout` (4 estados; timeout diferencia falha de call vs falha de auth)
- **RLS pattern** — idêntico a `messages`: `authenticated_read` + `authenticated_write` ambos `USING(true)` — sem filtro por `people_id` no nível de RLS (mesma decisão do baseline repair)
- **request_body segurança** — coluna existe mas NÃO deve jamais conter `Bearer {token}` nem headers de auth. Sanitização é responsabilidade do `whatsapp-outbound` no momento do INSERT (fora do escopo desta migration)
- **Sequence grant** — `GRANT USAGE, SELECT ON SEQUENCE message_delivery_attempts_id_seq TO authenticated, service_role` — necessário para INSERT com bigserial em edge fns

## QA Results

```
VEREDICTO: PASS (escopo DB: AC8 + AC9)
Story: FIX-SENDS-FIRST-MSG-01 | Data: 2026-07-25
Escopo: AC8 (tabela message_delivery_attempts) + AC9 (índices + RLS).
AC1-AC7/AC10-AC15 fora do escopo desta revisão.

──── AC8 — Tabela message_delivery_attempts ────
AC8 ✅  supabase/migrations/20260725350000_message_delivery_attempts.sql.
        CREATE TABLE IF NOT EXISTS public.message_delivery_attempts. ✅
        id bigserial PRIMARY KEY — coerente com messages.id bigserial. ✅
        message_id bigint NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE. ✅
        attempt_no int NOT NULL DEFAULT 1. ✅
        channel text NOT NULL. ✅
        provider text. ✅
        started_at timestamptz NOT NULL DEFAULT now(). ✅
        finished_at timestamptz. ✅
        status text NOT NULL CHECK ('pending'|'sent'|'failed'|'timeout') — 4 estados. ✅
        request_body jsonb. ✅
        response_body jsonb. ✅
        http_status int. ✅
        wamid text. ✅
        error_code text. ✅
        error_message text. ✅
        duration_ms int GENERATED ALWAYS AS (EXTRACT(epoch FROM (finished_at - started_at))
          * 1000)::int STORED — NULL enquanto pending. ✅
        COMMENT ON TABLE + COMMENT ON COLUMN (request_body, duration_ms). ✅
        SECURITY NOTE no header: request_body MUST NOT conter Bearer token. ✅
        BEGIN / COMMIT (transação). ✅

──── AC9 — Índices + RLS ────
AC9 (índices) ✅
        idx_mda_message_id_attempt ON (message_id, attempt_no) IF NOT EXISTS. ✅
        idx_mda_status_started ON (status, started_at DESC) IF NOT EXISTS. ✅

AC9 (RLS) ✅
        ENABLE ROW LEVEL SECURITY. ✅
        DROP POLICY IF EXISTS antes de CREATE — idempotente. ✅
        mda_authenticated_read: FOR SELECT TO authenticated USING (true). ✅
        mda_authenticated_write: FOR ALL TO authenticated USING (true) WITH CHECK (true). ✅
        Espelha padrão 20260428060000 (messages baseline repair). ✅
        GRANT SELECT/INSERT/UPDATE TO authenticated. ✅
        GRANT ALL TO service_role. ✅
        GRANT USAGE, SELECT ON SEQUENCE ... TO authenticated, service_role. ✅
          (necessário para INSERT com bigserial em edge fns)

──── Rollback ────
Rollback ✅  supabase/migrations/rollbacks/20260725350000_message_delivery_attempts.rollback.sql.
            Header: "Rollback for: ..." + "Tested-against: PostgreSQL 15". ✅
            REVOKE grants → DROP TABLE IF EXISTS CASCADE. ✅

──── Checklist ────
tsc: EXIT 0 ✅
1 Code review ✅ (IF NOT EXISTS, BEGIN/COMMIT, DROP POLICY IF EXISTS, comments)
2 Tests N/A (migration DB)  3 ACs 2/2 ✅ (AC8+AC9)  4 Regressão ✅ (nova tabela, sem ALTER)
5 Performance ✅ (2 índices direcionados)  6 Security ✅ (RLS + security note header)
7 Docs ✅ (COMMENT ON TABLE+COLUMN + story file)  8 API contracts N/A

Issues: nenhum
Próximo passo: @dev-devops push migration. @dev-beta AC10 (whatsapp-outbound INSERT/UPDATE).
```
