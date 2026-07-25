export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_token_consumed: {
        Row: {
          action: string | null
          consumed_at: string
          jti: string
          meeting_id: string | null
          resource_id: string | null
          tenant_id: string | null
          token_exp: string | null
        }
        Insert: {
          action?: string | null
          consumed_at?: string
          jti: string
          meeting_id?: string | null
          resource_id?: string | null
          tenant_id?: string | null
          token_exp?: string | null
        }
        Update: {
          action?: string | null
          consumed_at?: string
          jti?: string
          meeting_id?: string | null
          resource_id?: string | null
          tenant_id?: string | null
          token_exp?: string | null
        }
        Relationships: []
      }
      adm_audit_log: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      adm_client_versions: {
        Row: {
          applied_at: string
          applied_by: string | null
          client_id: string
          error_summary: string | null
          from_version: string | null
          id: string
          status: string
          sync_job_id: string | null
          to_version: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          client_id: string
          error_summary?: string | null
          from_version?: string | null
          id?: string
          status?: string
          sync_job_id?: string | null
          to_version: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          client_id?: string
          error_summary?: string | null
          from_version?: string | null
          id?: string
          status?: string
          sync_job_id?: string | null
          to_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_client_versions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "adm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adm_client_versions_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "adm_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      adm_clients: {
        Row: {
          anon_key: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          current_version: string | null
          db_password: string | null
          db_password_hint: string | null
          delete_requested_by: string | null
          deleted_at: string | null
          id: string
          last_health_check_at: string | null
          last_health_status: string | null
          last_synced_at: string | null
          management_token_hint: string | null
          management_token_rotated_at: string | null
          name: string
          notes: string | null
          service_role_key: string | null
          service_role_key_hint: string | null
          slug: string
          status: string
          supabase_url: string
          sync_status: string
          target_version: string | null
          updated_at: string
        }
        Insert: {
          anon_key: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          current_version?: string | null
          db_password?: string | null
          db_password_hint?: string | null
          delete_requested_by?: string | null
          deleted_at?: string | null
          id?: string
          last_health_check_at?: string | null
          last_health_status?: string | null
          last_synced_at?: string | null
          management_token_hint?: string | null
          management_token_rotated_at?: string | null
          name: string
          notes?: string | null
          service_role_key?: string | null
          service_role_key_hint?: string | null
          slug: string
          status?: string
          supabase_url: string
          sync_status?: string
          target_version?: string | null
          updated_at?: string
        }
        Update: {
          anon_key?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          current_version?: string | null
          db_password?: string | null
          db_password_hint?: string | null
          delete_requested_by?: string | null
          deleted_at?: string | null
          id?: string
          last_health_check_at?: string | null
          last_health_status?: string | null
          last_synced_at?: string | null
          management_token_hint?: string | null
          management_token_rotated_at?: string | null
          name?: string
          notes?: string | null
          service_role_key?: string | null
          service_role_key_hint?: string | null
          slug?: string
          status?: string
          supabase_url?: string
          sync_status?: string
          target_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      adm_migration_runs: {
        Row: {
          applied_at: string
          client_id: string
          error: string | null
          id: string
          migration_id: string
          status: string
        }
        Insert: {
          applied_at?: string
          client_id: string
          error?: string | null
          id?: string
          migration_id: string
          status?: string
        }
        Update: {
          applied_at?: string
          client_id?: string
          error?: string | null
          id?: string
          migration_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_migration_runs_migration_id_fkey"
            columns: ["migration_id"]
            isOneToOne: false
            referencedRelation: "adm_migrations"
            referencedColumns: ["id"]
          },
        ]
      }
      adm_migrations: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          sql_content: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          sql_content: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          sql_content?: string
        }
        Relationships: []
      }
      adm_releases: {
        Row: {
          changelog: string | null
          created_at: string
          created_by: string | null
          git_sha: string
          id: string
          migrations: Json
          min_compat_from: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          git_sha: string
          id?: string
          migrations?: Json
          min_compat_from?: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          git_sha?: string
          id?: string
          migrations?: Json
          min_compat_from?: string
          version?: string
        }
        Relationships: []
      }
      adm_sync_jobs: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          triggered_by: string
          type: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string
          type?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_sync_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "adm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      adm_sync_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_sync_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "adm_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          active: boolean | null
          agent_type: string | null
          buffer_ms: number
          channel_types: string[]
          created_at: string | null
          current_version: number | null
          description: string | null
          el_last_synced_at: string | null
          el_sync_status: string | null
          general_rules: string | null
          id: string
          identity: string | null
          input_data: string | null
          leads_stages_id: string | null
          llm_max_tokens: number
          llm_model: string
          llm_provider: string
          llm_provider_id: string | null
          llm_temperature: number
          memory_window: number
          name: string
          origem_lista_filters: string[]
          pipeline_id: string | null
          pipeline_ids: string[] | null
          score_allow_empty: boolean
          score_matrix_ids: string[] | null
          score_value: number | null
          stage_id: string | null
          stage_ids: string[]
          updated_at: string | null
          use_stages: boolean | null
          voice_first_message: string | null
          voice_language: string | null
          voice_model_id: string | null
          voice_response_mode: string
          voice_similarity: number | null
          voice_speed: number | null
          voice_stability: number | null
          wa_phone_number_id: string | null
        }
        Insert: {
          active?: boolean | null
          agent_type?: string | null
          buffer_ms?: number
          channel_types?: string[]
          created_at?: string | null
          current_version?: number | null
          description?: string | null
          el_last_synced_at?: string | null
          el_sync_status?: string | null
          general_rules?: string | null
          id?: string
          identity?: string | null
          input_data?: string | null
          leads_stages_id?: string | null
          llm_max_tokens?: number
          llm_model?: string
          llm_provider?: string
          llm_provider_id?: string | null
          llm_temperature?: number
          memory_window?: number
          name: string
          origem_lista_filters?: string[]
          pipeline_id?: string | null
          pipeline_ids?: string[] | null
          score_allow_empty?: boolean
          score_matrix_ids?: string[] | null
          score_value?: number | null
          stage_id?: string | null
          stage_ids?: string[]
          updated_at?: string | null
          use_stages?: boolean | null
          voice_first_message?: string | null
          voice_language?: string | null
          voice_model_id?: string | null
          voice_response_mode?: string
          voice_similarity?: number | null
          voice_speed?: number | null
          voice_stability?: number | null
          wa_phone_number_id?: string | null
        }
        Update: {
          active?: boolean | null
          agent_type?: string | null
          buffer_ms?: number
          channel_types?: string[]
          created_at?: string | null
          current_version?: number | null
          description?: string | null
          el_last_synced_at?: string | null
          el_sync_status?: string | null
          general_rules?: string | null
          id?: string
          identity?: string | null
          input_data?: string | null
          leads_stages_id?: string | null
          llm_max_tokens?: number
          llm_model?: string
          llm_provider?: string
          llm_provider_id?: string | null
          llm_temperature?: number
          memory_window?: number
          name?: string
          origem_lista_filters?: string[]
          pipeline_id?: string | null
          pipeline_ids?: string[] | null
          score_allow_empty?: boolean
          score_matrix_ids?: string[] | null
          score_value?: number | null
          stage_id?: string | null
          stage_ids?: string[]
          updated_at?: string | null
          use_stages?: boolean | null
          voice_first_message?: string | null
          voice_language?: string | null
          voice_model_id?: string | null
          voice_response_mode?: string
          voice_similarity?: number | null
          voice_speed?: number | null
          voice_stability?: number | null
          wa_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_leads_stages_id_fkey"
            columns: ["leads_stages_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_history: {
        Row: {
          ai_agent_id: string
          changelog: Json | null
          created_at: string | null
          data: Json
          id: string
          version: number
        }
        Insert: {
          ai_agent_id: string
          changelog?: Json | null
          created_at?: string | null
          data: Json
          id?: string
          version: number
        }
        Update: {
          ai_agent_id?: string
          changelog?: Json | null
          created_at?: string | null
          data?: Json
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_history_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_score_matrix: {
        Row: {
          active: boolean | null
          ai_agent_id: string | null
          created_at: string | null
          id: string
          score_matrix_id: string | null
        }
        Insert: {
          active?: boolean | null
          ai_agent_id?: string | null
          created_at?: string | null
          id?: string
          score_matrix_id?: string | null
        }
        Update: {
          active?: boolean | null
          ai_agent_id?: string | null
          created_at?: string | null
          id?: string
          score_matrix_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_score_matrix_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_score_matrix_score_matrix_id_fkey"
            columns: ["score_matrix_id"]
            isOneToOne: false
            referencedRelation: "score_matrix"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_stages: {
        Row: {
          active: boolean | null
          ai_agent_id: string
          control: string | null
          created_at: string | null
          id: string
          name: string | null
          order_index: number | null
          pipeline_id: string | null
          prompt: string | null
          stage_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_agent_id: string
          control?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          order_index?: number | null
          pipeline_id?: string | null
          prompt?: string | null
          stage_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_agent_id?: string
          control?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          order_index?: number | null
          pipeline_id?: string | null
          prompt?: string | null
          stage_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_stages_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_stages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_stages_history: {
        Row: {
          active: boolean | null
          ai_agent_stage_id: string
          changed_at: string
          changed_by: string | null
          changelog: Json | null
          control: string | null
          created_at: string
          id: string
          name: string | null
          order_index: number | null
          pipeline_id: string | null
          prompt: string | null
          stage_id: string | null
          version: number
        }
        Insert: {
          active?: boolean | null
          ai_agent_stage_id: string
          changed_at?: string
          changed_by?: string | null
          changelog?: Json | null
          control?: string | null
          created_at?: string
          id?: string
          name?: string | null
          order_index?: number | null
          pipeline_id?: string | null
          prompt?: string | null
          stage_id?: string | null
          version: number
        }
        Update: {
          active?: boolean | null
          ai_agent_stage_id?: string
          changed_at?: string
          changed_by?: string | null
          changelog?: Json | null
          control?: string | null
          created_at?: string
          id?: string
          name?: string | null
          order_index?: number | null
          pipeline_id?: string | null
          prompt?: string | null
          stage_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_stages_history_ai_agent_stage_id_fkey1"
            columns: ["ai_agent_stage_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_stages_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_steps: {
        Row: {
          active: boolean | null
          ai_agent_id: string
          control: string | null
          created_at: string | null
          id: string
          name: string | null
          order_index: number | null
          prompt: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_agent_id: string
          control?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          order_index?: number | null
          prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_agent_id?: string
          control?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          order_index?: number | null
          prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_agents_steps_history: {
        Row: {
          active: boolean | null
          ai_agent_step_id: string
          changed_at: string
          changed_by: string | null
          changelog: Json | null
          control: string | null
          created_at: string
          id: string
          name: string | null
          order_index: number | null
          pipeline_id: string | null
          prompt: string | null
          version: number
        }
        Insert: {
          active?: boolean | null
          ai_agent_step_id: string
          changed_at?: string
          changed_by?: string | null
          changelog?: Json | null
          control?: string | null
          created_at?: string
          id?: string
          name?: string | null
          order_index?: number | null
          pipeline_id?: string | null
          prompt?: string | null
          version: number
        }
        Update: {
          active?: boolean | null
          ai_agent_step_id?: string
          changed_at?: string
          changed_by?: string | null
          changelog?: Json | null
          control?: string | null
          created_at?: string
          id?: string
          name?: string | null
          order_index?: number | null
          pipeline_id?: string | null
          prompt?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_stages_history_ai_agent_stage_id_fkey"
            columns: ["ai_agent_step_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_steps_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_contratacao: {
        Row: {
          created_at: string
          created_by: string | null
          data_confirmacao_emissao: string | null
          data_emissao: string | null
          documentos_status: Json
          entrevista_financeira_status: string
          exames_status: Json
          id: string
          lead_id: string
          notas: string | null
          parceiro_emissor: string | null
          premio_confirmado: number | null
          underwriting_status: string
          updated_at: string
          updated_by: string | null
          valor_final: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_confirmacao_emissao?: string | null
          data_emissao?: string | null
          documentos_status?: Json
          entrevista_financeira_status?: string
          exames_status?: Json
          id?: string
          lead_id: string
          notas?: string | null
          parceiro_emissor?: string | null
          premio_confirmado?: number | null
          underwriting_status?: string
          updated_at?: string
          updated_by?: string | null
          valor_final?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_confirmacao_emissao?: string | null
          data_emissao?: string | null
          documentos_status?: Json
          entrevista_financeira_status?: string
          exames_status?: Json
          id?: string
          lead_id?: string
          notas?: string | null
          parceiro_emissor?: string | null
          premio_confirmado?: number | null
          underwriting_status?: string
          updated_at?: string
          updated_by?: string | null
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "altiora_contratacao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_contratacao_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_contratacao_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_email_queue: {
        Row: {
          body_preview: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          from_email: string | null
          from_name: string | null
          id: string
          lead_id: string | null
          message_id: string
          metadata: Json | null
          reason: string | null
          recipients: Json | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body_preview?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          lead_id?: string | null
          message_id: string
          metadata?: Json | null
          reason?: string | null
          recipients?: Json | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body_preview?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string
          metadata?: Json | null
          reason?: string | null
          recipients?: Json | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "altiora_email_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_finvity_analise: {
        Row: {
          created_at: string
          created_by: string | null
          dores: string[]
          finvity_arquivo_url: string | null
          finvity_link: string | null
          id: string
          lead_id: string
          necessidades: string[]
          notas: string | null
          produtos_sugeridos: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dores?: string[]
          finvity_arquivo_url?: string | null
          finvity_link?: string | null
          id?: string
          lead_id: string
          necessidades?: string[]
          notas?: string | null
          produtos_sugeridos?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dores?: string[]
          finvity_arquivo_url?: string | null
          finvity_link?: string | null
          id?: string
          lead_id?: string
          necessidades?: string[]
          notas?: string | null
          produtos_sugeridos?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "altiora_finvity_analise_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_finvity_analise_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_lead_interactions: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string
          payload: Json | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          payload?: Json | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "altiora_lead_interactions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "altiora_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_r1_data: {
        Row: {
          created_at: string
          created_by: string | null
          data_r2_prevista: string | null
          diagnostico: Json
          elephan_conflito: boolean
          elephan_importado: boolean
          lead_id: string
          scorecard: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_r2_prevista?: string | null
          diagnostico?: Json
          elephan_conflito?: boolean
          elephan_importado?: boolean
          lead_id: string
          scorecard?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_r2_prevista?: string | null
          diagnostico?: Json
          elephan_conflito?: boolean
          elephan_importado?: boolean
          lead_id?: string
          scorecard?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "altiora_r1_data_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_r1_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_r1_data_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_r2_data: {
        Row: {
          created_at: string
          created_by: string | null
          data_r3_prevista: string | null
          lead_id: string
          resultado: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_r3_prevista?: string | null
          lead_id: string
          resultado?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_r3_prevista?: string | null
          lead_id?: string
          resultado?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "altiora_r2_data_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_r2_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_r2_data_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      altiora_r3_data: {
        Row: {
          created_at: string
          created_by: string | null
          decisao_cliente: string | null
          lead_id: string
          resultado: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decisao_cliente?: string | null
          lead_id: string
          resultado?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decisao_cliente?: string | null
          lead_id?: string
          resultado?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "altiora_r3_data_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_r3_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altiora_r3_data_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events_log: {
        Row: {
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          occurred_at: string
          tenant_id: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          occurred_at?: string
          tenant_id?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          occurred_at?: string
          tenant_id?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_login_attempts: {
        Row: {
          attempts: number
          blocked_until: string | null
          email_hash: string
          id: string
          ip_hash: string
          last_attempt: string
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          email_hash: string
          id?: string
          ip_hash: string
          last_attempt?: string
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          email_hash?: string
          id?: string
          ip_hash?: string
          last_attempt?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_login_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_ad_accounts: {
        Row: {
          access_token: string | null
          account_id: string
          account_name: string
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          account_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          account_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bi_ad_campaigns: {
        Row: {
          ad_account_id: string
          campaign_id: string
          campaign_name: string
          created_at: string
          id: string
          objective: string | null
          platform: string
          status: string
          updated_at: string
          utm_campaign: string | null
        }
        Insert: {
          ad_account_id: string
          campaign_id: string
          campaign_name: string
          created_at?: string
          id?: string
          objective?: string | null
          platform: string
          status?: string
          updated_at?: string
          utm_campaign?: string | null
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string
          campaign_name?: string
          created_at?: string
          id?: string
          objective?: string | null
          platform?: string
          status?: string
          updated_at?: string
          utm_campaign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_ad_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_ad_spend: {
        Row: {
          ad_account_id: string
          campaign_id: string | null
          clicks: number | null
          created_at: string
          currency: string
          date: string
          id: string
          impressions: number | null
          leads: number | null
          platform: string
          raw_data: Json | null
          source: string | null
          spend: number
        }
        Insert: {
          ad_account_id: string
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string
          currency?: string
          date: string
          id?: string
          impressions?: number | null
          leads?: number | null
          platform: string
          raw_data?: Json | null
          source?: string | null
          spend?: number
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string
          currency?: string
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          platform?: string
          raw_data?: Json | null
          source?: string | null
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "bi_ad_spend_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_ad_spend_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_settings: {
        Row: {
          google_developer_token: string | null
          id: string
          meta_app_id: string | null
          meta_app_secret: string | null
          meta_system_token: string | null
          meta_system_token_saved_at: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          google_developer_token?: string | null
          id?: string
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_system_token?: string | null
          meta_system_token_saved_at?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          google_developer_token?: string | null
          id?: string
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_system_token?: string | null
          meta_system_token_saved_at?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bi_voice_session_log: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          error_msg: string | null
          id: string
          started_at: string
          tenant_id: string
          total_tokens_in: number | null
          total_tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          error_msg?: string | null
          id?: string
          started_at?: string
          tenant_id: string
          total_tokens_in?: number | null
          total_tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          error_msg?: string | null
          id?: string
          started_at?: string
          tenant_id?: string
          total_tokens_in?: number | null
          total_tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_voice_session_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_voice_token_log: {
        Row: {
          expires_at: string
          id: string
          issued_at: string
          model_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          issued_at?: string
          model_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          issued_at?: string
          model_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bi_voice_token_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_voice_tool_invocations: {
        Row: {
          args: Json | null
          called_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          success: boolean
          tenant_id: string | null
          tool_name: string
          user_id: string | null
        }
        Insert: {
          args?: Json | null
          called_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          success?: boolean
          tenant_id?: string | null
          tool_name: string
          user_id?: string | null
        }
        Update: {
          args?: Json | null
          called_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          success?: boolean
          tenant_id?: string | null
          tool_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_voice_tool_invocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rule_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
          url_id: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
          url_id?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
          url_id?: number | null
        }
        Relationships: []
      }
      booking_rules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          rule_set_id: string
          rule_type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          rule_set_id: string
          rule_type: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          rule_set_id?: string
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "booking_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_token_jti_usage: {
        Row: {
          jti: string
          reason: string | null
          revoked_at: string
        }
        Insert: {
          jti: string
          reason?: string | null
          revoked_at?: string
        }
        Update: {
          jti?: string
          reason?: string | null
          revoked_at?: string
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          channels: string[] | null
          content: string
          created_at: string | null
          id: string
          shortcut: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          channels?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          shortcut?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          channels?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clients_people: {
        Row: {
          accepts_calls: boolean | null
          address: string | null
          ai_enabled: boolean | null
          ai_last_message_at: string | null
          ai_processing_lock: boolean
          business_category: string | null
          company_description: string | null
          conversation_summary: string | null
          created_at: string
          document: string | null
          email: string | null
          enrichment_layers: string[] | null
          external_crm_person_id: string | null
          facebook_url: string | null
          google_maps_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          id: string
          instagram_handle: string | null
          instagram_id: string | null
          instagram_user_id: string | null
          linkedin_url: string | null
          merge_history: Json
          merged_into_id: string | null
          metadata: Json | null
          name: string
          notes: string | null
          q1_age: number | null
          q1_main_bottleneck: string | null
          q10_migration_process: string | null
          q10_stakeholders: string | null
          q11_budget_approved: string | null
          q11_decision_move_usa: string | null
          q12_start_process_time: string | null
          q12_timeline: string | null
          q13_household_income: string | null
          q13_urgency_reason: string | null
          q14_data_ready: string | null
          q15_minimum_volume: string | null
          q16_expected_roi: string | null
          q17_objections: string | null
          q18_real_fit: string | null
          q19_qualification_status: string | null
          q2_has_children: boolean | null
          q2_lead_volume_month: string | null
          q20_rejection_reason: string | null
          q21_interest_level: string | null
          q22_close_probability: string | null
          q23_behavioral_tags: string | null
          q24_last_update_by_agent: string | null
          q25_disc_profile: string | null
          q26_disc_analysis: string | null
          q3_number_of_children: number | null
          q3_team_size: string | null
          q4_crm_maturity: string | null
          q4_qualification_1: string | null
          q5_crm_name: string | null
          q5_qualification_area: string | null
          q6_profession_current: string | null
          q6_trigger: string | null
          q7_problem_impact: string | null
          q7_profession_years: string | null
          q8_engagement_level: string | null
          q8_professional_recognition: string | null
          q9_decision_authority: string | null
          q9_foreign_citizenship: boolean | null
          score_framing_id: string | null
          score_investment_id: string | null
          score_matrix_id: string | null
          score_objective_id: string | null
          service_status: string | null
          source: string | null
          status: string | null
          summary_message_counter: number | null
          telefone: string | null
          tiktok_open_id: string | null
          type: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          whatsapp_remote_id: string | null
          youtube_url: string | null
        }
        Insert: {
          accepts_calls?: boolean | null
          address?: string | null
          ai_enabled?: boolean | null
          ai_last_message_at?: string | null
          ai_processing_lock?: boolean
          business_category?: string | null
          company_description?: string | null
          conversation_summary?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          enrichment_layers?: string[] | null
          external_crm_person_id?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          instagram_handle?: string | null
          instagram_id?: string | null
          instagram_user_id?: string | null
          linkedin_url?: string | null
          merge_history?: Json
          merged_into_id?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          q1_age?: number | null
          q1_main_bottleneck?: string | null
          q10_migration_process?: string | null
          q10_stakeholders?: string | null
          q11_budget_approved?: string | null
          q11_decision_move_usa?: string | null
          q12_start_process_time?: string | null
          q12_timeline?: string | null
          q13_household_income?: string | null
          q13_urgency_reason?: string | null
          q14_data_ready?: string | null
          q15_minimum_volume?: string | null
          q16_expected_roi?: string | null
          q17_objections?: string | null
          q18_real_fit?: string | null
          q19_qualification_status?: string | null
          q2_has_children?: boolean | null
          q2_lead_volume_month?: string | null
          q20_rejection_reason?: string | null
          q21_interest_level?: string | null
          q22_close_probability?: string | null
          q23_behavioral_tags?: string | null
          q24_last_update_by_agent?: string | null
          q25_disc_profile?: string | null
          q26_disc_analysis?: string | null
          q3_number_of_children?: number | null
          q3_team_size?: string | null
          q4_crm_maturity?: string | null
          q4_qualification_1?: string | null
          q5_crm_name?: string | null
          q5_qualification_area?: string | null
          q6_profession_current?: string | null
          q6_trigger?: string | null
          q7_problem_impact?: string | null
          q7_profession_years?: string | null
          q8_engagement_level?: string | null
          q8_professional_recognition?: string | null
          q9_decision_authority?: string | null
          q9_foreign_citizenship?: boolean | null
          score_framing_id?: string | null
          score_investment_id?: string | null
          score_matrix_id?: string | null
          score_objective_id?: string | null
          service_status?: string | null
          source?: string | null
          status?: string | null
          summary_message_counter?: number | null
          telefone?: string | null
          tiktok_open_id?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_remote_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          accepts_calls?: boolean | null
          address?: string | null
          ai_enabled?: boolean | null
          ai_last_message_at?: string | null
          ai_processing_lock?: boolean
          business_category?: string | null
          company_description?: string | null
          conversation_summary?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          enrichment_layers?: string[] | null
          external_crm_person_id?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          instagram_handle?: string | null
          instagram_id?: string | null
          instagram_user_id?: string | null
          linkedin_url?: string | null
          merge_history?: Json
          merged_into_id?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          q1_age?: number | null
          q1_main_bottleneck?: string | null
          q10_migration_process?: string | null
          q10_stakeholders?: string | null
          q11_budget_approved?: string | null
          q11_decision_move_usa?: string | null
          q12_start_process_time?: string | null
          q12_timeline?: string | null
          q13_household_income?: string | null
          q13_urgency_reason?: string | null
          q14_data_ready?: string | null
          q15_minimum_volume?: string | null
          q16_expected_roi?: string | null
          q17_objections?: string | null
          q18_real_fit?: string | null
          q19_qualification_status?: string | null
          q2_has_children?: boolean | null
          q2_lead_volume_month?: string | null
          q20_rejection_reason?: string | null
          q21_interest_level?: string | null
          q22_close_probability?: string | null
          q23_behavioral_tags?: string | null
          q24_last_update_by_agent?: string | null
          q25_disc_profile?: string | null
          q26_disc_analysis?: string | null
          q3_number_of_children?: number | null
          q3_team_size?: string | null
          q4_crm_maturity?: string | null
          q4_qualification_1?: string | null
          q5_crm_name?: string | null
          q5_qualification_area?: string | null
          q6_profession_current?: string | null
          q6_trigger?: string | null
          q7_problem_impact?: string | null
          q7_profession_years?: string | null
          q8_engagement_level?: string | null
          q8_professional_recognition?: string | null
          q9_decision_authority?: string | null
          q9_foreign_citizenship?: boolean | null
          score_framing_id?: string | null
          score_investment_id?: string | null
          score_matrix_id?: string | null
          score_objective_id?: string | null
          service_status?: string | null
          source?: string | null
          status?: string | null
          summary_message_counter?: number | null
          telefone?: string | null
          tiktok_open_id?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_remote_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_people_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_score_framing_id_fkey"
            columns: ["score_framing_id"]
            isOneToOne: false
            referencedRelation: "score_framings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_score_income_id_fkey"
            columns: ["score_investment_id"]
            isOneToOne: false
            referencedRelation: "score_investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_score_matrix_id_fkey"
            columns: ["score_matrix_id"]
            isOneToOne: false
            referencedRelation: "score_matrix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_score_objective_id_fkey"
            columns: ["score_objective_id"]
            isOneToOne: false
            referencedRelation: "score_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_people_updates: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          people_id: string
        }
        Insert: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          people_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          people_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_updates_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_ai_settings: {
        Row: {
          business_context: string | null
          created_at: string
          email_auto_send: boolean
          email_consultant: boolean
          email_manager: boolean
          email_manager_threshold: number | null
          id: string
          manager_user_id: string | null
          updated_at: string
          weekly_summary_day: number | null
          weekly_summary_enabled: boolean
          weekly_summary_hour: number | null
        }
        Insert: {
          business_context?: string | null
          created_at?: string
          email_auto_send?: boolean
          email_consultant?: boolean
          email_manager?: boolean
          email_manager_threshold?: number | null
          id?: string
          manager_user_id?: string | null
          updated_at?: string
          weekly_summary_day?: number | null
          weekly_summary_enabled?: boolean
          weekly_summary_hour?: number | null
        }
        Update: {
          business_context?: string | null
          created_at?: string
          email_auto_send?: boolean
          email_consultant?: boolean
          email_manager?: boolean
          email_manager_threshold?: number | null
          id?: string
          manager_user_id?: string | null
          updated_at?: string
          weekly_summary_day?: number | null
          weekly_summary_enabled?: boolean
          weekly_summary_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_ai_settings_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_email_log: {
        Row: {
          error: string | null
          evaluation_id: string
          id: string
          recipient_email: string
          recipient_type: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          error?: string | null
          evaluation_id: string
          id?: string
          recipient_email: string
          recipient_type: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          error?: string | null
          evaluation_id?: string
          id?: string
          recipient_email?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_email_log_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "meeting_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_agencia_tenants: {
        Row: {
          agencia_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          agencia_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          agencia_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_agencia_tenants_agencia_id_fkey"
            columns: ["agencia_id"]
            isOneToOne: false
            referencedRelation: "crm_agencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_agencia_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agencia_tenants_agencia"
            columns: ["agencia_id"]
            isOneToOne: false
            referencedRelation: "crm_agencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agencia_tenants_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_agencia_usuarios: {
        Row: {
          agencia_id: string
          created_at: string
          id: string
          usuario_id: string
        }
        Insert: {
          agencia_id: string
          created_at?: string
          id?: string
          usuario_id: string
        }
        Update: {
          agencia_id?: string
          created_at?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_agencia_usuarios_agencia"
            columns: ["agencia_id"]
            isOneToOne: false
            referencedRelation: "crm_agencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agencia_usuarios_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_agencias: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      crm_agendamentos: {
        Row: {
          convidados: string[] | null
          criado_em: string
          data: string
          google_meet_link: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          id_calendar: string | null
          local: string | null
          negocio_id: string
          observacoes: string | null
          origem: string | null
          quantidade: number | null
          status: string | null
          tenant_id: string
          usuario_id: string | null
        }
        Insert: {
          convidados?: string[] | null
          criado_em?: string
          data: string
          google_meet_link?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          id_calendar?: string | null
          local?: string | null
          negocio_id: string
          observacoes?: string | null
          origem?: string | null
          quantidade?: number | null
          status?: string | null
          tenant_id: string
          usuario_id?: string | null
        }
        Update: {
          convidados?: string[] | null
          criado_em?: string
          data?: string
          google_meet_link?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          id_calendar?: string | null
          local?: string | null
          negocio_id?: string
          observacoes?: string | null
          origem?: string | null
          quantidade?: number | null
          status?: string | null
          tenant_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_agendamentos_negocio"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agendamentos_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agendamentos_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          empresas_info_json: Json | null
          id: string
          nome_fantasia: string
          observacoes: string | null
          razao_social: string | null
          site: string | null
          status: string | null
          telefone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresas_info_json?: Json | null
          id?: string
          nome_fantasia: string
          observacoes?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string | null
          telefone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresas_info_json?: Json | null
          id?: string
          nome_fantasia?: string
          observacoes?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string | null
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_empresas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          bloqueia_ia: boolean | null
          controle: string | null
          created_at: string
          data_criacao: string | null
          data_ganho: string | null
          data_ultima_interacao: string | null
          datetime_bloqueia_ia: string | null
          empresa_id: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          leads_info_json: Json | null
          person_id: string
          pipeline_id: string
          responsavel: string | null
          stage_id: string
          status: string | null
          status_followup: string | null
          tenant_id: string
          tentativas_followup: number | null
          time_responsavel: string | null
          titulo: string | null
          ultima_interacao: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor: number | null
        }
        Insert: {
          bloqueia_ia?: boolean | null
          controle?: string | null
          created_at?: string
          data_criacao?: string | null
          data_ganho?: string | null
          data_ultima_interacao?: string | null
          datetime_bloqueia_ia?: string | null
          empresa_id?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          leads_info_json?: Json | null
          person_id: string
          pipeline_id: string
          responsavel?: string | null
          stage_id: string
          status?: string | null
          status_followup?: string | null
          tenant_id: string
          tentativas_followup?: number | null
          time_responsavel?: string | null
          titulo?: string | null
          ultima_interacao?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor?: number | null
        }
        Update: {
          bloqueia_ia?: boolean | null
          controle?: string | null
          created_at?: string
          data_criacao?: string | null
          data_ganho?: string | null
          data_ultima_interacao?: string | null
          datetime_bloqueia_ia?: string | null
          empresa_id?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          leads_info_json?: Json | null
          person_id?: string
          pipeline_id?: string
          responsavel?: string | null
          stage_id?: string
          status?: string | null
          status_followup?: string | null
          tenant_id?: string
          tentativas_followup?: number | null
          time_responsavel?: string | null
          titulo?: string | null
          ultima_interacao?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "crm_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_responsavel_fkey"
            columns: ["responsavel"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_negocio_arquivos: {
        Row: {
          created_at: string
          id: string
          negocio_id: string
          nome_arquivo: string
          tamanho_arquivo: number | null
          tenant_id: string
          tipo_arquivo: string | null
          updated_at: string
          url_arquivo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          negocio_id: string
          nome_arquivo: string
          tamanho_arquivo?: number | null
          tenant_id: string
          tipo_arquivo?: string | null
          updated_at?: string
          url_arquivo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          negocio_id?: string
          nome_arquivo?: string
          tamanho_arquivo?: number | null
          tenant_id?: string
          tipo_arquivo?: string | null
          updated_at?: string
          url_arquivo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_negocio_arquivos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_negocio_arquivos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_negocio_arquivos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_negocio_notas: {
        Row: {
          conteudo: string | null
          created_at: string
          id: string
          negocio_id: string
          tenant_id: string
          titulo: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          id?: string
          negocio_id: string
          tenant_id: string
          titulo: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          id?: string
          negocio_id?: string
          tenant_id?: string
          titulo?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_negocio_notas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_negocio_notas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_negocio_notas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pessoa_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          pessoa_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          pessoa_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          pessoa_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pessoa_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "crm_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pessoa_empresas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "crm_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pessoa_empresas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pessoas: {
        Row: {
          aceita_ligacao: boolean | null
          atendimento_ia: boolean | null
          contador_mensagens_resumo: number | null
          created_at: string
          descricao_disc: string | null
          disc: string | null
          disc_resumo: string | null
          documento: string | null
          email: string | null
          id: string
          momento: string | null
          nome: string
          objetivo: string | null
          observacoes: string | null
          origem: string | null
          perfil: string | null
          pessoas_info_json: Json | null
          renda: string | null
          resumo_conversa: string | null
          score: number | null
          status: string | null
          tenant_id: string
          tipo: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_remote_id: string | null
        }
        Insert: {
          aceita_ligacao?: boolean | null
          atendimento_ia?: boolean | null
          contador_mensagens_resumo?: number | null
          created_at?: string
          descricao_disc?: string | null
          disc?: string | null
          disc_resumo?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          momento?: string | null
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          origem?: string | null
          perfil?: string | null
          pessoas_info_json?: Json | null
          renda?: string | null
          resumo_conversa?: string | null
          score?: number | null
          status?: string | null
          tenant_id: string
          tipo?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_remote_id?: string | null
        }
        Update: {
          aceita_ligacao?: boolean | null
          atendimento_ia?: boolean | null
          contador_mensagens_resumo?: number | null
          created_at?: string
          descricao_disc?: string | null
          disc?: string | null
          disc_resumo?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          momento?: string | null
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          origem?: string | null
          perfil?: string | null
          pessoas_info_json?: Json | null
          renda?: string | null
          resumo_conversa?: string | null
          score?: number | null
          status?: string | null
          tenant_id?: string
          tipo?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_remote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_pessoas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_tenants: {
        Row: {
          ativo: boolean
          created_at: string
          disc_config: Json | null
          id: string
          logo_url: string | null
          modulos_ativos: Json | null
          name: string
          openai_api_key: string | null
          openai_enabled: boolean | null
          openai_model: string | null
          openai_temperature: number | null
          primary_color: string | null
          resumo_config: Json | null
          secondary_color: string | null
          tenant_slug: string | null
          value: string
          webhook_conversas: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          disc_config?: Json | null
          id?: string
          logo_url?: string | null
          modulos_ativos?: Json | null
          name: string
          openai_api_key?: string | null
          openai_enabled?: boolean | null
          openai_model?: string | null
          openai_temperature?: number | null
          primary_color?: string | null
          resumo_config?: Json | null
          secondary_color?: string | null
          tenant_slug?: string | null
          value: string
          webhook_conversas?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          disc_config?: Json | null
          id?: string
          logo_url?: string | null
          modulos_ativos?: Json | null
          name?: string
          openai_api_key?: string | null
          openai_enabled?: boolean | null
          openai_model?: string | null
          openai_temperature?: number | null
          primary_color?: string | null
          resumo_config?: Json | null
          secondary_color?: string | null
          tenant_slug?: string | null
          value?: string
          webhook_conversas?: string | null
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          processed_at: string | null
          protocol: string
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          processed_at?: string | null
          protocol?: string
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          processed_at?: string | null
          protocol?: string
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      data_export_jobs: {
        Row: {
          created_at: string
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          requested_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria_results: {
        Row: {
          coaching_tip: string | null
          confidence: number | null
          criterion_id: string
          evaluation_id: string
          id: string
          quote: string | null
          quote_start_sec: number | null
          score: number | null
          verdict: string
        }
        Insert: {
          coaching_tip?: string | null
          confidence?: number | null
          criterion_id: string
          evaluation_id: string
          id?: string
          quote?: string | null
          quote_start_sec?: number | null
          score?: number | null
          verdict: string
        }
        Update: {
          coaching_tip?: string | null
          confidence?: number | null
          criterion_id?: string
          evaluation_id?: string
          id?: string
          quote?: string | null
          quote_start_sec?: number | null
          score?: number | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "playbook_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_criteria_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "meeting_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_section_results: {
        Row: {
          evaluation_id: string
          id: string
          score: number | null
          section_id: string
          summary: string | null
        }
        Insert: {
          evaluation_id: string
          id?: string
          score?: number | null
          section_id: string
          summary?: string | null
        }
        Update: {
          evaluation_id?: string
          id?: string
          score?: number | null
          section_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_section_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "meeting_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_section_results_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "playbook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      form_pro_rate_limits: {
        Row: {
          id: string
          ip: string
          ts: string
        }
        Insert: {
          id?: string
          ip: string
          ts?: string
        }
        Update: {
          id?: string
          ip?: string
          ts?: string
        }
        Relationships: []
      }
      inbound_webhooks: {
        Row: {
          active: boolean
          create_mode: string
          created_at: string
          field_mapping: Json
          id: string
          name: string
          pipeline_id: string | null
          stage_id: string | null
          token: string
          trigger_config: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          create_mode?: string
          created_at?: string
          field_mapping?: Json
          id?: string
          name: string
          pipeline_id?: string | null
          stage_id?: string | null
          token?: string
          trigger_config?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          create_mode?: string
          created_at?: string
          field_mapping?: Json
          id?: string
          name?: string
          pipeline_id?: string | null
          stage_id?: string | null
          token?: string
          trigger_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhooks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_automation_log: {
        Row: {
          action_executed: string | null
          automation_id: string | null
          automation_name: string | null
          error_message: string | null
          executed_at: string
          filters_matched: Json | null
          id: string
          ig_message_id: string | null
          message_text: string | null
          person_id: string | null
          person_name: string | null
          status: string
          trigger_type: string | null
        }
        Insert: {
          action_executed?: string | null
          automation_id?: string | null
          automation_name?: string | null
          error_message?: string | null
          executed_at?: string
          filters_matched?: Json | null
          id?: string
          ig_message_id?: string | null
          message_text?: string | null
          person_id?: string | null
          person_name?: string | null
          status?: string
          trigger_type?: string | null
        }
        Update: {
          action_executed?: string | null
          automation_id?: string | null
          automation_name?: string | null
          error_message?: string | null
          executed_at?: string
          filters_matched?: Json | null
          id?: string
          ig_message_id?: string | null
          message_text?: string | null
          person_id?: string | null
          person_name?: string | null
          status?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_automation_log_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "instagram_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_automation_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_automations: {
        Row: {
          action_comment_text: string | null
          action_comment_texts: Json
          action_dm_quick_replies: Json
          action_dm_text: string | null
          action_type: string
          cooldown_hours: number
          created_at: string
          description: string | null
          filter_operator: string
          filters: Json
          id: string
          is_active: boolean
          name: string
          priority: number
          target_post_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_comment_text?: string | null
          action_comment_texts?: Json
          action_dm_quick_replies?: Json
          action_dm_text?: string | null
          action_type: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          filter_operator?: string
          filters?: Json
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          target_post_id?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_comment_text?: string | null
          action_comment_texts?: Json
          action_dm_quick_replies?: Json
          action_dm_text?: string | null
          action_type?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          filter_operator?: string
          filters?: Json
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          target_post_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_stage_history: {
        Row: {
          actor_id: string | null
          changed_at: string
          from_stage_id: string | null
          id: string
          lead_id: string
          notes: string | null
          skip_confirmed: boolean
          to_stage_id: string | null
        }
        Insert: {
          actor_id?: string | null
          changed_at?: string
          from_stage_id?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          skip_confirmed?: boolean
          to_stage_id?: string | null
        }
        Update: {
          actor_id?: string | null
          changed_at?: string
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          skip_confirmed?: boolean
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          altiora_closer_id: string | null
          altiora_data_atribuicao: string | null
          altiora_data_handoff: string | null
          altiora_email_handoff_id: string | null
          altiora_etapa_perda: string | null
          altiora_gestor_id: string | null
          altiora_obs_atribuicao: string | null
          altiora_origem: string | null
          altiora_origem_atribuicao: string | null
          altiora_possibilidade_retomada: boolean | null
          control: string | null
          created_at: string
          external_crm_lead_id: string | null
          fb_lead_id: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          last_interaction: string | null
          last_interaction_at: string | null
          leads_loss_reasons_id: string | null
          leads_pipelines_id: string
          leads_stages_id: string
          lifecycle_stage: string | null
          loss_reason: string | null
          metadata: Json | null
          nome_evento: string | null
          origem_lista: string | null
          people_id: string
          recomendante: string | null
          relacao_corretor: string | null
          relacao_recomendante: string | null
          status: string | null
          teams_id: string | null
          title: string | null
          updated_at: string
          users_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
          won_at: string | null
        }
        Insert: {
          altiora_closer_id?: string | null
          altiora_data_atribuicao?: string | null
          altiora_data_handoff?: string | null
          altiora_email_handoff_id?: string | null
          altiora_etapa_perda?: string | null
          altiora_gestor_id?: string | null
          altiora_obs_atribuicao?: string | null
          altiora_origem?: string | null
          altiora_origem_atribuicao?: string | null
          altiora_possibilidade_retomada?: boolean | null
          control?: string | null
          created_at?: string
          external_crm_lead_id?: string | null
          fb_lead_id?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          last_interaction?: string | null
          last_interaction_at?: string | null
          leads_loss_reasons_id?: string | null
          leads_pipelines_id: string
          leads_stages_id: string
          lifecycle_stage?: string | null
          loss_reason?: string | null
          metadata?: Json | null
          nome_evento?: string | null
          origem_lista?: string | null
          people_id: string
          recomendante?: string | null
          relacao_corretor?: string | null
          relacao_recomendante?: string | null
          status?: string | null
          teams_id?: string | null
          title?: string | null
          updated_at?: string
          users_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          won_at?: string | null
        }
        Update: {
          altiora_closer_id?: string | null
          altiora_data_atribuicao?: string | null
          altiora_data_handoff?: string | null
          altiora_email_handoff_id?: string | null
          altiora_etapa_perda?: string | null
          altiora_gestor_id?: string | null
          altiora_obs_atribuicao?: string | null
          altiora_origem?: string | null
          altiora_origem_atribuicao?: string | null
          altiora_possibilidade_retomada?: boolean | null
          control?: string | null
          created_at?: string
          external_crm_lead_id?: string | null
          fb_lead_id?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          last_interaction?: string | null
          last_interaction_at?: string | null
          leads_loss_reasons_id?: string | null
          leads_pipelines_id?: string
          leads_stages_id?: string
          lifecycle_stage?: string | null
          loss_reason?: string | null
          metadata?: Json | null
          nome_evento?: string | null
          origem_lista?: string | null
          people_id?: string
          recomendante?: string | null
          relacao_corretor?: string | null
          relacao_recomendante?: string | null
          status?: string | null
          teams_id?: string | null
          title?: string | null
          updated_at?: string
          users_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_altiora_closer_id_fkey"
            columns: ["altiora_closer_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_altiora_gestor_id_fkey"
            columns: ["altiora_gestor_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_leads_loss_reasons_id_fkey"
            columns: ["leads_loss_reasons_id"]
            isOneToOne: false
            referencedRelation: "leads_loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_leads_pipelines_id_fkey"
            columns: ["leads_pipelines_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_leads_stages_id_fkey"
            columns: ["leads_stages_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_teams_id_fkey"
            columns: ["teams_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          leads_id: string
          updated_at: string
          users_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          leads_id: string
          updated_at?: string
          users_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          leads_id?: string
          updated_at?: string
          users_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_files_leads_id_fkey"
            columns: ["leads_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_files_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_loss_reasons: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          leads_id: string
          title: string
          updated_at: string
          users_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          leads_id: string
          title: string
          updated_at?: string
          users_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          leads_id?: string
          title?: string
          updated_at?: string
          users_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_notes_leads_id_fkey"
            columns: ["leads_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_notes_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_pipelines: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads_stages: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string
          id: string
          leads_pipelines_id: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          id?: string
          leads_pipelines_id: string
          name: string
          order_index: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          id?: string
          leads_pipelines_id?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_stages_leads_pipelines_id_fkey"
            columns: ["leads_pipelines_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_stages_followups: {
        Row: {
          active: boolean
          audio_file: string | null
          control: number | null
          created_at: string
          days: number
          hours: number
          id: string
          leads_stages_id: string
          message: string | null
          minutes: number
          score_matrix_id: string | null
          subject: string | null
          target_stage_id: string | null
          template_id: string | null
          type: string
          updated_at: string
          whatsapp_template_id: string | null
        }
        Insert: {
          active?: boolean
          audio_file?: string | null
          control?: number | null
          created_at?: string
          days?: number
          hours?: number
          id?: string
          leads_stages_id: string
          message?: string | null
          minutes?: number
          score_matrix_id?: string | null
          subject?: string | null
          target_stage_id?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Update: {
          active?: boolean
          audio_file?: string | null
          control?: number | null
          created_at?: string
          days?: number
          hours?: number
          id?: string
          leads_stages_id?: string
          message?: string | null
          minutes?: number
          score_matrix_id?: string | null
          subject?: string | null
          target_stage_id?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_stages_followups_leads_stages_id_fkey"
            columns: ["leads_stages_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stages_followups_score_matrix_id_fkey"
            columns: ["score_matrix_id"]
            isOneToOne: false
            referencedRelation: "score_matrix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stages_followups_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stages_followups_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_updates: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          leads_id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          leads_id: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          leads_id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_updates_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updates_leads_id_fkey"
            columns: ["leads_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_anonymization_log: {
        Row: {
          created_at: string
          id: string
          performed_by: string | null
          person_id: string
          tables_affected: string[]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          performed_by?: string | null
          person_id: string
          tables_affected?: string[]
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          performed_by?: string | null
          person_id?: string
          tables_affected?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_anonymization_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_anonymization_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_connections: {
        Row: {
          active: boolean
          additional_config: Json | null
          api_key: string
          connection_status: string | null
          created_at: string
          created_by: string | null
          default_model: string
          error_message: string | null
          id: string
          last_test_at: string | null
          max_tokens: number | null
          provider: string
          temperature: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          additional_config?: Json | null
          api_key: string
          connection_status?: string | null
          created_at?: string
          created_by?: string | null
          default_model: string
          error_message?: string | null
          id?: string
          last_test_at?: string | null
          max_tokens?: number | null
          provider: string
          temperature?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          additional_config?: Json | null
          api_key?: string
          connection_status?: string | null
          created_at?: string
          created_by?: string | null
          default_model?: string
          error_message?: string | null
          id?: string
          last_test_at?: string | null
          max_tokens?: number | null
          provider?: string
          temperature?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_connections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage_logs: {
        Row: {
          created_at: string
          error: string | null
          estimated_cost: number | null
          feature: string
          id: string
          llm_connections_id: string | null
          model: string
          prompt_preview: string | null
          provider: string
          response_time: number | null
          success: boolean
          tokens_input: number | null
          tokens_output: number | null
          tokens_total: number | null
          users_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          estimated_cost?: number | null
          feature: string
          id?: string
          llm_connections_id?: string | null
          model: string
          prompt_preview?: string | null
          provider: string
          response_time?: number | null
          success: boolean
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
          users_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          estimated_cost?: number | null
          feature?: string
          id?: string
          llm_connections_id?: string | null
          model?: string
          prompt_preview?: string | null
          provider?: string
          response_time?: number | null
          success?: boolean
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
          users_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_logs_llm_connections_id_fkey"
            columns: ["llm_connections_id"]
            isOneToOne: false
            referencedRelation: "llm_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_usage_logs_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_evaluations: {
        Row: {
          coaching_script: string | null
          competitors_mentioned: string[] | null
          created_at: string
          deal_risk: string | null
          email_sent_at: string | null
          error_message: string | null
          evaluated_at: string | null
          evaluation_version: number
          follow_up_agenda: string | null
          gaps: string[] | null
          id: string
          meeting_id: string
          model_used: string | null
          monologue_longest_sec: number | null
          next_steps: string[] | null
          overall_score: number | null
          overall_verdict: string | null
          playbook_id: string
          prompt_version: string | null
          provider_used: string | null
          questions_open: number | null
          questions_total: number | null
          sentiment_arc: Json | null
          status: string
          strengths: string[] | null
          superseded_at: string | null
          talk_ratio_client: number | null
          talk_ratio_consultant: number | null
          triggered_by: string
          updated_at: string
        }
        Insert: {
          coaching_script?: string | null
          competitors_mentioned?: string[] | null
          created_at?: string
          deal_risk?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          evaluated_at?: string | null
          evaluation_version?: number
          follow_up_agenda?: string | null
          gaps?: string[] | null
          id?: string
          meeting_id: string
          model_used?: string | null
          monologue_longest_sec?: number | null
          next_steps?: string[] | null
          overall_score?: number | null
          overall_verdict?: string | null
          playbook_id: string
          prompt_version?: string | null
          provider_used?: string | null
          questions_open?: number | null
          questions_total?: number | null
          sentiment_arc?: Json | null
          status?: string
          strengths?: string[] | null
          superseded_at?: string | null
          talk_ratio_client?: number | null
          talk_ratio_consultant?: number | null
          triggered_by?: string
          updated_at?: string
        }
        Update: {
          coaching_script?: string | null
          competitors_mentioned?: string[] | null
          created_at?: string
          deal_risk?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          evaluated_at?: string | null
          evaluation_version?: number
          follow_up_agenda?: string | null
          gaps?: string[] | null
          id?: string
          meeting_id?: string
          model_used?: string | null
          monologue_longest_sec?: number | null
          next_steps?: string[] | null
          overall_score?: number | null
          overall_verdict?: string | null
          playbook_id?: string
          prompt_version?: string | null
          provider_used?: string | null
          questions_open?: number | null
          questions_total?: number | null
          sentiment_arc?: Json | null
          status?: string
          strengths?: string[] | null
          superseded_at?: string | null
          talk_ratio_client?: number | null
          talk_ratio_consultant?: number | null
          triggered_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_evaluations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_evaluations_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_playbook_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          meeting_id: string
          playbook_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          meeting_id: string
          playbook_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          meeting_id?: string
          playbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_playbook_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_playbook_assignments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_playbook_assignments_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_records: {
        Row: {
          ai_key_topics: string[] | null
          ai_metadata: Json | null
          ai_next_steps: string[] | null
          ai_objections: string[] | null
          ai_score: number | null
          ai_sentiment: string | null
          content: string | null
          content_format: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          meeting_id: string
          record_type: string
          recorded_at: string | null
          source: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          ai_key_topics?: string[] | null
          ai_metadata?: Json | null
          ai_next_steps?: string[] | null
          ai_objections?: string[] | null
          ai_score?: number | null
          ai_sentiment?: string | null
          content?: string | null
          content_format?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          meeting_id: string
          record_type: string
          recorded_at?: string | null
          source?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          ai_key_topics?: string[] | null
          ai_metadata?: Json | null
          ai_next_steps?: string[] | null
          ai_objections?: string[] | null
          ai_score?: number | null
          ai_sentiment?: string | null
          content?: string | null
          content_format?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          meeting_id?: string
          record_type?: string
          recorded_at?: string | null
          source?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_records_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          altiora_compareceu: boolean | null
          altiora_created_by: string | null
          altiora_data_hora: string | null
          altiora_duracao_minutos: number | null
          altiora_motivo_ausencia: string | null
          altiora_pauta: string | null
          altiora_proxima_acao: string | null
          altiora_resultado: string | null
          altiora_tipo: string | null
          attendees: string[] | null
          calendar_id: string | null
          created_at: string
          date: string
          end_time: string
          gcal_sync_error: string | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          leads_id: string | null
          location: string | null
          meeting_type: string | null
          notes: string | null
          outcome: string | null
          quantity: number | null
          source: string | null
          start_time: string
          status: string | null
          users_id: string | null
        }
        Insert: {
          altiora_compareceu?: boolean | null
          altiora_created_by?: string | null
          altiora_data_hora?: string | null
          altiora_duracao_minutos?: number | null
          altiora_motivo_ausencia?: string | null
          altiora_pauta?: string | null
          altiora_proxima_acao?: string | null
          altiora_resultado?: string | null
          altiora_tipo?: string | null
          attendees?: string[] | null
          calendar_id?: string | null
          created_at?: string
          date: string
          end_time: string
          gcal_sync_error?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          leads_id?: string | null
          location?: string | null
          meeting_type?: string | null
          notes?: string | null
          outcome?: string | null
          quantity?: number | null
          source?: string | null
          start_time: string
          status?: string | null
          users_id?: string | null
        }
        Update: {
          altiora_compareceu?: boolean | null
          altiora_created_by?: string | null
          altiora_data_hora?: string | null
          altiora_duracao_minutos?: number | null
          altiora_motivo_ausencia?: string | null
          altiora_pauta?: string | null
          altiora_proxima_acao?: string | null
          altiora_resultado?: string | null
          altiora_tipo?: string | null
          attendees?: string[] | null
          calendar_id?: string | null
          created_at?: string
          date?: string
          end_time?: string
          gcal_sync_error?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          leads_id?: string | null
          location?: string | null
          meeting_type?: string | null
          notes?: string | null
          outcome?: string | null
          quantity?: number | null
          source?: string | null
          start_time?: string
          status?: string | null
          users_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_altiora_created_by_fkey"
            columns: ["altiora_created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_leads_id_fkey"
            columns: ["leads_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings_followups: {
        Row: {
          active: boolean
          audio_file: string | null
          created_at: string
          days: number
          hours: number
          id: string
          meeting_status: string
          message: string | null
          minutes: number
          subject: string | null
          template_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audio_file?: string | null
          created_at?: string
          days?: number
          hours?: number
          id?: string
          meeting_status: string
          message?: string | null
          minutes?: number
          subject?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audio_file?: string | null
          created_at?: string
          days?: number
          hours?: number
          id?: string
          meeting_status?: string
          message?: string | null
          minutes?: number
          subject?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetings_updates: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          meetings_id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          meetings_id: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          meetings_id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_updates_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_updates_meetings_id_fkey"
            columns: ["meetings_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string | null
          content: string
          created_at: string
          followup_id: string | null
          from_contact: string
          id: number
          ig_message_id: string | null
          leads_id: string
          media_metadata: Json | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          module_ref_id: string | null
          people_id: string | null
          source_type: string | null
          status: string | null
          updated_at: string
          users_id: string | null
          wa_message_id: string | null
          wa_phone_number_id: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          channel?: string | null
          content: string
          created_at?: string
          followup_id?: string | null
          from_contact: string
          id?: number
          ig_message_id?: string | null
          leads_id: string
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          module_ref_id?: string | null
          people_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string
          users_id?: string | null
          wa_message_id?: string | null
          wa_phone_number_id?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          channel?: string | null
          content?: string
          created_at?: string
          followup_id?: string | null
          from_contact?: string
          id?: number
          ig_message_id?: string | null
          leads_id?: string
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          module_ref_id?: string | null
          people_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string
          users_id?: string | null
          wa_message_id?: string | null
          wa_phone_number_id?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_leads_id_fkey"
            columns: ["leads_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_form_pages: {
        Row: {
          access_token: string
          created_at: string
          id: string
          page_id: string
          page_name: string
          subscribed: boolean
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          page_id: string
          page_name: string
          subscribed?: boolean
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          page_id?: string
          page_name?: string
          subscribed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      meta_lead_forms: {
        Row: {
          created_at: string
          field_mapping: Json
          id: string
          meta_form_id: string
          name: string
          page_id: string
          pipeline_id: string | null
          raw_questions: Json | null
          settings: Json
          status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_mapping?: Json
          id?: string
          meta_form_id: string
          name: string
          page_id: string
          pipeline_id?: string | null
          raw_questions?: Json | null
          settings?: Json
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_mapping?: Json
          id?: string
          meta_form_id?: string
          name?: string
          page_id?: string
          pipeline_id?: string | null
          raw_questions?: Json | null
          settings?: Json
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_forms_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_form_pages"
            referencedColumns: ["page_id"]
          },
          {
            foreignKeyName: "meta_lead_forms_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_form_pages_safe"
            referencedColumns: ["page_id"]
          },
          {
            foreignKeyName: "meta_lead_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          recovery_set_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          recovery_set_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          recovery_set_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      motivo_perda: {
        Row: {
          created_at: string
          id: string
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_motivo_perda_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_criteria: {
        Row: {
          created_at: string
          description: string | null
          detection_hints: string[] | null
          display_order: number
          example_bad: string | null
          example_good: string | null
          id: string
          is_required: boolean
          section_id: string
          title: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          detection_hints?: string[] | null
          display_order?: number
          example_bad?: string | null
          example_good?: string | null
          id?: string
          is_required?: boolean
          section_id: string
          title: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          detection_hints?: string[] | null
          display_order?: number
          example_bad?: string | null
          example_good?: string | null
          id?: string
          is_required?: boolean
          section_id?: string
          title?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_criteria_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "playbook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          playbook_id: string
          title: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          playbook_id: string
          title: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          playbook_id?: string
          title?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_sections_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_templates: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_system: boolean
          name: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default_for_type: boolean
          name: string
          parent_template_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default_for_type?: boolean
          name: string
          parent_template_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default_for_type?: boolean
          name?: string
          parent_template_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "playbook_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_automations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pipeline_id: string
          target_pipeline_id: string
          target_stage_id: string
          trigger_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id: string
          target_pipeline_id: string
          target_stage_id: string
          trigger_status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string
          target_pipeline_id?: string
          target_stage_id?: string
          trigger_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_automations_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_automations_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      // ── Manually added 2026-07-25 (FIX-SCORE-01) — pending supabase gen types ──
      score_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          order_index: number
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          order_index?: number
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      score_category_items: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "score_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      // ── End manually added ────────────────────────────────────────────────────
      score_framings: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      score_investments: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      score_matrix: {
        Row: {
          created_at: string | null
          detail_score: string | null
          framing_id: string[] | null
          id: string
          investment_id: string[] | null
          name: string | null
          objective_id: string[] | null
          pre_description_score: string | null
          profile_score: string | null
          score_number: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          detail_score?: string | null
          framing_id?: string[] | null
          id?: string
          investment_id?: string[] | null
          name?: string | null
          objective_id?: string[] | null
          pre_description_score?: string | null
          profile_score?: string | null
          score_number: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          detail_score?: string | null
          framing_id?: string[] | null
          id?: string
          investment_id?: string[] | null
          name?: string | null
          objective_id?: string[] | null
          pre_description_score?: string | null
          profile_score?: string | null
          score_number?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      score_objectives: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order_index: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order_index?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      secret_access_log: {
        Row: {
          accessed_at: string
          caller_context: string | null
          id: string
          ip_address: unknown
          secret_name: string
        }
        Insert: {
          accessed_at?: string
          caller_context?: string | null
          id?: string
          ip_address?: unknown
          secret_name: string
        }
        Update: {
          accessed_at?: string
          caller_context?: string | null
          id?: string
          ip_address?: unknown
          secret_name?: string
        }
        Relationships: []
      }
      sends: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number | null
          filter_config: Json | null
          id: string
          last_batch_at: string | null
          message_content: string | null
          name: string
          pipeline_id: string | null
          scheduled_at: string | null
          send_interval_seconds: number | null
          sent_count: number | null
          stage_id: string | null
          started_at: string | null
          status: string
          total_contacts: number | null
          type: string
          updated_at: string
          webhook_id: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          filter_config?: Json | null
          id?: string
          last_batch_at?: string | null
          message_content?: string | null
          name: string
          pipeline_id?: string | null
          scheduled_at?: string | null
          send_interval_seconds?: number | null
          sent_count?: number | null
          stage_id?: string | null
          started_at?: string | null
          status?: string
          total_contacts?: number | null
          type?: string
          updated_at?: string
          webhook_id?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          filter_config?: Json | null
          id?: string
          last_batch_at?: string | null
          message_content?: string | null
          name?: string
          pipeline_id?: string | null
          scheduled_at?: string | null
          send_interval_seconds?: number | null
          sent_count?: number | null
          stage_id?: string | null
          started_at?: string | null
          status?: string
          total_contacts?: number | null
          type?: string
          updated_at?: string
          webhook_id?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sends_webhook"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "sends_webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sends_import_presets: {
        Row: {
          created_at: string
          description: string | null
          field_mapping: Json
          id: string
          lead_control: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_mapping?: Json
          id?: string
          lead_control?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          field_mapping?: Json
          id?: string
          lead_control?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sends_import_sessions: {
        Row: {
          created_at: string
          error_message: string | null
          existing_people: number
          failed_rows: number
          id: string
          new_people: number
          processed: number
          send_id: string | null
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          existing_people?: number
          failed_rows?: number
          id?: string
          new_people?: number
          processed?: number
          send_id?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          existing_people?: number
          failed_rows?: number
          id?: string
          new_people?: number
          processed?: number
          send_id?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sends_import_sessions_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "sends"
            referencedColumns: ["id"]
          },
        ]
      }
      sends_people: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          people_id: string
          read_at: string | null
          send_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          people_id: string
          read_at?: string | null
          send_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          people_id?: string
          read_at?: string | null
          send_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sends_people_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_people_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_people_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "sends"
            referencedColumns: ["id"]
          },
        ]
      }
      sends_webhooks: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          accent_color: string | null
          address: string | null
          apify_token: string | null
          apollo_api_key: string | null
          bi_voice_chat_beta_enabled: boolean
          brand_primary_color: string | null
          brand_secondary_color: string | null
          company_name: string
          created_at: string
          currency: string | null
          custom_domain: string | null
          email: string | null
          explorium_api_key: string | null
          google_client_id: string | null
          google_client_secret: string | null
          id: string
          language: string | null
          login_max_attempts: number | null
          logo_url: string | null
          mfa_policy: string | null
          pdl_api_key: string | null
          phone: string | null
          primary_color: string | null
          product_name: string | null
          require_mfa_for_gestores: boolean | null
          secondary_color: string | null
          tax_id: string | null
          timezone: string | null
          updated_at: string
          website: string | null
          whatsapp_provider: string
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          apify_token?: string | null
          apollo_api_key?: string | null
          bi_voice_chat_beta_enabled?: boolean
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          company_name: string
          created_at?: string
          currency?: string | null
          custom_domain?: string | null
          email?: string | null
          explorium_api_key?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          id?: string
          language?: string | null
          login_max_attempts?: number | null
          logo_url?: string | null
          mfa_policy?: string | null
          pdl_api_key?: string | null
          phone?: string | null
          primary_color?: string | null
          product_name?: string | null
          require_mfa_for_gestores?: boolean | null
          secondary_color?: string | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_provider?: string
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          apify_token?: string | null
          apollo_api_key?: string | null
          bi_voice_chat_beta_enabled?: boolean
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          company_name?: string
          created_at?: string
          currency?: string | null
          custom_domain?: string | null
          email?: string | null
          explorium_api_key?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          id?: string
          language?: string | null
          login_max_attempts?: number | null
          logo_url?: string | null
          mfa_policy?: string | null
          pdl_api_key?: string | null
          phone?: string | null
          primary_color?: string | null
          product_name?: string | null
          require_mfa_for_gestores?: boolean | null
          secondary_color?: string | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_provider?: string
        }
        Relationships: []
      }
      settings_general: {
        Row: {
          cnpj: string | null
          cor_destaque: string | null
          cor_principal: string | null
          cor_secundaria: string | null
          created_at: string
          email: string | null
          endereco: string | null
          fuso_horario: string | null
          id: string
          idioma: string | null
          logo_url: string | null
          moeda: string | null
          nome_empresa: string
          telefone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          cnpj?: string | null
          cor_destaque?: string | null
          cor_principal?: string | null
          cor_secundaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          fuso_horario?: string | null
          id?: string
          idioma?: string | null
          logo_url?: string | null
          moeda?: string | null
          nome_empresa: string
          telefone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          cnpj?: string | null
          cor_destaque?: string | null
          cor_principal?: string | null
          cor_secundaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          fuso_horario?: string | null
          id?: string
          idioma?: string | null
          logo_url?: string | null
          moeda?: string | null
          nome_empresa?: string
          telefone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      settings_schedules_followups: {
        Row: {
          ativo: boolean
          atraso_minutos: number
          canal_envio: string
          created_at: string
          id: string
          mensagem: string | null
          status_agendamento: string
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atraso_minutos?: number
          canal_envio?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          status_agendamento: string
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atraso_minutos?: number
          canal_envio?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          status_agendamento?: string
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_stages_followups: {
        Row: {
          arquivo_audio: string | null
          assunto: string | null
          ativo: boolean
          created_at: string
          dias: number
          horas: number
          id: string
          mensagem: string | null
          minutos: number
          stage_id: string
          template_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_audio?: string | null
          assunto?: string | null
          ativo?: boolean
          created_at?: string
          dias?: number
          horas?: number
          id?: string
          mensagem?: string | null
          minutos?: number
          stage_id: string
          template_id?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          arquivo_audio?: string | null
          assunto?: string | null
          ativo?: boolean
          created_at?: string
          dias?: number
          horas?: number
          id?: string
          mensagem?: string | null
          minutos?: number
          stage_id?: string
          template_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stage_followups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_system_modules: {
        Row: {
          ativo: boolean
          created_at: string
          icon: string | null
          id: string
          module_key: string
          module_name: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          module_key: string
          module_name: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          module_key?: string
          module_name?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings_teams: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          prioridade: number
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_time"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          prioridade?: number
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_time"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          prioridade?: number
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_time"]
          updated_at?: string
        }
        Relationships: []
      }
      settings_teams_pipelines: {
        Row: {
          created_at: string
          pipeline_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          pipeline_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          pipeline_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_teams_pipelines_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_teams_pipelines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_users: {
        Row: {
          agencia_id: string | null
          agente: string | null
          ativo: boolean
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string
          fuso_horario: string | null
          gestor: boolean
          id: string
          mfa_grace_until: string | null
          nome: string
          super_adm: boolean | null
          tenant_id: string | null
          updated_at: string
          user_type: string | null
          whatsapp: string | null
        }
        Insert: {
          agencia_id?: string | null
          agente?: string | null
          ativo?: boolean
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          fuso_horario?: string | null
          gestor?: boolean
          id?: string
          mfa_grace_until?: string | null
          nome: string
          super_adm?: boolean | null
          tenant_id?: string | null
          updated_at?: string
          user_type?: string | null
          whatsapp?: string | null
        }
        Update: {
          agencia_id?: string | null
          agente?: string | null
          ativo?: boolean
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          fuso_horario?: string | null
          gestor?: boolean
          id?: string
          mfa_grace_until?: string | null
          nome?: string
          super_adm?: boolean | null
          tenant_id?: string | null
          updated_at?: string
          user_type?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_usuarios_agencia_id_fkey"
            columns: ["agencia_id"]
            isOneToOne: false
            referencedRelation: "crm_agencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_usuarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_users_schedules: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          tenant_id: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          tenant_id: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tenant_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_horarios_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_horarios_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_users_teams: {
        Row: {
          created_at: string
          id: string
          is_priority: boolean
          tenant_id: string
          time_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_priority?: boolean
          tenant_id: string
          time_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_priority?: boolean
          tenant_id?: string
          time_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_usuario_times_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuario_times_time"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuario_times_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_users_teams_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_users_teams_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          key: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          key: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          key?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          priority: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: number
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          snoozed_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          snoozed_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          snoozed_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string
          id: string
          is_manager: boolean
          is_super_admin: boolean
          name: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          id?: string
          is_manager?: boolean
          is_super_admin?: boolean
          name: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          id?: string
          is_manager?: boolean
          is_super_admin?: boolean
          name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      users_schedules: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          start_time: string
          users_id: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          users_id: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          users_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_schedules_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users_teams: {
        Row: {
          created_at: string
          id: string
          teams_id: string
          users_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          teams_id: string
          users_id: string
        }
        Update: {
          created_at?: string
          id?: string
          teams_id?: string
          users_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_teams_teams_id_fkey"
            columns: ["teams_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_teams_users_id_fkey"
            columns: ["users_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          channel: string | null
          created_at: string
          error_detail: string | null
          event: string
          id: string
          message_id: string | null
          payload: Json | null
          people_id: string | null
          source: string
          subscriber_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          error_detail?: string | null
          event: string
          id?: string
          message_id?: string | null
          payload?: Json | null
          people_id?: string | null
          source: string
          subscriber_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          error_detail?: string | null
          event?: string
          id?: string
          message_id?: string | null
          payload?: Json | null
          people_id?: string | null
          source?: string
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          id_template: string
          json_data: Json | null
          last_synced_at: string | null
          meta_template_name: string | null
          nome: string
          purpose: string | null
          slug: string
          status: string
          system_enabled: boolean
          updated_at: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          id_template: string
          json_data?: Json | null
          last_synced_at?: string | null
          meta_template_name?: string | null
          nome: string
          purpose?: string | null
          slug: string
          status?: string
          system_enabled?: boolean
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          id_template?: string
          json_data?: Json | null
          last_synced_at?: string | null
          meta_template_name?: string | null
          nome?: string
          purpose?: string | null
          slug?: string
          status?: string
          system_enabled?: boolean
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      meta_lead_form_pages_safe: {
        Row: {
          created_at: string | null
          id: string | null
          page_id: string | null
          page_name: string | null
          subscribed: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          page_id?: string | null
          page_name?: string | null
          subscribed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          page_id?: string | null
          page_name?: string | null
          subscribed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adm_client_decrypted_secrets: {
        Args: { p_client_id: string }
        Returns: {
          db_password: string
          management_token: string
          service_role_key: string
        }[]
      }
      adm_clients_secrets_status: {
        Args: never
        Returns: {
          has_db_password: boolean
          has_management_token: boolean
          has_service_role_key: boolean
          id: string
        }[]
      }
      adm_timeout_stuck_jobs: { Args: never; Returns: number }
      anonymize_person: { Args: { p_person_id: string }; Returns: Json }
      app_decrypt_secret: {
        Args: { p_context: string; p_encrypted: string }
        Returns: string
      }
      app_encrypt_secret: {
        Args: { p_context: string; p_value: string }
        Returns: string
      }
      append_crm_field_value: {
        Args: { p_field_key: string; p_new_value: string; p_person_id: string }
        Returns: undefined
      }
      assign_lead_round_robin: {
        Args: { p_lead_id: string; p_team_id: string }
        Returns: string
      }
      book_meeting:
        | {
            Args: {
              p_duration?: number
              p_end_time: string
              p_exclude_user_ids?: string[]
              p_lead_id: string
              p_notes?: string
              p_rule_set_id?: string
              p_start_time: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_duration_minutes?: number
              p_lead_id: string
              p_notes?: string
              p_start_ts: string
              p_title: string
              p_user_id: string
            }
            Returns: string
          }
      check_bi_voice_beta_update: { Args: never; Returns: boolean }
      check_horario_disponivel: {
        Args: { p_horario: string; p_tenant_id: string; p_usuario_id: string }
        Returns: {
          hora_fim: string
          hora_inicio: string
          horario_preferencia: string
          tem_conflito: boolean
        }[]
      }
      check_whatsapp_duplicate: {
        Args: {
          exclude_id_param?: string
          tenant_id_param: string
          whatsapp_param: string
        }
        Returns: boolean
      }
      check_whatsapp_exists_in_tenant: {
        Args: {
          exclude_id_param?: string
          tenant_id_param: string
          whatsapp_param: string
        }
        Returns: boolean
      }
      claim_pending_messages: {
        Args: {
          p_batch_size?: number
          p_channel?: string
          p_max_age_hours?: number
          p_people_id?: string
        }
        Returns: {
          channel: string
          content: string
          execution_id: string
          id: number
          lead_id: string
          media_metadata: Json
          media_url: string
          message_type: string
          metadata: Json
          module_ref_id: string
          people_id: string
          sent_at: string
          source_type: string
          user_id: string
          wa_phone_number_id: string
          whatsapp_template_id: string
        }[]
      }
      clean_message_duplicates: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      cleanup_auth_login_attempts: { Args: never; Returns: undefined }
      cleanup_bi_voice_token_log: { Args: never; Returns: undefined }
      create_pessoa_with_lead: {
        Args: {
          pessoa_data: Json
          pipeline_id_param: string
          tenant_id_param: string
        }
        Returns: Json
      }
      create_tenant_user: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_phone?: string
          p_super_admin?: boolean
          p_user_type?: string
        }
        Returns: Json
      }
      criar_backup_agente: {
        Args: { agente_id: string; changelog_text?: string }
        Returns: undefined
      }
      debug_auth_context: {
        Args: never
        Returns: {
          current_tenant_id: string
          current_user_id: string
          session_valid: boolean
        }[]
      }
      decrypt_api_key: {
        Args: { encrypted_key: string; secret_key: string }
        Returns: string
      }
      decrypt_llm_api_key: {
        Args: { encrypted_key: string; tenant_id: string }
        Returns: string
      }
      delete_pessoa_and_related_data: {
        Args: { pessoa_id_param: string; tenant_id_param: string }
        Returns: boolean
      }
      encrypt_api_key: {
        Args: { key_value: string; secret_key: string }
        Returns: string
      }
      encrypt_llm_api_key: {
        Args: { key_value: string; tenant_id: string }
        Returns: string
      }
      excluir_agente_completo: {
        Args: { agente_id: string }
        Returns: undefined
      }
      find_duplicate_person: {
        Args: {
          p_document?: string
          p_email?: string
          p_exclude_id: string
          p_instagram_handle?: string
          p_instagram_user_id?: string
          p_whatsapp?: string
        }
        Returns: string
      }
      find_score_matrix: {
        Args: {
          p_framing_id: string
          p_investment_id: string
          p_objective_id: string
        }
        Returns: {
          matrix_id: string
          matrix_score: number
        }[]
      }
      get_active_ai_provider_key: {
        Args: { p_provider: string }
        Returns: string
      }
      get_available_slots: {
        Args: {
          p_date: string
          p_period?: string
          p_slot_minutes?: number
          p_user_id: string
        }
        Returns: Json
      }
      get_booking_eligible_user_ids:
        | { Args: { p_rule_set_id?: string }; Returns: string[] }
        | {
            Args: { p_pipeline_id?: string; p_rule_set_id?: string }
            Returns: string[]
          }
      get_booking_session: {
        Args: {
          p_days_ahead?: number
          p_duration?: number
          p_lead_id: string
          p_rule_set_id?: string
        }
        Returns: Json
      }
      get_call_stats: {
        Args: { date_from: string; date_to: string }
        Returns: Json
      }
      get_current_user_permissions: {
        Args: never
        Returns: {
          is_ativo: boolean
          is_gestor: boolean
          is_super_adm: boolean
          tenant_id: string
          user_id: string
        }[]
      }
      get_current_user_tenant_id: { Args: never; Returns: string }
      get_current_user_tenant_safe: { Args: never; Returns: string }
      get_dashboard_agendamentos_aggregated: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_scores?: number[]
          p_tenant_id: string
          p_vendedor?: string
        }
        Returns: Json
      }
      get_dashboard_campanhas_aggregated: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_responsavel?: string
          p_scores?: number[]
          p_tenant_id: string
        }
        Returns: Json
      }
      get_dashboard_conversas_aggregated: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_responsavel?: string
          p_scores?: number[]
          p_tenant_id: string
        }
        Returns: Json
      }
      get_dashboard_leads_conversao: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_pipeline_id?: string
          p_responsavel?: string
          p_scores?: number[]
          p_stage_id?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_dashboard_leads_evolucao: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_pipeline_id?: string
          p_responsavel?: string
          p_scores?: number[]
          p_stage_id?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_dashboard_negocios_aggregated: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_pipeline_id?: string
          p_responsavel?: string
          p_scores?: number[]
          p_stage_id?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_insights_context: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_pipeline_id?: string
        }
        Returns: Json
      }
      get_public_settings: {
        Args: never
        Returns: {
          company_name: string
          logo_url: string
        }[]
      }
      get_user_available_tenants: {
        Args: never
        Returns: {
          ativo: boolean
          gestor: boolean
          role: string
          super_adm: boolean
          tenant_id: string
          tenant_name: string
        }[]
      }
      get_user_by_auth_id: {
        Args: { auth_id: string }
        Returns: {
          ativo: boolean
          auth_user_id: string
          created_at: string
          deleted_at: string
          deleted_by: string
          email: string
          gestor: boolean
          id: string
          nome: string
          super_adm: boolean
          tenant_id: string
          updated_at: string
          whatsapp: string
        }[]
      }
      get_user_tenant_id:
        | { Args: never; Returns: string }
        | { Args: { user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_empresa: { Args: { empresa_data: Json }; Returns: Json }
      import_pessoa_with_flexible_lead:
        | {
            Args: {
              modo_operacao?: string
              pessoa_data: Json
              pipeline_id_param?: string
              tenant_id_param?: string
            }
            Returns: Json
          }
        | {
            Args: {
              modo_operacao?: string
              pessoa_data: Json
              pipeline_id_param: string
              tenant_id_param: string
            }
            Returns: Json
          }
      increment_field: {
        Args: {
          field_name: string
          increment_by?: number
          row_id: string
          table_name: string
        }
        Returns: undefined
      }
      is_current_user_super_admin: { Args: never; Returns: boolean }
      is_current_user_super_admin_safe: { Args: never; Returns: boolean }
      is_gestor_or_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_user_manager_for_tenant: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      is_user_super_admin: { Args: never; Returns: boolean }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: undefined
      }
      merge_persons: {
        Args: { p_canonical_id: string; p_duplicate_id: string }
        Returns: Json
      }
      mfa_recovery_consume: { Args: { p_code: string }; Returns: Json }
      mfa_recovery_generate: { Args: never; Returns: string[] }
      process_message_buffer: { Args: never; Returns: undefined }
      release_stale_ai_locks: { Args: never; Returns: undefined }
      reorder_stages: { Args: { stage_ids: string[] }; Returns: undefined }
      reset_stale_sending_messages: { Args: never; Returns: undefined }
      restaurar_versao_agente: {
        Args: { agente_id: string; versao_restaurar: number }
        Returns: undefined
      }
      save_agent_complete: {
        Args: {
          p_agent_data: Json
          p_agent_id: string
          p_changelog?: Json
          p_created_by?: string
          p_steps_data?: Json
        }
        Returns: Json
      }
      secure_http_post: {
        Args: {
          body: Json
          caller_context?: string
          secret_name: string
          url: string
        }
        Returns: Json
      }
      set_booking_lead_email: {
        Args: { p_email: string; p_lead_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_custom_domain_to_adm: {
        Args: { p_custom_domain: string; p_tenant_id: string }
        Returns: undefined
      }
      sync_service_role_from_vault: { Args: never; Returns: undefined }
      test_count_real_leads: { Args: { p_tenant_id: string }; Returns: number }
      test_dashboard_leads_count: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      trigger_fwup01_smoke_test: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          status: string
        }[]
      }
      trigger_instagram_token_refresh: { Args: never; Returns: undefined }
      trigger_omni_channel_health_check: { Args: never; Returns: undefined }
      trigger_omni_delivery_engine: { Args: never; Returns: undefined }
      trigger_omni_retry_dead_letter: { Args: never; Returns: undefined }
      trigger_sends_dispatch_batch: { Args: never; Returns: undefined }
      trigger_zoom_token_refresh: { Args: never; Returns: undefined }
      update_meeting: {
        Args: {
          p_duration_minutes?: number
          p_meeting_id: string
          p_notes?: string
          p_start_ts?: string
          p_status: string
        }
        Returns: undefined
      }
      user_has_tenant_access: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      user_has_tenant_access_robust: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      validate_lead_creation: {
        Args: { person_id_param: string; tenant_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
      entidade_campo: "pessoa" | "empresa" | "negocio"
      notification_channel: "in_app" | "email" | "whatsapp"
      notification_event_type:
        | "lead_assigned"
        | "followup_due"
        | "meeting_scheduled"
        | "coach_evaluation_ready"
        | "transcript_ready"
        | "word_spotting_triggered"
      permissao_usuario: "admin" | "leitura" | "suporte"
      tipo_campo: "texto" | "numero" | "data" | "select" | "multipla_escolha"
      tipo_time: "suporte" | "vendas"
      tipo_usuario:
        | "admin_global"
        | "admin_cliente"
        | "usuario_cliente"
        | "gestor"
        | "atendimento"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "manager", "user"],
      entidade_campo: ["pessoa", "empresa", "negocio"],
      notification_channel: ["in_app", "email", "whatsapp"],
      notification_event_type: [
        "lead_assigned",
        "followup_due",
        "meeting_scheduled",
        "coach_evaluation_ready",
        "transcript_ready",
        "word_spotting_triggered",
      ],
      permissao_usuario: ["admin", "leitura", "suporte"],
      tipo_campo: ["texto", "numero", "data", "select", "multipla_escolha"],
      tipo_time: ["suporte", "vendas"],
      tipo_usuario: [
        "admin_global",
        "admin_cliente",
        "usuario_cliente",
        "gestor",
        "atendimento",
      ],
    },
  },
} as const
