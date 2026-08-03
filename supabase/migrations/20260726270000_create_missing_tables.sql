-- =============================================================================
-- Migration: 20260726270000_create_missing_tables.sql
-- Purpose: Create all tables identified as missing from the public schema.
--          instagram_automations + instagram_automation_log already exist — skipped.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- GROUP 1: AI / Agents
-- ---------------------------------------------------------------------------

-- ai_agent_callback_configs: Config da tool agendar_retorno por agente (RETORNO-01)
CREATE TABLE IF NOT EXISTS ai_agent_callback_configs (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                  UUID        NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    step_id                   UUID        REFERENCES ai_agents_steps(id) ON DELETE CASCADE,
    enabled                   BOOLEAN     NOT NULL DEFAULT false,
    default_mode              TEXT        NOT NULL DEFAULT 'direct' CHECK (default_mode IN ('direct','agent')),
    allow_agent_choose_mode   BOOLEAN     NOT NULL DEFAULT false,
    allow_free_text           BOOLEAN     NOT NULL DEFAULT false,
    templates                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
    free_prompt               TEXT,
    whatsapp_template_fallback TEXT,
    min_delay_minutes         INTEGER     NOT NULL DEFAULT 5,
    max_delay_hours           INTEGER     NOT NULL DEFAULT 720,
    cancel_on_resume          BOOLEAN     NOT NULL DEFAULT true,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_callback_configs_agent_step_idx
    ON ai_agent_callback_configs (agent_id, step_id);

CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_callback_configs_default_per_agent
    ON ai_agent_callback_configs (agent_id) WHERE step_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_agent_callback_configs_agent
    ON ai_agent_callback_configs (agent_id);

ALTER TABLE ai_agent_callback_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON ai_agent_callback_configs USING (true);


-- ai_agents_execution_log: Log de execuções do agente de IA por lead/pessoa
CREATE TABLE IF NOT EXISTS ai_agents_execution_log (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_agent_id             UUID        NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    people_id               UUID        NOT NULL REFERENCES clients_people(id) ON DELETE CASCADE,
    lead_id                 UUID        REFERENCES leads(id) ON DELETE SET NULL,
    prompt_rendered         TEXT        NOT NULL,
    tools_used              TEXT[]      DEFAULT '{}',
    execution_status        TEXT        NOT NULL,
    execution_duration_ms   INTEGER,
    response_data           JSONB,
    error_message           TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    created_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_agent_time
    ON ai_agents_execution_log (ai_agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_people_time
    ON ai_agents_execution_log (people_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_status
    ON ai_agents_execution_log (execution_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_lead
    ON ai_agents_execution_log (lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE ai_agents_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON ai_agents_execution_log USING (true);


-- ai_scheduled_callbacks: Fila de retornos ad-hoc agendados pela tool agendar_retorno
CREATE TABLE IF NOT EXISTS ai_scheduled_callbacks (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id                     UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    people_id                   UUID        NOT NULL REFERENCES clients_people(id) ON DELETE CASCADE,
    agent_id                    UUID        REFERENCES ai_agents(id) ON DELETE SET NULL,
    step_id                     UUID        REFERENCES ai_agents_steps(id) ON DELETE SET NULL,
    scheduled_for               TIMESTAMPTZ NOT NULL,
    mode                        TEXT        NOT NULL CHECK (mode IN ('direct','agent')),
    template_id                 TEXT,
    message_text                TEXT,
    whatsapp_template_name      TEXT,
    reason                      TEXT        NOT NULL,
    channel                     TEXT        NOT NULL DEFAULT 'whatsapp',
    status                      TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','processing','sent','failed','cancelled','skipped')),
    fired_at                    TIMESTAMPTZ,
    cancelled_at                TIMESTAMPTZ,
    cancel_reason               TEXT,
    message_id                  INTEGER     REFERENCES messages(id) ON DELETE SET NULL,
    error_message               TEXT,
    retry_count                 INTEGER     NOT NULL DEFAULT 0,
    response_data               JSONB,
    created_by_execution_id     UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_scheduled_callbacks_one_pending_per_lead
    ON ai_scheduled_callbacks (lead_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_due
    ON ai_scheduled_callbacks (scheduled_for) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_people
    ON ai_scheduled_callbacks (people_id);

CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_status
    ON ai_scheduled_callbacks (status);

CREATE INDEX IF NOT EXISTS idx_ai_scheduled_callbacks_lead
    ON ai_scheduled_callbacks (lead_id);

ALTER TABLE ai_scheduled_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON ai_scheduled_callbacks USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 2: Settings
-- ---------------------------------------------------------------------------

-- settings_ai_providers: LLM provider credentials (singleton-like)
CREATE TABLE IF NOT EXISTS settings_ai_providers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    TEXT        NOT NULL,
    label       TEXT        NOT NULL,
    api_key     TEXT,
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    active      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settings_ai_providers_provider
    ON settings_ai_providers (provider);

CREATE INDEX IF NOT EXISTS idx_settings_ai_providers_default
    ON settings_ai_providers (is_default) WHERE is_default = true;

ALTER TABLE settings_ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON settings_ai_providers USING (true);


-- settings_whatsapp_channels: One row per WhatsApp Business Account phone-number channel
CREATE TABLE IF NOT EXISTS settings_whatsapp_channels (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    label            TEXT        NOT NULL,
    phone_number_id  TEXT        NOT NULL,
    waba_id          TEXT,
    access_token     TEXT        NOT NULL,
    app_secret       TEXT,
    is_default       BOOLEAN     NOT NULL DEFAULT false,
    active           BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT settings_whatsapp_channels_phone_number_id_key UNIQUE (phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_whatsapp_channels_created_at
    ON settings_whatsapp_channels (created_at);

ALTER TABLE settings_whatsapp_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON settings_whatsapp_channels USING (true);


-- settings_business_hours: Singleton table (limit 1 row)
CREATE TABLE IF NOT EXISTS settings_business_hours (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled      BOOLEAN     NOT NULL DEFAULT false,
    start_hour   INTEGER     NOT NULL DEFAULT 8,
    end_hour     INTEGER     NOT NULL DEFAULT 18,
    days_of_week INTEGER[]   NOT NULL DEFAULT '{1,2,3,4,5}',
    timezone     TEXT        NOT NULL DEFAULT 'America/Sao_Paulo',
    bh_only_last BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settings_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON settings_business_hours USING (true);


-- settings_elevenlabs: Singleton table (limit 1 row)
CREATE TABLE IF NOT EXISTS settings_elevenlabs (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key               TEXT,
    api_key_encrypted     TEXT,
    workspace_id          TEXT,
    default_model_id      TEXT        NOT NULL DEFAULT 'eleven_flash_v2_5',
    default_voice_id      TEXT,
    default_output_format TEXT        NOT NULL DEFAULT 'mp3_44100_128',
    webhook_secret        TEXT,
    monthly_char_limit    INTEGER     NOT NULL DEFAULT 0,
    monthly_char_used     INTEGER     NOT NULL DEFAULT 0,
    monthly_reset_at      TIMESTAMPTZ,
    active                BOOLEAN     NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settings_elevenlabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON settings_elevenlabs USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 3: ElevenLabs
-- ---------------------------------------------------------------------------

-- elevenlabs_voices: Cache of voices synced from ElevenLabs API
CREATE TABLE IF NOT EXISTS elevenlabs_voices (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_id        TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    category        TEXT,
    language        TEXT,
    gender          TEXT,
    use_case        TEXT,
    labels          JSONB,
    description     TEXT,
    stability       NUMERIC     NOT NULL DEFAULT 0.5,
    similarity_boost NUMERIC   NOT NULL DEFAULT 0.75,
    style           NUMERIC     NOT NULL DEFAULT 0,
    speed           NUMERIC     NOT NULL DEFAULT 1.0,
    preview_url     TEXT,
    is_default      BOOLEAN     NOT NULL DEFAULT false,
    source          TEXT,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT elevenlabs_voices_voice_id_key UNIQUE (voice_id)
);

CREATE INDEX IF NOT EXISTS idx_elevenlabs_voices_name
    ON elevenlabs_voices (name);

CREATE INDEX IF NOT EXISTS idx_elevenlabs_voices_default
    ON elevenlabs_voices (is_default) WHERE is_default = true;

ALTER TABLE elevenlabs_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON elevenlabs_voices USING (true);


-- elevenlabs_agents: Cache of ElevenLabs Conversational AI agents
CREATE TABLE IF NOT EXISTS elevenlabs_agents (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    elevenlabs_agent_id  TEXT        NOT NULL,
    name                 TEXT,
    voice_id             TEXT,
    llm_provider         TEXT,
    llm_model            TEXT,
    phone_number_id      TEXT,
    phone_number         TEXT,
    first_message        TEXT,
    status               TEXT        NOT NULL DEFAULT 'active',
    ai_agent_id          UUID        REFERENCES ai_agents(id) ON DELETE SET NULL,
    synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT elevenlabs_agents_elevenlabs_agent_id_key UNIQUE (elevenlabs_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_elevenlabs_agents_ai_agent_id
    ON elevenlabs_agents (ai_agent_id);

CREATE INDEX IF NOT EXISTS idx_elevenlabs_agents_name
    ON elevenlabs_agents (name);

ALTER TABLE elevenlabs_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON elevenlabs_agents USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 4: Clients / CRM entities
-- ---------------------------------------------------------------------------

-- clients_companies: Company/organization master table
CREATE TABLE IF NOT EXISTS clients_companies (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_name  TEXT        NOT NULL,
    legal_name  TEXT,
    tax_id      TEXT,
    email       TEXT,
    phone       TEXT,
    website     TEXT,
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique constraints (allow NULLs without collision)
CREATE UNIQUE INDEX IF NOT EXISTS clients_companies_tax_id_notnull_idx
    ON clients_companies (tax_id) WHERE tax_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_companies_email_notnull_idx
    ON clients_companies (email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_companies_trade_name
    ON clients_companies (trade_name);

ALTER TABLE clients_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON clients_companies USING (true);

-- Add FK from leads.company_id -> clients_companies.id (column already exists, no FK yet)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'leads'
          AND constraint_name = 'leads_company_id_fkey'
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE leads
            ADD CONSTRAINT leads_company_id_fkey
            FOREIGN KEY (company_id) REFERENCES clients_companies(id) ON DELETE SET NULL;
    END IF;
END;
$$;


-- clients_people_companies: N:N join between clients_people and clients_companies
CREATE TABLE IF NOT EXISTS clients_people_companies (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    people_id   UUID        NOT NULL REFERENCES clients_people(id) ON DELETE CASCADE,
    company_id  UUID        NOT NULL REFERENCES clients_companies(id) ON DELETE CASCADE,
    role        TEXT,
    is_primary  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT clients_people_companies_people_company_key UNIQUE (people_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_people_companies_company_id
    ON clients_people_companies (company_id);

CREATE INDEX IF NOT EXISTS idx_clients_people_companies_people_id
    ON clients_people_companies (people_id);

ALTER TABLE clients_people_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON clients_people_companies USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 5: Lead fields (dynamic schema)
-- ---------------------------------------------------------------------------

-- lead_field_definitions: Schema registry for dynamic extra fields
CREATE TABLE IF NOT EXISTS lead_field_definitions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    key          TEXT        NOT NULL,
    type         TEXT        NOT NULL,
    entity_type  TEXT        NOT NULL,
    category     TEXT        NOT NULL DEFAULT 'outros',
    pipeline_id  UUID        REFERENCES leads_pipelines(id) ON DELETE SET NULL,
    required     BOOLEAN     NOT NULL DEFAULT false,
    active       BOOLEAN     NOT NULL DEFAULT true,
    options      JSONB       DEFAULT '[]'::jsonb,
    order_index  INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_field_definitions_global_key_idx
    ON lead_field_definitions (entity_type, key) WHERE pipeline_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lead_field_definitions_pipeline_key_idx
    ON lead_field_definitions (entity_type, key, pipeline_id) WHERE pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_field_definitions_entity_active_order
    ON lead_field_definitions (entity_type, active, order_index);

CREATE INDEX IF NOT EXISTS idx_lead_field_definitions_pipeline_id
    ON lead_field_definitions (pipeline_id) WHERE pipeline_id IS NOT NULL;

ALTER TABLE lead_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON lead_field_definitions USING (true);


-- lead_field_values: Stores typed values for dynamic extra fields
CREATE TABLE IF NOT EXISTS lead_field_values (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type           TEXT        NOT NULL,
    entity_id             UUID        NOT NULL,
    field_definition_id   UUID        NOT NULL REFERENCES lead_field_definitions(id) ON DELETE CASCADE,
    lead_id               UUID        REFERENCES leads(id) ON DELETE CASCADE,
    value_text            TEXT,
    value_number          NUMERIC,
    value_boolean         BOOLEAN,
    value_date            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lead_field_values_entity_field_key UNIQUE (entity_type, entity_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_field_values_entity
    ON lead_field_values (entity_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_lead_field_values_lead_id
    ON lead_field_values (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_field_values_field_definition
    ON lead_field_values (field_definition_id);

ALTER TABLE lead_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON lead_field_values USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 6: Lead types
-- ---------------------------------------------------------------------------

-- lead_types: Lookup table for classifying lead import types
CREATE TABLE IF NOT EXISTS lead_types (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT        NOT NULL,
    description           TEXT        NOT NULL DEFAULT '',
    csv_headers           TEXT[]      NOT NULL DEFAULT '{}'::text[],
    csv_example           TEXT[]      NOT NULL DEFAULT '{}'::text[],
    is_active             BOOLEAN     NOT NULL DEFAULT true,
    sort_order            INTEGER     NOT NULL DEFAULT 0,
    whatsapp_template_id  TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lead_types_name_key UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_lead_types_active_sort
    ON lead_types (is_active, sort_order);

ALTER TABLE lead_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON lead_types USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 7: Email
-- ---------------------------------------------------------------------------

-- email_templates: Reusable HTML email template library (ADR-EMAIL-01)
CREATE TABLE IF NOT EXISTS email_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    subject     TEXT        NOT NULL,
    html_body   TEXT        NOT NULL,
    variables   TEXT[]      NOT NULL DEFAULT '{}',
    category    TEXT,
    active      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_active
    ON email_templates (active);

CREATE INDEX IF NOT EXISTS idx_email_templates_category
    ON email_templates (category) WHERE category IS NOT NULL;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON email_templates USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 8: Omni-channel / messaging
-- ---------------------------------------------------------------------------

-- omni_channel_configs: OMNI PRO centralised channel config
CREATE TABLE IF NOT EXISTS omni_channel_configs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel          TEXT        NOT NULL,
    is_active        BOOLEAN     DEFAULT false,
    display_name     TEXT        NOT NULL,
    credentials      JSONB       DEFAULT '{}',
    settings         JSONB       DEFAULT '{}',
    webhook_fallback JSONB       DEFAULT '{}',
    business_hours   JSONB       DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT omni_channel_configs_channel_key UNIQUE (channel),
    CONSTRAINT omni_channel_configs_channel_check
        CHECK (channel IN ('whatsapp','instagram','email','sms','telefone'))
);

ALTER TABLE omni_channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON omni_channel_configs USING (true);


-- message_buffer: Inbound message debounce buffer (replaces Redis)
CREATE TABLE IF NOT EXISTS message_buffer (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    people_id           UUID        NOT NULL REFERENCES clients_people(id) ON DELETE CASCADE,
    messages            JSONB[]     NOT NULL DEFAULT '{}',
    expires_at          TIMESTAMPTZ NOT NULL,
    processed           BOOLEAN     NOT NULL DEFAULT false,
    processed_at        TIMESTAMPTZ,
    wa_phone_number_id  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_buffer_ready_to_process
    ON message_buffer (people_id, expires_at) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_message_buffer_wa_phone_number_id
    ON message_buffer (wa_phone_number_id) WHERE wa_phone_number_id IS NOT NULL;

ALTER TABLE message_buffer ENABLE ROW LEVEL SECURITY;

-- service_role only (matches source intent)
CREATE POLICY "service_role only" ON message_buffer
    USING (auth.role() = 'service_role');


-- ---------------------------------------------------------------------------
-- GROUP 9: Conversion tracking
-- ---------------------------------------------------------------------------

-- conversion_event_rules: Flexible rule-based ad-platform conversion triggers
CREATE TABLE IF NOT EXISTS conversion_event_rules (
    id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                          TEXT        NOT NULL,
    trigger_type                  TEXT        NOT NULL,
    trigger_config                JSONB       NOT NULL DEFAULT '{}',
    meta_enabled                  BOOLEAN     NOT NULL DEFAULT false,
    meta_pixel_id                 TEXT,
    meta_event_name               TEXT,
    meta_send_value               BOOLEAN     NOT NULL DEFAULT false,
    google_enabled                BOOLEAN     NOT NULL DEFAULT false,
    google_account_id             TEXT,
    google_conversion_action_id   TEXT,
    google_conversion_action_name TEXT,
    google_send_value             BOOLEAN     NOT NULL DEFAULT false,
    google_currency               TEXT        NOT NULL DEFAULT 'BRL',
    active                        BOOLEAN     NOT NULL DEFAULT true,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversion_event_rules_trigger_type_check
        CHECK (trigger_type IN ('stage_enter','lead_won','lead_lost','lead_created','booking_status'))
);

CREATE INDEX IF NOT EXISTS idx_conversion_event_rules_user_id
    ON conversion_event_rules (user_id);

CREATE INDEX IF NOT EXISTS idx_conversion_event_rules_trigger_type
    ON conversion_event_rules (trigger_type, active);

ALTER TABLE conversion_event_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON conversion_event_rules
    USING (auth.uid() = user_id);


-- conversion_events_queue: Processing queue for ad-platform conversion events
CREATE TABLE IF NOT EXISTS conversion_events_queue (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id        UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    stage_id       UUID        NOT NULL REFERENCES leads_stages(id) ON DELETE CASCADE,
    lead_source    TEXT,
    event_data     JSONB       NOT NULL DEFAULT '{}',
    meta_status    TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (meta_status IN ('pending','sent','failed','skipped')),
    meta_response  JSONB,
    meta_sent_at   TIMESTAMPTZ,
    google_status  TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (google_status IN ('pending','sent','failed','skipped')),
    google_response JSONB,
    google_sent_at TIMESTAMPTZ,
    skip_reason    TEXT,
    retry_count    INTEGER     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_queue_pending
    ON conversion_events_queue (created_at)
    WHERE meta_status = 'pending' OR google_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_conv_queue_lead
    ON conversion_events_queue (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_queue_user
    ON conversion_events_queue (user_id);

ALTER TABLE conversion_events_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON conversion_events_queue USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 10: Follow-up queue
-- ---------------------------------------------------------------------------

-- fup_programados: Queue of AI-agent-scheduled follow-ups
CREATE TABLE IF NOT EXISTS fup_programados (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id           UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    people_id         UUID        REFERENCES clients_people(id) ON DELETE SET NULL,
    agent_id          UUID        REFERENCES ai_agents(id) ON DELETE SET NULL,
    tipo              TEXT        NOT NULL
                          CHECK (tipo IN ('etapa_crm','agendamento','programado')),
    etapa_id          UUID        REFERENCES leads_stages(id) ON DELETE SET NULL,
    template_id       TEXT,
    mensagem          TEXT,
    agendamento_titulo TEXT,
    motivo            TEXT,
    scheduled_at      TIMESTAMPTZ NOT NULL,
    fired_at          TIMESTAMPTZ,
    status            TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','processing','done','failed','cancelled')),
    error_message     TEXT,
    retry_count       INTEGER     NOT NULL DEFAULT 0,
    cancelado_por     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    cancelado_em      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fup_programados_pending
    ON fup_programados (scheduled_at)
    WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fup_programados_lead_id
    ON fup_programados (lead_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fup_programados_status
    ON fup_programados (status, scheduled_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fup_programados_agent_id
    ON fup_programados (agent_id)
    WHERE agent_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE fup_programados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON fup_programados USING (true);


-- ---------------------------------------------------------------------------
-- GROUP 11: Form PRO
-- ---------------------------------------------------------------------------

-- form_pro_forms: Form PRO definitions
CREATE TABLE IF NOT EXISTS form_pro_forms (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    pipeline_id     UUID        REFERENCES leads_pipelines(id) ON DELETE SET NULL,
    fields          JSONB       NOT NULL DEFAULT '[]',
    settings        JSONB       NOT NULL DEFAULT '{}',
    webhook_url     TEXT,
    webhook_secret  TEXT,
    create_contact  BOOLEAN     NOT NULL DEFAULT true,
    create_lead     BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_pro_forms_pipeline_id
    ON form_pro_forms (pipeline_id) WHERE pipeline_id IS NOT NULL;

ALTER TABLE form_pro_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON form_pro_forms USING (true);


-- form_pro_submissions: Form PRO submissions
CREATE TABLE IF NOT EXISTS form_pro_submissions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id          UUID,
    form_id          UUID        REFERENCES form_pro_forms(id) ON DELETE SET NULL,
    meta_form_id     UUID,
    lead_id          UUID        REFERENCES leads(id) ON DELETE SET NULL,
    people_id        UUID        REFERENCES clients_people(id) ON DELETE SET NULL,
    source           TEXT        NOT NULL DEFAULT 'site'
                         CHECK (source IN ('site','meta')),
    data             JSONB       NOT NULL DEFAULT '{}',
    utm_source       TEXT,
    utm_medium       TEXT,
    utm_campaign     TEXT,
    utm_content      TEXT,
    utm_term         TEXT,
    ip_address       INET,
    user_agent       TEXT,
    gclid            TEXT,
    fbclid           TEXT,
    fbc              TEXT,
    fbp              TEXT,
    meta_leadgen_id  TEXT,
    meta_adgroup_id  TEXT,
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_pro_submissions_source
    ON form_pro_submissions (source);

CREATE INDEX IF NOT EXISTS idx_form_pro_submissions_meta_form
    ON form_pro_submissions (meta_form_id) WHERE meta_form_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_pro_submissions_lead_id
    ON form_pro_submissions (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_pro_submissions_people_id
    ON form_pro_submissions (people_id) WHERE people_id IS NOT NULL;

-- form_pro_submissions has no RLS per schema notes (rls: false)


-- ---------------------------------------------------------------------------
-- GROUP 12: Admin / control-plane
-- ---------------------------------------------------------------------------

-- adm_client_drift: Records schema drift between expected and actual tenant schema
CREATE TABLE IF NOT EXISTS adm_client_drift (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id        UUID        NOT NULL REFERENCES adm_clients(id) ON DELETE CASCADE,
    detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_hash    TEXT        NOT NULL,
    actual_hash      TEXT        NOT NULL,
    expected_release TEXT        NOT NULL,
    diff_summary     TEXT,
    status           TEXT        NOT NULL DEFAULT 'detected'
                         CHECK (status IN ('detected','repaired','acknowledged_persistent')),
    repaired_at      TIMESTAMPTZ,
    repaired_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adm_client_drift_client_detected_idx
    ON adm_client_drift (client_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS adm_client_drift_status_idx
    ON adm_client_drift (status) WHERE status = 'detected';

ALTER TABLE adm_client_drift ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON adm_client_drift USING (true);


-- ---------------------------------------------------------------------------
-- VIEW: v_dispatch_health
-- Monitors pg_cron dispatch jobs and related queue/error metrics.
-- Access guard: super_admin / gestor / admin / service_role get rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_dispatch_health AS
SELECT
    j.jobname::TEXT                                                        AS jobname,
    j.schedule::TEXT                                                       AS schedule,
    j.active                                                               AS cron_active,

    -- runs in the last 5 minutes
    COALESCE((
        SELECT COUNT(*)
        FROM cron.job_run_details r
        WHERE r.jobid = j.jobid
          AND r.start_time >= now() - INTERVAL '5 minutes'
    ), 0)::BIGINT                                                          AS runs_5min,

    -- failures in the last 30 minutes
    COALESCE((
        SELECT COUNT(*)
        FROM cron.job_run_details r
        WHERE r.jobid = j.jobid
          AND r.status = 'failed'
          AND r.start_time >= now() - INTERVAL '30 minutes'
    ), 0)::BIGINT                                                          AS failures_30min,

    -- last run timestamp
    (
        SELECT MAX(r.start_time)
        FROM cron.job_run_details r
        WHERE r.jobid = j.jobid
    )                                                                      AS last_run_at,

    -- messages pending > 5 min
    COALESCE((
        SELECT COUNT(*)
        FROM messages m
        WHERE m.status = 'pending'
          AND m.created_at <= now() - INTERVAL '5 minutes'
    ), 0)::BIGINT                                                          AS pending_5min,

    -- messages with error in last 30 min
    COALESCE((
        SELECT COUNT(*)
        FROM messages m
        WHERE m.status = 'error'
          AND m.created_at >= now() - INTERVAL '30 minutes'
    ), 0)::BIGINT                                                          AS error_30min,

    -- messages expired in last 24 h
    COALESCE((
        SELECT COUNT(*)
        FROM messages m
        WHERE m.status = 'expired'
          AND m.created_at >= now() - INTERVAL '24 hours'
    ), 0)::BIGINT                                                          AS expired_24h,

    -- sends stuck in 'running' state
    COALESCE((
        SELECT COUNT(*)
        FROM sends s
        WHERE s.status = 'running'
          AND s.updated_at <= now() - INTERVAL '10 minutes'
    ), 0)::BIGINT                                                          AS running_stuck

FROM cron.job j
WHERE j.jobname IN (
    'omni-delivery-engine',
    'sends-dispatch-batch',
    'process-message-buffer'
)
AND (
    -- access guard: authenticated super_admin/gestor/admin or service_role
    EXISTS (
        SELECT 1 FROM settings_users su
        WHERE su.auth_user_id = auth.uid()
          AND (su.user_type IN ('super_admin','gestor','admin') OR su.super_admin = true)
    )
    OR auth.role() = 'service_role'
);

GRANT SELECT ON v_dispatch_health TO authenticated, service_role;
