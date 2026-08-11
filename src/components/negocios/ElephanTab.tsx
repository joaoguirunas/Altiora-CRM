import { useMemo, useState } from 'react';
import {
  AudioLines, Clock, Play, Sparkles, ChevronDown, ChevronUp, ListTree,
  Lightbulb, MessageSquareWarning, ThumbsUp, Bug, Swords, Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useElephanReuniao, type AltioraTipo, type ElephanTipoData } from '@/hooks/useElephanReuniao';
import type { MeetingRecord } from '@/hooks/useMeetingRecords';

const TIPO_CONFIG: Record<AltioraTipo, { label: string; color: string }> = {
  R1: { label: 'R1 — Diagnóstico', color: '#3B82F6' },
  R2: { label: 'R2 — Proposta',    color: '#8B5CF6' },
  R3: { label: 'R3 — Fechamento',  color: '#10B981' },
};

const SENTIMENT_LABELS: Record<string, { label: string; cls: string }> = {
  POSITIVE: { label: 'Positivo', cls: 'bg-emerald-500' },
  NEUTRAL:  { label: 'Neutro',   cls: 'bg-sky-500' },
  NEGATIVE: { label: 'Negativo', cls: 'bg-rose-500' },
  MIXED:    { label: 'Misto',    cls: 'bg-amber-500' },
};

interface ElephanInsight {
  type: string;
  description: string;
  details?: string;
}

const INSIGHT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Lightbulb; cls: string }> = {
  customer_need:    { label: 'Necessidade do cliente', icon: Lightbulb,             cls: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  feature_request:  { label: 'Pedido de funcionalidade', icon: MessageSquareWarning, cls: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
  product_feedback: { label: 'Feedback positivo',       icon: ThumbsUp,             cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  usability_issue:  { label: 'Problema de usabilidade', icon: Bug,                  cls: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  competitive_gap:  { label: 'Gap competitivo',         icon: Swords,               cls: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  other_observation:{ label: 'Observação',              icon: Eye,                  cls: 'text-muted-foreground bg-muted border-border' },
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}min${s > 0 ? ` ${s}s` : ''}`;
};

const formatMs = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Resumo da Elephan chega como HTML simples (<br>) — convertido em parágrafos limpos. */
const parseSummary = (html: string) => {
  const withoutLink = html.replace(/<a[^>]*>.*?<\/a>/gi, '').replace(/por Elephan.*$/i, '');
  return withoutLink
    .split(/<br\s*\/?>\s*<br\s*\/?>/i)
    .map(block => block.replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean);
};

interface SentimentBarProps {
  totalSentiment?: Array<{ sentimental: string; perc: number }>;
}

const SentimentBar = ({ totalSentiment }: SentimentBarProps) => {
  if (!totalSentiment || totalSentiment.length === 0) return null;
  const percByKey = totalSentiment.reduce<Record<string, number>>((acc, s) => {
    acc[s.sentimental] = (acc[s.sentimental] ?? 0) + s.perc;
    return acc;
  }, {});
  const ordered = ['POSITIVE', 'NEUTRAL', 'MIXED', 'NEGATIVE']
    .filter(key => percByKey[key] != null)
    .map(key => ({ sentimental: key, perc: percByKey[key] }));

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sentimento da call</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {ordered.map(s => (
          <div
            key={s.sentimental}
            className={cn('h-full', SENTIMENT_LABELS[s.sentimental]?.cls)}
            style={{ width: `${s.perc}%` }}
            title={`${SENTIMENT_LABELS[s.sentimental]?.label}: ${s.perc}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {ordered.map(s => (
          <span key={s.sentimental} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', SENTIMENT_LABELS[s.sentimental]?.cls)} />
            {SENTIMENT_LABELS[s.sentimental]?.label} · {s.perc}%
          </span>
        ))}
      </div>
    </div>
  );
};

const InsightsSection = ({ insights }: { insights: ElephanInsight[] }) => {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Lightbulb className="h-3 w-3" /> Insights da call
      </p>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const config = INSIGHT_TYPE_CONFIG[insight.type] ?? INSIGHT_TYPE_CONFIG.other_observation;
          const Icon = config.icon;
          return (
            <div key={i} className="rounded-[2px] border border-border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn('inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[10px] font-medium', config.cls)}>
                  <Icon className="h-2.5 w-2.5" /> {config.label}
                </span>
              </div>
              <p className="text-xs font-medium text-foreground">{insight.description}</p>
              {insight.details && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{insight.details}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TranscriptPanel = ({ record }: { record: MeetingRecord }) => {
  const [expanded, setExpanded] = useState(false);
  const speakers = (record.ai_metadata?.speakers ?? null) as
    | Array<{ text: string; start: number; end: number; sentiment?: { Sentiment: string } }>
    | null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
      >
        <ListTree className="h-3 w-3" />
        {expanded ? 'Ocultar transcrição completa' : 'Ver transcrição completa'}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="max-h-96 overflow-y-auto rounded-[2px] border border-border bg-muted/30 p-3">
          {speakers && speakers.length > 0 ? (
            <div className="space-y-2.5">
              {speakers.map((seg, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <span className="w-10 shrink-0 pt-px font-mono text-[10px] text-muted-foreground/60">
                    {formatMs(seg.start)}
                  </span>
                  <span
                    className={cn(
                      'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                      seg.sentiment?.Sentiment ? SENTIMENT_LABELS[seg.sentiment.Sentiment]?.cls : 'bg-muted-foreground/30'
                    )}
                  />
                  <p className="text-muted-foreground">{seg.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{record.content}</p>
          )}
        </div>
      )}
    </div>
  );
};

const ElephanCallCard = ({ data }: { data: ElephanTipoData }) => {
  const { meeting, records } = data;
  const recording = records.find(r => r.record_type === 'recording');
  const transcript = records.find(r => r.record_type === 'transcript');
  const summary = records.find(r => r.record_type === 'ai_summary' || r.record_type === 'summary');
  const sentimentAnalysis = summary?.ai_metadata?.sentimentAnalysis as
    | { totalSentiment?: Array<{ sentimental: string; perc: number }> }
    | undefined;
  const insights = (summary?.ai_metadata?.insights ?? []) as ElephanInsight[];

  const summaryParagraphs = useMemo(
    () => (summary?.content ? parseSummary(summary.content) : []),
    [summary?.content]
  );

  return (
    <div className="space-y-4 rounded-[4px] border border-border bg-card p-4">
      {/* Header estilo Elephan.ai */}
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-violet-500/10">
              <AudioLines className="h-3 w-3 text-violet-500" strokeWidth={2} />
            </span>
            <h3 className="text-[13px] font-medium text-foreground">{meeting.title || 'Reunião gravada'}</h3>
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            {meeting.start_time &&
              new Date(meeting.start_time).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meeting.altiora_duracao_minutos != null && (
            <Badge variant="secondary" className="gap-1 rounded-[2px] text-[11px]">
              <Clock className="h-3 w-3" /> {formatDuration(recording?.duration_seconds ?? meeting.altiora_duracao_minutos * 60)}
            </Badge>
          )}
          <Badge className="rounded-[2px] border-violet-500/20 bg-violet-500/10 text-[11px] text-violet-500 hover:bg-violet-500/10">
            Elephan.ai
          </Badge>
        </div>
      </div>

      {recording?.url && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Play className="h-3 w-3" /> Gravação
          </p>
          <audio controls src={recording.url} className="h-9 w-full" />
        </div>
      )}

      {sentimentAnalysis?.totalSentiment && <SentimentBar totalSentiment={sentimentAnalysis.totalSentiment} />}

      {summaryParagraphs.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Resumo da call
          </p>
          <div className="space-y-2 rounded-[2px] border border-border bg-muted/30 p-3">
            {summaryParagraphs.map((p, i) => (
              <p key={i} className="text-xs leading-relaxed text-muted-foreground">{p}</p>
            ))}
          </div>
        </div>
      )}

      <InsightsSection insights={insights} />

      {transcript && <TranscriptPanel record={transcript} />}
    </div>
  );
};

const EmptyTipo = ({ tipo }: { tipo: AltioraTipo }) => (
  <div className="rounded-[4px] border border-dashed border-border/40 py-10 text-center">
    <AudioLines className="mx-auto mb-2 h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
    <p className="text-[12px] text-muted-foreground/40">Nenhuma call da Elephan.ai vinculada a {tipo} ainda</p>
  </div>
);

interface ElephanTabProps {
  leadId: string;
}

export const ElephanTab = ({ leadId }: ElephanTabProps) => {
  const { data, isLoading } = useElephanReuniao(leadId);
  const [activeTipo, setActiveTipo] = useState<AltioraTipo>('R1');

  const tipos: AltioraTipo[] = ['R1', 'R2', 'R3'];

  return (
    <div className="space-y-4 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Elephan.ai</p>

      {/* Sub-abas R1 / R2 / R3 */}
      <div className="flex gap-1 border-b border-border">
        {tipos.map(tipo => {
          const config = TIPO_CONFIG[tipo];
          const isActive = activeTipo === tipo;
          const hasData = !!data?.[tipo];
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => setActiveTipo(tipo)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] transition-colors',
                isActive
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground/60 hover:text-foreground/80'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.color }} />
              {config.label}
              {hasData && <span className="h-1 w-1 rounded-full bg-violet-500" />}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-[12px] text-muted-foreground/50">Carregando dados da Elephan.ai...</p>
      ) : data?.[activeTipo] ? (
        <ElephanCallCard data={data[activeTipo]!} />
      ) : (
        <EmptyTipo tipo={activeTipo} />
      )}
    </div>
  );
};

export default ElephanTab;
