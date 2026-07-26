---
title: "RCA: Primeira mensagem do disparo não entregue ao cliente"
type: research
status: resolved
agent: dev-dev-beta (Rex)
created: 2026-07-25
updated: 2026-07-25
tags: [rca, sends-pro, omni-delivery-engine, whatsapp-outbound, bug, P0]
related:
  - "[[../../stories/done/FIX-SENDS-FIRST-MSG-01]]"
  - "[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]"
  - "[[../../project/modules/sends-pro]]"
---

# RCA: Primeira mensagem do disparo não entregue ao cliente

## Sintoma

> "Primeira mensagem do disparo aparece no Omni mas não chega ao cliente."

A mensagem é visível na conversa Omni (registrada em `messages` com `status='pending'`), mas nunca é despachada para a Meta Graph API. Em setups multi-canal, o delivery falha por credenciais incorretas.

---

## Hipóteses investigadas

### H1 — `omni-delivery-engine` filtra por `source_type='campaign'` (DESCARTADA)

**Investigação:** leitura completa do RPC `claim_pending_messages` (gerado pelo migration `20260316210000_fix_message_duplication_atomic_claim.sql`, versionado em `20260317000000_fix_claim_pending_messages_types.sql`).

**Resultado:** o RPC não tem nenhum filtro em `source_type` ou `module_ref_id`. Filtra apenas:
- `m.status = 'pending'`
- `m.from_contact != 'cliente'`
- `m.created_at > now() - (p_max_age_hours || ' hours')::interval`
- `delay_minutes` check (JSONB metadata)

Mensagens de campanha têm `from_contact='sistema'` (inserido por `send-dispatch-worker` linha 1066) → passam corretamente. **H1 descartada.**

### H2 — `wa_phone_number_id` ou `metadata.components` em formato incorreto (CONFIRMADA — causa primária)

**Investigação:** comparação das interfaces sender (`omni-delivery-engine/deliverWhatsApp`) e receiver (`whatsapp-outbound` body destructuring).

**Causa confirmada (key name mismatch):**

`omni-delivery-engine` (linha 201, antes do fix):
```javascript
wa_phone_number_id: group[0].wa_phone_number_id ?? undefined,
```

`whatsapp-outbound` body destructuring (linha 857):
```typescript
const {
  to,
  phone_number_id: bodyPhoneNumberId,  // ← esperava 'phone_number_id'
  channel_id,
  ...
} = body;
```

O campo `wa_phone_number_id` (nome da coluna DB) era passado como chave do JSON, mas `whatsapp-outbound` lê `phone_number_id`. O valor era **completamente ignorado**. `bodyPhoneNumberId` ficava `undefined`, `phoneNumberId` ficava `''`.

**Consequência:** sem `phoneNumberId` explícito, `whatsapp-outbound` entra em fallback triplo:
1. Canal default (`is_default=true`)
2. Último canal do qual o cliente recebeu mensagem inbound
3. Qualquer canal ativo

Em setups **single-channel**: fallback 3 encontra o canal correto → delivery funciona.

Em setups **multi-channel**: fallback usa canal errado → credenciais (`access_token`) incorretas para o `phone_number_id` esperado → Meta API retorna 401/400 → mensagem fica em `error`.

**Causa secundária (mesmo bug, mais sutil):** mesmo que o key name fosse correto (`phone_number_id`), `whatsapp-outbound` não fazia lookup do `access_token` para esse `phone_number_id` — usava `envAccessToken` (variável de ambiente global) que pode não ser o token correto para o canal específico da campanha.

### H3 — Cron suspenso ou abortando (PARCIALMENTE RELEVANTE)

O cron `trigger_omni_delivery_engine` (a cada 1 minuto) só é acionado quando há `messages.status='pending'`. O `send-dispatch-worker` também dispara `omni-delivery-engine` imediatamente após cada INSERT (fire-and-forget). Se o disparo imediato falha silenciosamente (cold start, erro de rede), o cron pega em até 1 minuto.

Porém: o `claim_pending_messages` transiciona `pending → sending`. Se a tentativa falha depois de `claiming`, o `omni-delivery-engine` reverte para `error` e insere na `omni_delivery_dead_letter`. O cron não repesca mensagens em `error` — só `pending`. O dead-letter tem seu próprio retry schedule (60s, 5min, 30min...).

**Resultado:** H3 não é a causa primária, mas é relevante para resiliência: se o delivery imediato falha e o dead-letter retry também falha (same root cause), a mensagem fica em `error` permanentemente.

### H4 — Meta retorna 200 OK com payload de erro (DESCARTADA)

`sendTemplateToMeta` em `whatsapp-outbound` (linha 760): `if (!res.ok)` → captura HTTP errors. Payload de erro estruturado da Meta retorna status 4xx/5xx, não 200 OK. **H4 descartada.**

---

## Root Cause Summary

```
send-dispatch-worker
  → INSERT messages (wa_phone_number_id='META_PHONE_ID', from_contact='sistema', status='pending')
  → fetch omni-delivery-engine (fire-and-forget)

omni-delivery-engine
  → claim_pending_messages(p_people_id, p_channel='whatsapp')
  → claims message (status='sending')
  → deliverWhatsApp():
      fetch whatsapp-outbound {
        to,
        messages,
        wa_phone_number_id: 'META_PHONE_ID',  ← WRONG KEY (bug)
        message_ids: [N]
      }

whatsapp-outbound
  → const { phone_number_id: bodyPhoneNumberId } = body  ← undefined (wrong key)
  → phoneNumberId = '' (empty)
  → fallback: uses default channel (possibly WRONG channel for this campaign)
  → sendTemplateToMeta(wrongAccessToken, wrongPhoneNumberId, to, ...)
  → Meta API: 401/400 (wrong credentials)  OR  works by luck (single-channel)
  → on failure: messages.status='error', dead-letter queue
```

---

## Fix aplicado

**Commit:** ver `git log --oneline -- supabase/functions/omni-delivery-engine/index.ts supabase/functions/whatsapp-outbound/index.ts`

**Fix 1 — `omni-delivery-engine`:** renomear `wa_phone_number_id` → `phone_number_id` no body enviado a `whatsapp-outbound`:
```javascript
// ANTES (bug):
wa_phone_number_id: group[0].wa_phone_number_id ?? undefined,

// DEPOIS (fix):
phone_number_id: group[0].wa_phone_number_id ?? undefined,
```

**Fix 2 — `whatsapp-outbound`:** quando `bodyPhoneNumberId` é passado sem `channel_id`, fazer lookup em `settings_whatsapp_channels` para resolver o `access_token` correto do canal:
```typescript
} else if (bodyPhoneNumberId) {
  // FIX-SENDS-FIRST-MSG-01: look up channel credentials by phone_number_id
  const { data: pnChannel } = await supabase
    .from('settings_whatsapp_channels')
    .select('phone_number_id, access_token')
    .eq('phone_number_id', bodyPhoneNumberId)
    .eq('active', true)
    .maybeSingle();
  if (pnChannel) {
    accessToken = pnChannel.access_token || envAccessToken;
    phoneNumberId = bodyPhoneNumberId;
  }
}
```

---

## Observações pós-fix

- `sends_contacts.status='sent'` ainda é setado imediatamente após enqueue (linha 1108 do `dispatch-worker`), antes da confirmação de delivery pela Meta. Isso viola o invariant do AC3. Fix não aplicado nesta story (requer ADR separado sobre estado intermediário `dispatching`).
- A tabela `message_delivery_attempts` (ADR-SENDS-01) ainda não existe — migration pendente por dev-data-engineer. O `whatsapp-outbound` usa `messages.metadata.delivery_log` como interim. A instrumentação completa (AC10) será concluída após a migration.
- Sem a tabela de attempts, hipóteses como esta são difíceis de diagnosticar em produção. **O ADR-SENDS-01 resolve exatamente isso.**
