-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK: FIX-SENDS-STATUS-BRIDGE-01 AC3+AC4 (20260725270000)
-- Desfaz o trigger e a função de bridge messages → sends_contacts.
-- O índice idx_sends_contacts_send_people é removido (foi adicionado pela migration).
-- AVISO: após rollback, sends_contacts.delivered_at/read_at voltam a ficar NULL
-- para mensagens de campanhas futuras. Dados já propagados NÃO são revertidos.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Drop trigger ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_messages_to_sends_contacts ON public.messages;

-- ─── 2. Drop função de trigger ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_messages_to_sends_contacts_bridge();

-- ─── 3. Drop índice composto (adicionado pela migration forward) ──────────────
DROP INDEX IF EXISTS public.idx_sends_contacts_send_people;

COMMIT;
