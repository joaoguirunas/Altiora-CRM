---
title: "US-CFG-07: White-label — domínio customizado e branding completo"
type: story
status: done
epic: settings
complexity: L
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, settings, white-label, branding, P3]
related: ["[[../../project/modules/settings]]"]
---

# US-CFG-07: White-label — domínio customizado e branding completo

## Objetivo
Permitir que tenants configurem domínio próprio, cores de marca e identidade visual completa para entregar o produto sob marca própria.

## Acceptance Criteria
- [x] AC1: Settings > White-label exibe campos: domínio customizado + botão "Verificar DNS", cor primária, cor secundária, nome do produto
- [x] AC2: Botão "Verificar DNS" chama edge function `domain-verify` que verifica CNAME via Cloudflare DoH — retorna `{ verified, expected_cname, found_cnames }`
- [x] AC3: Domínio salvo em `settings.custom_domain` e sincronizado para `adm_clients` via RPC SECURITY DEFINER `sync_custom_domain_to_adm`
- [x] AC4: Cores primária/secundária em `settings.brand_primary_color` e `brand_secondary_color` — aplicadas via CSS variables `--primary`/`--secondary` via `useBrandColors` hook
- [x] AC5: Nome do produto em `settings.product_name` — substituído em `<title>` via `useBrandColors`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations/20260423007000_settings_white_label.sql`
- `supabase/functions/domain-verify/index.ts`
- `src/components/config/WhiteLabelConfig.tsx`
- `src/hooks/useBrandColors.ts`
- `src/hooks/useSettings.ts` (custom_domain, brand_primary_color, brand_secondary_color, product_name adicionados)
- `src/pages/Configuracoes.tsx` (nav "white-label" adicionada)
- `src/App.tsx` (useBrandColors chamado em AppContent)

## QA Results
<!-- QA preenche ao revisar -->
