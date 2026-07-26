---
title: "RCA DB-side: FIX-SENDS-FIRST-MSG-01 — perspectiva data-engineer"
type: rca
agent: dev-data-engineer (Bythak)
created: 2026-07-25
updated: 2026-07-25
status: concluído
tags: [rca, sends-pro, claim-pending-messages, whatsapp, delivery, database]
related:
  - "[[../../stories/done/FIX-SENDS-FIRST-MSG-01]]"
  - "[[../../agents/research/sends-first-message-bug]]"
  - "[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]"
  - "[[schema]]"
  - "[[migrations-log]]"
---

# RCA DB-side: FIX-SENDS-FIRST-MSG-01

> **Nota:** Este arquivo cobre exclusivamente a perspectiva DB/pipeline do data-engineer.
> O RCA completo (causa primária confirmada, fix aplicado) está em
> `[[../../agents/research/sends-first-message-bug]]` (autoria: Rex / dev-dev-beta).

---

## Escopo da investigação

Solicitado pelo team-lead: rastrear o fluxo completo de uma mensagem desde INSERT em
`messages` até o handoff para `whatsapp-outbound`, identificar se há qualquer filtro
DB-side, constraint ou race condition que possa excluir a primeira mensagem de um
disparo novo. Investigação apenas — sem modificação de código.

Arquivos lidos:
- `supabase/migrations/20260316210000_fix_message_duplication_atomic_claim.sql`
- `supabase/migrations/20260317000000_fix_claim_pending_messages_types.sql`
- `supabase/functions/send-dispatch-worker/index.ts` (linhas 730-1120)
- `supabase/functions/omni-delivery-engine/index.ts` (linhas 60-247)
- `supabase/functions/whatsapp-outbound/index.ts` (linhas 680-1230)
- `docs/smart-memory/agents/research/sends-first-message-bug.md`

---

## Findings por hipótese

### H1 — `claim_pending_messages` filtra por `source_type` ou `module_ref_id` — DESCARTADA (DB)

**Investigação:** leitura completa da função SQL `claim_pending_messages` (migration
`20260316210000` + `20260317000000`).

**Resultado:** a função usa `FOR UPDATE SKIP LOCKED` com os seguintes filtros:

```sql
WHERE m.status = 'pending'
  AND m.from_contact != 'cliente'
  AND m.created_at > now() - (p_max_age_hours || ' hours')::interval
  AND (p_people_id IS NULL OR m.people_id = p_people_id)
  AND (p_channel IS NULL OR m.channel = p_channel)
  AND (
    (m.metadata->>'delay_minutes') IS NULL
    OR (m.metadata->>'delay_minutes')::int = 0
    OR (COALESCE(m.sent_at, m.created_at)
        + ((m.metadata->>'delay_minutes')::int * interval '1 minute') <= now())
  )
```

**Não há qualquer filtro em `source_type` ou `module_ref_id`.** Mensagens de
campanha inseridas por `send-dispatch-worker` com:
- `from_contact = 'sistema'` → passa `!= 'cliente'`
- `status = 'pending'` → passa
- `source_type = 'campaign'` → não filtrado
- `module_ref_id = {send_id}` → não filtrado

H1 descartada na camada DB.

---

### H2 — Key mismatch `wa_phone_number_id` vs `phone_number_id` — CONFIRMADA (já no RCA do Rex)

**Investigação DB:** verificado o caminho completo:

1. `send-dispatch-worker` insere `messages` com coluna DB `wa_phone_number_id` (linha 1071):
   ```javascript
   wa_phone_number_id: waChannelObj.phone_number_id,
   ```
2. `claim_pending_messages` retorna o campo como `wa_phone_number_id` (coluna DB, linha 76 do RETURNS TABLE).
3. `omni-delivery-engine` (ANTES do fix) passava o valor com a chave errada `wa_phone_number_id`
   no body para `whatsapp-outbound`; a função espera a chave `phone_number_id`.
4. `whatsapp-outbound` desestrutura `phone_number_id: bodyPhoneNumberId` → recebia `undefined`.
5. Sem `phoneNumberId` explícito, entrava em fallback triplo (default channel → last inbound
   channel → any active channel), usando credenciais incorretas em setups multi-canal.

**Fix já aplicado:** `omni-delivery-engine` linha 205:
```javascript
// FIX-SENDS-FIRST-MSG-01: was 'wa_phone_number_id' (DB column name) —
// whatsapp-outbound expects 'phone_number_id' for credential resolution.
phone_number_id: group[0].wa_phone_number_id ?? undefined,
```

E em `whatsapp-outbound` linhas 987-1005: lookup em `settings_whatsapp_channels` pelo
`phone_number_id` para resolver o `access_token` correto do canal da campanha.

---

### H3 — Race condition entre INSERT e fire-and-forget trigger — DESCARTADA (timing)

**Investigação:** análise do fluxo em `send-dispatch-worker` (linhas 1061-1093):

```
await supabase.from('messages').insert({...})  ← AWAITED (HTTP round-trip completo)
                                               ← PostgREST wraps em BEGIN/COMMIT internamente
                                               ← resposta 201 chega APÓS o commit no DB
                                               ← portanto: INSERT já commitado aqui
fetch(omni-delivery-engine, {...}).catch(...)  ← fire-and-forget chamado APÓS commit
```

Não há race condition. O `await` no insert Supabase resolve apenas após o HTTP 201 do
PostgREST, que só vem depois do `COMMIT` no Postgres. A mensagem está visível para
qualquer conexão antes de `fetch()` ser chamado.

**Nota sobre PgBouncer:** Supabase usa transaction pooling (PgBouncer). Mas após COMMIT,
a row é visível via MVCC para TODAS as conexões subsequentes — independentemente de qual
conexão do pool é usada. Sem issue de read-your-own-writes cross-connection.

---

### H4 — `resolvedTemplateName` vazia → Meta rejeitaria silenciosamente — DESCARTADA (guard)

**Investigação:** `send-dispatch-worker` linhas 978-985:

```javascript
const resolvedTemplateName = waTemplate.meta_template_name
  || (waTemplate.json_data?.elementName as string)
  || '';
if (!resolvedTemplateName) {
  throw new Error(
    `Template "${waTemplate.name}" sem meta_template_name — preencha no cadastro`
  );
}
```

Se `meta_template_name` é vazio, o worker lança erro e **não insere** a mensagem.
Não há cenário de mensagem inserida com `template_name` vazio — a guarda está antes do INSERT.

`omni-delivery-engine` (linha 161-167) tem log de erro adicional para o caso de
`metadata.template_name` vazio, mas esse estado só ocorreria em inserções manuais ou
via path diferente do worker.

---

### H5 — `message_delivery_attempts` inexistente bloqueia o send — DESCARTADA

**Investigação:** `whatsapp-outbound` funções `openDeliveryAttempt` / `closeDeliveryAttempt`
(linhas 684-747):

```typescript
async function openDeliveryAttempt(...): Promise<number | null> {
  try {
    // ... insert em message_delivery_attempts ...
    if (error) {
      console.error('openDeliveryAttempt: insert failed:', error.message);
      return null;  // ← falha gracefully, não bloqueia
    }
    return row?.id ?? null;
  } catch (e) {
    console.error('openDeliveryAttempt: exception:', (e as Error).message);
    return null;  // ← falha gracefully, não bloqueia
  }
}
```

A função retorna `null` em qualquer falha. O send principal (linha 1132):
```typescript
const attemptId = msgId
  ? await openDeliveryAttempt(supabase, msgId, tplRequestBody)
  : null;
const result = await sendTemplateToMeta(...)  // ← prossegue independente de attemptId
```

A ausência da tabela `message_delivery_attempts` antes da migration
`20260725350000` causava falha silenciosa apenas no logging — o send real
à Meta não era bloqueado. Confirmado: a migration cria a tabela que o código já
esperava.

---

## Observação adicional: AC3 violation (não é a causa do bug)

`send-dispatch-worker` (linha 1106-1109):
```javascript
await supabase
  .from('sends_contacts')
  .update({ status: 'sent', sent_at: new Date().toISOString() })
  .eq('id', contact.id);
```

Este UPDATE acontece ANTES de qualquer confirmação de delivery pela Meta. Viola
o invariant do AC3 ("sent somente após handoff bem-sucedido"). Porém, este é um
problema de representação de status, não causa mensagens não entregues. Documentado
como technical debt no RCA do Rex (requer ADR separado sobre estado `dispatching`).

---

## Diagrama do fluxo verificado (estado pós-fix)

```
send-dispatch-worker
  ├─ INSERT messages {wa_phone_number_id='X', from_contact='sistema', status='pending',
  │                   metadata.template_name='my_template', source_type='campaign'}
  │   ← AWAITED — commitado antes de continuar
  ├─ fetch omni-delivery-engine {people_id, channel='whatsapp'}  ← fire-and-forget
  └─ UPDATE sends_contacts {status='sent'}  ← premature, mas não bloqueia delivery

omni-delivery-engine (invocado)
  ├─ claim_pending_messages(p_people_id, p_channel='whatsapp')
  │   WHERE status='pending' AND from_contact!='cliente'  ← 'sistema' passa
  │   FOR UPDATE SKIP LOCKED  ← atômico
  └─ deliverWhatsApp():
      fetch whatsapp-outbound {
        to, messages, message_ids,
        phone_number_id: 'X'  ← CORRETO (pós-fix)
      }

whatsapp-outbound
  ├─ lookup settings_whatsapp_channels WHERE phone_number_id='X' AND active=true
  │   → resolve access_token correto do canal  ← CORRETO (pós-fix)
  ├─ openDeliveryAttempt(msgId, requestBody)  ← INSERT em message_delivery_attempts
  ├─ sendTemplateToMeta(correctToken, 'X', to, template)
  ├─ closeDeliveryAttempt(attemptId, {status:'sent', wamid, ...})
  └─ UPDATE messages {status='sent', wa_message_id=wamid}
```

---

## Conclusão DB-side

| Hipótese | Status | Evidência |
|---|---|---|
| H1 — filtro source_type/module_ref_id | ❌ Descartada | claim_pending_messages lida completa — sem esses filtros |
| H2 — key mismatch wa_phone_number_id | ✅ Confirmada (Rex) | Fix já aplicado em omni-delivery-engine + whatsapp-outbound |
| H3 — race condition INSERT vs trigger | ❌ Descartada | await resolve pós-commit; PostgREST + MVCC garantem visibilidade |
| H4 — template_name vazio | ❌ Descartada | Guard em send-dispatch-worker lança erro antes do INSERT |
| H5 — message_delivery_attempts ausente | ❌ Descartada | openDeliveryAttempt falha gracefully, não bloqueia send |
| AC3 violation (sends_contacts prematuro) | ⚠️ Known debt | Status misrepresentation, não causa delivery failure |

**Root cause confirmado (DB-side):** nenhum filtro ou constraint DB-side exclui
mensagens de campanha. O bug era exclusivamente no mapping de chave JSON entre funções
edge (`wa_phone_number_id` → `phone_number_id`). A camada DB (claim + indexes + RLS)
funciona corretamente.

**Contribuição desta story (Bythak):**
- Migration `20260725350000_message_delivery_attempts.sql` cria a tabela que
  `whatsapp-outbound` já esperava — completa o AC10 no lado DB.
- 35 rollbacks criados para migrations recentes sem cobertura (cobertura 84→119).
