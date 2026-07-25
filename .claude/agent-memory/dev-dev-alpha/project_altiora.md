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
- Pipeline UUID: `a1000000-0000-0000-0000-000000000001` (fixo, inserido pela migration)
- Entidade principal: "Referral" em vez de "Negócio"
- 13 etapas com UUIDs fixos `...0001-...0001` até `...0001-...0013` (ver altiora-schema.md)
- Perfis: Admin/RevOps (Ivanderlei), Gestor Comercial (André), Closer (Marco, Ellen, Kayan)

## user_type values — CUIDADO: dois sets coexistem
- **Legado (pré-Altiora):** 'admin' | 'manager' | 'user' | 'comercial'
- **Altiora (migration 20260725110000):** 'admin' | 'gestor_comercial' | 'closer' | NULL
- `isComercial` e `isCloser` → checar 'comercial' || 'closer'
- `isManager` → checar 'manager' || 'gestor_comercial' || 'admin'
- `UserType` em `src/types/usuarios.ts` já inclui todos os 6 valores

**Why:** Projeto CRM especializado para gestão de referrals da Altiora, construído sobre CRM genérico existente.
**How to apply:** Sempre verificar se estamos no contexto Altiora antes de implementar terminologia ou funcionalidades específicas. Sempre incluir AMBOS os valores de user_type nos filtros.
