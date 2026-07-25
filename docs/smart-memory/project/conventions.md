---
title: Convenções de Código
type: overview
agent: dev-analyst
created: 2026-04-22
updated: 2026-05-10
tags: [conventions, discovery]
related: ["[[tech-stack]]"]
---

# Convenções de Código

## Estilo

- **TypeScript com strict relaxado:** `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false` — tipagem pragmática, não rígida
- **ESM nativo:** `"type": "module"` no package.json; imports com extensão omitida (bundler resolve)
- **`@ts-nocheck`** aparece em hooks de data layer (ex: `useAgendamentos.ts`) — padrão aceito para evitar erros de tipo em código legado
- **Ponto-e-vírgula:** presente (inferido de arquivos lidos)
- **Aspas:** simples em imports TypeScript

## Nomenclatura

| Artefato | Padrão | Exemplos |
|---|---|---|
| Componentes React | PascalCase | `DashLayout`, `NegocioSingle`, `PageErrorBoundary` |
| Arquivos de componente | PascalCase.tsx | `Configuracoes.tsx`, `ClienteSingle.tsx` |
| Hooks | camelCase com prefixo `use` | `useAgendamentos.ts`, `useTenantId.ts` |
| Contextos | PascalCase + sufixo `Context` | `TenantContext`, `NavigationContext` |
| Páginas | PascalCase.tsx em `src/pages/` | `Dashboard.tsx`, `Negocios.tsx` |
| Edge functions | kebab-case | `followup-trigger-worker`, `bi-insights-chat` |
| Migrations (tenant) | `{timestamp}-{uuid}-ok.sql` | `20250624143518-692fb78f-...-ok.sql` |
| Migrations (ADM) | `{timestamp}_{descricao_snake}.sql` | `20260311130000_adm_control_plane.sql` |
| Utilitários/helpers | camelCase.ts | `auditLogger.ts`, `phoneUtils.ts` |
| Tipos TS | PascalCase em arquivos `types.ts` | `Database` em `src/integrations/supabase/types.ts` |

## Estrutura de Pastas (`src/`)

```
src/
├── App.tsx                 # Roteamento central e providers aninhados
├── main.tsx                # Entry point
├── components/
│   ├── ui/                 # shadcn/ui — primitivos gerados pelo CLI
│   ├── auth/               # Componentes de autenticação
│   ├── layout/             # DashLayout e estrutura de shell
│   ├── common/             # Componentes reutilizáveis cross-feature
│   ├── adm/                # UI exclusiva do módulo ADM
│   ├── agendamento/        # UI de agendamentos
│   ├── conversas/          # UI de conversas/chat
│   ├── disparos/           # UI de disparos/campanhas
│   └── ...                 # Um diretório por domínio
├── contexts/               # Contextos React de estado global de sessão
├── hooks/                  # Custom hooks — data fetching e lógica reutilizável
├── pages/                  # Página raiz por rota (1 arquivo = 1 rota)
├── integrations/
│   └── supabase/           # client.ts (singleton) + types.ts (gerado)
├── lib/                    # utils.ts (cn helper), helpers de componentes
├── utils/                  # Utilitários de domínio (audit, phone, templates)
├── types/                  # Tipos TypeScript globais
├── data/                   # Dados estáticos / mock data
├── styles/                 # CSS global além de index.css
└── i18n/                   # Internacionalização (estrutura custom)
```

## Padrões de Import

- **Alias `@/`** mapeia para `src/` — todos os imports internos usam `@/` (nunca caminhos relativos longos)
- **shadcn components:** `import { Button } from "@/components/ui/button"`
- **Supabase client:** `import { supabase } from "@/integrations/supabase/client"`
- **Hooks:** `import { useAgendamentosSimple } from "@/hooks/useAgendamentosSimple"`
- Imports externos antes dos internos (convenção não enforçada por lint, mas observada)

## ESLint

Arquivo: `eslint.config.js` (flat config, ESLint v9)

- Extends: `js.configs.recommended` + `tseslint.configs.recommended`
- Plugins: `react-hooks`, `react-refresh`
- Regras notáveis:
  - `react-hooks/rules-of-hooks` e `react-hooks/exhaustive-deps` — enforçados
  - `react-refresh/only-export-components` — warn (allowConstantExport: true)
  - `@typescript-eslint/no-unused-vars` — **off** (intencional)
- Ignora: `dist/`

## tsconfig Paths

```json
"paths": { "@/*": ["./src/*"] }
```

Definido em `tsconfig.json` (raiz) e replicado em `tsconfig.app.json`. O alias `@/` é resolvido pelo Vite via `resolve.alias` em `vite.config.ts`.

## Tailwind / Tokens de Design

- CSS variables para todos os tokens de cor (`hsl(var(--primary))`) — permite troca de tema
- `darkMode: "class"` — controlado pelo `ThemeProvider` do `next-themes`
- Cores customizadas: `iatize.blue (#2563FF)`, `iatize.green (#00D26A)`, `iatize.purple (#6C16F8)`
- Base font: 14px; títulos customizados via `fontSize` extensions
- Prefix shadcn: vazio (sem prefixo nas classes geradas)

## Organização de Edge Functions (`supabase/functions/`)

- **Uma função por diretório:** `supabase/functions/{kebab-case}/index.ts`
- **Runtime:** Deno — imports via `https://esm.sh/` e `https://deno.land/std@0.168.0/`
- **Utilitários compartilhados:** `_shared/` — `logger.ts`, `response.ts`, `llm-provider.ts`, `validateBookingCapability.ts`, etc.
- **Padrão de entrada:** `serve(async (req) => {...})` do `deno.land/std`
- **CORS:** objeto `corsHeaders` definido localmente em cada função (sem shared util de CORS)
- **Auth:** configurável por função em `supabase/config.toml` — `verify_jwt = true/false`; funções públicas fazem validação manual (HMAC, getClaims())
- **Service role:** criado via `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` para operações privilegiadas

## Convenção de Migrations

**Tenant (`supabase/migrations/`):**
- Formato: `{YYYYMMDDHHMMSS}-{uuid}-ok.sql`
- Geradas pelo Supabase CLI (`supabase migration new`)
- Sufixo `-ok` indica migration aplicada com sucesso no histórico

**ADM (`supabase/migrations_adm/`):**
- Formato: `{YYYYMMDDHHMMSS}_{descricao_snake_case}.sql`
- Nomenclatura manual; prefixo `adm_` na descrição
- Exemplo: `20260311130000_adm_control_plane.sql`

## Contextos vs Zustand

- **Contextos React** (`src/contexts/`): estado de sessão e infra — tenant, navegação, loading, realtime
- **Zustand** (`zustand ^5.0.8`): estado de aplicação global mais complexo
- **React Query** (`@tanstack/react-query`): cache de server state — hooks em `src/hooks/` que encapsulam queries/mutations

## Padrão de Hook de Data

Hooks em `src/hooks/` seguem o padrão:
1. Recebem `tenantId?` como parâmetro (opcional, muitas vezes ignorado pois resolvido internamente)
2. Usam `supabase` importado de `@/integrations/supabase/client`
3. Retornam via `useMutation` / `useQuery` do React Query
4. Toast via `sonner` para feedback de erro/sucesso
5. Alias de compatibilidade para hooks refatorados (ex: `useAgendamentos` → alias para `useAgendamentosSimple`)
