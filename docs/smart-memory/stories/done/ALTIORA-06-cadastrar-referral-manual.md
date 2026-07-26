---
title: "ALTIORA-06: Cadastrar referral manualmente — adaptar NovoNegocioModal (UC11)"
type: story
status: done
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
- [x] AC1: Modal "Novo Referral" exibe campos: Nome (obrigatório), E-mail (obrigatório), Telefone (obrigatório), Origem (select: avenue_email/manual/outros — obrigatório), Data do handoff (date picker — obrigatório), Observações (textarea — opcional).
- [x] AC2: Sistema busca duplicata por e-mail ou telefone no pipeline Altiora. Se encontrar, exibe dialog com registros similares e opções: "Cancelar", "Abrir existente" ou "Criar mesmo assim (com justificativa obrigatória)".
- [x] AC3: Referral criado aparece na coluna "Novo referral" (stage ALTIORA_STAGE_NOVO_REFERRAL) com `altiora_origem = 'manual'` e `altiora_data_handoff` preenchido.
- [x] AC4: Somente Gestor e Admin visualizam o botão "Novo Referral" no pipeline Altiora (verificado via `isManager`). Closer não vê.
- [x] AC5: Campos inválidos (e-mail malformado, telefone com menos de 10 dígitos) destacados com mensagem de erro inline antes do submit.

## Escopo

**IN:**
- `NovoReferralModal` com campos Altiora (não extensão do `NovoNegocioModal`, mas novo componente dedicado)
- Lógica de deduplicação por e-mail/telefone no pipeline Altiora
- Permissão de exibição do botão por perfil (`isManager`)

**OUT:**
- Criação de novo componente de modal do zero (reaproveitar `NovoNegocioModal`)
- Campos de R1/R2/R3/Finvity (cobertos em stories posteriores)
- Atribuição de Closer no momento da criação (cobre ALTIORA-07)

## Contexto Técnico
- `ALTIORA_PIPELINE_ID = 'a1000000-0000-0000-0000-000000000001'`
- `ALTIORA_STAGE_NOVO_REFERRAL = 'a1000000-0000-0000-0001-000000000001'`
- `formatPhoneForStorage()`: adiciona prefixo +55 se ausente
- Cria `pessoa` → `lead` em sequência com FK `people_id`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/components/negocios/NovoReferralModal.tsx` — criado: modal completo com dedup, justificativa, validação inline
- `src/pages/Negocios.tsx` — condicional `isAltioraPipeline && isManager` para mostrar `NovoReferralModal` vs `NovoNegocioModal`

## QA Results
<!-- QA preenche ao revisar -->
