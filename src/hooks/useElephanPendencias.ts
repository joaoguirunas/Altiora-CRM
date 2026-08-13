import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildScorecard,
  toAiScoreColumn,
  type ElephanAnswer,
  type ElephanScorecard,
} from '@/utils/elephanScorecard';

export interface ElephanPendencia {
  id: string;
  transcribe_id: string;
  call_date: string;
  title: string | null;
  closer_email: string | null;
  closer_user_id: string | null;
  closer_name: string | null;
  summary: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript_text: string | null;
  status: 'pending' | 'linked' | 'ignored';
  created_at: string;
  /**
   * Payload completo do transcribe, como a Elephan mandou. É daqui que sai o
   * score card no vínculo manual — o webhook guarda tudo antes de estacionar a
   * pendência, então nada se perde por não ter casado na hora.
   */
  raw_payload?: { answers?: ElephanAnswer[]; prompt?: ElephanScorecard['prompt'] } | null;
}

export const useElephanPendencias = () => {
  return useQuery({
    queryKey: ['elephan-pendencias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('elephan_unmatched_events')
        .select('*, closer:settings_users(name)')
        .eq('status', 'pending')
        .order('call_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        closer_name: (r as unknown as { closer?: { name?: string } }).closer?.name ?? null,
      })) as ElephanPendencia[];
    },
    staleTime: 15_000,
  });
};

interface LinkPendenciaParams {
  pendenciaId: string;
  transcribeId: string;
  leadId: string;
  leadPeopleId: string | null;
  closerUserId: string | null;
  callDate: string;
  title: string | null;
  summary: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcriptText: string | null;
  linkedBy: string;
  /** Respostas do score card, vindas de `elephan_unmatched_events.raw_payload`. */
  answers?: ElephanAnswer[] | null;
  scorecardPrompt?: ElephanScorecard['prompt'];
}

/** Busca best-effort — se a Elephan falhar ou demorar, o vínculo segue sem insights. */
const fetchElephanInsights = async (transcribeId: string): Promise<Record<string, unknown>[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('elephan-fetch-insights', {
      body: { transcribeId },
    });
    if (error) return [];
    return (data?.insights ?? []) as Record<string, unknown>[];
  } catch {
    return [];
  }
};

export const useLinkElephanPendencia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: LinkPendenciaParams) => {
      const { data: meeting, error: meetingErr } = await supabase
        .from('meetings')
        .insert({
          leads_id: params.leadId,
          people_id: params.leadPeopleId,
          users_id: params.closerUserId,
          title: params.title ?? 'Reunião (Elephan.ai — vínculo manual)',
          date: params.callDate.slice(0, 10),
          start_time: params.callDate,
          end_time: params.callDate,
          source: 'elephan',
          status: 'realizado',
        })
        .select('id')
        .single();
      if (meetingErr) throw meetingErr;

      const records: Record<string, unknown>[] = [];
      if (params.recordingUrl) {
        records.push({
          meeting_id: meeting.id,
          record_type: 'recording',
          source: 'elephan',
          url: params.recordingUrl,
          duration_seconds: params.durationSeconds,
        });
      }
      if (params.transcriptText) {
        records.push({
          meeting_id: meeting.id,
          record_type: 'transcript',
          source: 'elephan',
          content: params.transcriptText,
          content_format: 'text',
        });
      }
      const insights = await fetchElephanInsights(params.transcribeId);
      // Score card do payload original — mesma normalização do webhook, para o
      // vínculo manual não gerar um registro mais pobre que o automático.
      const scorecard = buildScorecard(params.answers, params.scorecardPrompt ?? null);
      if (params.summary || insights.length > 0 || scorecard) {
        records.push({
          meeting_id: meeting.id,
          record_type: 'ai_summary',
          source: 'elephan',
          content: params.summary,
          content_format: 'html',
          ai_score: toAiScoreColumn(scorecard?.stats.scoreAverage),
          ai_metadata:
            insights.length > 0 || scorecard
              ? {
                  ...(insights.length > 0 ? { insights } : {}),
                  ...(scorecard ? { scorecard } : {}),
                }
              : undefined,
        });
      }
      // Insere um de cada vez — o PostgREST rejeita insert em lote quando os
      // objetos do array têm conjuntos de chaves diferentes (PGRST102), e aqui
      // recording/transcript/ai_summary sempre têm formatos diferentes.
      for (const record of records) {
        const { error: recErr } = await supabase.from('meeting_records').insert(record);
        if (recErr) throw recErr;
      }

      const { error: updateErr } = await supabase
        .from('elephan_unmatched_events')
        .update({
          status: 'linked',
          linked_lead_id: params.leadId,
          linked_meeting_id: meeting.id,
          linked_by: params.linkedBy,
          linked_at: new Date().toISOString(),
        })
        .eq('id', params.pendenciaId);
      if (updateErr) throw updateErr;

      return meeting.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elephan-pendencias'] });
    },
  });
};

export const useIgnoreElephanPendencia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pendenciaId: string) => {
      const { error } = await supabase
        .from('elephan_unmatched_events')
        .update({ status: 'ignored' })
        .eq('id', pendenciaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elephan-pendencias'] });
    },
  });
};

export interface NegocioSearchResult {
  id: string;
  title: string | null;
  people_id: string | null;
  pessoa_nome: string | null;
}

export const useSearchNegocios = (search: string) => {
  return useQuery({
    queryKey: ['negocios-search-elephan', search],
    queryFn: async () => {
      const term = search.trim();
      if (!term) return [] as NegocioSearchResult[];

      const { data: byTitle, error: titleErr } = await supabase
        .from('leads')
        .select('id, title, people_id, pessoa:clients_people(name)')
        .ilike('title', `%${term}%`)
        .limit(10);
      if (titleErr) throw titleErr;

      const { data: matchingPeople } = await supabase
        .from('clients_people')
        .select('id')
        .ilike('name', `%${term}%`)
        .limit(10);
      const peopleIds = (matchingPeople ?? []).map((p) => p.id);

      let byPessoa: typeof byTitle = [];
      if (peopleIds.length > 0) {
        const { data, error: pessoaErr } = await supabase
          .from('leads')
          .select('id, title, people_id, pessoa:clients_people(name)')
          .in('people_id', peopleIds)
          .limit(10);
        if (pessoaErr) throw pessoaErr;
        byPessoa = data ?? [];
      }

      const merged = new Map<string, (typeof byTitle)[number]>();
      [...(byTitle ?? []), ...byPessoa].forEach((r) => merged.set(r.id, r));

      return Array.from(merged.values()).map((r) => ({
        id: r.id,
        title: r.title,
        people_id: r.people_id,
        pessoa_nome: (r as unknown as { pessoa?: { name?: string } }).pessoa?.name ?? null,
      })) as NegocioSearchResult[];
    },
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });
};
