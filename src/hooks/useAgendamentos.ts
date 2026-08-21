import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAgendamentosSimple } from './useAgendamentosSimple';
import { auditLogger } from '@/utils/auditLogger';

// `meeting_collaborators` e `meeting_guests` ainda não estão nos tipos gerados
// do Supabase — mesmo cast usado em useAltioraMeetings.ts.
const sbUntyped = supabase as unknown as SupabaseClient;

interface CreateAgendamentoData {
  lead_id?: string | null;
  people_id?: string | null;
  title?: string;
  user_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  google_meet_link?: string | null;
  status?: string;
  sendConfirmation?: boolean;
  /**
   * Tipo da reunião. Quando é R1/R2/R3, também alimenta `meetings.altiora_tipo`
   * — é ele que faz google-cal-upsert-event usar o template de convite Altiora
   * (Wealth Planning Discovery/Presentation, IUL Implementation) em vez do
   * texto genérico "Reunião — <cliente> / Agendado via app".
   */
  meeting_type?: string;
  /**
   * Consultores adicionais da reunião, além do organizador (`user_id`).
   * Gravados em `meeting_collaborators` ANTES do evento ir para o Google
   * Calendar, para que todos entrem no mesmo convite — se fossem gravados
   * depois, o cliente receberia um segundo e-mail de "evento atualizado".
   * Ver ADR-ALTIORA-01.
   */
  collaboratorIds?: string[];
  /**
   * Convidados externos por e-mail (`meeting_guests`), estilo "Adicionar
   * convidados" do Google Meet. Gravados no mesmo ponto e pelo mesmo motivo que
   * os colaboradores — convite único. Diferença: não são co-hosts, não assinam
   * o convite e não têm conta no CRM.
   */
  guestEmails?: string[];
  /**
   * Título/corpo do convite editados à mão na tela de agendamento. Vazios ⇒ a
   * edge function monta o convite pelo template (comportamento padrão); com
   * texto ⇒ é ele que o cliente recebe. Ver migration
   * 20260821120000_add_meeting_invite_override.sql.
   */
  invite_title?: string | null;
  invite_description?: string | null;
}

interface UpdateAgendamentoData {
  id: string;
  leads_id?: string;
  users_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  notes?: string;
  google_meet_link?: string | null;
  status?: string;
  attendees?: string[];
  quantity?: number | null;
}

// Main hook - alias to useAgendamentosSimple for backwards compatibility
export const useAgendamentos = (tenantId?: string) => {
  return useAgendamentosSimple();
};

// Enhanced hook - alias to useAgendamentosSimple for backwards compatibility
export const useAgendamentosEnhanced = () => {
  return useAgendamentosSimple();
};

export const useCriarAgendamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAgendamentoData) => {
      // Combinar date + time e converter para UTC respeitando o fuso local do browser
      const startTimestamp = new Date(`${data.date}T${data.start_time}`).toISOString();
      const endTimestamp   = new Date(`${data.date}T${data.end_time}`).toISOString();

      // R1/R2/R3 ⇒ reunião do fluxo Altiora: altiora_tipo é o que dispara o
      // template de convite do playbook em google-cal-upsert-event. Antes o
      // meeting_type vinha por cast e nem chegava ao insert, então todo convite
      // saía com o texto genérico.
      //
      // R1/R2/R3 NÃO podem ir para meeting_type: o CHECK meetings_meeting_type_check
      // só aceita discovery|demo|closing|consulting|mentoring|qbr|followup|other.
      // Guardamos o equivalente genérico ali (para relatórios que agrupam por
      // meeting_type continuarem funcionando) e o valor Altiora em altiora_tipo.
      const ALTIORA_PARA_MEETING_TYPE: Record<string, string> = {
        R1: 'discovery', // R1 — Reunião de Diagnóstico
        R2: 'demo',      // R2 — Apresentação de Proposta
        R3: 'closing',   // R3 — Fechamento
        EXTRA: 'other',  // Reunião Extra — fora da sequência R1→R2→R3
      };
      const altioraTipo = data.meeting_type && ALTIORA_PARA_MEETING_TYPE[data.meeting_type]
        ? data.meeting_type
        : null;
      const meetingType = altioraTipo
        ? ALTIORA_PARA_MEETING_TYPE[altioraTipo]
        : data.meeting_type || null;

      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          leads_id: data.lead_id || null,
          people_id: data.people_id || null,
          users_id: data.user_id || null,
          date: data.date,
          start_time: startTimestamp,
          end_time: endTimestamp,
          location: data.location || null,
          notes: data.notes || null,
          meeting_type: meetingType,
          altiora_tipo: altioraTipo,
          google_meet_link: data.google_meet_link || null,
          status: data.status || 'agendado',
          title: data.title || 'Reunião',
          invite_title: data.invite_title?.trim() || null,
          invite_description: data.invite_description?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Colaboradores ANTES do GCal: o convite sai uma vez só, já com todos em
      // attendees. Falha aqui não derruba a reunião — o evento ainda é válido
      // com o organizador, e o usuário é avisado pela tela.
      if (data.collaboratorIds?.length) {
        const { error: collabError } = await sbUntyped.from('meeting_collaborators').insert(
          data.collaboratorIds.map((userId) => ({
            meeting_id: meeting.id,
            user_id: userId,
            role: 'co_host',
          })),
        );
        if (collabError) console.warn('[collaborators] insert error:', collabError);
      }

      // Convidados externos — mesma janela (antes do GCal), mesma tolerância a
      // falha. Dedup por e-mail normalizado antes de inserir: o índice único do
      // banco é case-insensitive e recusaria a leva inteira por uma repetição.
      if (data.guestEmails?.length) {
        const seen = new Set<string>();
        const guestRows = data.guestEmails
          .map((e) => e.trim())
          .filter((e) => {
            if (!e) return false;
            const k = e.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((email) => ({ meeting_id: meeting.id, email }));

        if (guestRows.length) {
          const { error: guestError } = await sbUntyped.from('meeting_guests').insert(guestRows);
          if (guestError) console.warn('[guests] insert error:', guestError);
        }
      }

      // Rollback helper — deletes the meeting if GCal confirmation fails
      const rollback = async (reason: string) => {
        await supabase.from('meetings').delete().eq('id', meeting.id);
        const messages: Record<string, string> = {
          no_calendar_connection: 'Reunião não salva — consultor sem Google Calendar conectado. Configure em Integrações.',
          no_consultant: 'Reunião não salva — consultor não definido.',
          token_refresh_failed: 'Reunião não salva — token do Google Calendar expirou. Reconecte em Integrações.',
          create_failed: 'Reunião não salva — Google Calendar rejeitou o evento. Verifique as permissões.',
          meeting_not_found: 'Reunião não salva — erro interno ao sincronizar.',
        };
        throw new Error(messages[reason] ?? `Reunião não salva — Google Calendar não confirmou (${reason}).`);
      };

      // Aguarda confirmação do Google Calendar antes de confirmar o meeting
      let gcalEventId: string | undefined;
      try {
        const { data: gcalData, error: gcalErr } = await supabase.functions
          .invoke('google-cal-upsert-event', { body: { meeting_id: meeting.id, action: 'create' } });

        if (gcalErr) {
          console.warn('[GCal] upsert error:', gcalErr);
          await rollback('create_failed');
        }

        const d = gcalData as { skipped?: boolean; reason?: string; success?: boolean; google_event_id?: string } | null;

        if (d?.skipped) {
          await rollback(d.reason ?? 'create_failed');
        }

        if (!d?.success) {
          await rollback('create_failed');
        }

        gcalEventId = d?.google_event_id;
        console.info('[GCal] evento confirmado:', gcalEventId);
      } catch (err) {
        // rollback já foi feito dentro, só re-lança
        throw err;
      }

      // Audit log (só chega aqui se GCal confirmou)
      await auditLogger.log({
        action: 'meeting_created',
        resource_type: 'meeting',
        resource_id: meeting.id,
        details: {
          lead_id: data.lead_id,
          user_id: data.user_id,
          start_time: startTimestamp,
          end_time: endTimestamp,
          status: data.status || 'agendado',
          google_event_id: gcalEventId,
        }
      });

      return { meeting, gcalEventId, sendConfirmation: data.sendConfirmation };
    },
    onSuccess: ({ meeting, sendConfirmation }) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      toast.success('Reunião agendada e confirmada no Google Calendar!');

      // Microsoft Teams: fire-and-forget (secundário)
      supabase.functions
        .invoke('ms-teams-upsert-event', { body: { meeting_id: meeting.id, action: 'create' } })
        .then(({ data, error }) => {
          if (error) { console.warn('[Teams] upsert error:', error); return; }
          const d = data as { skipped?: boolean; reason?: string; success?: boolean; ms_meeting_id?: string } | null;
          if (d?.skipped) console.info('[Teams] skipped:', d.reason);
          else if (d?.success) {
            console.info('[Teams] synced to Microsoft Teams:', d.ms_meeting_id);
            queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
          }
        })
        .catch((err) => console.warn('[Teams] upsert-event exception:', err));

      // WhatsApp confirmation após GCal (meet link disponível)
      if (sendConfirmation) {
        supabase.functions
          .invoke('send-meeting-confirmation', { body: { meeting_id: meeting.id } })
          .then(({ data: confirmData, error: confirmErr }) => {
            const cd = confirmData as { sent?: boolean; error?: string } | null;
            if (confirmErr) console.warn('[MeetConfirm] error:', confirmErr.message);
            else if (cd?.sent) toast.success('Confirmação enviada por WhatsApp');
            else if (cd?.error) console.warn('[MeetConfirm]', cd.error);
          })
          .catch((err) => console.warn('[MeetConfirm] invoke error:', err));
      }
    },
    onError: (error: Error) => {
      console.error('Error creating meeting:', error);
      toast.error(error.message || 'Erro ao criar reunião.');
    },
  });
};

export const useUpdateAgendamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAgendamentoData) => {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Audit log
      await auditLogger.log({
        action: 'meeting_updated',
        resource_type: 'meeting',
        resource_id: id,
        details: {
          fields_changed: Object.keys(data),
          updates: data
        }
      });
      
      return meeting;
    },
    onSuccess: (meeting, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      const isCancelling = variables.status === 'cancelado';
      toast.success(isCancelling ? 'Reunião cancelada e removida do calendário.' : 'Reunião atualizada com sucesso!');

      // 'cancelado' → remove o evento (dispara e-mail de cancelamento aos convidados via sendUpdates=all).
      // Qualquer outra alteração → PATCH do evento existente (dispara e-mail de atualização).
      const syncAction = isCancelling ? 'delete' : 'update';

      // Sync to Google Calendar (fire-and-forget)
      supabase.functions
        .invoke('google-cal-upsert-event', { body: { meeting_id: meeting.id, action: syncAction } })
        .catch((err) => console.warn(`google-cal-upsert-event (${syncAction}) error:`, err));
      // Sync to Microsoft Teams (fire-and-forget — skips if provider != microsoft)
      supabase.functions
        .invoke('ms-teams-upsert-event', { body: { meeting_id: meeting.id, action: syncAction } })
        .catch((err) => console.warn(`ms-teams-upsert-event (${syncAction}) error:`, err));
      // Trigger meeting follow-ups when status changes (fire-and-forget)
      const meetingRecord = meeting as { id: string; leads_id?: string | null; google_event_id?: string; ms_meeting_id?: string };
      if ('status' in variables && variables.status && meetingRecord.leads_id) {
        supabase.functions
          .invoke('followup-enqueue', {
            body: {
              lead_id:        meetingRecord.leads_id,
              source_type:    'meeting',
              meeting_status: variables.status,
            },
          })
          .then(({ data }) => {
            const enqData = data as { enqueued?: number } | null;
            if (enqData?.enqueued && enqData.enqueued > 0) {
              console.log(`[followup-enqueue] ${enqData.enqueued} follow-up(s) de reunião agendado(s) — status=${variables.status}`);
            }
          })
          .catch((err) => console.warn('[followup-enqueue meeting] erro:', err));
      }
    },
    onError: (error: Error) => {
      console.error('Error updating meeting:', error);
      toast.error(error.message || 'Error updating meeting');
    },
  });
};

export const useDeleteAgendamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get meeting data before deleting (need google_event_id + user_id for calendar sync)
      const { data: meetingToDelete } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      // Sync deletion to Google Calendar / Microsoft Teams before deleting from DB
      if (meetingToDelete?.google_event_id) {
        await supabase.functions
          .invoke('google-cal-upsert-event', { body: { meeting_id: id, action: 'delete' } })
          .catch((err) => console.warn('google-cal-upsert-event (delete) error:', err));
      }
      if ((meetingToDelete as { ms_meeting_id?: string } | null)?.ms_meeting_id) {
        await supabase.functions
          .invoke('ms-teams-upsert-event', { body: { meeting_id: id, action: 'delete' } })
          .catch((err) => console.warn('ms-teams-upsert-event (delete) error:', err));
      }

      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Audit log
      await auditLogger.log({
        action: 'meeting_deleted',
        resource_type: 'meeting',
        resource_id: id,
        details: {
          lead_id: meetingToDelete?.leads_id,
          date: meetingToDelete?.date,
          status: meetingToDelete?.status
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      toast.success('Meeting deleted successfully!');
    },
    onError: (error: Error) => {
      console.error('Error deleting meeting:', error);
      toast.error(error.message || 'Error deleting meeting');
    },
  });
};
