-- migrations/20260725350000_message_delivery_attempts.sql
-- Story: FIX-SENDS-FIRST-MSG-01 — Observabilidade permanente do delivery WhatsApp
-- ADR:   docs/smart-memory/decisions/ADR-SENDS-01-message-delivery-attempts.md
-- Agent: dev-data-engineer (Bythak) — AC8 + AC9
--
-- SECURITY NOTE: request_body MUST NOT contain Bearer token or any auth credential.
--                Sanitise at insert time inside whatsapp-outbound edge fn.
--                Persist only the POST body JSON (template, components, recipient) —
--                never Authorization headers.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- Table: message_delivery_attempts
-- 1:N with public.messages — each row = one attempt to deliver a message
-- via a provider (Meta Graph API, etc.)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_delivery_attempts (
  id            bigserial         PRIMARY KEY,

  -- FK to messages (bigserial PK) — cascade delete keeps log tidy
  message_id    bigint            NOT NULL
                                  REFERENCES public.messages(id)
                                  ON DELETE CASCADE,

  -- Monotonically increasing per message; first attempt = 1
  attempt_no    int               NOT NULL DEFAULT 1,

  -- Delivery channel: 'whatsapp' | 'email' | 'sms' | 'phone' (extensible)
  channel       text              NOT NULL,

  -- Upstream provider: 'meta_graph' | 'sendgrid' | 'twilio' | etc.
  provider      text,

  -- Attempt lifecycle timestamps
  started_at    timestamptz       NOT NULL DEFAULT now(),
  finished_at   timestamptz,

  -- Delivery outcome
  status        text              NOT NULL
                                  CHECK (status IN ('pending', 'sent', 'failed', 'timeout')),

  -- Sanitized request body (NO Bearer token — see SECURITY NOTE above)
  request_body  jsonb,

  -- Full provider response (safe to store — no inbound credentials)
  response_body jsonb,

  -- HTTP-level details
  http_status   int,

  -- WhatsApp message ID returned by Meta Graph API
  wamid         text,

  -- Provider-level error fields (null on success)
  error_code    text,
  error_message text,

  -- Computed delivery latency — null while attempt is still pending
  -- Cast to int: miliseconds as integer (max ~24 days before overflow, acceptable)
  duration_ms   int GENERATED ALWAYS AS (
    (EXTRACT(epoch FROM (finished_at - started_at)) * 1000)::int
  ) STORED
);

COMMENT ON TABLE  public.message_delivery_attempts IS
  'Delivery attempt log — 1:N with messages. Enables per-message observability '
  '(request/response/latency/error) and retry tracking. '
  'request_body MUST NOT contain auth credentials (see ADR-SENDS-01).';

COMMENT ON COLUMN public.message_delivery_attempts.request_body IS
  'Sanitized POST body sent to provider. Never persist Authorization headers or access tokens.';

COMMENT ON COLUMN public.message_delivery_attempts.duration_ms IS
  'Delivery latency in milliseconds (GENERATED: finished_at - started_at). NULL while pending.';

-- ────────────────────────────────────────────────────────────────────────────
-- Indexes (AC9)
-- ────────────────────────────────────────────────────────────────────────────

-- Primary lookup: all attempts for a message, ordered by attempt_no ascending
-- Used by: UI lazy-fetch of delivery log, whatsapp-outbound attempt_no increment
CREATE INDEX IF NOT EXISTS idx_mda_message_id_attempt
  ON public.message_delivery_attempts (message_id, attempt_no);

-- Monitoring + ops: find pending/failed attempts in a time window
-- Used by: ops dashboards, REL-03 drift detection, incident triage
CREATE INDEX IF NOT EXISTS idx_mda_status_started
  ON public.message_delivery_attempts (status, started_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS — mirrors public.messages policy pattern
-- (ref: 20260428060000_fwup17_rls_policies_baseline_repair.sql)
-- All authenticated users can read/write; service_role bypasses automatically.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.message_delivery_attempts ENABLE ROW LEVEL SECURITY;

-- Drop before create (idempotent re-apply)
DROP POLICY IF EXISTS "mda_authenticated_read"  ON public.message_delivery_attempts;
DROP POLICY IF EXISTS "mda_authenticated_write" ON public.message_delivery_attempts;

-- SELECT: any authenticated user can read delivery logs
-- (same as messages — no cross-people filtering at row level; API layer gates by people_id)
CREATE POLICY "mda_authenticated_read"
  ON public.message_delivery_attempts
  FOR SELECT
  TO authenticated
  USING (true);

-- ALL (INSERT/UPDATE/DELETE): authenticated users may write
-- Primary writer is whatsapp-outbound (service_role, bypasses RLS)
-- Authenticated path allows manual corrections by admin if needed
CREATE POLICY "mda_authenticated_write"
  ON public.message_delivery_attempts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- Grants
-- ────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE
  ON public.message_delivery_attempts
  TO authenticated;

GRANT ALL
  ON public.message_delivery_attempts
  TO service_role;

-- bigserial sequence: edge fns (service_role) and authenticated hooks need USAGE + SELECT
GRANT USAGE, SELECT
  ON SEQUENCE public.message_delivery_attempts_id_seq
  TO authenticated, service_role;

COMMIT;
