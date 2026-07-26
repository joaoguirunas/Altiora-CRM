---
title: "Research: Auditoria — Campos Obsoletos e Referências N8N em Followups"
type: research
agent: dev-analyst
created: 2026-04-27
updated: 2026-04-27
tags: [research, audit, followups, n8n, dead-code]
related: []
---

# Research: Auditoria — Campos Obsoletos e Referências N8N em Followups

**Decisão que informa:** limpeza de dead code nas configs de followup  
**Solicitado por:** team-lead (team-os)

---

## Resumo executivo

O sistema tem **duas dimensões de followup** com arquiteturas distintas:
1. **Stage followups** (`leads_stages_followups`) — disparos ao entrar em etapa de pipeline
2. **Agendamento followups** (`meetings_followups` / `meeting_followup_queue`) — disparos por status de reunião (pré/pós)

A integração n8n **não foi descontinuada em todas as dimensões**: ela ainda é o mecanismo central em duas áreas (`SendsProConfig` e `CallProFollowupsConfig`). O que existe são referências residuais/textuais ao n8n em contextos onde a integração real é via outros canais (WhatsApp Business API, AS Discador). Campos como `audio_file`, `control`, `whatsapp_texto` existem no DB mas não têm UI ativa — são campos suspeitos.

---

## Seção por arquivo auditado

### 1. CallProFollowupsConfig.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `webhook_url` (required field) | linha 90, 113, 210–218 | **Ativo — modelo central** | Campo obrigatório na UI e no DB (`meetings_followups.webhook_url`). O canal real é o webhook: qualquer URL é aceita, inclusive n8n |
| `Webhook` icon import | linha 32 | Ativo | Decorativo, mas consistente com o modelo |
| Texto "pronto para N8N ou qualquer automação" | linha 482–484 | **Suspeito/UI** | Referência explícita ao N8N como ferramenta esperada — não é dead code funcional, mas é acoplamento textual ao n8n |
| `channel` type: `'whatsapp' \| 'email' \| 'sms' \| 'phone'` | `useCallProFollowups.ts` linha 7 | Ativo | Channels reais enviados ao webhook |
| Validação: `form.webhook_url.trim().length > 0 && (... \|\| true)` | linha 112–114 | **Suspeito** | O `|| true` torna a condição de timing sempre verdadeira — disparo imediato sempre habilitado independente do timing. Parece intencional mas o comentário `// allow immediate` é frágil |

**Nota estrutural:** Este componente usa a tabela `meetings_followups` como source of truth. O `webhook_url` não é resquício — é o mecanismo de entrega real desta feature.

---

### 2. SmsMegaConfig.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `webhookFallback` state | linha 26 | **Suspeito** | Inicializa com `enabled: false`. Quando provider='webhook', a URL é salva mas `enabled` depende de haver URL preenchida — inicialização inconsistente |
| Placeholder `"https://n8n.suaempresa.com/webhook/sms"` | linha 160 | **Textual/UI** | Referência ao n8n apenas como exemplo de URL — não é lógica |
| Provider `'webhook'` como padrão | linha 23 | Ativo | Default state é webhook, não Twilio — o SMS real é via webhook |
| `settings.rate_limit_per_hour` | linha 182 | **Suspeito** | Campo salvo no DB mas sem evidência de uso real pelo backend de envio |
| `settings.retry_attempts` | linha 186 | **Suspeito** | Idem — salvo mas sem confirmação de consumo pela edge function |
| `channel-test-send` edge function | linha 64 | Ativo | Função invocada existe (`channel-test-send`) |

---

### 3. EmailMegaConfig.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `webhookFallback` state | linha 26 | **Suspeito** | Mesmo padrão de SmsMega: `enabled: false` no init. Ao salvar, `enabled` é controlado pelo preenchimento da URL, não por um switch explícito |
| `businessHours` state | linha 27 | **Suspeito** | `enabled: false` hardcoded no init. A UI não tem controle para ativar business hours — o switch não existe nesta tela. Campo salvo mas nunca ativável via UI |
| Placeholder `"https://n8n.suaempresa.com/webhook/email"` | linha 212 | **Textual/UI** | Referência ao n8n como exemplo |
| `settings.max_per_hour` | linha 234 | **Suspeito** | Campo salvo, sem evidência de consumo pelo backend |
| `settings.retry_attempts` | linha 238 | **Suspeito** | Idem |
| Providers: `smtp`, `sendgrid`, `webhook` | linhas 93–97 | Ativo | Três provedores reais suportados |

**Achado importante:** `businessHours.enabled` é sempre `false` ao carregar (linha 27) e não há nenhum `Switch` ou UI para mudá-lo para `true`. O campo é sempre serializado como `enabled: false` na chamada de save. **Functionally dead flag.**

---

### 4. SendsProConfig.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| Referência "N8N" no header/banner | linhas 122, 132–134, 230 | **Ativo — modelo central** | N8N é o receptor explícito dos webhooks de campanha. A integração é viva: o sistema envia POST para o webhook configurado |
| Placeholder `"https://n8n.yourserver.com/webhook/..."` | linha 87 | **Textual/UI** | Placeholder de exemplo |
| Nome de exemplo `"Ex: N8N Campanha WhatsApp"` | linha 79 | **Textual/UI** | Sugestão de nome, não lógica |
| `description: null` no create | linha 53 | **Suspeito** | Campo `description` existe no tipo `SendWebhook` e no DB mas é sempre null no mutate — nunca preenchido |

---

### 5. StagesConfig.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `colorDraft` state | linha 24 | Ativo | Usado para optimistic update de cor — funcional |
| `isReordering` flag | linha 23 | Ativo | Flag de controle de drag-and-drop — funcional |
| Nenhuma referência a n8n/webhook | — | Limpo | Arquivo sem integração externa |

**Diagnóstico:** Arquivo limpo. Sem campos obsoletos ou referências mortas.

---

### 6. PipelinesConfig.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `selectedTenantId` prop prefixada `_selectedTenantId` | linha 188 | **Suspeito** | Prop recebida mas nunca usada no corpo do componente — foi renomeada com `_` para suprimir lint, indica feature removida ou placeholder |
| `localOrder` state | linha 196 | Ativo | Controle de reordenação local antes de confirmar no DB |
| Nenhuma referência a n8n/webhook | — | Limpo | Arquivo sem integração externa |

---

### 7. AgendamentoFollowupModal.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `audio_file: null` no payload | linha 133 | **Suspeito** | Campo `audio_file` existe no DB (`meetings_followups`) e no tipo mas é sempre `null` no payload — UI não tem input para este campo |
| Canal `'whatsapp_audio'` | não presente na UI | **Suspeito** | `useAgendamentosFollowups.ts` linha 62 mapeia `whatsapp_audio` como tipo possível, mas o modal não oferece esta opção de canal na CANAIS array |
| `template_id` vs `whatsapp_template_id` | linhas 86–88, 130–131 | **Suspeito** | Dois campos distintos para identificar o mesmo template WA (`template_id` = human-readable id, `whatsapp_template_id` = UUID). Duplicação de semântica — pode causar inconsistência ao carregar followups existentes |
| `control` field | linha 137 | **Suspeito** | Presente no payload mas a UI não tem input para este campo no modal de agendamento. Sempre usa `followup?.control ?? null` |
| Canal `'ligacao'` → `as_queue_id` | linhas 138, 273–308 | Ativo | Integração com AS (Atende Simples) via fila — funcional |

---

### 8. AgendamentoFollowupsCard.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `CANAL_META['whatsapp_audio']` | linha 29 | **Suspeito** | Mapa inclui `whatsapp_audio` como canal possível, mas nunca é criado via UI (modal não oferece esta opção) — dead entry no objeto |
| `CANAL_META['whatsapp_texto']` | linha 28 | **Suspeito** | Idem — `whatsapp_texto` não é oferecido como canal no modal. Existe para compatibilidade com dados antigos no DB |
| `CANAL_META['email_texto']` | linha 31 | **Suspeito** | Idem — nunca criável via UI atual |

**Diagnóstico:** Os três canais obsoletos (`whatsapp_texto`, `whatsapp_audio`, `email_texto`) existem apenas para renderizar dados legados. São compat-shims sem criação nova.

---

### 9. FollowupModal.tsx (Stage Followups)

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| Texto "via N8N" no canal `ligacao` | linha 319 | **Textual** | UI diz "O N8N será responsável por iniciar a ligação" — mas a integração real é via AS Discador (campo `as_queue_id` inexiste aqui) |
| `arquivo_audio: null` no payload | linha 133 | **Suspeito** | `audio_file` existe no DB (`leads_stages_followups`) mas payload sempre envia null — sem UI |
| `control` field | linhas 51, 138–139, 399–411 | **Ativo parcial** | UI tem input para `control` no stage modal (linhas 399–411) mas não no agendamento modal. Campo tem backend no DB |
| `FormState.score_matrix_id` | linhas 49, 65, 104 | Ativo | Campo funcional para segmentação por score |
| `target_stage_id` | linhas 50, 65, 138, 365–395 | Ativo | Move lead para outra etapa após envio — campo funcional no DB |
| Canal `'ligacao'` sem `as_queue_id` | linha 34, 316–323 | **Inconsistência** | Stage followup de ligação delega ao N8N (texto), mas não tem seletor de fila AS como o modal de agendamento. Não há campo `as_queue_id` neste modal nem no payload |

---

### 10. StageFollowupsCard.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| `CANAL_ICONS['whatsapp_texto']` | linha 21 | **Suspeito** | Tipo legado — renderizável mas não criável via UI |
| Texto "ligação via N8N" | linha 93 | **Textual** | Inconsistente: o canal `ligacao` em agendamentos usa AS, aqui ainda aponta N8N |
| `leadsCount` prop | linha 15 | Ativo | Prop passada mas exibida apenas se >0 — funcional |

---

### 11. FollowupEmailEditor.tsx

**Achados:**

Nenhuma referência n8n/webhook. Componente limpo — rich text editor puro com Tiptap.

---

### 12. MultiSelectScoreMatrix.tsx

**Achados:**

Nenhuma referência n8n/webhook. Componente de seleção de score matrix — limpo.

---

### 13. ScoreMatrixSelector.tsx

**Achados:**

Nenhuma referência n8n/webhook. Componente limpo.

---

### 14. VariablePicker.tsx

**Achados:**

| Campo/Prop | Localização | Status | Justificativa |
|---|---|---|---|
| Footer text "resolvidas pelo N8N via payload do webhook" | linha 208 | **Textual/Suspeito** | Afirma que variáveis são resolvidas pelo N8N — mas nos followups de agendamento o canal pode ser direto (WA template, SMS via AS, etc). Pode não ser verdade universal |

---

### 15. WhatsappTemplatePickerModal.tsx

**Achados:**

Nenhuma referência n8n/webhook. Componente limpo.

---

## Seção: Feature Flags Mortas

| Flag/Booleano | Arquivo | Status | Justificativa |
|---|---|---|---|
| `businessHours.enabled: false` (init sem UI para mudar) | EmailMegaConfig.tsx:27 | **MORTA** | Sempre `false` ao salvar — sem Switch na UI para ativá-la |
| `webhookFallback.enabled: false` (init) | SmsMegaConfig.tsx:26, EmailMegaConfig.tsx:26 | **Suspeito** | Torna-se `true` apenas se URL preenchida; lógica implícita, não explícita |
| `|| true` em `isValid` da RuleForm | CallProFollowupsConfig.tsx:114 | **Flag morta** | Torna timing 0/0/0 sempre válido, anulando a validação de timing |

---

## Seção: Integrações Externas Referenciadas

| Integração | Arquivos | Status Real |
|---|---|---|
| **N8N (webhooks de campanha)** | SendsProConfig.tsx | **ATIVA** — modelo central de envio de campanhas |
| **N8N (webhooks de followup reunião)** | CallProFollowupsConfig.tsx, useCallProFollowups.ts | **ATIVA** — `webhook_url` é campo obrigatório; backend usa para disparar |
| **N8N (referência textual em ligações)** | FollowupModal.tsx:319, StageFollowupsCard.tsx:93 | **INATIVA/Inconsistente** — canal `ligacao` em agendamentos usa AS Discador, não N8N direto |
| **N8N (VariablePicker footer)** | VariablePicker.tsx:208 | **Parcialmente incorreto** — variáveis não são resolvidas por N8N em todos os canais |
| **Twilio (SMS)** | SmsMegaConfig.tsx | **Disponível mas não sabemos se ativa** — UI permite config mas sem evidência de backend ativo |
| **AS Discador (ligações)** | AgendamentoFollowupModal.tsx, useCallProASQueues | **ATIVA** — integração funcional com filas AS |
| **CallMega** | CallMegaConfig.tsx (não auditado explicitamente) | Fora do escopo desta auditoria |

---

## Sumário

| Categoria | Contagem |
|---|---|
| Campos/props **obsoletos confirmados** (dead em DB ou sem lógica) | 5 |
| Campos/props **suspeitos** (existem no DB, sem UI ou sem consumo confirmado) | 12 |
| Feature flags **mortas** | 2 (+ 1 suspeita) |
| Referências **textuais** ao n8n (não-lógica) | 6 |
| Referências **funcionais** ao n8n (lógica ativa) | 2 features completas |
| Arquivos **limpos** (sem achados) | 4 (FollowupEmailEditor, MultiSelectScoreMatrix, ScoreMatrixSelector, WhatsappTemplatePickerModal) |

### Achados de maior risco para limpeza

1. **`businessHours.enabled`** (EmailMegaConfig) — flag morta, sempre false, pode ser removida com segurança
2. **`audio_file`** (AgendamentoFollowupModal, FollowupModal) — campo no DB mas sem UI; sempre null no payload
3. **`whatsapp_texto`, `whatsapp_audio`, `email_texto`** nos CANAL_META dicts — tipos legados sem criação nova via UI
4. **`_selectedTenantId`** (PipelinesConfig) — prop nunca usada
5. **Canal `ligacao` no FollowupModal** — aponta para N8N no texto mas deveria usar AS Discador como no modal de agendamento (inconsistência funcional, não só textual)
6. **`description: null`** (SendsProConfig) — campo no tipo/DB sempre null no create

### O que NÃO deve ser removido sem cuidado

- `webhook_url` em `meetings_followups` / `CallProFollowupsConfig` — é o mecanismo central, não resquício
- N8N em `SendsProConfig` — integração viva para campanhas
- `control` em `leads_stages_followups` — tem UI no FollowupModal, campo ativo
- `as_queue_id` em `meetings_followups` — integração AS ativa
