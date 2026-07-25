# Contrato — `_shared/email-provider.ts` (sender de e-mail unificado)

> Story EMAIL-1.3 · ADR-EMAIL-01. Fonte única de envio de e-mail via provider configurado
> no canal omni `email`. Consumido por `followup-trigger-worker`, `omni-delivery-engine` e
> `channel-test-send`.

## Providers suportados

Lidos de `omni_channel_configs.credentials` (jsonb, plaintext + RLS) para `channel='email'`:

| provider   | credenciais obrigatórias                  | transporte |
|------------|-------------------------------------------|------------|
| `resend`   | `api_key`, `from_email` (`from_name` opc) | `POST https://api.resend.com/emails` (Bearer) |
| `sendgrid` | `api_key`, `from_email` (`from_name` opc) | `POST https://api.sendgrid.com/v3/mail/send` (Bearer, `text/html`) |
| `smtp`     | `host`, `user`, `pass`, `from_email` (`port` opc, default 587; TLS se 465) | denomailer (import dinâmico) |

`provider` ∈ {`webhook`, ausente, outro} → **não** é envio direto (`hasDirectEmailProvider === false`);
o caller deve cair no `webhook_fallback` (N8N) legado.

## API exportada

```ts
// Substitui {{chave}} (aceita ponto: {{pessoa.nome}}) pelos valores de vars.
// escape (default true): escapa o VALOR substituído (nunca o template). Use false p/ subject.
renderTemplate(template: string, vars: Record<string,string>, opts?: { escape?: boolean }): string

// true se credentials.provider é resend/smtp/sendgrid.
hasDirectEmailProvider(creds?: EmailCredentials | null): boolean

// HTML-escape dos 5 caracteres (& < > " ').
escapeHtml(text: string): string

// Renderiza subject (sem escape) + html (escape) e despacha pelo provider.
// NÃO checa is_active — o caller decide (ex.: botão de teste envia com canal inativo).
sendEmailWithConfig(config: EmailConfig, params: SendEmailParams): Promise<SendResult>

// Atalho: carrega a config de omni_channel_configs(channel='email'),
// valida is_active + provider direto, e envia.
sendEmail(supabase: SupabaseClient, params: SendEmailParams): Promise<SendResult>
```

### Tipos

```ts
interface SendEmailParams { to: string; subject: string; html: string; vars?: Record<string,string> }
interface EmailConfig     { is_active?: boolean; credentials?: EmailCredentials | null }
interface SendResult      { success: boolean; error?: string }
```

## Garantias

- **Nunca lança.** Toda falha (sem provider, sem credencial, `to` vazio, erro HTTP/SMTP, timeout 30s)
  retorna `{ success: false, error }` com mensagem curta — sem stack trace.
- **Escape de dados do lead:** valores de `vars` são HTML-escapados no corpo (`html`); o `subject`
  é renderizado como texto puro (sem escape). O HTML do template em si é confiável (autorado pelo gestor).
- **Var-map canônico** (tokens do `VariablePicker`): `pessoa.nome`, `pessoa.email`, `pessoa.telefone`,
  `pessoa.whatsapp`, `lead.titulo`. Tokens não resolvidos → string vazia (paridade com o motor omni).
  Tokens mais profundos (utm.*, qualificacao.*, disc, pipeline/etapa) ainda não são resolvidos no envio
  direto — degradam para vazio. Ampliação futura exigiria um resolver compartilhado.

## Consumidores

- **`followup-trigger-worker`**: ramo `entry.channel === 'email'` quando o canal tem provider direto ativo.
  Resolve `pessoa.email`; subject/html do `email_templates` referenciado (via
  `leads_stages_followups.email_template_id`) ou do conteúdo inline da fila. Sem provider direto →
  fallback webhook N8N (legado).
- **`omni-delivery-engine`**: `deliverViaEmail` para `channel==='email'` com provider direto;
  senão `deliverViaWebhook` (webhook_fallback preservado).
- **`channel-test-send`**: botão "Enviar teste" para smtp/sendgrid/resend.
