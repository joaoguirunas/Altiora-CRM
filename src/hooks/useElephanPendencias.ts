import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  buildScorecard,
  toAiScoreColumn,
  type ElephanAnswer,
  type ElephanScorecard,
} from '@/utils/elephanScorecard';

/**
 * `elephan_unmatched_events` ainda não existe no types.ts gerado (o arquivo está
 * atrás do banco). Sem a tabela no schema, o cliente tipado não tem overload
 * para ela e a inferência do PostgREST estoura. O formato real das linhas está
 * em ElephanPendencia, logo abaixo.
 */
const pendenciasTable = () =>
  (supabase as unknown as SupabaseClient).from('elephan_unmatched_events');

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
  /**
   * 'pending' = o webhook não achou reunião nenhuma e o closer busca o negócio.
   * 'needs_confirmation' = achou candidatas e quer que ele diga qual era.
   * Ver migration 20260821140000_elephan_candidate_meetings.sql.
   */
  status: 'pending' | 'needs_confirmation' | 'linked' | 'ignored';
  /** Reuniões que o match automático considerou plausíveis (status needs_confirmation). */
  candidate_meeting_ids: string[] | null;
  created_at: string;
  /**
   * Payload completo do transcribe, como a Elephan mandou. É daqui que sai o
   * score card no vínculo manual — o webhook guarda tudo antes de estacionar a
   * pendência, então nada se perde por não ter casado na hora.
   */
  raw_payload?: { answers?: ElephanAnswer[]; prompt?: ElephanScorecard['prompt'] } | null;
}

/**
 * Pendências em aberto. `closerUserId` restringe às calls do próprio consultor —
 * é assim que o closer resolve as dele sem enxergar (nem mexer n)as dos outros.
 * Sem o filtro, lista tudo (visão de gestão).
 */
export const useElephanPendencias = (closerUserId?: string | null) => {
  return useQuery({
    queryKey: ['elephan-pendencias', closerUserId ?? 'all'],
    queryFn: async () => {
      // Sem reatribuir o builder: reatribuição faz o TS reinferir a cadeia
      // inteira do PostgREST e estourar em "type instantiation excessively deep".
      const base = pendenciasTable()
        .select('*, closer:settings_users(name)')
        .in('status', ['pending', 'needs_confirmation'])
        .order('call_date', { ascending: false });

      const { data, error } = await (closerUserId
        ? base.eq('closer_user_id', closerUserId)
        : base);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        closer_name: (r as unknown as { closer?: { name?: string } }).closer?.name ?? null,
      })) as unknown as ElephanPendencia[];
    },
    staleTime: 15_000,
  });
};

interface LinkPendenciaParams {
  pendenciaId: string;
  transcribeId: string;
  leadId: string;
  /**
   * Reunião que já existe no CRM (candidata sugerida pelo match). Quando vem,
   * os artefatos da call são anexados a ela; sem isso, criaríamos uma segunda
   * reunião para o mesmo encontro e o negócio ficaria com a agenda duplicada.
   * Ausente = call sem reunião correspondente, aí sim criamos uma.
   */
  meetingId?: string | null;
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
      let meetingId = params.meetingId ?? null;

      if (!meetingId) {
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
        meetingId = meeting.id;
      }

      const records: Record<string, unknown>[] = [];
      if (params.recordingUrl) {
        records.push({
          meeting_id: meetingId,
          record_type: 'recording',
          source: 'elephan',
          url: params.recordingUrl,
          duration_seconds: params.durationSeconds,
        });
      }
      if (params.transcriptText) {
        records.push({
          meeting_id: meetingId,
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
          meeting_id: meetingId,
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

      const { error: updateErr } = await pendenciasTable()
        .update({
          status: 'linked',
          linked_lead_id: params.leadId,
          linked_meeting_id: meetingId,
          linked_by: params.linkedBy,
          linked_at: new Date().toISOString(),
        })
        .eq('id', params.pendenciaId);
      if (updateErr) throw updateErr;

      return meetingId;
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
      const { error } = await pendenciasTable()
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

// ── Candidatas sugeridas pelo match automático ───────────────────────────────

export interface CandidateMeeting {
  meeting_id: string;
  start_time: string;
  meeting_title: string | null;
  altiora_tipo: string | null;
  lead_id: string;
  lead_title: string | null;
  lead_people_id: string | null;
  pessoa_nome: string | null;
}

/**
 * Resolve os `candidate_meeting_ids` de uma pendência em algo exibível. Os nomes
 * vêm do banco na hora (e não do payload da Elephan) para a sugestão nunca
 * mostrar um negócio com nome velho.
 */
export const useCandidateMeetings = (meetingIds: string[] | null | undefined) => {
  const ids = meetingIds ?? [];
  return useQuery({
    queryKey: ['elephan-candidate-meetings', ids.join(',')],
    queryFn: async () => {
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('id, leads_id, start_time, title, altiora_tipo')
        .in('id', ids)
        .order('start_time', { ascending: true });
      if (error) throw error;

      const leadIds = [...new Set((meetings ?? []).map(m => m.leads_id).filter(Boolean))] as string[];
      if (leadIds.length === 0) return [] as CandidateMeeting[];

      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, title, people_id, pessoa:clients_people(name)')
        .in('id', leadIds);
      if (leadsErr) throw leadsErr;

      const leadById = new Map(
        (leads ?? []).map(l => [
          l.id,
          {
            title: l.title,
            people_id: l.people_id,
            pessoa_nome: (l as unknown as { pessoa?: { name?: string } }).pessoa?.name ?? null,
          },
        ]),
      );

      return (meetings ?? [])
        .filter(m => m.leads_id && leadById.has(m.leads_id))
        .map(m => {
          const lead = leadById.get(m.leads_id as string)!;
          return {
            meeting_id: m.id,
            start_time: m.start_time,
            meeting_title: m.title ?? null,
            altiora_tipo: m.altiora_tipo ?? null,
            lead_id: m.leads_id as string,
            lead_title: lead.title,
            lead_people_id: lead.people_id,
            pessoa_nome: lead.pessoa_nome,
          };
        }) as CandidateMeeting[];
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
};
