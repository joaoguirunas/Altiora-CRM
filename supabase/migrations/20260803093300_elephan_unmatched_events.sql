-- Elephan.ai — calls gravadas que não deram match automático com um negócio.
-- A function elephan-inbound tenta casar por e-mail do consultor + janela de
-- tempo (em camadas); quando falha, a call cai aqui em vez de só ficar
-- perdida em webhook_logs, pra permitir vínculo manual depois.

BEGIN;

CREATE TABLE IF NOT EXISTS public.elephan_unmatched_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcribe_id     TEXT NOT NULL,
  call_date         TIMESTAMPTZ NOT NULL,
  title             TEXT,
  closer_email      TEXT,
  closer_user_id    UUID REFERENCES public.settings_users(id) ON DELETE SET NULL,
  summary           TEXT,
  duration_seconds  INTEGER,
  recording_url     TEXT,
  transcript_text   TEXT,
  raw_payload       JSONB NOT NULL DEFAULT '{}'::jsonb,

  status            TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'linked', 'ignored')),
  linked_lead_id    UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  linked_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  linked_by         UUID REFERENCES public.settings_users(id) ON DELETE SET NULL,
  linked_at         TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_elephan_unmatched_events_transcribe_id
  ON public.elephan_unmatched_events (transcribe_id);

CREATE INDEX IF NOT EXISTS idx_elephan_unmatched_events_status
  ON public.elephan_unmatched_events (status, call_date DESC);

DROP TRIGGER IF EXISTS update_elephan_unmatched_events_updated_at ON public.elephan_unmatched_events;
CREATE TRIGGER update_elephan_unmatched_events_updated_at
  BEFORE UPDATE ON public.elephan_unmatched_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.elephan_unmatched_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select" ON public.elephan_unmatched_events;
CREATE POLICY "authenticated_select" ON public.elephan_unmatched_events
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update" ON public.elephan_unmatched_events;
CREATE POLICY "authenticated_update" ON public.elephan_unmatched_events
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Sem INSERT/DELETE para authenticated — só a edge function (service role) cria linhas;
-- usuários só resolvem pendências (UPDATE de status/link), nunca criam ou apagam à mão.

GRANT SELECT, UPDATE ON public.elephan_unmatched_events TO authenticated;

COMMIT;
