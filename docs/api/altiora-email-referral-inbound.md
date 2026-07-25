# API: altiora-email-referral-inbound

**Edge Function:** `supabase/functions/altiora-email-referral-inbound/index.ts`  
**Stories:** ALTIORA-05, ALTIORA-07  
**Auth:** Nenhuma (chamada pelo provedor de e-mail — SendGrid/Mailgun)

---

## Endpoint

```
POST /functions/v1/altiora-email-referral-inbound
```

---

## Env Vars

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role key |
| `ALTIORA_ALLOWED_SENDERS` | ❌ | `avenue.com` | Domínios/e-mails autorizados (vírgula) |
| `ALTIORA_PIPELINE_ID` | ❌ | UUID pipeline Altiora | UUID do pipeline |
| `ALTIORA_STAGE_ID_NOVO` | ❌ | UUID "Novo referral" | UUID da etapa inicial |
| `ALTIORA_STAGE_ID_ENCAMINHADO` | ❌ | UUID "Encaminhado ao comercial" | UUID da etapa pós-atribuição |

---

## Content Types Suportados

- `application/json` — JSON direto ou Mailgun
- `multipart/form-data` — SendGrid Inbound Parse
- `application/x-www-form-urlencoded` — Mailgun Routes

---

## Request (JSON)

```json
{
  "Message-Id": "<unique-id@mail.example.com>",
  "from": "Matheus <matheus@avenue.com>",
  "to": ["gestao@altiora.com", "marco@altiora.com"],
  "cc": ["ellen@altiora.com"],
  "subject": "Referral: João Silva | 11999990000",
  "body": "Nome: João Silva\nE-mail: joao@email.com\nTelefone: 11999990000\n..."
}
```

### SendGrid Inbound Parse (form-data)
O parser extrai automaticamente: `from`, `to`, `cc`, `subject`, `text`, `headers` (para Message-ID).

---

## Responses

### 200 OK — Lead criado
```json
{
  "ok": true,
  "action": "created",
  "lead_id": "uuid-do-lead",
  "closer_id": "uuid-do-closer"
}
```

### 200 OK — Lead pendente (dados mínimos ausentes)
```json
{
  "ok": true,
  "action": "pending_validation",
  "lead_id": "uuid-do-lead"
}
```

### 200 OK — Duplicata (idempotente)
```json
{
  "ok": true,
  "action": "duplicate",
  "lead_id": "uuid-do-lead-original"
}
```

### 403 Forbidden — Remetente não autorizado
```json
{
  "ok": false,
  "error": "Forbidden",
  "code": "SENDER_NOT_ALLOWED"
}
```

---

## Lógica de Extração de Cliente

O parser tenta extrair do `subject` + `body`:

| Campo | Padrões detectados |
|---|---|
| `name` | `Nome: João Silva`, `Cliente: ...`, `Referral: João Silva \| ...` |
| `email` | `E-mail: x@y.com`, ou qualquer e-mail encontrado no body |
| `phone` | `Telefone: ...`, `Tel: ...`, número BR no formato (11) 99999-9999 |

---

## Detecção Automática de Closer (ALTIORA-07)

Quando um destinatário em `To` ou `CC` corresponde ao e-mail de um usuário com `user_type = 'closer'`:
- O lead é criado já com `altiora_closer_id` preenchido
- Etapa movida para "Encaminhado ao comercial"
- Closer recebe notificação em `altiora_notifications`
- Interação registrada em `altiora_lead_interactions` com `type = 'closer_assigned'`

**Múltiplos Closers detectados:** sem atribuição automática → lead fica sem `closer_id`.

---

## Tabelas Afetadas

| Tabela | Operação | Condição |
|---|---|---|
| `altiora_email_queue` | INSERT | Sempre (exceto remetente não autorizado que usa UPSERT) |
| `leads` | INSERT | Sempre (exceto duplicata) |
| `clients_people` | UPSERT | Se nome/e-mail do cliente extraído |
| `altiora_lead_interactions` | INSERT | `email_received` + `closer_assigned` (se aplicável) |
| `altiora_notifications` | INSERT | Gestores + Closer (se detectado) |

---

## Como Configurar o Webhook

### SendGrid Inbound Parse
1. Em SendGrid → Settings → Inbound Parse
2. Hostname: seu domínio de e-mail (ex: `handoff.altiora.com.br`)
3. URL: `https://<project>.supabase.co/functions/v1/altiora-email-referral-inbound`
4. Marcar "POST the raw, full MIME message"

### Mailgun Routes
1. Em Mailgun → Sending → Routes
2. Filter expression: `match_recipient("referral@altiora.com.br")`
3. Action: `forward("https://<project>.supabase.co/functions/v1/altiora-email-referral-inbound")`
