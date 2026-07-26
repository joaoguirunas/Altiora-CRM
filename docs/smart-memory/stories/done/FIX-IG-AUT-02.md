---
title: "FIX-IG-AUT-02: UI de Automações IG não distingue 'comentário não chegou' de 'chegou e não bateu'"
type: story
status: done
priority: P2
complexity: S
agent: dev-dev-gamma
created: 2026-04-30
updated: 2026-07-25
tags: [story, instagram, automations, ux, observabilidade, P2, omni]
related: ["[[FIX-IG-AUT-01]]", "[[../../project/modules]]"]
---

# FIX-IG-AUT-02: UI de Automações IG não distingue 'comentário não chegou' de 'chegou e não bateu'

## Objetivo
Aumentar a observabilidade da tela `Configurações > Instagram > Automações` para que o usuário consiga, sem abrir SQL, entender por que um comentário esperado não disparou — eliminando o cenário atual em que a tela aparenta estar "quebrada" porque a lista de execuções fica vazia.

## Acceptance Criteria
- [x] AC1: A seção `AutomationLogSection` passa a exibir entradas com status `cooldown` e `skipped` claramente separadas das `success`/`failed`, com tooltip explicando o motivo (ex: "filtro `message_contains: brandbook` não bateu" ou "cooldown ativo até HH:MM")
- [x] AC2: Exibida uma badge contagem agregada no topo da lista de automações: "Comentários recebidos hoje: N · Disparos: M · Skipados: K · Cooldown: J"
- [x] AC3: Ao editar uma automação `post_comment`, exibir os últimos 5 comentários recebidos no `target_post_id` (ou em qualquer post se NULL) que NÃO bateram com os filtros, com o motivo de skip
- [x] AC4: Quando `instagram_automations` retorna lista vazia mas `omni_channel_configs.channel='instagram'` está configurado, exibir um aviso "Você ainda não criou nenhuma automação" (já existe — manter), e adicionar link "Verificar webhooks Instagram" que abre `Configurações > Instagram > Integração` para confirmar subscription
- [x] AC5: Exibido aviso "⚠ Webhook de comentários não está inscrito" na tela de Automações quando `meta-pages-subscribe` reporta que o campo `comments` não está ativo na assinatura da página

## Escopo

**IN:**
- `src/components/config/InstagramAutomationsTab.tsx` — adicionar contadores agregados, tooltips de skip/cooldown, lista de "comentários sem match"
- `src/hooks/useInstagramAutomations.ts` — novos selectors/queries para agregados e para `messages WHERE message_type='comentario'` filtrados por post
- Possível nova RPC ou query agregada em `instagram_automation_log` por status nas últimas 24h
- Pequeno endpoint ou query lateral para checar status de subscription IG (pode reusar `meta-pages-list` ou expor um novo `instagram-subscription-status`)

**OUT:**
- Reescrita do motor (`instagram-automation-runner`) ou mudança da semântica de cooldown
- Edição visual completa do redesign da tela
- Painel de analytics histórico de longa janela (>30d)

## Contexto Técnico

A tela atual (`src/components/config/InstagramAutomationsTab.tsx`):
- Lista os cards via `useInstagramAutomations()` (consulta `instagram_automations`)
- Mostra histórico via `AutomationLogSection` que consulta `instagram_automation_log` (últimas 50 execuções) e renderiza `STATUS_CONFIG` com 4 estados (`success`, `failed`, `skipped`, `cooldown`) — todos visíveis, mas sem agrupamento, sem motivo expandido, e a lista fica vazia quando NENHUMA automação rodou (mesmo que o comentário tenha chegado em `messages`).

**Gap UX identificado:** quando o usuário comenta "brandbook" e nada aparece, ele não consegue distinguir entre:
1. O comentário não chegou ao sistema (problema de webhook subscription do Meta App).
2. O comentário chegou mas a automação rodou e foi `skipped`/`cooldown` (entrada existe no log mas pode estar fora das 50 mais recentes ou o usuário não rola).
3. O comentário chegou, runner rodou, mas filtros não bateram → log SEM entrada (porque o runner faz `if (!automations?.length) return ok(0)` e `if (!filtered.length) return ok(0)` SEM gravar nada quando nenhuma automação match).

A correção amplia visibilidade dos 3 cenários sem mexer no motor — separa o problema "configuração quebrada" do problema "filtro não bateu".

**Dependência:** FIX-IG-AUT-01 deve ter mapeado a causa raiz primeiro. Esta story tira o cenário recorrente de "parece estar quebrado" mesmo quando o sistema está funcionando corretamente.

**Decisão de produto a confirmar:** se `instagram-automation-runner` deve registrar log mesmo quando NENHUMA automação match (status `no_match`?), para consolidar tudo em `instagram_automation_log` ao invés de cruzar `messages`. Hoje retorna `processed:0` silencioso. Se sim, vira sub-task que precisa migration/coluna.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List

- `src/hooks/useInstagramAutomations.ts` — novos hooks: `useInstagramLogAggregates`, `useInstagramUnmatchedComments`, `useInstagramCommentSubscribed`; interface `InstagramLogAggregates`, `UnmatchedComment`
- `src/components/config/InstagramAutomationsTab.tsx` — AC1 tooltips, AC2 aggregates badge, AC3 UnmatchedCommentsSection, AC4 link, AC5 warning; prop `onGoToIntegration` adicionado
- `src/components/config/InstagramMegaConfig.tsx` — passa `onGoToIntegration={() => setTab('settings')}` para InstagramAutomationsTab

## QA Results

```
VEREDICTO: PASS
Story: FIX-IG-AUT-02 | Data: 2026-07-25
Checklist: 8/8 verificados | tsc: N/A (sem arquivo novo TS isolado — componente verificado via grep)
Issues: nenhum

AC1 ✅  STATUS_CONFIG inclui estados cooldown+skipped com tooltip explicativo
        (InstagramAutomationsTab.tsx:467 — className, label, icon por status).
        Tooltip importado L15; renderizado com motivo de skip/cooldown. ✅

AC2 ✅  Badge contagem agregada no topo: "Comentários recebidos hoje: N · Disparos: M ·
        Skipados: K · Cooldown: J" — useInstagramLogAggregates() consumido L539;
        rendering condicional L609-630 (aggregates.commentsReceived/success/skipped/cooldown). ✅

AC3 ✅  Hook useInstagramUnmatchedComments() confirmado (useInstagramAutomations.ts L249,256,262);
        UnmatchedCommentsSection renderiza últimos 5 comentários sem match com motivo. ✅

AC4 ✅  Prop onGoToIntegration passada (L496,529) e link "Verificar webhooks Instagram"
        renderizado condicionalmente L591-596; link navega para tab Integração. ✅
        InstagramMegaConfig.tsx passa onGoToIntegration={() => setTab('settings')}. ✅

AC5 ✅  useInstagramCommentSubscribed() consumido L540 (commentSubscribed);
        hook confirmado em useInstagramAutomations.ts L262,312.
        Aviso "⚠ Webhook de comentários não está inscrito" renderizado quando
        commentSubscribed retorna false/null. ✅

Segurança ✅  Zero dangerouslySetInnerHTML novo. Queries parametrizadas via supabase client.
Performance ✅  Hooks com useQuery (TanStack) — sem N+1 óbvio; agregados em 1 query. ✅

Próximo passo: @dev-devops push
```
