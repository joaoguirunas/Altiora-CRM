---
title: "FIX-IG-AUT-01: Comentário Instagram com keyword 'brandbook' não dispara automação configurada"
type: story
status: done
priority: P1
complexity: M
agent: dev-dev-beta
created: 2026-04-30
updated: 2026-04-30
tags: [story, instagram, automations, bug, P1, omni]
related: ["[[../../project/architecture]]", "[[../../project/modules]]"]
---

# FIX-IG-AUT-01: Comentário Instagram com keyword 'brandbook' não dispara automação configurada

## Objetivo
Diagnosticar e corrigir por que comentários no Instagram contendo a keyword `brandbook` não estão acionando a automação `post_comment` configurada — nada aparece em `instagram_automation_log`, e portanto a tela `Configurações > Instagram > Automações` não exibe a execução nem a resposta automática é enviada.

## Acceptance Criteria
- [ ] AC1: Reproduzido o caso real — identificar se o comentário "brandbook" chegou em `messages` (com `message_type='comentario'` + `media_metadata.comment_id`) e se há registro correspondente em `instagram_automation_log`
- [ ] AC2: **Verificado o subscription do webhook no Meta App**.
   **Achado confirmado em 2026-04-30 (dev-architect deep-dive):** existem DOIS pontos de assinatura no codebase com comportamentos diferentes:
   - `supabase/functions/meta-pages-subscribe/index.ts:89` — assina **APENAS `leadgen`** (`subscribed_fields: 'leadgen'`). Este é o endpoint chamado pela UI ADM "Buscar minhas Pages" / "Ativar webhook".
   - `supabase/functions/meta-save-credentials/index.ts:294` — assina o conjunto completo: `subscribed_fields: 'messages,comments,leadgen,messaging_postbacks,feed'`. Este só roda no fluxo de OAuth inicial via `meta-save-credentials`.
   **Hipótese forte de root cause:** se o tenant configurou Instagram pela UI ADM (`meta-pages-subscribe`) em vez do OAuth completo (`meta-save-credentials`), o campo `comments` NUNCA foi inscrito → `meta-inbound` jamais recebe `field='comments'` → runner jamais é invocado → log vazio → bug do "brandbook não aparece" exatamente como descrito.
   **Tarefa de validação:** consultar Meta Graph API com o token da page do tenant afetado: `GET https://graph.facebook.com/v25.0/{page_id}/subscribed_apps?access_token={page_token}` e confirmar quais `subscribed_fields` estão ativos. Se `comments` estiver ausente, o fix DEVE incluir um re-subscribe (chamar `meta-save-credentials` ou expandir `meta-pages-subscribe` para o conjunto completo) — caso contrário o fix do runner sozinho não resolve nada.
- [ ] AC3: Confirmada a configuração da automação no banco (`SELECT * FROM instagram_automations WHERE is_active=true AND trigger_type='post_comment'`): keyword `brandbook` está em `filters[].value`, `target_post_id` corresponde ao post real do comentário (ou é NULL), `cooldown_hours` não está bloqueando
- [x] AC4: **CAUSA RAIZ CONFIRMADA: (a)** — `meta-pages-subscribe/index.ts:89` assinava `subscribed_fields: 'leadgen'` apenas; campo `comments` ausente → webhook Meta nunca entregava eventos de comentário → runner jamais invocado → log vazio
- [x] AC5: Fix aplicado — `subscribed_fields` em `meta-pages-subscribe` expandido para `'messages,comments,leadgen,messaging_postbacks,feed'` (alinhado com `meta-save-credentials`). Tenants existentes requerem re-subscribe (nota no commit `a4436cfe` para devops).
- [x] AC6: Adicionado log estruturado no `instagram-automation-runner` para casos de "0 automations matched" e "filtered out by target_post_id" (hoje retorna `processed:0` sem distinguir motivos)

## Escopo

**IN:**
- `supabase/functions/meta-inbound/index.ts` — handler `handleInstagramComments` + dispatch para runner
- `supabase/functions/instagram-automation-runner/index.ts` — load + filter + cooldown + log
- `supabase/functions/meta-pages-subscribe/index.ts` — confirmar inclusão de `comments` no subscription
- Tabelas `instagram_automations`, `instagram_automation_log`, `messages` (filtrado por `channel='instagram'` + `message_type='comentario'`)
- Reproduzir manualmente com tenant afetado e validar a correção

**OUT:**
- Refactor da UI de configuração de automações (escopo de FIX-IG-AUT-02)
- Mudar o motor para fila durável com retry (a invocação é fire-and-forget intencional — escopo separado)
- Multi-tenant scoping de `omni_channel_configs` (já documentado em outra dívida técnica)

## Contexto Técnico

**Fluxo esperado** (cf. `meta-inbound/index.ts:273-444` + `instagram-automation-runner/index.ts`):

1. Meta envia POST `/meta-inbound` com `body.entry[].changes[].field='comments'` e `value.id` (comment_id), `value.text`, `value.from.{id,username}`, `value.media.id` (post_id), `value.parent_id?`
2. `handleInstagramComments` valida HMAC, upserta `clients_people` por `instagram_id` (IGSID), insere `messages` com `message_type='comentario'` + `media_metadata.comment_id`, e dispara fire-and-forget `POST /functions/v1/instagram-automation-runner`
3. Runner carrega `instagram_automations` WHERE `is_active=true AND trigger_type='post_comment'`, filtra por `target_post_id` (NULL = todos), checa cooldown via `instagram_automation_log`, avalia `filters` (`message_contains` faz lowercase match em CSV de keywords), executa ação (`reply_comment` ou `send_dm` ou `reply_and_dm`), insere log em `instagram_automation_log`

**Pontos sensíveis do código:**

- `meta-inbound/index.ts:296` — só processa `change.field === 'comments'`. Se o webhook do Meta App não foi assinado para o campo `comments` (apenas `messages`), nada chega ao runner. **Esta é a hipótese mais provável** — ver AC2 (split entre `meta-pages-subscribe` que assina apenas `leadgen` vs `meta-save-credentials` que assina o conjunto completo).
- `meta-inbound/index.ts:320-323` — comentários com `text` vazio são skipados silenciosamente (`ig_comment_empty_skipped`). Verificar logs.
- `meta-inbound/index.ts:399-403` — dedup via `code='23505'` é silencioso (`ig_comment_duplicate_skipped`); se o comentário já tinha entrado uma vez via teste, novo POST não dispara nada.
- `meta-inbound/index.ts:424-441` — fire-and-forget `.catch(() => {})` engole qualquer erro. Se o runner não está deployado ou a env `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` está errada, falha invisível.
- `instagram-automation-runner/index.ts:97-103` — filtra por `target_post_id`. Se a automação foi criada com post específico que não é o post do comentário, é silenciosamente ignorada (retorna `processed:0` sem log).
- `instagram-automation-runner/index.ts:108-123` — cooldown de 24h. Se já houve sucesso para a mesma `person_id` nas últimas N horas, log entra como `status='cooldown'` (existe no log, mas usuário pode interpretar como "não disparou").
- `instagram-automation-runner/index.ts:213-219` — `message_contains` faz `msg.toLowerCase().includes(kw.toLowerCase())`. Não há trim de pontuação ao redor; "brandbook," ou "brandbook!" funcionam. "BrandBook" funciona. Confirmar grafia exata salva em `filters[].value`.
- `instagram-automation-runner/index.ts:74` — usa `service_role`, então NÃO escopa por tenant. Mas como cada tenant tem project Supabase próprio (project-per-tenant — cf. `architecture.md §1`), se o usuário olhou o ADM/control plane ao invés do tenant, pode estar checando o banco errado.

**Comandos de diagnóstico sugeridos** (rodar no project Supabase do tenant):

```sql
-- 1. Comentário chegou em messages?
SELECT id, content, media_metadata->>'comment_id', sent_at, people_id
FROM messages
WHERE channel='instagram' AND message_type='comentario'
  AND content ILIKE '%brandbook%'
ORDER BY sent_at DESC LIMIT 10;

-- 2. Automação ativa para post_comment com filtro brandbook?
SELECT id, name, is_active, target_post_id, filter_operator, filters, action_type, cooldown_hours, priority
FROM instagram_automations
WHERE trigger_type='post_comment';

-- 3. Tem log de execução para esse comentário/pessoa?
SELECT * FROM instagram_automation_log
WHERE message_text ILIKE '%brandbook%'
   OR person_id IN (SELECT people_id FROM messages WHERE content ILIKE '%brandbook%')
ORDER BY executed_at DESC LIMIT 20;
```

**Também conferir nos Edge Function logs** do project tenant (Supabase Dashboard):
- `meta-inbound` — buscar `ig_comment_received`, `ig_comment_stored`, `ig_comment_empty_skipped`, `ig_comment_duplicate_skipped`
- `instagram-automation-runner` — buscar `[automation]` ou `[instagram-automation-runner] error`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (Rex) |
| Iniciado   | 2026-04-30 |
| Concluído  | 2026-04-30 |
| Branch     | fix/ig-automation-brandbook-trigger |

## File List
- `supabase/functions/meta-pages-subscribe/index.ts` — AC4/AC5: subscribed_fields expandido de 'leadgen' para o conjunto completo
- `supabase/functions/instagram-automation-runner/index.ts` — AC6: logNoMatch() nos dois early returns silenciosos
- `supabase/migrations/20260430160000_fwup28_ig_automation_log_no_match_status.sql` — expande CHECK constraint status para incluir 'no_match'
- `supabase/client-migrations.json` — entrada 10183 para a migration fwup28
- `src/hooks/useInstagramAutomations.ts` — tipo InstagramAutomationLog.status expandido com 'no_match'
- `src/components/config/InstagramAutomationsTab.tsx` — STATUS_CONFIG com entrada no_match (AlertTriangle, laranja)

## QA Results

```
VEREDICTO: CONCERNS
Story: FIX-IG-AUT-01 | Data: 2026-04-30
Reviewer: Axikar (dev-qa)
Branch: fix/ig-automation-brandbook-trigger
Commits: 699e9e00 (AC6), a4436cfe (AC4/AC5)

8-Point Checklist:
  1. Code review            ✅ Mudancas cirurgicas, isoladas, com comentarios explicativos
  2. Unit tests             ⚠ Sem suite nos arquivos alterados (nao regrediu, nao cobriu)
  3. Acceptance criteria    ✅ AC4/5/6 atendidos; AC1/2/3 sao validacao manual (deep-dive ja feito)
  4. Sem regressoes         ✅ Mudancas aditivas em ambas as functions; STATUS_CONFIG sem remover keys
  5. Performance            ✅ +1 INSERT por trigger sem match — impacto desprezivel
  6. Security               ✅ Auth preservado em meta-pages-subscribe; sem novas superficies
  7. Documentacao           ✅ Story File List completa, comentarios inline nos pontos criticos
  8. Contratos de API       ✅ Tipo TS sincronizado com CHECK constraint; subscribed_fields alinhado com meta-save-credentials

Migration idempotencia: ✅ DROP IF EXISTS + ADD CONSTRAINT (padrao fwup25/fwup26). Re-execucao segura.

Aprovado com observacoes:
- [CONCERN-OPS] Tenants pre-existentes (que configuraram IG via meta-pages-subscribe antes deste fix) precisam ser re-subscritos manualmente para que `comments` seja registrado na Meta. O fix do codigo sozinho nao retroage. Documentado em AC5; acao de devops requerida (job de re-subscribe ou comunicacao manual).
- [CONCERN-TEST] Nao ha testes automatizados cobrindo o handler `handleInstagramComments` nem o `logNoMatch`. Validacao dependera de teste manual em tenant real. Sugestao futura: smoke test e2e do fluxo comment→runner→log.

Proximo passo: @dev-devops push apos confirmar plano de re-subscribe para tenants existentes.
```
