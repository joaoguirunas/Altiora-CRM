import type { AgendamentoSimple } from '@/hooks/useAgendamentosSimple';
import type { UserTask } from '@/hooks/useUserTasks';

/**
 * Item unificado da timeline de Tarefas: reuniões vindas da Agenda (`meetings`)
 * e tarefas pessoais (`user_tasks`) convivem na mesma lista, ordenados por horário.
 */
export type TimelineKind = 'reuniao' | 'equipe' | 'propria';

export interface TimelineItem {
  /** Único dentro da timeline — prefixado por origem para não colidir entre tabelas. */
  key: string;
  kind: TimelineKind;
  /** YYYY-MM-DD (fuso local). */
  date: string;
  /** HH:MM, ou null para tarefa sem horário. */
  time: string | null;
  title: string;
  subtitle: string;
  done: boolean;
  /** Reunião encerrada há +10min e ainda sem status atualizado (linguagem visual da Agenda). */
  needsStatusUpdate: boolean;
  meeting?: AgendamentoSimple;
  task?: UserTask;
}

export const KIND_LABEL: Record<TimelineKind, string> = {
  reuniao: 'Reunião',
  equipe: 'Equipe',
  propria: 'Minha tarefa',
};

/** Faixa lateral + badge. Cores do mock mapeadas para tokens do design system. */
export const KIND_STYLES: Record<TimelineKind, { bar: string; badge: string }> = {
  reuniao: {
    bar: 'bg-[hsl(var(--stats-primary-border))]',
    badge: 'text-[hsl(var(--stats-primary-text))] bg-[hsl(var(--stats-primary))] border-[hsl(var(--stats-primary-border))]',
  },
  equipe: {
    bar: 'bg-[hsl(var(--stats-tertiary-border))]',
    badge: 'text-[hsl(var(--stats-tertiary-text))] bg-[hsl(var(--stats-tertiary))] border-[hsl(var(--stats-tertiary-border))]',
  },
  propria: {
    bar: 'bg-muted-foreground/40',
    badge: 'text-muted-foreground bg-muted border-border',
  },
};
