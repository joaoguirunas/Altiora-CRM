/**
 * ALTIORA-24: Hook de métricas operacionais do funil Altiora.
 *
 * Queries diretas em leads + meetings para V1 (sem RPC).
 * Retorna métricas agregadas por período, Closer e origem.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

// ── Altiora pipeline UUID ─────────────────────────────────────────────────────

const ALTIORA_PIPELINE_ID = 'a1000000-0000-0000-0000-000000000001';

const STAGE_CONTATO_INICIADO = 'a1000000-0000-0000-0001-000000000003';
// All stages from "Contato iniciado" onwards (index 3-13)
const STAGES_APOS_CONTATO = [
  'a1000000-0000-0000-0001-000000000003',
  'a1000000-0000-0000-0001-000000000004',
  'a1000000-0000-0000-0001-000000000005',
  'a1000000-0000-0000-0001-000000000006',
  'a1000000-0000-0000-0001-000000000007',
  'a1000000-0000-0000-0001-000000000008',
  'a1000000-0000-0000-0001-000000000009',
  'a1000000-0000-0000-0001-000000000010',
  'a1000000-0000-0000-0001-000000000011',
  'a1000000-0000-0000-0001-000000000012',
  'a1000000-0000-0000-0001-000000000013',
];

// ── Period helpers ────────────────────────────────────────────────────────────

export type Periodo = 'semana' | 'mes_atual' | 'mes_anterior' | 'custom';

export interface PeriodoRange {
  from: string;  // ISO date string (YYYY-MM-DD)
  to: string;
}

export function getPeriodoRange(periodo: Periodo, custom?: PeriodoRange): PeriodoRange {
  const now = new Date();
  switch (periodo) {
    case 'semana':
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to:   format(now, 'yyyy-MM-dd'),
      };
    case 'mes_atual':
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to:   format(now, 'yyyy-MM-dd'),
      };
    case 'mes_anterior': {
      const prev = subMonths(now, 1);
      return {
        from: format(startOfMonth(prev), 'yyyy-MM-dd'),
        to:   format(endOfMonth(prev),   'yyyy-MM-dd'),
      };
    }
    case 'custom':
      return custom ?? { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AltioraMetrics {
  totalReferrals:       number;
  totalAtribuidos:      number;
  totalContatoIniciado: number;
  totalR1:              number;
  totalR1Compareceu:    number;
  taxaComparecimentoR1: number;  // percentage 0-100
  totalR2:              number;
  totalR2Compareceu:    number;
  totalR3:              number;
  totalR3Compareceu:    number;
  totalGanhos:          number;
  premioTotal:          number;
  totalPerdidos:        number;
  motivosPerdaTop3:     { motivo: string; count: number }[];
  hasData:              boolean;
}

export interface UseAltioraMetricsParams {
  periodo: Periodo;
  customRange?: PeriodoRange;
  closerId?: string;  // '' = todos
  origem?: string;    // '' = todas
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useAltioraMetrics = (params: UseAltioraMetricsParams) => {
  const { periodo, customRange, closerId, origem } = params;
  const range = getPeriodoRange(periodo, customRange);

  return useQuery<AltioraMetrics>({
    queryKey: ['altiora-metrics', periodo, customRange, closerId, origem],
    queryFn: async () => {
      // ── 1. Fetch leads in Altiora pipeline in period ─────────────────────
      let leadsQuery = supabase
        .from('leads')
        .select(`
          id,
          status,
          value,
          altiora_closer_id,
          altiora_origem,
          altiora_motivo_perda,
          leads_stages_id,
          created_at
        `)
        .eq('leads_pipelines_id', ALTIORA_PIPELINE_ID)
        .gte('created_at', `${range.from}T00:00:00`)
        .lte('created_at', `${range.to}T23:59:59`);

      if (closerId) {
        leadsQuery = leadsQuery.eq('altiora_closer_id', closerId);
      }
      if (origem) {
        leadsQuery = leadsQuery.eq('altiora_origem', origem);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw new Error(leadsError.message);

      const leadList = leads ?? [];
      const leadIds = leadList.map(l => l.id);

      if (leadIds.length === 0) {
        return emptyMetrics();
      }

      // ── 2. Fetch meetings for these leads ─────────────────────────────────
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, lead_id, altiora_tipo, altiora_compareceu, status')
        .in('lead_id', leadIds)
        .not('altiora_tipo', 'is', null);

      if (meetingsError) throw new Error(meetingsError.message);

      const meetingList = meetings ?? [];

      // ── 3. Compute metrics ────────────────────────────────────────────────

      const totalReferrals = leadList.length;

      const totalAtribuidos = leadList.filter(l => l.altiora_closer_id).length;

      const totalContatoIniciado = leadList.filter(
        l => STAGES_APOS_CONTATO.includes(l.leads_stages_id ?? ''),
      ).length;

      const r1s = meetingList.filter(m => m.altiora_tipo === 'R1');
      const r2s = meetingList.filter(m => m.altiora_tipo === 'R2');
      const r3s = meetingList.filter(m => m.altiora_tipo === 'R3');

      const totalR1 = r1s.length;
      const totalR1Compareceu = r1s.filter(m => m.altiora_compareceu).length;
      const taxaComparecimentoR1 = totalR1 > 0 ? Math.round((totalR1Compareceu / totalR1) * 100) : 0;

      const totalR2 = r2s.length;
      const totalR2Compareceu = r2s.filter(m => m.altiora_compareceu).length;

      const totalR3 = r3s.length;
      const totalR3Compareceu = r3s.filter(m => m.altiora_compareceu).length;

      const ganhos = leadList.filter(l => l.status === 'won');
      const totalGanhos = ganhos.length;
      const premioTotal = ganhos.reduce((sum, l) => sum + (l.value ?? 0), 0);

      const perdidos = leadList.filter(l => l.status === 'lost');
      const totalPerdidos = perdidos.length;

      // Top 3 motivos de perda
      const motivoCounts: Record<string, number> = {};
      perdidos.forEach(l => {
        const m = (l.altiora_motivo_perda as string | null) ?? 'Não informado';
        motivoCounts[m] = (motivoCounts[m] ?? 0) + 1;
      });
      const motivosPerdaTop3 = Object.entries(motivoCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([motivo, count]) => ({ motivo, count }));

      return {
        totalReferrals,
        totalAtribuidos,
        totalContatoIniciado,
        totalR1,
        totalR1Compareceu,
        taxaComparecimentoR1,
        totalR2,
        totalR2Compareceu,
        totalR3,
        totalR3Compareceu,
        totalGanhos,
        premioTotal,
        totalPerdidos,
        motivosPerdaTop3,
        hasData: true,
      };
    },
    staleTime: 2 * 60 * 1000,  // 2 min
    enabled: true,
  });
};

// ── Helper ────────────────────────────────────────────────────────────────────

function emptyMetrics(): AltioraMetrics {
  return {
    totalReferrals: 0, totalAtribuidos: 0, totalContatoIniciado: 0,
    totalR1: 0, totalR1Compareceu: 0, taxaComparecimentoR1: 0,
    totalR2: 0, totalR2Compareceu: 0,
    totalR3: 0, totalR3Compareceu: 0,
    totalGanhos: 0, premioTotal: 0, totalPerdidos: 0,
    motivosPerdaTop3: [],
    hasData: false,
  };
}
