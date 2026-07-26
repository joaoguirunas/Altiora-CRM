---
title: Triagem do Backlog SENDS PRO
type: triage
agent: dev-architect
created: 2026-05-01
updated: 2026-05-01
tags: [sends-pro, triage, backlog, ora-fix-sends-module]
related: ["[[../../stories/BACKLOG]]", "[[../../project/audit-sends-pro]]", "[[../../project/modules/sends-pro]]"]
---

# Triagem do Backlog SENDS PRO

Inventário e priorização de todas as stories `FIX-SENDS-*`, `SENDS-*` e `CLEAN-SENDS-*` em `docs/smart-memory/stories/backlog/`, executada para o time `ora-fix-sends-module` em 2026-05-01.

Base: leitura completa das 16 stories, audit em [[../../project/audit-sends-pro]] (commit `23f7fd60`), módulo deep-dive [[../../project/modules/sends-pro]] e BACKLOG.md.

---

## Inventário

| ID | Título (1-linha) | Status atual | Severidade | Depende de | Conflita com |
|---|---|---|---|---|---|
| [[../../stories/backlog/FIX-SENDS-FIRST-MSG-01]] | Primeira mensagem do disparo aparece no Omni mas não chega ao cliente | backlog (nova) | **P0** | dev-analyst RCA | possível overlap com FIX-SENDS-DISPATCH-01 (race) e FIX-OMNI-01 (whatsapp-outbound) — confirmar pós-RCA |
| [[../../stories/backlog/SENDS-FIX-01]] | Auditoria completa de quebras no módulo SENDS PRO | backlog (entregue — audit-sends-pro.md já existe; AC8 marcado [x]) | P1 | — | — |
| [[../../stories/backlog/FIX-SENDS-FILTER-01]] | Corrigir filtro `person_status` ignorado em filter-leads-for-send | backlog | **P1** | — | — |
| [[../../stories/backlog/FIX-SENDS-FILTER-02]] | Corrigir `has_more` com count real em filter-leads-for-send | backlog | **P1** | — | — |
| [[../../stories/backlog/FIX-SENDS-DISPATCH-01]] | Atomic claim em sends-dispatch-batch via UPDATE+RETURNING (race) | backlog | **P1** | FIX-SENDS-01 (done) | candidato a sobreposição parcial com FIX-SENDS-FIRST-MSG-01 dependendo do RCA |
| [[../../stories/backlog/FIX-SENDS-DISPATCH-02]] | Reduzir retry delays inline em send-dispatch-worker | backlog | P2 | — | — |
| [[../../stories/backlog/FIX-SENDS-IMPORT-03]] | Criar lead para contatos existentes quando create_leads=true | backlog | P2 | SENDS-IMPORT-01/02 (done) | — |
| [[../../stories/backlog/FIX-SENDS-IMPORT-04]] | Dedup e insert em bulk para imports >1000 contatos | backlog | P2 | FIX-SENDS-IMPORT-03 | — |
| [[../../stories/backlog/FIX-SENDS-IMPORT-05]] | Lead extras visíveis no FieldMapper sem createLeads | **done (commit b2800baf)** | P2 | SENDS-IMPORT-02 (done) | — |
| [[../../stories/backlog/FIX-SENDS-IMPORT-06]] | Reintroduzir input estático de lead_control no ImportListaTab | **done (commit b2800baf)** | P2 | SENDS-IMPORT-01 (done) | — |
| [[../../stories/backlog/FIX-SENDS-UI-01]] | Não sobrescrever started_at ao retomar disparo pausado | backlog | P2 | — | — |
| [[../../stories/backlog/FIX-SENDS-UI-02]] | Corrigir timezone em scheduled_at ao criar disparo agendado | backlog | P2 | — | — |
| [[../../stories/backlog/FIX-SENDS-01]] | Mover dispatch loop do browser para servidor (pg_cron) | **done (FIX-SENDS-01 QA: CONCERNS, funcional)** | P1 | — | — |
| [[../../stories/backlog/SENDS-IMPORT-01]] | Simplificar fluxo de importação — remover templates/presets | backlog (Dev Agent: concluído) | P2 | — | — |
| [[../../stories/backlog/SENDS-IMPORT-02]] | Expandir campos mapeáveis — Q-fields + empresa estruturada | **done** | P1 | — | — |
| [[../../stories/backlog/CLEAN-SENDS-01]] | Tipos gerados sends_contacts + FK stage_ids/template_id | backlog (Dev Agent: concluído mas no backlog/) | P3 | — | — |
| [[../../stories/backlog/CLEAN-SENDS-MIGRATION-01]] | Remover migration duplicada + config.toml para sends-dispatch-batch | **done** | P3 | FIX-SENDS-01 (done) | — |

### Observações de status

- 6 stories já têm Dev Agent Record marcado como concluído mas continuam fisicamente em `backlog/`. Sugerido que o Chief mova-as para `stories/done/` em uma higienização separada (fora do escopo desta triagem) — `FIX-SENDS-01`, `SENDS-IMPORT-01`, `SENDS-IMPORT-02`, `FIX-SENDS-IMPORT-05`, `FIX-SENDS-IMPORT-06`, `CLEAN-SENDS-MIGRATION-01`, `CLEAN-SENDS-01`.
- `SENDS-FIX-01` (auditoria) tem todos os ACs marcados [x] no próprio arquivo e o relatório `audit-sends-pro.md` está produzido — também candidato a `done/`.
- O BACKLOG.md ainda lista `SENDS-IMPORT-01` como `backlog` apesar do dev agent declarar concluído — divergência a reconciliar.

---

## Mapa de severidade pós-bug atual

```
P0 (1):  FIX-SENDS-FIRST-MSG-01  ← bug ativo reportado
P1 (3):  FIX-SENDS-FILTER-01, FIX-SENDS-FILTER-02, FIX-SENDS-DISPATCH-01
P2 (5):  FIX-SENDS-DISPATCH-02, FIX-SENDS-IMPORT-03, FIX-SENDS-IMPORT-04,
         FIX-SENDS-UI-01, FIX-SENDS-UI-02
```

Stories `done` ou de cleanup não entram nesta priorização para iteração corrente.

---

## Sobreposições e conflitos

### FIX-SENDS-FIRST-MSG-01 × FIX-SENDS-DISPATCH-01

A race condition descrita em `FIX-SENDS-DISPATCH-01` causa **double-dispatch** (mesma mensagem enviada duas vezes), enquanto o bug atual reportado é o oposto: **mensagem registrada mas não enviada**. Ainda assim, o claim atômico de `FIX-SENDS-DISPATCH-01` pode interagir com o bug atual se a primeira mensagem está perdida porque um claim parcial (UPDATE em `sends_contacts.status='sent'` sem o lado outbound completar) está deixando o registro num estado órfão.

**Decisão:** mantém-se ambas separadas. O dev-analyst (Lyra) está investigando o root cause em paralelo. Quando publicar `[[../research/sends-first-message-bug]]`, se o RCA apontar a mesma raiz da race, o Chief decide se funde ou marca uma como `superseded-by` da outra.

### FIX-SENDS-FIRST-MSG-01 × FIX-OMNI-01 (whatsapp-outbound)

A primeira mensagem WhatsApp passa por `messages.insert` (status `pending`) e depois por `omni-delivery-engine` que invoca `whatsapp-outbound`. Se a falha está no handoff, há sobreposição parcial com `FIX-OMNI-01` (action tokens em whatsapp-outbound). Recomendado o RCA da Lyra delimitar qual edge função está pifando antes de tomar decisão de fusão.

### Cleanups vs. P0/P1

- `CLEAN-SENDS-01` e `CLEAN-SENDS-MIGRATION-01` não conflitam com nenhuma story P0/P1 — podem ser executadas oportunisticamente, mas **não devem entrar nesta iteração** enquanto P0/P1 estiverem abertas.

---

## Recomendação de ordem de execução

A iteração corrente do time `ora-fix-sends-module` deve atacar **3 stories** nesta ordem:

### 1. FIX-SENDS-FIRST-MSG-01 (P0, bloqueante)
Bug em produção. Bloqueia fluxo end-to-end de qualquer disparo WhatsApp. Sem essa correção, todas as stories FIX-SENDS-* abaixo estão tratando sintomas em um sistema que não envia. **Awaiting RCA do dev-analyst antes de delegar implementação.**

### 2. FIX-SENDS-FILTER-01 (P1, audiência incorreta)
Filtro `person_status` ignorado faz audiências serem retornadas como zero contatos para qualquer status diferente de `active`. Impacto: usuários filtrando por inativos/arquivados criam disparos vazios sem aviso. Fix mínimo (uma condicional em `filter-leads-for-send/index.ts:182`). Independente da story P0.

### 3. FIX-SENDS-DISPATCH-01 (P1, race / double-dispatch)
Race condition pode entregar mensagens duplicadas para o mesmo contato. Mais difícil de detectar do que o bug atual mas igualmente crítico para confiabilidade. Pode ter relação com FIX-SENDS-FIRST-MSG-01 dependendo do RCA — atacar logo depois para que o ciclo de fixes do dispatch fique contido.

### Próxima iteração (sugestão, não escopo desta task)
4. `FIX-SENDS-FILTER-02` (P1, paginação)
5. `FIX-SENDS-DISPATCH-02` (P2, retry timeout)
6. `FIX-SENDS-UI-01` + `FIX-SENDS-UI-02` (P2, agrupar por baixo custo)

---

## Notas operacionais

- O backlog tem ~7 stories com status divergente (Dev Agent declara concluído, fisicamente em `backlog/`). **Não é parte desta triagem corrigir o status**, mas o Chief deve agendar uma higienização breve antes da próxima sprint para que `BACKLOG.md` reflita a realidade.
- A auditoria `audit-sends-pro.md` está atualizada (commit `23f7fd60`) e cobre 5 vetores. Os 5 findings ativos referenciados nela mapeiam 1:1 nas stories `FIX-SENDS-FILTER-01`, `FIX-SENDS-FILTER-02`, `FIX-SENDS-DISPATCH-01`, `FIX-SENDS-DISPATCH-02`, `FIX-SENDS-IMPORT-03`. O bug atual `FIX-SENDS-FIRST-MSG-01` é **adicional** — não estava no audit anterior.
