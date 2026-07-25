---
title: Auditoria de Rotas
type: audit
agent: dev-architect
created: 2026-04-26
updated: 2026-04-26
tags: [audit, routes, navigation]
related: ["[[../project/modules]]", "[[../project/architecture]]"]
---

# Auditoria de Rotas — rev-os

Snapshot de `src/App.tsx` (872 linhas) + `src/components/layout/DashLayout.tsx` (sidebar) + `src/utils/constants.ts` (`PUBLIC_ROUTES`) + grep completo de `navigate('/...')` em `src/`.

## TL;DR

- **ADM NÃO está quebrada como rota.** `/adm` e `/adm/clients/:id` estão declaradas (App.tsx:808-825) e os componentes existem. **O bug é de visibilidade do item de menu na sidebar** — depende de `isControlPlane && user?.profile?.super_adm` (DashLayout.tsx:366), e `isControlPlane` é avaliado lendo `sessionStorage._supabase_client_config` (DashLayout.tsx:262-271). Se o bootstrap do tenant ainda não escreveu essa key (ou se o user não tem `super_adm = true` no profile), o item nunca aparece.
- **`/dashboard` (sem filhos) é uma rota fantasma de redirect.** `ProtectedRoute.tsx:45` e `LoginPage.tsx:80,116` redirecionam todo login bem-sucedido para `/dashboard` — mas em App.tsx essa rota só tem children específicos (`negocios`, `reunioes`); não há `<Route index />`. Resultado: `/dashboard` puro renderiza o `DashLayout` com `<Outlet />` vazio (tela em branco).
- **Settings tem rotas declaradas que apontam todas para o mesmo componente `Configuracoes`** (que despacha por `useLocation().pathname` interno). Várias ações (`navigate('/settings/omni/whatsapp')`, `navigate('/settings/general/brandbook')`) chamam paths que NÃO têm Route declarada — caem no catch-all `*` (404 page).

---

## Rotas declaradas (mapa completo)

### Públicas (sem auth)
| Path | Componente | Errorboundary | Em `PUBLIC_ROUTES`? |
|---|---|---|---|
| `/login` | `LoginPage` | Login | ✅ |
| `/reset-password` | `ResetPasswordPage` | Reset Password | ✅ |
| `/finalizar-cadastro` | `FinalizarCadastro` | Finalizar Cadastro | ✅ |
| `/oauth/meta/callback` | `MetaOAuthCallback` | — | ✅ (`/oauth`) |
| `/oauth/google/callback` | `GoogleOAuthCallback` | — | ✅ (`/oauth`) |
| `/oauth/microsoft/callback` | `MicrosoftOAuthCallback` | — | ✅ (`/oauth`) |
| `/tiktok/callback` | `TiktokCallback` | — | ✅ (`/tiktok`) |
| `/agendar/:leadId` | `AgendamentoPublico` | Agendamento Público | ✅ (`/agendar`) |
| `/f/:formId` | `PublicFormPage` | Formulário Público | ✅ (`/f`) |
| `/excluir-dados` | `DataDeletionPage` | Exclusão de Dados | ✅ |
| `/politica-de-privacidade` | `PrivacyPolicyPage` | Política de Privacidade | ✅ |
| `/termos-de-servico` | `TermsOfServicePage` | Termos de Serviço | ✅ |
| `/terms-of-service` | `TermsOfServicePage` | Terms of Service | ✅ |

### Index / redirect
| Path | Comportamento |
|---|---|
| `/` | `<Navigate to="/bipro" replace />` |

### Mobile (`/m/*`, dentro de `MobileShell`, todas com `MobileModuleGuard`)
| Path | Componente | Module Key |
|---|---|---|
| `/m/bi` | `MobileBiPro` | `dashboard` |
| `/m/crm` | `MobileCrmPro` | `negocios` |
| `/m/crm/:id` | `MobileNegocioDetail` | `negocios` |
| `/m/omni` | `MobileOmniPro` | `conversas` |
| `/m/omni/:id` | `MobileConversaDetail` | `conversas` |
| `/m/perfil` | `MobilePerfil` | — |

### BI / CRM / Send / Prospect / Schedule / Omni / Form / Call (todas dentro de `DashLayout`)
| Path | Componente | Protegida por |
|---|---|---|
| `/bipro` (index) | `Dashboard` | `dashboard` |
| `/dashboard` (pai) | `DashLayout` | `ProtectedRoute` |
| `/dashboard/negocios` | `Negocios` | `negocios` |
| `/dashboard/negocios/:id` | `NegocioSingle` | `negocios` |
| `/dashboard/reunioes` | `Reunioes` | `agendamentos` |
| `/dashboard/reunioes/:id` | `ReuniaoSingle` | `agendamentos` |
| `/crm/kanban` | `Negocios` | `negocios` |
| `/crm/kanban/:id` | `NegocioSingle` | `negocios` |
| `/crm/list` | `Negocios` | `negocios` |
| `/crm/list/:id` | `NegocioSingle` | `negocios` |
| `/crm/clients` | `Clientes` | `clientes` |
| `/crm/clients/:id` | `ClienteSingle` | `clientes` |
| `/send` (index) | `Disparos` | `disparos` |
| `/send/novo` | `CriarDisparo` | `disparos` |
| `/send/:id` | `DisparoDetalhes` | `disparos` |
| `/prospect` (index) | `ProspectPro` | `prospect` |
| `/prospect/:id` | `ProspectSingle` | `prospect` |
| `/schedule` (index) | `Reunioes` | `agendamentos` |
| `/schedule/:id` | `ReuniaoSingle` | `agendamentos` |
| `/omni` (index) | `Conversas` | `conversas` |
| `/omni/demo` | `ConversasDemo` | `conversas` |
| `/omni/mensagens` | `OmniMensagens` | `conversas` |
| `/omni/automacoes` | `OmniAutomacoes` | `conversas` |
| `/lp` (index) | `LpPro` | `lp` |
| `/call` (index) | `CallPro` | `call` |
| `/call/negocios/:id` | `NegocioSingle` | `negocios` |

### Settings — todas roteiam para `Configuracoes` (que despacha internamente)
> `Configuracoes` (`pages/Configuracoes.tsx:230-323`) lê `useLocation().pathname` e mapeia `/settings/{area}/{item}` para uma seção interna via `urlItemToSection`. **As Routes em App.tsx servem só para "registrar" o path; o conteúdo real é decidido dentro do componente.**

| Path | Componente real renderizado |
|---|---|
| `/settings` (index) | `Configuracoes` → seção `geral` (default) |
| `/settings/crm/pipelines` | `Configuracoes` → `PipelinesConfig` |
| `/settings/crm/campos-extras` | `Configuracoes` → `CamposExtrasConfig` |
| `/settings/crm/score` | `Configuracoes` → `ScoreConfig` |
| `/settings/crm/motivos` | `Configuracoes` → `MotivosConfig` |
| `/settings/crm/followups` | `Configuracoes` → `Followups` (página inteira reusada) |
| `/settings/crm/aiagents` | `Configuracoes` → `AgentesIA` |
| `/settings/crm/aiagents/:id` | `AgenteSingle` (rota direta, **não** `Configuracoes`) |
| `/settings/crm/conversoes` | `Configuracoes` → `ConversionTrackingConfig` |
| `/settings/omni/email` | `Configuracoes` → `EmailMegaConfig` |
| `/settings/omni/sms` | `Configuracoes` → `SmsMegaConfig` |
| `/settings/omni/call` | `Configuracoes` → `CallMegaConfig` |
| `/settings/omni/dedup` | `Configuracoes` → `OmniDedupHealthConfig` |
| `/settings/omni/instagram` | `Configuracoes` → `InstagramMegaConfig` |
| `/settings/omni/whatsapp-log` | `Configuracoes` → `WhatsappLogConfig` (legacy) |
| `/settings/call/config` | `Configuracoes` → `CallMegaConfig` |
| `/settings/send/config` | `Configuracoes` → default `geral` (não há mapping em `urlItemToSection.send`) |
| `/settings/schedule/google` | `Configuracoes` → `IntegracoesConfig` (mapeado para `integracoes`) |
| `/settings/schedule/teams` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/schedule/distribuicao` | `Configuracoes` → `BookingDistribuicaoConfig` |
| `/settings/schedule/automacoes` | `Configuracoes` → `ScheduleAutomacoesConfig` |
| `/settings/lp/config` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/bi/ads` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/prospect/integracao` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/coach/config` | `Configuracoes` → `CoachProConfig` |
| `/settings/general/config` | `Configuracoes` → `GeralConfig` |
| `/settings/general/usuarios` | `Configuracoes` → `UsuariosConfig` |
| `/settings/general/times` | `Configuracoes` → `TimesConfig` |
| `/settings/general/times/:teamId` | `TimeSingle` (rota direta) |
| `/settings/general/webhooks` | `Configuracoes` → default `geral` (sem mapping) |
| `/settings/general/integracoes` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/general/design-system` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/general/ai-providers` | `Configuracoes` → `IntegracoesConfig` |
| `/settings/general/outros` | `Configuracoes` → `OutrosConfig` |
| `/settings/mfa-setup` | `MfaSetup` (standalone, fora do DashLayout) |
| `/settings/mfa-recovery-regenerate` | `MfaRecoveryRegenerate` (standalone) |

### MFA standalone
| Path | Componente |
|---|---|
| `/mfa-verify` | `MfaVerify` |

### Outros
| Path | Componente | Notas |
|---|---|---|
| `/profile` (index) | `Perfil` | — |
| `/brandbook` | `Brandbook` | fullscreen, sem `DashLayout` |
| `/schedules` (index) | `Horarios` | `RestrictedRoute requireGestor` |
| `/followups` (index) | `Followups` | — |
| `/coach` (index) | `CoachDashboard` | `coach` |
| `/coach/meetings/:meetingId` | `CoachMeetingEvaluation` | `coach` |
| `/coach/team` | `CoachTeamBoard` | `coach` |
| `/coach/team/:userId` | `CoachConsultantProfile` | `coach` |
| `/score` (index) | `Score` | sem `ModuleProtectedRoute` |
| **`/adm`** | **`Adm`** | **`RestrictedRoute requireSuperAdmin`** — fullscreen |
| **`/adm/clients/:id`** | **`AdmClientSingle`** | **`RestrictedRoute requireSuperAdmin`** — fullscreen |
| `*` (catch-all) | inline 404 | "Ir para o login" link |

---

## Issues encontrados

### P0 — Crítico (quebra visível agora)

**[P0-1] `/dashboard` puro renderiza tela em branco.**
- `App.tsx:226-261` declara `<Route path="/dashboard">` com children `negocios` e `reunioes`, mas **nenhum `<Route index />`**.
- **3 callers principais** redirecionam para `/dashboard` puro: `ProtectedRoute.tsx:45`, `LoginPage.tsx:80`, `LoginPage.tsx:116`. Também `GoogleOAuthCallback.tsx:26,33,49` e `MicrosoftOAuthCallback.tsx:26,33,42`.
- Resultado: após login bem-sucedido, user pode cair em `DashLayout` com `<Outlet />` vazio.
- **Fix recomendado:** ou (a) adicionar `<Route index element={<Navigate to="/bipro" replace />} />` dentro de `/dashboard`, ou (b) trocar todos os `navigate('/dashboard')` por `navigate('/bipro')`.

**[P0-2] Item ADM no sidebar depende de bootstrap completo.**
- `DashLayout.tsx:366` exige `isControlPlane && user?.profile?.super_adm`.
- `isControlPlane` (linha 262-271) é calculado **uma única vez via `useMemo([])`** lendo `sessionStorage._supabase_client_config`. Se a sidebar montar antes do `bootstrapClientConfig()` em `main.tsx` escrever a key, `isControlPlane` retorna `true` (fallback "no tenant config = control plane") — OK para esse caso. Mas se o profile não tem `super_adm = true` (OU se o profile ainda não carregou — DashLayout monta sem aguardar), o item nunca renderiza.
- **Fixes possíveis:**
  - Verificar se o user `joaoguirunasramos@gmail.com` tem `super_adm = true` no profile do control plane (`ohzwetkaazgxafubzvop`).
  - Se a sidebar precisa reagir à entrada tardia do profile, transformar `isControlPlane` em `useMemo([user?.profile?.id])` para reler quando o user carrega.
  - Adicionar log/telemetria: imprimir `{ isControlPlane, super_adm }` no console da sidebar.
- **Não é bug de rota** — a rota `/adm` ainda está acessível digitando direto no navegador (vai cair no `RestrictedRoute requireSuperAdmin` e ele faz a verificação real via edge function `adm-verify-super-admin`).

**[P0-3] `/settings/omni/whatsapp` retorna 404.**
- `pages/CriarDisparo.tsx:392` tem `onClick={() => navigate('/settings/omni/whatsapp')}`.
- App.tsx só declara `omni/email`, `omni/sms`, `omni/call`, `omni/dedup`, `omni/instagram`, `omni/whatsapp-log` (linhas 528-559). Não há `omni/whatsapp`.
- Resultado: clique cai no catch-all `*` → 404.
- **Fix:** trocar por `/settings/general/integracoes?tab=meta-leads` (que é o destino real da config WhatsApp/Meta) **ou** adicionar Route `omni/whatsapp`. Consistente com `urlItemToSection.omni.whatsapp = 'integracoes'` (Configuracoes.tsx:258), o que sugere que era pra ir para `IntegracoesConfig`.

**[P0-4] `/settings/general/brandbook` retorna 404.**
- `pages/Brandbook.tsx:183` tem `onClick={() => navigate('/settings/general/brandbook')}`.
- App.tsx não declara essa Route. `urlItemToSection.general.brandbook = 'outros'` (Configuracoes.tsx:297) sugere que o destino esperado é a aba "Outros".
- **Fix:** trocar para `/settings/general/outros` ou para `/brandbook` (página fullscreen já existe).

---

### P1 — Alto (funcionalidade degradada / inconsistência clara)

**[P1-1] `/settings/send/config` e `/settings/general/webhooks` caem em "Geral" silenciosamente.**
- App.tsx:567-570 e 638-641 declaram essas Routes apontando para `Configuracoes`, mas `urlItemToSection.send` está vazio e não há mapping para `general.webhooks`. O fallback é `geral` (Configuracoes.tsx:319 + 322).
- Resultado: usuário clica numa entrada de menu esperando "Send Config" e vai parar em "Geral" — sem aviso.
- **Fix:** ou remover essas Routes, ou criar os componentes/mappings reais.

**[P1-2] `Configuracoes` filtra por `s.adminOnly` que não existe em nenhum item.**
- `pages/Configuracoes.tsx:369` tem `.filter((s) => !s.adminOnly || isSuperAdmin)`. Em todo `allSections` (linhas 63-202) **nenhum item tem `adminOnly: true`**. Filtro morto — ou (a) historicamente havia uma seção super-admin que foi removida dos items mas o filtro ficou, ou (b) intenção futura nunca implementada.
- **Fix:** remover filtro morto OU adicionar a seção admin esperada (deveria existir uma seção apontando para ADM Control Plane?).

**[P1-3] `getRestrictedSidebarItems` retorna array vazio.**
- `DashLayout.tsx:149`: `const getRestrictedSidebarItems = (t) => [];` com comentário "now empty since settings moved outside CRM".
- Função morta — nunca é chamada em `getActiveSidebarItems` (linhas 334-372). Lixo de refactor.
- **Fix:** deletar a função.

**[P1-4] `superAdminSidebarItems` só contém ADM, mas a checagem usa `super_adm` local sem revalidar com edge function.**
- `DashLayout.tsx:366` confia em `user?.profile?.super_adm` para mostrar item de menu, enquanto `RestrictedRoute requireSuperAdmin` (RestrictedRoute.tsx:104-114) **revalida via `adm-verify-super-admin`**. É correto (defense-in-depth), mas a UX fica esquisita: se o profile local diz que é super_adm e a verify retornar `denied`, o user clica no menu e vê "Acesso Restrito" — sem feedback prévio.
- **Fix (UX):** considerar pré-validar o super_adm e cachear (já existe `_adm_verified_${userId}` mas só é populado quando o user navega para `/adm` — poderia ser pré-warmed no login).

**[P1-5] Bootstrap de tenant + sidebar têm race condition silenciosa.**
- `DashLayout.tsx:262-271` `isControlPlane` é `useMemo` com deps `[]` (avaliado uma vez no mount). Se o `sessionStorage._supabase_client_config` for escrito DEPOIS do mount, a sidebar não relê.
- Em prática: `bootstrapClientConfig()` em `main.tsx` roda ANTES do `App` ser importado, então no mount já está populado. **Mas** se algum cenário mudar o tenant em runtime (não há hoje, mas...), o sidebar fica stale.
- **Fix preventivo:** depender de `user?.profile?.id` para reavaliar.

---

### P2 — Médio (inconsistência não-bloqueante)

**[P2-1] `/dashboard` (path canônico) vs `/bipro` (path real) — duplicação confusa.**
- `App.tsx:147` faz `/` → `/bipro`. Mas o sidebar usa `/bipro` (DashLayout.tsx:89). Toda lógica de redirect pós-login usa `/dashboard` (que é só o pai de `negocios`/`reunioes`). Mistura legacy/atual.
- **Fix:** consolidar em `/bipro` ou em `/dashboard` (escolher um).

**[P2-2] `getPageTitle()` em DashLayout ignora `/score`, `/profile` e outras rotas.**
- DashLayout.tsx:308-328 tem mapeamento manual de path → título. `/score` está; `/profile` está; mas `/brandbook` (que renderiza fora do DashLayout, OK) não. `/dashboard/negocios` cai em "Refresh button" mas não tem título — só "Refresh".
- Não é bug, mas é frágil — qualquer rota nova precisa lembrar de atualizar essa função.

**[P2-3] `path === '/dashboard'` em DashLayout.tsx:518.**
- O active-state da sidebar usa `path === '/dashboard'` para fixed match de uma rota que **não existe na sidebar** (sidebar usa `/bipro`, `/crm/kanban`, etc.). Código morto residual de quando `/dashboard` era usado como rota principal.

**[P2-4] Várias rotas standalone usam `<Route path>` em vez de relative children.**
- `/settings/mfa-setup`, `/settings/mfa-recovery-regenerate` (App.tsx:666, 675) são declaradas com path absoluto **fora** do `<Route path="/settings">` parent. Funciona, mas é confuso — como o `Configuracoes` lê `/settings/...` do pathname, essas duas rotas standalone não conflitam, mas o leitor não vê o porquê.

**[P2-5] `Navigate to="/m/bi"` para mobile é hardcoded.**
- App.tsx:107: `<Navigate to="/m/bi" replace />` redireciona qualquer mobile user para BI. Se o tenant não tem módulo `dashboard` ativo, `MobileModuleGuard` bloqueia e o user fica preso. Não há fallback inteligente.

**[P2-6] Settings tem ~6 rotas legacy mapeadas mas sem Route declarada.**
- `urlItemToSection.crm.elevenlabs`, `urlItemToSection.omni.meta`, `urlItemToSection.omni.whatsapp-meta`, `urlItemToSection.omni.new-contact`, `urlItemToSection.coach.config` (este último ESTÁ declarado), `urlItemToSection.schedule.google`, `urlItemToSection.schedule.teams` etc. Várias dessas chaves no map de Configuracoes não têm Route — só funcionam como "se você digitar essa URL, o componente saberia o que fazer", mas sem Route o React Router nunca chama o componente.
- **Fix:** auditar item-por-item — manter só os que têm Route OU adicionar Routes para todos.

**[P2-7] `MfaVerify` tem path `/mfa-verify` (sem `/settings/`).**
- Inconsistente com os outros MFA paths (`/settings/mfa-setup`, `/settings/mfa-recovery-regenerate`). Não causa bug porque está hardcoded em `ProtectedRoute.tsx:79`, mas semanticamente deveria ser `/settings/mfa-verify` ou todos deveriam ser raiz.

---

## ADM — diagnóstico específico

**Status:** Rotas OK, componentes existem, problema é UX/visibilidade do menu.

**Cadeia completa:**
1. App.tsx:808-825 declara `/adm` e `/adm/clients/:id` com `<RestrictedRoute requireSuperAdmin>`. ✅
2. `pages/Adm.tsx` e `pages/AdmClientSingle.tsx` existem no disco. ✅
3. `RestrictedRoute.tsx:104-114` verifica via edge function `adm-verify-super-admin` (control plane). ✅
4. **Sidebar:** `DashLayout.tsx:152-160` define `superAdminSidebarItems` com path `/adm`, `requireSuperAdmin: true`, `groupLabel: "ADMIN"`. ✅
5. **Renderização:** `DashLayout.tsx:366` só inclui esse item se `isControlPlane && user?.profile?.super_adm`. ⚠️

**Hipóteses do "ADM sumiu":**
- (a) **`user.profile.super_adm` não está `true`** no profile do user atual (control plane Supabase project `ohzwetkaazgxafubzvop`). Verificar com SQL `SELECT id, email, super_adm FROM profiles WHERE email = 'joaoguirunasramos@gmail.com'`.
- (b) **`isControlPlane` está retornando `false`** porque o `_supabase_client_config` foi gravado com URL diferente do `CONTROL_PLANE_URL`. Ver `main.tsx → bootstrapClientConfig` + `integrations/supabase/client.ts`.
- (c) **Profile ainda não carregou no momento do mount do sidebar** — `user?.profile?.super_adm` é `undefined`. Mas o sidebar re-renderiza quando o profile chega, então não deveria persistir. Confirmar com console.log no DashLayout (já tem `console.log('Active sidebar items:', activeItems)` na linha 370).

**Workaround imediato:** digitar `/adm` direto no browser (a Route existe e o `RestrictedRoute` faz a checagem real).

**Fix de raiz (após confirmar a hipótese):** mais provável (a) — e o conserto é só atualizar o profile do user. Se for (c), envolver `isControlPlane` em `useMemo([user?.profile?.id])` ou usar `useState` reativo.

---

## Settings — diagnóstico específico

**Padrão arquitetural:** todas as rotas `/settings/*` (exceto `/settings/mfa-*`, `/settings/crm/aiagents/:id` e `/settings/general/times/:teamId`) montam o **mesmo componente `Configuracoes`**, que olha `useLocation().pathname` e despacha internamente. Isso é OK (um componente, várias seções), mas tem 3 problemas:

1. **Routes duplicam mappings.** As 30+ Routes em App.tsx (linhas 487-662) só existem para "registrar" o path com o React Router — todo o despacho real fica dentro de `Configuracoes.tsx:240-302` (`urlItemToSection`). **Toda nova seção precisa ser adicionada em DOIS lugares.** Inconsistências surgem fácil:
   - `/settings/omni/whatsapp` está em `urlItemToSection.omni.whatsapp = 'integracoes'` (Configuracoes.tsx:258) **mas não tem Route declarada** → 404. **[P0-3]**
   - `/settings/general/brandbook` mapeado para `'outros'` (Configuracoes.tsx:297) **mas não tem Route** → 404. **[P0-4]**
   - `/settings/send/config` tem Route mas não tem mapping → cai em `geral`. **[P1-1]**
   - `/settings/general/webhooks` tem Route mas não tem mapping → cai em `geral`. **[P1-1]**

2. **Filtro `adminOnly` morto.** `Configuracoes.tsx:369` filtra mas nenhum item declara — provável remoção parcial. **[P1-2]**

3. **`/settings` (index) sempre cai em `'geral'`** (Configuracoes.tsx:234, fallback `searchParams.get("section") || "geral"`). Se o usuário esperava ver outra coisa (algumas LPs ainda usam `?section=ia` no `VoiceChatButton.tsx:170`), o handler de query param ainda existe mas não há item `'ia'` em allSections — silenciosamente cai em geral.

**Fix arquitetural recomendado:** consolidar despacho em UM lugar — ou (a) o mapping `urlItemToSection` no componente vira a fonte da verdade e cada chave gera dinamicamente uma `Route`, ou (b) cada path vira um child-route real apontando para o config component específico (eliminando `urlItemToSection` inteiro). Hoje os dois conviveram e divergiram.

---

## Recomendações priorizadas

1. **Investigar P0-2 antes de tocar em código** — verificar `super_adm` do user no DB do control plane. Se for esse o problema, é dado, não código.
2. **Aplicar P0-1, P0-3, P0-4** (bug fixes mecânicos) — ~30min cada.
3. **Limpar P1-2 e P1-3** (código morto) — facilita auditorias futuras.
4. **Decidir estratégia de settings (P2-6)** — se for refactor grande, abrir story para Architect (Zaelor) propor ADR.
5. **P2-1 (`/dashboard` vs `/bipro`)** — escolher um, fazer migração consistente.
