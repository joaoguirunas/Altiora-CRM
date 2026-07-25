---
title: "ALTIORA-06: Cadastrar referral manualmente — adaptar NovoNegocioModal (UC11)"
type: story
status: backlog
epic: ALTIORA-B
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, referral, modal, frontend]
related: ["[[ALTIORA-01]]", "[[ALTIORA-04]]", "[[ALTIORA-07]]"]
---

# ALTIORA-06: Cadastrar referral manualmente — adaptar NovoNegocioModal (UC11)

## Objetivo
Adaptar `NovoNegocioModal` para o contexto Altiora, adicionando campos obrigatórios específicos (origem do referral, data do handoff) e verificação de duplicatas antes de criar o registro.

## Acceptance Criteria
- [ ] AC1: Quando o pipeline Altiora está ativo, o modal "Novo Referral" exibe os campos: Nome do cliente (obrigatório), E-mail (obrigatório), Telefone (obrigatório), Origem do referral (select: Avenue, Indicação interna, Manual — obrigatório), Data do handoff (date picker — obrigatório), Observações iniciais (textarea — opcional).
- [ ] AC2: Ao clicar em "Criar Referral", o sistema busca por duplicata por e-mail ou telefone no pipeline Altiora. Se encontrar, exibe dialog com os registros similares e opções: "Cancelar", "Abrir existente" ou "Criar mesmo assim (com justificativa)".
- [ ] AC3: Referral criado aparece imediatamente na coluna "Novo referral" do KanbanBoard com `source = 'manual'` e `created_by` = UUID do usuário autenticado.
- [ ] AC4: Closer sem permissão de cadastro manual (perfil `closer` sem flag `can_create_referral`) não vê o botão "Novo Referral" — somente Gestor e Admin visualizam por padrão.
- [ ] AC5: Campos inválidos (e-mail malformado, telefone com menos de 10 dígitos) são destacados com mensagem de erro inline antes do submit.

## Escopo

**IN:**
- Extensão do `NovoNegocioModal` com campos Altiora (condicional ao pipeline selecionado)
- Lógica de deduplicação por e-mail/telefone no pipeline Altiora
- Permissão de exibição do botão por perfil

**OUT:**
- Criação de novo componente de modal do zero (reaproveitar `NovoNegocioModal`)
- Campos de R1/R2/R3/Finvity (cobertos em stories posteriores)
- Atribuição de Closer no momento da criação (cobre ALTIORA-07)

## Contexto Técnico
- `src/components/negocios/NovoNegocioModal.tsx` — base para extensão
- `src/hooks/useNegocios.ts` → `useCriarNegocio` — hook de criação; verificar campos aceitos
- Perfil do usuário: `useAuth.ts` → `profile.user_type` ou nova coluna `can_create_referral`
- Pipeline Altiora: usar constante `ALTIORA_PIPELINE_ID` (setar após ALTIORA-01)
- Dedup: query em `leads` filtrando `leads_pipelines_id = ALTIORA_PIPELINE_ID AND (email = ? OR phone = ?)`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
