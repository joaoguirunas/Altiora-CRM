---
title: Tech Stack
type: overview
agent: dev-analyst
created: 2026-04-22
updated: 2026-05-10
tags: [tech-stack, discovery]
related: ["[[conventions]]"]
---

# Tech Stack

## Runtime e Tooling

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Runtime (frontend) | Node.js | v25.8.1 | Apenas dev; app roda no browser |
| Package manager | bun | — | Inferido da ausência de package-lock.json e presença de bun.lockb |
| Bundler | Vite + @vitejs/plugin-react-swc | ^5.4.1 / ^3.5.0 | SWC para transpile rápido |
| Linguagem | TypeScript | ^5.5.3 | strict: false; noImplicitAny: false |
| Framework UI | React | ^18.3.1 | react-jsx transform |
| Roteamento | react-router-dom | ^7.12.0 | BrowserRouter com rotas declarativas em App.tsx |
| Runtime (edge functions) | Deno | — | Supabase Edge Functions; deno.json em supabase/functions/ |

## UI e Estilos

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Component library | shadcn/ui | default style | Componentes em src/components/ui/ |
| Primitivos | Radix UI | vários ^1.x / ^2.x | ~25 pacotes @radix-ui/react-* |
| Estilos | Tailwind CSS | ^3.4.11 | darkMode: class; CSS variables para tokens |
| Animações | tailwindcss-animate | ^1.0.7 | Plugin Tailwind |
| Motion | framer-motion | ^12.23.24 | Animações de componentes |
| Fontes | Outfit (sans), JetBrains Mono | — | Definidas em tailwind.config.ts |
| Temas | next-themes | ^0.3.0 | ThemeProvider no App.tsx |
| Ícones | lucide-react | ^0.462.0 | |

## Data Layer

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Backend-as-a-Service | Supabase | — | Postgres + Auth + Storage + Edge Functions + Realtime |
| Cliente Supabase | @supabase/supabase-js | ^2.81.0 | Multi-tenant: config resolvida via sessionStorage |
| Server state | @tanstack/react-query | ^5.56.2 | QueryClientProvider no App.tsx; devtools em ^5.83.0 |
| Forms | react-hook-form + @hookform/resolvers | ^7.53.0 / ^3.9.0 | Validação via zod |
| Validação | zod | ^3.23.8 | |
| Client state | zustand | ^5.0.8 | Loja global; contextos React para estado de sessão |

## State Management (Contextos React)

Contextos em `src/contexts/` — estado de sessão e UI global:

| Contexto | Responsabilidade |
|---|---|
| `TenantContext` | ID e config do tenant ativo |
| `NavigationContext` | Estado de navegação global |
| `LoadingContext` | Loading global |
| `RealtimeContext` | Conexão Realtime Supabase |

## Editor Rico e Conteúdo

| Lib | Versão | Uso |
|---|---|---|
| @tiptap/react + extensões | ^2.27.1 | Editor de rich text |
| react-markdown + remark-gfm | ^10.1.0 / ^4.0.1 | Render Markdown |
| dompurify | ^3.3.1 | Sanitização HTML |
| mammoth | ^1.9.1 | DOCX → HTML |
| pdfjs-dist / pdf-parse | ^5.3.93 / ^1.1.1 | Parse PDF |

## DnD e Interatividade

| Lib | Versão |
|---|---|
| @dnd-kit/core + sortable + utilities | ^6.3.1 / ^10.0.0 / ^3.2.2 |
| @hello-pangea/dnd | ^18.0.1 |
| react-beautiful-dnd | ^13.1.1 |
| @xyflow/react | ^12.10.0 |

## Datas e Internacionalização

| Lib | Versão |
|---|---|
| date-fns | ^3.6.0 |
| date-fns-tz | ^3.2.0 |
| react-day-picker | ^8.10.1 |
| i18n | src/i18n/ (estrutura custom) |

## Notificações e Feedback

| Lib | Versão | Uso |
|---|---|---|
| sonner | ^1.5.0 | Toast principal |
| @radix-ui/react-toast | ^1.2.1 | Toast Radix (usado via shadcn) |

## Imagem e Mídia

| Lib | Versão |
|---|---|
| @pqina/pintura + react-pintura | ^8.95.7 / ^9.0.4 |
| react-dropzone | ^14.3.8 |
| @splinetool/react-spline + runtime | ^4.1.0 / ^1.12.28 |

## Dados e Export

| Lib | Versão |
|---|---|
| recharts | ^2.15.3 |
| xlsx | ^0.18.5 |
| papaparse | ^5.5.3 |
| embla-carousel-react | ^8.3.0 |
| react-countup | ^6.5.3 |

## Utilitários UI

| Lib | Versão | Uso |
|---|---|---|
| class-variance-authority | ^0.7.1 | Variantes de componentes |
| clsx | ^2.1.1 | Merge condicional de classes |
| tailwind-merge | ^2.5.2 | Merge de classes Tailwind |
| cmdk | ^1.0.0 | Command palette |
| vaul | ^0.9.3 | Drawer |
| input-otp | ^1.2.4 | OTP input |
| react-resizable-panels | ^2.1.3 | Painéis redimensionáveis |
| diff | ^8.0.2 | Diff de texto |

## Supabase / Backend

- **Projeto tenant:** `fjokfryrjlvxemgbbyyh` (supabase/config.toml)
- **Control plane:** URL hardcoded em `src/integrations/supabase/client.ts`; config tenant resolvida via `sessionStorage._supabase_client_config`
- **Edge Functions:** ~86 funções em `supabase/functions/`; runtime Deno com `https://esm.sh/@supabase/supabase-js@2`
- **Migrations tenant:** `supabase/migrations/`
- **Migrations ADM:** `supabase/migrations_adm/`
- **Scripts DB:** `scripts/` — auto-update-manifest, generate-baseline

## Versioning

- Versão app em `version.json`; injetada no build via `vite.config.ts` (`__APP_VERSION__`)
- Bump automatizado por GitHub Actions no deploy
