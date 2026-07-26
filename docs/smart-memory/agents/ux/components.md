---
title: Component Specs
type: component-spec
agent: dev-ux
updated: 2026-04-22
tags: [ux, components, design-system]
related: ["[[../../project/tech-stack]]"]
---

# Component Specs — rev-os

Discovery scan: read-only catalog of existing UI components, design tokens, and page architecture.

---

## Design System

### Stack
- **Framework:** shadcn/ui (style: default, baseColor: slate, CSS variables enabled)
- **Styling:** Tailwind CSS v3 with custom tokens
- **Primitives:** Radix UI (full suite — see list below)
- **Theme:** `next-themes`, default dark, no system override

### Color Tokens (CSS variables, dual light/dark)

| Token | Light | Dark | Semantic use |
|---|---|---|---|
| `--primary` | `hsl(17 100% 50%)` = `#FF4400` | same | Brand orange — CTA, active state, ring |
| `--primary-hover` | `hsl(18 100% 58%)` | same | Button hover |
| `--background` | white | `#0a0a0a` | Page background |
| `--card` | white | `#111113` | Card/modal surfaces |
| `--foreground` | `hsl(210 11% 8%)` | `hsl(0 0% 96%)` | Body text |
| `--muted` | `hsl(215 20% 95%)` | `hsl(240 5% 8%)` | Subtle backgrounds |
| `--muted-foreground` | `hsl(215 16% 47%)` | `hsl(0 0% 55%)` | Placeholder, secondary text |
| `--border` | `hsl(215 20% 89%)` | `hsl(0 0% 14%)` | Dividers, component borders |
| `--accent` | `hsl(217 91% 60%)` | same | Blue accent |
| `--destructive` | `hsl(0 84.2% 60.2%)` | same | Error/delete |
| `--success` | `hsl(142 76% 36%)` | same | Confirm/active |
| `--warning` | `hsl(48 96% 53%)` | same | Caution |

**Sidebar tokens:** separate set (`--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, etc.) — sidebar bg is always near-black (`#0a0a0a`) even in light mode.

**Semantic card tokens:**
- `--card-info` — blue tint (empresa info)
- `--card-empresa` — purple tint
- `--card-money` — green tint
- `--card-summary` — amber tint
- `--stats-primary/secondary/tertiary/quaternary` — stat widget variants

**Brand colors (non-token, hardcoded):**
- `iatize.blue` `#2563FF`, `iatize.blue-light` `#78AFFF`
- `iatize.green` `#00D26A`, `iatize.purple` `#6C16F8`, `iatize.black` `#141414`

### Typography

| Scale | Value | Token |
|---|---|---|
| Base | 14px | `text-base` |
| Caption | 12px | `text-caption` |
| Micro | 11px | `text-micro` |
| Title XL | 32px | `text-title-xl` |
| Title Large | 24px | `text-title-large` |
| Title Medium | 18px | `text-title-medium` |
| Primary font | Outfit (display) | `font-outfit` |
| Secondary font | Inter (body, default) | body default via CSS |
| Mono font | JetBrains Mono | `font-mono` |

### Spacing & Radius

- `--radius`: `0.125rem` (2px) — intentionally brutalist/tight
- Tailwind `borderRadius.lg` = `var(--radius)` = 2px
- `borderRadius.DEFAULT` = 8px (utility class fallback)
- Container max: `1400px` at `2xl`

### Shadows

- `shadow-elegant` — subtle depth
- `shadow-glow` — primary color ring glow (focus states)

### Animations (Tailwind keyframes)

- `fade-in` — 0.3s, opacity + Y translate
- `scale-in` — 0.2s, scale from 0.95
- `accordion-down/up` — height transition via Radix CSS var
- `card-hover` — scale + shadow lift

---

## shadcn/ui Components Installed

Full list inferred from `src/components/ui/`:

| Component | File | Radix Primitive |
|---|---|---|
| Accordion | `accordion.tsx` | `@radix-ui/react-accordion` |
| Alert Dialog | `alert-dialog.tsx` | `@radix-ui/react-alert-dialog` |
| Alert | `alert.tsx` | — |
| Aspect Ratio | `aspect-ratio.tsx` | `@radix-ui/react-aspect-ratio` |
| Avatar | `avatar.tsx` | `@radix-ui/react-avatar` |
| Badge | `badge.tsx` | — |
| Breadcrumb | `breadcrumb.tsx` | — |
| Button | `button.tsx` | `@radix-ui/react-slot` |
| Calendar | `calendar.tsx` | `react-day-picker` |
| Card | `card.tsx` | — |
| Carousel | `carousel.tsx` | — |
| Chart | `chart.tsx` | recharts wrapper |
| Checkbox | `checkbox.tsx` | `@radix-ui/react-checkbox` |
| Collapsible | `collapsible.tsx` | `@radix-ui/react-collapsible` |
| Command | `command.tsx` | `cmdk` |
| Context Menu | `context-menu.tsx` | `@radix-ui/react-context-menu` |
| Date Range Picker | `date-range-picker.tsx` | custom |
| Dialog | `dialog.tsx` | `@radix-ui/react-dialog` |
| Drawer | `drawer.tsx` | `vaul` |
| Dropdown Menu | `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` |
| Form | `form.tsx` | react-hook-form + Radix Label |
| Hover Card | `hover-card.tsx` | `@radix-ui/react-hover-card` |
| Input OTP | `input-otp.tsx` | `input-otp` package |
| Input | `input.tsx` | — |
| Label | `label.tsx` | `@radix-ui/react-label` |
| Loading Spinner | `loading-spinner.tsx` | custom |
| Menubar | `menubar.tsx` | `@radix-ui/react-menubar` |
| Navigation Menu | `navigation-menu.tsx` | `@radix-ui/react-navigation-menu` |
| Pagination Controls | `pagination-controls.tsx` | custom |
| Pagination | `pagination.tsx` | — |
| Popover | `popover.tsx` | `@radix-ui/react-popover` |
| Progress | `progress.tsx` | `@radix-ui/react-progress` |
| Radio Group | `radio-group.tsx` | `@radix-ui/react-radio-group` |
| Resizable | `resizable.tsx` | `react-resizable-panels` |
| Rich Text Editor | `rich-text-editor.tsx` | custom (Tiptap) |
| Scroll Area | `scroll-area.tsx` | `@radix-ui/react-scroll-area` |
| Select | `select.tsx` | `@radix-ui/react-select` |
| Separator | `separator.tsx` | `@radix-ui/react-separator` |
| Sheet | `sheet.tsx` | `@radix-ui/react-dialog` |
| Sidebar | `sidebar.tsx` | custom |
| Skeleton | `skeleton.tsx` | — |
| Slider | `slider.tsx` | `@radix-ui/react-slider` |
| Sonner (Toaster) | `sonner.tsx` | `sonner` |
| Switch | `switch.tsx` | `@radix-ui/react-switch` |
| Table | `table.tsx` | — |
| Tabs | `tabs.tsx` | `@radix-ui/react-tabs` |
| Textarea | `textarea.tsx` | — |
| Toast | `toast.tsx` | `@radix-ui/react-toast` |
| Toaster | `toaster.tsx` | — |
| Toggle Group | `toggle-group.tsx` | `@radix-ui/react-toggle-group` |
| Toggle | `toggle.tsx` | `@radix-ui/react-toggle` |
| Tooltip | `tooltip.tsx` | `@radix-ui/react-tooltip` |

**Custom additions in `ui/`:**
- `contact-avatar.tsx` — avatar with initials fallback for contacts
- `shader-background.tsx` — WebGL/canvas animated background
- `spotlight.tsx` — spotlight cursor effect
- `whatsapp-input.tsx` — phone input with WhatsApp formatting
- `pagination-controls.tsx` — pre-composed prev/next pagination

### Button Variants

The project uses an **Enterprise Edition** override (`buttonVariantsWithRounded`):

| Variant | Style |
|---|---|
| `default` | bg-primary, text-primary-foreground, hover:bg-primary-hover |
| `destructive` | bg-destructive |
| `outline` | border-border, transparent bg, hover:bg-muted |
| `secondary` | bg-secondary |
| `ghost` | hover:bg-accent |
| `link` | text-primary underline |

| Size | Height |
|---|---|
| `default` | 30px |
| `sm` | 30px |
| `xs` | 28px |
| `lg` | 44px |
| `icon` | 30x30px |

Radius is `rounded-[4px]` (hardcoded in variant, not `--radius`).

---

## Custom Components by Domain

### `adm/` — ADM Control Plane (super admin only)
- `AdmAuditLogPanel` — audit log viewer
- `AdmClientModal` — create/edit client tenant
- `AdmClientRow` — table row for client list
- `AdmCreateUserModal` — create user in client tenant
- `AdmModulesSection` — module enablement per tenant
- `AdmSyncPanel` — database sync operations
- `HealthBadge` — status indicator badge
- `SyncConfirmDialog` — confirmation dialog for sync

### `agendamento/` — Inline scheduling
- `AgendamentoInlineTab` — inline booking tab within a sidebar

### `agentes-ia/` — AI Agents
- `CentralDeTestes` — test hub for agents
- `TestActivityLog`, `TestChatPanel`, `TestPersonSelector` — testing sub-panels
- `ChangelogDisplay` — version history viewer
- `ConfiguracaoTab`, `ContextoTab`, `PromptsTab`, `HistoricoTab` — agent config tabs
- `DadosEntradaEditor` — input data editor
- `IdentidadeSelector` — agent identity picker
- `NovoAgenteModal`, `NovoTemplateModal` — creation modals
- `PipelineStageSelector` — stage picker for agent triggers
- `PromptEditor`, `PromptEtapaEditor`, `PromptShortcutsBar` — prompt composition
- `TemplateCard` — agent template card
- `ToolWidgetPanel` — tool configuration panel
- `VersionPreviewModal`, `VersionRestoreModal` — version management

### `auth/` — Authentication
- `LoginPage` — full-page login form
- `ResetPasswordPage` — password reset flow
- `SimpleAuthProvider` — Supabase auth context provider
- `ProtectedRoute` — auth guard (redirect to /login)
- `ModuleProtectedRoute` — module feature flag guard
- `RestrictedRoute` — role guard (gestor, superAdmin)

### `booking/` — Public booking
- `InlineBooking` — embeddable calendar booking widget

### `brandbook/` — Design System Viewer
Internal design documentation tabs: ColorTokens, Foundations, Typography, Spacing, Surfaces, Cards, Tables, Navigation, Patterns, Feedback, Effects, FlowDiagram, VFX, SEO, Advanced, Templates, LpSections, TokenExport.

### `call-pro/` — Call PRO™ (VoIP module)
- `CallProActiveCallPopup` — floating active call overlay
- `CallProAnalytics` — call analytics view
- `CallProAudioPlayer` — audio recording player
- `CallProCallDetail` — single call detail panel
- `CallProDialer` — phone dialer UI
- `CallProFloatingPanel` — persistent floating panel (rendered in DashLayout)
- `CallProHeaderIcon` — header status icon with badge
- `CallProHistory` — call history list
- `CallProPersonCalls` — calls for a specific person
- `CallProStandby` — idle/ready state
- `CallProTestSimulator` — test mode simulator

### `common/` — Shared generic components
- `ClienteJaAtribuidoAlert` — warning alert for already-assigned clients
- `CopyableId` — copyable ID chip
- `CopyPromptButton` — one-click prompt copy
- `EditableField` — inline editable text field
- `MultiSelectPessoas` — multi-select for contacts (Dialog + Command + Popover)
- `MultiSelectScore` — multi-select for score dimensions
- `MultiSelectSearchable` — generic searchable multi-select
- `PersonScoreDisplay`, `PersonScoreSection` — score display for a person
- `ScoreInformationDisplay` — score breakdown view
- `SearchableSelect` — single searchable select
- `UnsavedChangesDialog` — leave confirmation dialog
- `WhatsAppInput` — WhatsApp number input with country code

### `config/` — Settings panels
Large domain: 60+ components covering all module configurations.

**Sub-domains:**
- `horarios/` — Schedule availability editors (day cards, intervals, booking rules)
- `score/` — Score matrix configuration (base, category, objectives, investments, framings)
- `assets/` — Marketing/branding assets, RevOS logo

**Key config panels:**
- `GeralConfig` — general settings
- `PipelinesConfig` / `PipelineVisualization` — pipeline management
- `WhatsappTemplateBuilderModal` — WhatsApp template composer
- `DesignSystemConfig` — per-tenant design customization
- `AIProvidersConfig` — LLM provider keys
- `ElevenLabsConfig` — TTS voice config
- `ModulosConfig` — module on/off toggles
- `UsuariosConfig` / `TimesConfig` — user and team management
- `ScoreConfig` — score settings entry point

### `conversas/` — OMNI PRO™ Inbox
- `ConversasSidebar` — conversation list sidebar
- `ConversaDetalhes` — active conversation panel
- `MessageContent` — message bubble renderer (supports media types)
- `MessageStatusTicks` — WhatsApp-style read receipts (✓✓)
- `OmniTabNav` — channel tabs (WhatsApp, Email, etc.)
- `PessoaSidebar` — contact info sidebar
- `NegociosSection` — linked deals section
- `CannedResponsesModal` — saved reply templates
- `ScoreBadge` — contact score indicator
- `ControleIA` — AI on/off toggle per conversation
- `StatusAtendimento` — conversation status (open/closed)
- `CriarAgendamentoModal` — schedule meeting from conversation
- `AlterarEtapaNegocio` — change deal stage inline
- `AtribuirTimeResponsavel` — assign team/owner

### `dashboard/` — BI PRO™
- `BIProComercialTab` — commercial KPIs
- `BIProInsightsTab` — AI voice insights
- `BIProMarketingTab` — marketing attribution
- `BIProRevOpsTab` — RevOps metrics
- `BIProSummaryBar` — top summary strip
- `BottleneckAlert` — funnel bottleneck notification
- `DashboardFilters` / `DateRangeFilter` — filter controls
- `DynamicChart` — recharts wrapper with chart type switching
- `StageConversionMatrix` — stage-by-stage conversion grid
- `VoicePicker` / `VoicePlayerBar` — AI voice report controls

### `disparos/` — SENDS PRO™ (bulk messaging)
- `CriarDisparoModal` — multi-step create disparo wizard
- `DisparoCard` — campaign card
- `DisparoControls` — play/pause/stop campaign
- `FiltroContatosVisual` — visual contact filter builder
- `FilterWizardStepper` — stepper UI for filter wizard
- `FileUploadZone` — CSV drag-and-drop upload
- `ImportPreviewTable` — import preview table
- `FieldMapper` / `FieldMappingRow` — CSV column mapping
- `LiveCounterSidebar` — real-time contact count sidebar
- `CountdownCircular` — circular countdown timer
- `StatCard` / `PerformanceCard` / `ProgressCard` — metric cards
- `StatusBadge` — campaign status badge
- `steps/` — wizard step components (EtapasStep, LeadFiltersStep, PessoaFiltersStep, PipelineStep)

### `error-boundaries/`
- `PageErrorBoundary` — top-level React error boundary
- `SectionErrorBoundary` — per-section boundary with section label
- `AdvancedErrorBoundary` — recovery-capable boundary

### `followups/` — Follow-up management
- `FollowupModal` — create/edit follow-up
- `FollowupEmailEditor` — email body editor
- `AgendamentoFollowupModal` / `AgendamentoFollowupsCard` — meeting-linked followups
- `StageFollowupsCard` — stage-triggered followups
- `VariablePicker` — dynamic variable insertion
- `WhatsappTemplatePickerModal` — WA template picker
- `MultiSelectScoreMatrix` / `ScoreMatrixSelector` — score-based targeting

### `layout/`
- `DashLayout` — main app shell: collapsible sidebar (64px/240px) + fixed header (72px) + main content area + CallPro floating panel
- `TenantFooter` — tenant branding footer

### `loading/`
- `Loader` — full-page spinner
- `StandardPageLoader` — consistent page loading state

### `lp/` — FORM PRO™ (Landing Page / Form Builder)
- `LpFormBuilder` — main form builder
- `FormBuilderCatalog` / `FormBuilderSortable` — field catalog + drag-to-sort
- `FormBuilderPreview` / `FormBuilderSimulation` — live preview
- `FormBuilderSettings` / `FormBuilderStyle` — config panels
- `LpFieldEditor` — individual field editor
- `LpFormSubmissions` — submissions list
- `MetaFormBuilder` / `MetaFormEditor` — Meta Lead Ads form integration
- `MetaPageSelector` — Facebook Page picker

### `mobile/` — Mobile shell (PWA)
Auto-redirects mobile users to `/m/*` routes.

- `MobileShell` — mobile layout with bottom tabs
- `MobileBottomTabs` — bottom navigation (BI, CRM, Omni, Profile)
- `MobileAppHeader` — sticky mobile header
- `MobileModuleGuard` — mobile module feature gate
- `clientes/MobileClientesTabs` — mobile contacts tabs
- `conversas/` — mobile conversation list, item, single view
- `negocios/` — mobile deals list, card, sidebar, single, tabs, toolbar

### `modals/` — Shared modals
Generic entity modals used across modules:
- `ArquivarPessoaModal` — archive contact
- `BloquearAgendaModal` — block calendar slots
- `ConfirmarExclusaoModal` — delete confirmation
- `ConvidarUsuarioModal` — invite user by email
- `EditarEmpresaModal` / `NovaEmpresaModal` — company CRUD
- `EditarPessoaModal` / `NovaPessoaModal` — contact CRUD
- `EditarReuniaoModal` / `NovaReuniaoModal` / `NovaReuniaoWizardModal` — meeting CRUD
- `EditarUsuarioModal` / `NovoUsuarioModal` — user management
- `ExcluirPessoaModal` — delete contact
- `MergeContactModal` / `MergeLeadsModal` — dedup merging

### `negocios/` — CRM PRO™ Deal views
- `KanbanBoard` — drag-and-drop kanban (uses `@hello-pangea/dnd`)
- `StageColumn` — kanban column with cards
- `NegocioSidebar` — deal detail sidebar
- `NegociosList` — list view alternative
- `NegociosToolbar` — filter + view toggle toolbar
- `NovoNegocioModal` — create deal modal
- `NegocioAnalise` — AI deal analysis section
- `NegocioArquivos` — file attachments
- `NegocioBadges` — status/tag badges
- `NegocioConversa` — conversation tab
- `NegocioInteracoes` — interaction timeline
- `NegocioNotas` — notes section
- `NegocioReunioes` — linked meetings
- `NegocioScoreSection` — deal score display
- `MotivoPerdasModal` — loss reason modal
- `QualificacaoIASection` — AI qualification section
- `CamposExtrasSection` — custom fields section
- `conversa/MessageInput` / `conversa/MessageList` — inline messaging within deal

### `pessoas/` — Contact extra fields
- `ExtraFieldsCard` — extra fields for contacts
- `CompanyExtraFieldsCard` — extra fields for companies

### `prospect/` — PROSPECT PRO™
- `ProspectEditModal` / `ProspectNovaModal` — campaign CRUD
- `ProspectStepCRMV2` / `ProspectStepEmpresas` / `ProspectStepPessoas` / `ProspectStepRevisarV2` — wizard steps

### `reunioes/` — SCHEDULE PRO™ Meeting views
- `CalendarioView` — calendar grid view
- `CalendarioSemanalView` — weekly calendar view
- `MeetingRecordCard` — meeting card with recording status
- `MeetingTranscriptViewer` — transcript/AI summary viewer
- `AddMeetingRecordModal` — attach recording to meeting
- `RescheduleModal` — reschedule existing meeting
- `SmartSlotPicker` — AI-assisted available slot picker

### `schedule/`
- `ScheduleTabNav` — tab navigation for schedule section

### `status/`
- `ConnectionStatusIndicator` — realtime WebSocket status

---

## Form Patterns

- **Library:** `react-hook-form` with `FormProvider` / `Controller` / `useFormContext`
- **Validation:** zod via `zodResolver` (used selectively — found in adm/ modals)
- **shadcn form.tsx** wraps react-hook-form with `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`
- **Pattern:** `<Form>` (= FormProvider) > `<FormField control={form.control} name="...">` > `<FormItem>` > `<FormControl>` > `<Input />`
- Labels auto-connected via Radix Label primitive — `htmlFor` wired to field id

---

## Page / Route Architecture

| Module | Routes | Auth |
|---|---|---|
| BI PRO™ | `/bipro` | ProtectedRoute + ModuleProtectedRoute(dashboard) |
| CRM PRO™ | `/crm/kanban`, `/crm/list`, `/crm/clients`, `/crm/kanban/:id`, `/crm/clients/:id` | module: negocios / clientes |
| OMNI PRO™ | `/omni`, `/omni/mensagens`, `/omni/automacoes`, `/omni/demo` | module: conversas |
| SENDS PRO™ | `/send`, `/send/:id`, `/send/novo` | module: disparos |
| SCHEDULE PRO™ | `/schedule`, `/schedule/:id` | module: agendamentos |
| FORM PRO™ | `/lp` | module: lp |
| CALL PRO™ | `/call`, `/call/negocios/:id` | module: call |
| PROSPECT PRO™ | `/prospect`, `/prospect/:id` | module: prospect |
| COACH PRO™ | `/coach`, `/coach/meetings/:id`, `/coach/team`, `/coach/team/:userId` | module: coach |
| SCORE PRO™ | `/score` | ProtectedRoute |
| Follow-ups | `/followups` | ProtectedRoute |
| Schedules | `/schedules` | RestrictedRoute(requireGestor) |
| Settings | `/settings/**` | ProtectedRoute, some RestrictedRoute(requireGestor) |
| Profile | `/profile` | ProtectedRoute |
| ADM Control Plane | `/adm`, `/adm/clients/:id` | RestrictedRoute(requireSuperAdmin) |
| Brandbook | `/brandbook` | ProtectedRoute, no DashLayout |
| Public booking | `/agendar/:leadId` | public |
| Public form | `/f/:formId` | public |
| OAuth callbacks | `/oauth/meta`, `/oauth/google`, `/oauth/microsoft`, `/tiktok/callback` | public |
| LGPD | `/excluir-dados`, `/politica-de-privacidade` | public |

**Mobile routes** (`/m/*`, auto-redirect for mobile UA):
- `/m/bi` — MobileBiPro
- `/m/crm`, `/m/crm/:id` — MobileCrmPro + MobileNegocioDetail
- `/m/omni`, `/m/omni/:id` — MobileOmniPro + MobileConversaDetail
- `/m/perfil` — MobilePerfil

---

## DashLayout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar (240px / 64px collapsed)   │  Header (72px)            │
│  bg: #0a0a0a (always dark)          │  bg: card, border-bottom  │
│                                     │  [Back] [Title] ... [User]│
│  Logo / R                           ├───────────────────────────┤
│  ──────────────────                 │  <main> — router Outlet   │
│  CORE                               │  flex-1, overflow-auto    │
│    BI PRO™                          │                           │
│    CRM PRO™                         │                           │
│    OMNI PRO™                        │                           │
│  ──────────────────                 │                           │
│  MODULES (per active flags)         │                           │
│    CALL PRO™                        │                           │
│    SENDS PRO™                       │                           │
│    SCHEDULE PRO™                    │                           │
│    ...                              │                           │
│  ──────────────────                 │                           │
│  ADMIN (super_adm only)             │                           │
│    ADM                              │                           │
│  ──────────────────                 │                           │
│  [Settings] [< collapse]            │                           │
└─────────────────────────────────────┴───────────────────────────┘
                              + CallProFloatingPanel (portal)
```

Active sidebar items filtered by `activeModules` (Supabase) + user role (gestor, super_adm). Module items only appear when `is_active = true` in tenant config.

---

## Accessibility Observations

- **Radix UI primitives** provide keyboard navigation, focus management, and ARIA roles out-of-the-box for: Dialog, DropdownMenu, Select, Tabs, Accordion, Collapsible, Tooltip, AlertDialog, Popover, Checkbox, Switch, RadioGroup, Slider, Toggle, HoverCard, ContextMenu, Menubar.
- **Pagination:** explicit `role="navigation"`, `aria-label="pagination"`, `aria-current="page"`, `aria-label` on prev/next buttons.
- **Rich Text Editor:** toolbar buttons have `aria-label` for each action (Bold, Italic, Underline, Heading 1-3, Bullet list, Quote, Align left/center/right).
- **Focus ring:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` applied via button variants.
- **Disabled state:** `disabled:pointer-events-none disabled:opacity-50` on interactive elements.
- **Gap:** custom sidebar buttons use `<button>` natively but skip explicit `aria-label` when collapsed — only Tooltip text visible to sighted users, not screen readers.
- **Forms:** shadcn form.tsx wires `<FormLabel>` via Radix Label → `htmlFor` → input `id` automatically.
- **Theme:** `next-themes` with `attribute="class"` — dark/light toggle works without system preference.

---

## Notable Patterns

- **Drag-and-drop:** `@hello-pangea/dnd` (KanbanBoard) — a React 18-compatible fork of react-beautiful-dnd
- **Charts:** recharts wrapped by shadcn `chart.tsx`
- **Notifications:** `sonner` toast (replaces radix toast in practice)
- **Command palette pattern:** `cmdk` via `Command` component — used in MultiSelectSearchable and similar combobox patterns
- **Lazy loading:** `LazyComponentLoader` wrapper for code-split routes
- **Error isolation:** Three-tier error boundary system (Page → Section → Component)
- **Realtime:** `RealtimeProvider` context for Supabase realtime subscriptions
- **Multi-tenancy:** `TenantProvider` + `TenantFooter` for white-label support, single-tenant mode active

---

*Catalog produced by Vela+Astra (dev-ux) — read-only discovery pass, 2026-04-22.*
