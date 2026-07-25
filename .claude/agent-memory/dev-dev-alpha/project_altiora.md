---
name: project-altiora-crm
description: Contexto do projeto Altiora CRM — stack, padrões arquiteturais e regras.
metadata:
  type: project
---

# Projeto Altiora CRM

**Path:** `/Volumes/Data-Ivanderlei/Projetos/Altiora-CRM`
**Stack:** React 18 + TypeScript strict + Tailwind CSS + shadcn/ui + TanStack Query v5 + Supabase

## Regras absolutas
- Dark theme + red accent — NÃO alterar cores/design
- Nunca usar `any` (TS strict) — mas o projeto já tem `any` pré-existente; não introduzir novos
- `git push` delegado ao Grav via Chief
- `git add .` proibido — sempre arquivos específicos
- Não criar novas libs/deps sem necessidade
- Se schema do banco não existe ainda, usar dados hardcoded com `// TODO` comment

## Estrutura chave
- `src/pages/Negocios.tsx` — pipeline/kanban principal
- `src/components/negocios/` — KanbanBoard, StageColumn, NegocioSidebar, NegociosToolbar, NovoNegocioModal
- `src/hooks/usePipelines.ts` — pipelines e stages
- `src/hooks/useNegociosOptimized.ts` — fetch otimizado de negócios por pipeline
- `src/hooks/useNegocios.ts` — CRUD de negócios (useCriarNegocio, useUpdateNegocio)
- `src/hooks/useAuth.ts` — perfil do usuário autenticado
- `src/utils/` — utilitários (pipelineLabels, phoneUtils, constants, etc.)

## Pipeline Altiora
- Identificado por nome (case-insensitive match em 'altiora')
- Entidade principal: "Referral" em vez de "Negócio"
- 13 etapas (ver use-cases-v1.md)
- Perfis: Admin/RevOps (Ivanderlei), Gestor Comercial (André), Closer (Marco, Ellen, Kayan)

**Why:** Projeto CRM especializado para gestão de referrals da Altiora, construído sobre CRM genérico existente.
**How to apply:** Sempre verificar se estamos no contexto Altiora antes de implementar terminologia ou funcionalidades específicas.
