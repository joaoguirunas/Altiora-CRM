/**
 * Nomes das reuniões do fluxo Altiora, para exibição na interface.
 *
 * FONTE DE VERDADE: `supabase/functions/_shared/altiora-invite-template.ts`
 * (constante `COPY`), que é o que vai para o título do convite no Google
 * Calendar, MS Teams e Zoom. Os nomes aqui são um espelho dela — o cliente vê
 * "Wealth Planning Discovery" no convite, então o time tem de ver o mesmo nome
 * no CRM. Ao mexer em um, mexer no outro.
 *
 * Não é import direto porque o template roda em Deno (edge functions) e este
 * módulo no bundle do Vite; duplicar 3 strings é mais barato do que compartilhar
 * build entre os dois runtimes.
 *
 * `R1`/`R2`/`R3` continuam sendo a chave em `meetings.altiora_tipo` e nos nomes
 * das etapas do pipeline ("R1 agendada", "R1 realizada"). O código curto é
 * identificador interno — não aparece mais na interface.
 */

export type AltioraTipoReuniao = 'R1' | 'R2' | 'R3';

export const ALTIORA_TIPOS: AltioraTipoReuniao[] = ['R1', 'R2', 'R3'];

/** Nome idêntico ao que o cliente recebe no título do convite. */
export const ALTIORA_REUNIAO_NOME: Record<AltioraTipoReuniao, string> = {
  R1: 'Wealth Planning Discovery',
  R2: 'Wealth Planning Presentation',
  R3: 'IUL Implementation',
};

/**
 * Versão curta para onde o nome completo não cabe — chip do card de pipeline,
 * sub-abas, coluna estreita de tabela. Deriva do nome completo, sem inventar
 * terminologia nova: mantém a palavra que distingue as três reuniões.
 */
export const ALTIORA_REUNIAO_NOME_CURTO: Record<AltioraTipoReuniao, string> = {
  R1: 'Discovery',
  R2: 'Presentation',
  R3: 'Implementation',
};

/** Cor de identificação da reunião, consistente entre badge, card e aba. */
export const ALTIORA_REUNIAO_COR: Record<AltioraTipoReuniao, string> = {
  R1: '#3B82F6',
  R2: '#8B5CF6',
  R3: '#10B981',
};

export const isAltioraTipoReuniao = (v: unknown): v is AltioraTipoReuniao =>
  v === 'R1' || v === 'R2' || v === 'R3';

/**
 * Nome para exibição a partir de um `altiora_tipo` cru do banco. Valor
 * inesperado volta como veio, em vez de sumir da tela.
 */
export const nomeReuniao = (tipo: string | null | undefined): string =>
  isAltioraTipoReuniao(tipo) ? ALTIORA_REUNIAO_NOME[tipo] : (tipo ?? 'Reunião');

export const nomeReuniaoCurto = (tipo: string | null | undefined): string =>
  isAltioraTipoReuniao(tipo) ? ALTIORA_REUNIAO_NOME_CURTO[tipo] : (tipo ?? 'Reunião');
