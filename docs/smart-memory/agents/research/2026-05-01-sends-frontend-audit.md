---
title: "Audit: SENDS PRO Frontend — Cross-layer FE↔BE para disparo WhatsApp"
type: research
agent: dev-dev-gamma
created: 2026-05-01
updated: 2026-05-10
tags: [research, sends-pro, frontend, cross-layer, dispatch-flow, audit]
related:
  - "[[sends-pro-dispatch-flow]]"
  - "[[../../project/modules/sends-pro]]"
  - "[[2026-05-01-taskforce-sends-omni-rca]]"
  - "[[../data-engineer/2026-05-01-ora-schema-drift]]"
---

# Audit: SENDS PRO Frontend — Cross-layer FE↔BE

**Escopo:** investigação read-only do caminho UI → hook → edge fn (1º batch) → pg_cron + auditoria de pontos onde a UI mascara erro do worker / permite estado inválido.
**Tenant:** João Guirunas (`wotuyxscsfralqpoiyfv`).
**Fonte de verdade do pipeline backend:** [[sends-pro-dispatch-flow]] (não duplicar).

## Resumo executivo

O frontend do SENDS PRO foi simplificado pra apenas **chutar o 1º batch** e entregar o resto pro `pg_cron` (`useSendDispatch.ts:58-102`). Não há loop em browser. **Mas a UI de criação não pede `variables_map`** das variáveis posicionais do template (`{{1}}, {{2}}, ...`) — isso fica 100% dependente de `lead_field_values` resolver no worker (`send-dispatch-worker:941-967`). Se o lead não tiver os campos certos, o disparo falha contato a contato com erro escondido.

Outros gaps cross-layer:

1. O filtro `activeTemplates` em `CriarDisparo.tsx:97` aceita qualquer template com `system_enabled=true`, **sem checar `status='approved'` nem `meta_template_name` preenchido** — divergente de outros pontos do app que filtram por approved (`WhatsappTemplateModal.tsx:251`, `WhatsappTemplatePickerModal.tsx:31`). Permite o user selecionar um template que o worker vai rejeitar (`send-dispatch-worker:926-933`).
2. Em `Disparos.tsx:86-96` (`handleAtivar` da lista), o user clica "Ativar" e a UI **só faz `UPDATE sends.status='running'` no DB** — não invoca o 1º batch (diferente de `DisparoControls.handleStart` no detalhe). Se o pg_cron estiver com `service_role_key` desincronizado (P0 do RCA), o disparo fica running indefinidamente sem feedback visual.
3. Erros do worker chegam a `messages.metadata.last_error` (server) e a `sends_contacts.error_message` (server). A UI surface isso **truncado em `max-w-[200px]`** dentro de `TabelaContatos.tsx:247-253` — aparece como tooltip, não como alerta. Não há painel "Por que esse disparo não está enviando?" agregando os erros.
4. Não há indicador no UI de que o cron-engine está OK. `DisparoHeroSection` mostra apenas o badge "Em Execução" — o user não tem como saber se o cron está vivo, se o `_app_config` foi sincronizado, ou se as msgs estão presas em `messages.status='pending'`.

## Trace UI → hook → edge fn

```
src/pages/Disparos.tsx:60                            — lista de campanhas
  ├─ handleAtivar (linha 86)                         — UPDATE sends.status='running' (sem invoke worker) ⚠️
  ├─ handlePausar (linha 98)                         — UPDATE sends.status='paused'
  ├─ handleRetomar (linha 105)                       — UPDATE sends.status='running' (sem invoke worker) ⚠️
  └─ handleParar (linha 117)                         — UPDATE sends.status='completed'

src/pages/DisparoDetalhes.tsx:13                     — detalhe + polling 15s
  └─ DisparoControls.handleStart (DisparoControls.tsx:23)
      ├─ UPDATE sends SET status='running', started_at=now()
      └─ useSendDispatch.mutate() ─────────► supabase.functions.invoke('send-dispatch-worker', { send_id, batch_size:1 })
                                              (useSendDispatch.ts:65-77)
            ├─ se data.processed === 0:
            │    UPDATE sends SET status='draft' + toast.error('Nenhum contato pendente...')
            ├─ se onError:
            │    UPDATE sends SET status='draft' + toast.error('Erro ao iniciar disparo: ' + err.message)
            └─ se sucesso:
                 toast.success('Disparo iniciado!')
                 → daqui, pg_cron sends-dispatch-batch assume (a cada 1min)

src/pages/CriarDisparo.tsx:52                        — wizard de criação
  ├─ useFilterLeads (filter-leads-for-send)          — preview de contatos
  ├─ useWhatsappChannels (settings_whatsapp_channels) — sem filtro, exceto active=true
  ├─ useWhatsappTemplates                            — sem filtro client-side de status
  ├─ filtragem `activeTemplates`:
  │    activeTemplates = templates.filter(t => t.system_enabled === true)  // ⚠️ não checa status='approved'
  ├─ validate() (linha 133-145):
  │    ✓ nome trim
  │    ✓ filterResult.total > 0 OU importResult.total > 0
  │    ✓ waChannelId definido (whatsapp)
  │    ✓ templateId definido (whatsapp)
  │    ✗ NÃO valida meta_template_name preenchido no template
  │    ✗ NÃO pede variables_map por contato
  │    ✗ NÃO valida que template.status === 'APPROVED'
  └─ useCriarSend ──────────► INSERT sends + INSERT sends_contacts batch
        (useSendMutations.ts:49-111)
        ├─ insertSendContacts: { send_id, people_id, whatsapp, status:'pending' }  // sem variables_map
        └─ se contact insert falhar: rollback DELETE sends
```

## Pontos onde a UI mascara erro do backend

### M1 — `handleAtivar` na lista não invoca worker
**Onde:** `src/pages/Disparos.tsx:86-96`.

```ts
const handleAtivar = (send: Send) => {
  updateSend(
    { id: send.id, data: { status: 'running', started_at: new Date().toISOString() } },
    { onSuccess: () => { toast.success('Disparo ativado!'); navigate(`/send/${send.id}`); } }
  );
};
```

Compare com `DisparoControls.handleStart` (linha 23-52) que **chama `useSendDispatch`** após o UPDATE. O usuário que ativa via lista (sem entrar no detalhe) não tem feedback se há contatos pendentes — depende 100% do pg_cron pegar no próximo minuto. Se o cron estiver quebrado, fica "Em andamento" indefinidamente. **Mesmo problema em `handleRetomar`** (linha 105-115).

**Surfacing perdido:** o caminho do detalhe checa `data.processed === 0` e reverte pra draft + toast.error informando "Nenhum contato pendente". A lista pula essa validação.

### M2 — `useSendDispatch.onError` parsing genérico
**Onde:** `src/hooks/useSendDispatch.ts:70-78`.

```ts
if (error) {
  let actualMsg = error.message;
  try {
    const body = await (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
    if (body?.error) actualMsg = body.error;
  } catch { /* ignore */ }
  throw new Error(actualMsg);
}
```

Tenta extrair `body.error` do contexto de erro do supabase-js, mas erros do worker que **viram 500 com texto plano** ou erros de JWT (401) caem no fallback genérico ("Edge Function returned a non-2xx status code"). O user vê "Erro ao iniciar disparo: Edge Function returned a non-2xx status code" — sem detalhe acionável.

**Caminho de erros real do worker** (do `[[sends-pro-dispatch-flow]]`):
- Template sem `meta_template_name` → throw 500 com `error: "Template <id> não encontrado ou sem meta_template_name configurado"` (`send-dispatch-worker:923-933`).
- Canal WA sem `phone_number_id`/`access_token` → throw 500 (`whatsapp-outbound:933-944`).
- `wa_channel_id` nulo na campanha → 500 (`send-dispatch-worker:732-734`).

Esses erros existem no body, mas o frontend só renderiza msg curta no toast. Sem trace ID, sem retry-helper.

### M3 — Erros por contato escondidos em tooltip
**Onde:** `src/components/disparos/TabelaContatos.tsx:247-253`.

```tsx
{contact.error_message ? (
  <div className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate" title={contact.error_message}>
    {contact.error_message}
  </div>
) : (...)}
```

`error_message` chega como mensagem completa de Meta API (ex: "(#132000) Number of parameters does not match expected number..."). Truncado em 200px, escondido em tooltip — **a maioria dos users não passa o mouse** e nunca lê. Não há filtro de "ver só falhas" pré-selecionado quando `failed_count > 0`.

### M4 — Sem painel agregado de saúde do disparo
**Onde:** `src/pages/DisparoDetalhes.tsx:60-138` (estrutura geral).

Não existe um card "Saúde do disparo" que sumarize:
- Última msg com `messages.status='sent'` (= cron OMNI alcançou Meta?).
- Quantas msgs em `messages.status='pending'` (= cron parado?).
- Quantas em `messages.status='error'` com `metadata.last_error`.
- Status do `_app_config.service_role_key` (P0 do RCA).
- Status do canal WhatsApp escolhido (`active`, `is_default`, `phone_number_id` válido).

`PerformanceCard` (`src/components/disparos/PerformanceCard.tsx:38`) mostra apenas "X envios/min" calculado a partir de `intervalSeconds` — número teórico, não observado. Se o cron está quebrado o card mostra "1 envio/min" mesmo enviando zero.

### M5 — `useSends` sem refetch agressivo
**Onde:** `src/hooks/useSends.ts:11-48`.

`staleTime: 5 * 60 * 1000` (5min) e `refetchOnWindowFocus: false`. Numa lista de campanhas em execução, a UI só atualiza ao recarregar a página. O user que volta pra lista de uma aba aberta há 10min vê dados velhos sem indicador. Sem auto-poll de campanhas `running`.

`useSend` (linha 50-77) tem `refetchInterval` configurado em `DisparoDetalhes.tsx:18-21` (15s quando running) — esse caminho está OK, mas só na view de detalhe.

## Pontos onde a UI permite estado inválido

### V1 — Template sem `meta_template_name` selecionável
**Onde:** `src/pages/CriarDisparo.tsx:97`.

```ts
const activeTemplates = templates?.filter(t => t.system_enabled === true) ?? [];
```

`useWhatsappTemplates` (`src/hooks/useWhatsappTemplates.ts:33-53`) já carrega `meta_template_name`, mas o filtro **ignora**. O user pode escolher um template recém-criado sem `meta_template_name` (situação real, foi a causa do RCA bug 1 — confirmado em `[[2026-05-01-taskforce-sends-omni-rca]]`). O wizard cria a campanha, o user clica Play, e o worker rejeita 100% dos contatos com:

> Template ${id} não encontrado ou sem meta_template_name configurado — preencha o campo "ID externo (Meta)" no template

Comparação:
- `WhatsappTemplateModal.tsx:251` (Conversas): filtra `t.status?.toLowerCase() === 'approved' && t.system_enabled === true` ✅
- `WhatsappTemplatePickerModal.tsx:31` (Followups): filtra `t.status?.toLowerCase() === 'approved'` ✅
- `CriarDisparo.tsx:97` (SENDS): apenas `system_enabled` ❌
- `ConfiguracaoDisparoTab.tsx:45`: idem ❌

### V2 — Canal sem `is_default`, sem alerta de fallback
**Onde:** `src/pages/CriarDisparo.tsx:89-95`.

```ts
React.useEffect(() => {
  if (!waChannelId && waChannels?.length) {
    const def = waChannels.find(c => c.is_default) ?? waChannels[0];
    setWaChannelId(def.id);
  }
}, [waChannels, waChannelId]);
```

Auto-seleciona o canal default OU o primeiro. O user pode salvar a campanha com um canal que **não tem `is_default=true` e não tem `active=true`** desde que o canal exista — porque o select sidebar filtra apenas active=true (`useWhatsappChannels.ts:23`). Mas se NENHUM canal tem `is_default=true`, o `whatsapp-outbound` (P1 do RCA, `whatsapp-outbound/index.ts:846-931`) cai no fallback "qualquer active=true limit 1" — pode disparar de número errado em multi-canal sem aviso na UI.

A UI sequer mostra o badge "padrão" quando o canal selecionado **não é default**.

### V3 — Variáveis de template (`variables_map`) inexistentes na UI
**Onde:** `src/pages/CriarDisparo.tsx` (busca completa: `variables_map` não aparece em nenhum lugar da UI de SENDS).

O `send-dispatch-worker:941-967` resolve variáveis posicionais lendo:
1. `sends_contacts.variables_map` (jsonb por contato) — **nunca preenchido pela UI**.
2. Fallback: `lead_field_values` por `(person_id, q_field_id)` — depende do CRM ter dados.
3. Fallback final: string vazia.

Se um template é `Olá {{1}}, seu pedido {{2}} está pronto`, o `{{1}}` resolve do `clients_people.name` (assumido), mas `{{2}}` precisa estar em algum `lead_field_values`. **A UI não mostra nem alerta** que o template tem 2 variáveis e que apenas a 1 será preenchida automaticamente. Resultado: Meta rejeita "Number of parameters does not match" ou envia "Olá João, seu pedido está pronto" (com vazio) e o user descobre só após-falha.

`WhatsappTemplatePreview` mostra o body do template com `{{1}}, {{2}}` literal — sem aviso "este template requer N variáveis e você não mapeou X delas".

### V4 — Webhook não validado antes do Play
**Onde:** `src/hooks/useSendDispatch.ts:18-42` (`useValidateWebhook` existe mas não é chamado).

Existe um hook `useValidateWebhook` que invoca `send-dispatch-worker` com `validate_only:true`, mas **nenhum componente do wizard ou do detalhe o chama antes do Play**. O user ativa um disparo com webhook quebrado, descobre na hora.

### V5 — Wizard permite criar com canal sem `phone_number_id`
**Onde:** `src/pages/CriarDisparo.tsx:140` apenas valida `waChannelId`.

```ts
if (channel === 'whatsapp' && !waChannelId) {
  toast.error('Selecione um número WhatsApp para o disparo');
  return false;
}
```

Não verifica que o canal tem `phone_number_id` e `access_token` populados. Como `useWhatsappChannels` traz `phone_number_id` (linha 22), seria trivial mostrar status. Hoje o user pode selecionar um canal recém-criado com placeholders — falha só no worker.

### V6 — Status mudado direto no DB (sem invoke)
**Onde:** `Disparos.tsx:86-96, 105-115` e `DisparoControls.tsx:54-83, 65-73, 75-83`.

Praticamente todo botão (`Pausar`, `Retomar`, `Reabrir`, `Parar`) faz `UPDATE sends.status` direto no client. O backend não tem trigger validando transições — é possível ir de `completed → draft → running` sem qualquer validação. Em particular, **Retomar não verifica se ainda há `sends_contacts WHERE status='pending'`**: pode marcar como `running` uma campanha 100% completa, e o pg_cron consome 1min vazio até `sends-dispatch-batch` marcar `completed` de novo (`sends-dispatch-batch/index.ts` ao receber `has_more:false`).

Não é bug crítico, mas é estado inválido transitório.

## Cross-layer: o que o user vê hoje quando "não chega"

Cenário típico do bug João Guirunas (P0 service_role_key desincronizado):

1. User cria campanha. UI valida e cria sem reclamar.
2. User clica Play (no detalhe).
3. UI invoca worker → worker pega o 1º contato → INSERT em `messages` (status pending) → UPDATE `sends_contacts.status='sent'` no contato 1.
4. Toast.success("Disparo iniciado!") aparece no client.
5. UI mostra: 1 contato com status `sent` (parece que enviou) e demais `pending`.
6. **A partir daqui, depende do cron.** Se `_app_config.service_role_key` está desatualizado, ambos crons retornam 401 silenciosamente.
7. `messages.status='pending'` para sempre. `sends_contacts.status='sent'` (que na verdade é "enfileirado, não entregue" — semântica confusa).
8. User espera. UI mostra "Em andamento". KPI "Mensagens enviadas" mostra 1 (o que o worker fez). Nenhum erro.
9. Após 24h, `MAX_AGE_HOURS=24` no `omni-delivery-engine` faz a msg expirar. Sem alerta.
10. User abre TabelaContatos. Vê 1 `sent` e N `pending`. Clica no contato `sent` — não há indicador de "entregue ou não". Coluna "Erro" vazia. Vai embora pensando que "1 mensagem foi enviada".

**A confusão semântica `sends_contacts.status='sent'` (= worker enfileirou) vs entrega real é o ponto que mais mascara o problema na UI.** Já existe doc `[[sends-status-callback-analysis]]` que mostra que `delivered_at`/`read_at` ficam NULL — esse audit confirma que a UI também não diferencia.

## Achados em ordem de impacto (UI/cross-layer)

| # | Severidade | Onde | Impacto |
|---|---|---|---|
| V1 | **P1** | `CriarDisparo.tsx:97`, `ConfiguracaoDisparoTab.tsx:45` | User seleciona template sem `meta_template_name` e descobre só após Play. **Bate diretamente com o RCA bug 1.** |
| V3 | **P1** | `CriarDisparo.tsx` (não existe) | Variables_map inexistente. Templates multi-variável falham silenciosamente ou enviam dados vazios. |
| M1 | **P1** | `Disparos.tsx:86, 105` | "Ativar" e "Retomar" da lista não invocam worker — sem feedback de "0 contatos pendentes" ou "canal inválido" antes do cron. |
| M4 | **P1** | `DisparoDetalhes.tsx` | Sem painel de saúde agregando estado de cron + canal + msgs pendentes. RCA P0 invisível ao user. |
| M3 | **P2** | `TabelaContatos.tsx:247-253` | Erros truncados em tooltip 200px. User precisa hover contato a contato. |
| V2 | **P2** | `CriarDisparo.tsx:89-95` | Auto-select de canal cai em fallback sem alertar. Multi-canal: dispara do número errado. |
| V5 | **P2** | `CriarDisparo.tsx:140` | Não valida que canal tem `phone_number_id`/`access_token`. |
| M2 | **P2** | `useSendDispatch.ts:70-78` | Parsing de erro do worker é fraco; users veem "non-2xx" sem causa. |
| M5 | **P3** | `useSends.ts:11-48` | Lista de campanhas com staleTime 5min. Dados velhos sem polling em campanhas `running`. |
| V4 | **P3** | `useSendDispatch.ts:18-42` | `useValidateWebhook` existe mas não é chamado pré-Play. |
| V6 | **P3** | múltiplos | Transições de status sem trigger no DB; permite estados transitórios inválidos. |

## Recomendações (sem implementar — para próxima sessão)

### Pré-Play guards (frontend, sem mudança de schema)

1. **Filtrar templates por `meta_template_name != null` E `status === 'APPROVED'`** em `CriarDisparo.tsx:97` e `ConfiguracaoDisparoTab.tsx:45` — alinhar com `WhatsappTemplateModal.tsx:251`. Mostrar dica visual "Template ainda não publicado" ao lado de templates filtrados, link para a tela de templates.
2. **Validar que o canal tem `phone_number_id` e `access_token`** (use `WhatsappChannelsConfig` que já tem badge "Configurado"). `useWhatsappChannels` precisa retornar essa info — ainda hoje não retorna `access_token` (segurança), mas pode retornar boolean `has_token`.
3. **Computar `template.variables.length`** (json_data já tem) e exigir `variables_map` por contato OR mostrar warning "Este template tem N variáveis. Apenas {{1}} (nome do contato) será preenchido automaticamente. Os demais virão vazios.".
4. **Chamar `useValidateWebhook` automaticamente** pré-Play se webhook estiver configurado.

### Surfacing de erro

5. **Substituir tooltip truncado** em TabelaContatos por uma célula "Status detalhado" com botão "Ver erro" abrindo modal — agrupar erros por causa (Meta error code).
6. **Card de saúde do disparo** em DisparoDetalhes:
   - Última msg `messages.status='sent'` neste send.
   - Contagem de msgs em `pending > 5min` (= cron parado?).
   - Validação `_app_config` (precisa de RPC pública, nova).
   - Status do canal selecionado.
7. **Toast actionable**: ao receber erro do worker, mapear códigos comuns (132000, 131009, 131056) pra mensagens "user-friendly" + link "Ver template" / "Configurar canal".

### Consistência

8. **`handleAtivar`/`handleRetomar` da lista** invocam o 1º batch igual ao detalhe. Sem isso, os dois caminhos têm UX divergente.
9. **`useSends` poll a cada 30s** se houver alguma campanha `status='running'` — atualizar contadores de KPIs sem reload manual.
10. **Banner global** em DashLayout: "Cron de disparo offline há > 5min" — precisa de RPC server-side (ex: `SELECT now() - last_batch_at FROM sends WHERE status='running'`).

### Backend changes que destravariam o frontend

11. **`useWhatsappChannels` precisa devolver `has_token`** (boolean derivado server-side; `access_token` em si NÃO deve trafegar pro client). Já existe `WhatsappChannelsConfig.tsx:240-243` mostrando "Token salvo" em modal de edição — replicar como flag.
12. **RPC `get_send_health(send_id)`** retornando `{ pg_cron_alive, last_dispatch_at, pending_count, error_count_by_reason }` para o card de saúde sem precisar de N queries.
13. **`send-dispatch-worker` retornar JSON estruturado** `{ success: false, error: { code, message, hint } }` em vez de só string genérica — useSendDispatch ganha actionable info.

## Limitações deste audit

- Não rodei o app — análise estática de TSX/TS.
- Não testei o caminho real de criação→play→falha em João Guirunas.
- Não inspecionei mobile (`src/components/mobile/`).
- Não cobri `CriarDisparoModal.tsx` (existe mas não é o caminho ativo das pages).
- Não verifiquei se as edge fns de fato retornam o JSON estruturado que `useSendDispatch` tenta extrair.

## Fontes (FE)

- `src/pages/Disparos.tsx` (432 linhas)
- `src/pages/CriarDisparo.tsx` (582 linhas)
- `src/pages/DisparoDetalhes.tsx` (140 linhas)
- `src/components/disparos/DisparoControls.tsx` (183 linhas)
- `src/components/disparos/ConfiguracaoDisparoTab.tsx` (262 linhas)
- `src/components/disparos/TabelaContatos.tsx` (299 linhas)
- `src/components/disparos/PerformanceCard.tsx` (134 linhas)
- `src/hooks/useSendDispatch.ts` (102 linhas)
- `src/hooks/useSendMutations.ts` (219 linhas)
- `src/hooks/useSends.ts` (78 linhas)
- `src/hooks/useSendContacts.ts` (47 linhas)
- `src/hooks/useWhatsappChannels.ts` (30 linhas)
- `src/hooks/useWhatsappTemplates.ts` (54 linhas)
- `src/components/config/WhatsappChannelsConfig.tsx` (form de canal)

## Cross-references

- Pipeline server-side completo + autenticação Meta + falhas P0–P3: [[sends-pro-dispatch-flow]]
- RCA dos dois bugs João Guirunas (template não chega + agente IA): [[2026-05-01-taskforce-sends-omni-rca]]
- `send-status-callback` órfão / `delivered_at` sempre NULL: [[sends-status-callback-analysis]]
- Schema drift João Guirunas: [[../../archive/2026-05-01-ora-schema-drift]]
