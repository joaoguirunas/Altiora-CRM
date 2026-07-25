---
name: patterns-altiora-filters
description: Padrão de filtros específicos do pipeline Altiora — closerIdFilter, origemFilter, propagação e valores válidos
metadata:
  type: project
---

## Filtros Altiora — Padrão de propagação

**closerIdFilter**: filtra `altiora_closer_id` na tabela `leads`
- Auto-aplicado em `Negocios.tsx` via useEffect quando `isComercial && isAltiora`
- Controlado por seletor "Ver carteira de:" na toolbar para `isManager && isAltiora`
- Propagado: `Negocios.tsx` → `KanbanBoard.tsx` → `useNegociosByStage` → `useNegociosPipeline` → `.eq('altiora_closer_id', closerIdFilter)`

**origemFilter**: filtra `altiora_origem` na tabela `leads`
- Seletor no popover "Filtros" da NegociosToolbar, condicional a `isAltiora`
- Valores válidos (check constraint DB): `avenue_email` | `manual` | `outros`
- UI labels: "Avenue (E-mail)" | "Manual" | "Outros"
- Propagado: `Negocios.tsx` → `KanbanBoard.tsx` → `useNegociosByStage` → query `.eq('altiora_origem', origemFilter)`

**Busca textual estendida** (ALTIORA-09 AC2):
- OR clause cobre: `title`, `clients_people.name`, `clients_people.email`, `clients_people.whatsapp`, `clients_companies.trade_name`
- `whatsapp` é coluna real em `clients_people` (index criado no baseline.sql)

**Why:** closerIdFilter usa `altiora_closer_id` (FK settings_users.id), não `auth.uid()` diretamente. O `profile.id` do useAuth mapeia ao `settings_users.id`.

**How to apply:** Sempre passar `|| undefined` para evitar queries com string vazia: `closerIdFilter: closerIdFilter || undefined`.
