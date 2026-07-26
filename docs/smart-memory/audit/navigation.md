---
title: Auditoria de Navegação e Botões de Configuração
type: audit
agent: dev-ux
created: 2026-04-26
tags: [navigation, routing, settings, audit]
---

# Auditoria de Navegação — rev-os

## Resumo executivo

| Severidade | Total |
|---|---|
| P0 (rota 404 real) | 3 |
| P1 (rota existe mas comportamento inesperado) | 6 |
| P2 (inconsistência leve / silencioso) | 5 |

---

## P0 — Rota inexistente (404 real)

### P0-1: `/settings/omni/whatsapp` não declarada no router

**Arquivo:** `src/pages/CriarDisparo.tsx:392`
```tsx
onClick={() => navigate('/settings/omni/whatsapp')}
```

**Problema:** A rota `/settings/omni/whatsapp` não existe em `src/App.tsx`. As rotas `/settings/omni/*` declaradas são: `email`, `sms`, `call`, `dedup`, `instagram`, `whatsapp-log`. O destino correto seria `/settings/general/integracoes` (seção WhatsApp/Meta).

**Impacto:** Usuário clica no botão "Configurar WhatsApp" em CriarDisparo e recebe tela 404.

**Fix:** Alterar para `navigate('/settings/general/integracoes?tab=whatsapp')`.

---

### P0-2: `/crm/empresas/:id` não declarada no router

**Arquivos:**
- `src/pages/Clientes.tsx:611` — `navigate('/crm/empresas/${empresa.id}')`
- `src/pages/Clientes.tsx:656` — `navigate('/crm/empresas/${empresa.id}')`

**Problema:** `/crm/empresas/:id` não existe em `src/App.tsx`. A estrutura CRM declara `crm/clients/:id` (para `ClienteSingle`) mas não `crm/empresas/:id`. A página `EmpresaSingle` existe em `src/pages/EmpresaSingle.tsx` mas não está registrada como rota.

**Impacto:** Clicar numa empresa na listagem de clientes resulta em 404.

**Fix:** Adicionar `<Route path="empresas/:id" element={<EmpresaSingle />} />` dentro do bloco `/crm` em App.tsx.

---

### P0-3: `/form-pro?tab=forms` não declarada

**Arquivo:** `src/components/config/FormProConfig.tsx:368`
```tsx
onEditInFormPro={() => navigate("/form-pro?tab=forms")}
```

**Problema:** Não existe rota `/form-pro` no router. O módulo é `/lp`.

**Impacto:** Botão "Editar no Form PRO" dentro das configurações quebra silenciosamente (vai para 404).

**Fix:** Alterar para `navigate('/lp')`.

---

## P1 — Rota existe mas comportamento inesperado

### P1-1: `/dashboard` sem rota index — LoginPage navega para ela

**Arquivos:**
- `src/components/auth/LoginPage.tsx:80,116` — `navigate('/dashboard', { replace: true })`
- `src/components/auth/ProtectedRoute.tsx:45` — `navigate('/dashboard', { replace: true })`
- `src/pages/GoogleOAuthCallback.tsx:26,33,49` — `navigate('/dashboard')`
- `src/pages/MicrosoftOAuthCallback.tsx:26,33,42` — `navigate('/dashboard')`

**Problema:** `/dashboard` em `App.tsx` tem apenas subrotas `negocios` e `reunioes` — sem `<Route index>`. Navegar para `/dashboard` renderiza `DashLayout` com `<Outlet>` vazio (conteúdo em branco).

**Impacto:** Após login bem-sucedido, usuário vê layout sem conteúdo. O app deveria redirecionar para `/bipro`.

**Fix:** Adicionar `<Route index element={<Navigate to="/bipro" replace />} />` dentro de `/dashboard`, ou alterar todos os navigate para `/bipro`.

---

### P1-2: Botão de Settings só visível para `isGestorOrAdmin`

**Arquivo:** `src/components/layout/DashLayout.tsx:595,617`

**Problema:** O botão de Configurações na sidebar (collapsed e expanded) só aparece se `isGestorOrAdmin === true`. Consultores e atendentes não veem o botão — o que pode ser intencional. Porém, `Configuracoes.tsx` também aplica `<RestrictedRoute requireGestor={true}>` — a proteção está duplicada. Não é um bug, mas a visibilidade depende de `user.profile.gestor` ou `user.profile.super_adm`, sem documentação explícita sobre essa intenção.

**Observação:** Confirmar se há casos de `cliente` ou `provisional` que deveriam ter acesso limitado a settings.

---

### P1-3: ADM sumiu — causa raiz identificada

**Arquivo:** `src/components/layout/DashLayout.tsx:366`
```tsx
if (isControlPlane && user?.profile?.super_adm) {
  activeItems.push(...superAdminSidebarItems);
}
```

**Causa:** `isControlPlane` é `true` apenas quando `sessionStorage._supabase_client_config.url === CONTROL_PLANE_URL` (ou quando não há config no sessionStorage). Em produção, um usuário super_adm logado em **tenant subdomain** tem `isControlPlane = false` → ADM desaparece da sidebar mesmo que `super_adm === true`.

**Esse comportamento é correto por design** (ADR-ADM): o controle plane ADM só deve ser acessível pelo domínio principal `revos.growthsales.ai`. O problema reportado ("ADM sumiu") provavelmente ocorre quando o super_adm acessa pelo subdomínio de tenant em vez do domínio principal.

**Não é um bug — é proteção intencional.** O link ADM aparece corretamente em `revos.growthsales.ai` com super_adm.

---

### P1-4: `/settings/general/webhooks` e `/settings/send/config` — rota existe mas Configuracoes não mapeia

**App.tsx:**
- `settings/general/webhooks` declarado (linha 638) → renderiza `<Configuracoes />`
- `settings/send/config` declarado (linha 567) → renderiza `<Configuracoes />`

**Configuracoes.tsx:** Nenhum dos dois está no `urlItemToSection`. `send` não existe em `areaDefaults`.

**Resultado:** Navegar para essas URLs abre Configuracoes na seção **Geral** (fallback default) sem indicar ao usuário onde está. Não é 404, mas é conteúdo errado.

**Fix:** Adicionar ao `urlItemToSection` em `Configuracoes.tsx`:
- `'general': { 'webhooks': 'webhooks' }` + criar seção `webhooks`, ou mapear para `outros`.
- `'send': { 'config': 'outro-id-relevante' }` na key `send`.

---

### P1-5: `href="/settings?tab=ia"` não corresponde a nenhuma seção

**Arquivo:** `src/components/bi/VoiceChatButton.tsx:170`
```tsx
href="/settings?tab=ia"
```

**Problema:** `Configuracoes.tsx` lê `searchParams.get("section")` — não `tab`. O parâmetro `?tab=ia` é ignorado, abrindo settings na seção default (Geral).

**Fix:** Alterar para `href="/settings?section=ia"` e garantir que existe handler para `"ia"` em `renderContent()`, ou mapear para uma seção existente como `integracoes`.

---

### P1-6: MobilePerfil navega para `/settings` (rota desktop) em mobile

**Arquivo:** `src/pages/mobile/MobilePerfil.tsx:44`
```tsx
onClick={() => navigate('/settings')}
```

**Problema:** Em mobile, `/settings` não existe na shell `/m/*`. O usuário clica em "Configurações" no perfil mobile e é redirecionado para `/settings` — que por sua vez o `AppContent` pode tentar re-redirecionar para `/m/bi` (pois `isMobile && !isPublic && !pathname.startsWith('/m/')`).

**Resultado:** Loop de redirect ou usuário cai no `/m/bi` sem chegar às configurações.

**Fix:** Ou remover o botão de settings do mobile perfil (se não houver página mobile de settings), ou criar `/m/settings` com subset de configurações acessíveis.

---

## P2 — Inconsistências leves / silenciosas

### P2-1: `navigate('/settings/general/brandbook')` — rota existe mas mapeada para seção `outros`

**Arquivo:** `src/pages/Brandbook.tsx:183`

Navegar para `/settings/general/brandbook` abre a aba **Outros** em configurações — o usuário não sabe onde está. Funciona, mas é confuso: o botão parece navegar de volta para o Brandbook.

---

### P2-2: `navigate('/dashboard/negocios/:id')` em múltiplos componentes — legado funcional mas inconsistente com padrão atual

**Arquivos:**
- `src/components/negocios/NegociosList.tsx:356,506`
- `src/components/negocios/StageColumn.tsx:127`
- `src/components/conversas/NegociosSection.tsx:42`
- `src/components/conversas/PessoaSidebar.tsx:94`
- `src/pages/Reunioes.tsx:736`
- `src/pages/ReuniaoSingle.tsx:365,638`

A rota `/dashboard/negocios/:id` está declarada no App.tsx e funciona. O padrão atual usa `/crm/kanban/:id`. Dois sistemas paralelos causam inconsistência no `getPageTitle()` do DashLayout (linha 312) — `dashboard/negocios` não gera título.

---

### P2-3: `ScheduleTabNav` usa `<Link to="/settings/schedule/automacoes">` que existe no router

**Arquivo:** `src/components/schedule/ScheduleTabNav.tsx:7`

A rota existe e Configuracoes.tsx mapeia corretamente para seção `schedule-automacoes`. Funcional, mas o tab nav aparece na página `/schedule` principal — usuário clica "Automações" e sai do contexto de Schedule para Configurações. Transição abrupta.

---

### P2-4: `VoicePlayerBar` navega para `/settings/general/integracoes` sem tab específica

**Arquivo:** `src/components/dashboard/VoicePlayerBar.tsx:74`

Navega para integracoes genérico sem indicar qual integração configurar. Menor que os outros pois pelo menos vai para a página certa.

---

### P2-5: `CriarDisparoModal` navega para `/settings` com state `{ openSection: 'importacao-exportacao' }`

**Arquivo:** `src/components/disparos/CriarDisparoModal.tsx:142`

`Configuracoes.tsx` não tem seção `importacao-exportacao` em `allSections` nem em `renderContent()`. O state é ignorado silenciosamente, abrindo Geral.

---

## Mapa completo de botões de Settings

| Origem | Destino | Status |
|---|---|---|
| `DashLayout` sidebar (expanded/collapsed) | `/settings` | OK |
| `DashLayout` dropdown user menu | `/profile` | OK |
| `MfaGraceBanner` href | `/settings/mfa-setup` | OK (standalone route) |
| `MfaSection` href | `/settings/mfa-setup` | OK |
| `MfaSection` href | `/settings/mfa-recovery-regenerate` | OK |
| `ProtectedRoute` MFA guard | `/settings/mfa-setup` | OK |
| `CallProHeaderIcon` | `/settings/omni/call` | OK (rota existe) |
| `CriarDisparo` botão WhatsApp | `/settings/omni/whatsapp` | **P0 — 404** |
| `VoiceChatButton` href | `/settings?tab=ia` | **P1 — param ignorado** |
| `VoicePlayerBar` | `/settings/general/integracoes` | OK |
| `FormProConfig` | `/settings/general/integracoes?tab=meta-leads` | OK |
| `FormProConfig` edit callback | `/form-pro?tab=forms` | **P0 — 404** |
| `ZoomConfig` href | `/settings/general/integracoes?tab=zoom` | OK |
| `Brandbook` botão voltar | `/settings/general/brandbook` | P2 — mapeia para "outros" |
| `TimeSingle` voltar | `/settings/general/times` | OK |
| `AgenteSingle` voltar | `/settings/crm/aiagents` | OK |
| `AgentesIA` navigate | `/settings/crm/aiagents/:id` | OK |
| `TemplateCard` | `/settings/crm/aiagents/:id` | OK |
| `MobilePerfil` | `/settings` | **P1 — desktop route em mobile** |
| `TiktokCallback` | `/settings/general/integracoes?tab=tiktok` | OK |
| `GoogleOAuthCallback` | `/settings/general/integracoes?tab=google-ads` | OK |
| `MetaOAuthCallback` | `/settings/general/integracoes?tab=meta-ads` | OK |
| `CriarDisparoModal` | `/settings` + state openSection | P2 — state ignorado |
| `ScheduleTabNav` | `/settings/schedule/automacoes` | OK mas contexto confuso |

---

## Issues Mobile específicos

| Issue | Arquivo | Severidade |
|---|---|---|
| MobilePerfil navega para `/settings` (desktop) | `mobile/MobilePerfil.tsx:44` | P1 |
| Redirect global mobile: `!pathname.startsWith('/m/')` → `/m/bi`, mas `/m/settings` não existe | `App.tsx:107` | P1 |
| MobileDashboard não importado em App.tsx (arquivo existe mas não é rota) | `mobile/MobileDashboard.tsx` | P2 |

---

## Diagnóstico do botão mais problemático

**`/settings/omni/whatsapp` (P0-1)** é o botão mais crítico porque:
1. Rota não declarada → 404 hard
2. Aparece no fluxo de criação de disparo (Sends PRO) — caminho de alta frequência
3. O usuário acabou de criar um disparo e precisa configurar WhatsApp — bloqueia o onboarding completo
4. Fix trivial: substituir por `/settings/general/integracoes`

---

*Auditoria realizada por Velax em 2026-04-26*
