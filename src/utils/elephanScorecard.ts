/**
 * Score card da Elephan.ai — leitura e normalização.
 *
 * A Elephan aplica um `prompt` (playbook) à call e devolve uma resposta por
 * pergunta. Isso chega no webhook desde sempre, dentro de `answers[]`, e é
 * gravado em `meeting_records.ai_metadata.scorecard`.
 *
 * ESPELHO: `buildScorecard` em supabase/functions/elephan-inbound/index.ts é a
 * mesma lógica, do lado do webhook (auto-match). Este módulo cobre o vínculo
 * manual de pendências e a leitura na UI. Mesmo motivo da duplicação do template
 * de convite: um roda em Deno, o outro no bundle do Vite. Mexeu em um, mexa no
 * outro — em especial na regra da média (ver `scoreAverage` abaixo).
 */

export interface ElephanAnswer {
  questionId?: string;
  question?: string;
  /** Nota 0–10 nas perguntas de pontuação. */
  score?: number;
  yesNo?: 'yes' | 'no' | string;
  /** Perguntas abertas — nos payloads observados até hoje vêm sem resposta. */
  answer?: string;
  text?: string;
}

export interface ElephanScorecardStats {
  total: number;
  scoreCount: number;
  /** Quantas notas vieram 0 e ficaram fora da média — ver `scoreAverage`. */
  scoreZero: number;
  scoreAverage: number | null;
  yesCount: number;
  noCount: number;
  openCount: number;
  openAnswered: number;
}

export interface ElephanScorecard {
  prompt: { id?: string; name?: string; type?: string } | null;
  answers: ElephanAnswer[];
  stats: ElephanScorecardStats;
}

/** Formato de uma linha para renderização, já classificada. */
export type ScorecardRow =
  | { kind: 'score'; question: string; value: number; questionId?: string }
  | { kind: 'yesNo'; question: string; value: boolean; questionId?: string }
  | { kind: 'open'; question: string; value: string | null; questionId?: string };

export const isScoreAnswer = (a: ElephanAnswer) => typeof a.score === 'number';
export const isYesNoAnswer = (a: ElephanAnswer) => a.yesNo === 'yes' || a.yesNo === 'no';

/**
 * Constrói o score card a partir do array cru de respostas.
 *
 * `scoreAverage` IGNORA notas 0. Nos payloads reais, 0 aparece em perguntas que
 * não se aplicaram àquela call — contá-las derrubaria a nota de forma enganosa.
 * `scoreZero` fica exposto para a UI declarar quantas ficaram de fora, em vez de
 * esconder a decisão. Se a Elephan confirmar que 0 é nota real, trocar o filtro
 * aqui e no espelho da edge function.
 */
export function buildScorecard(
  answers: ElephanAnswer[] | null | undefined,
  prompt: ElephanScorecard['prompt'] = null,
): ElephanScorecard | null {
  if (!Array.isArray(answers) || answers.length === 0) return null;

  const scores = answers.filter(isScoreAnswer).map(a => a.score as number);
  const scored = scores.filter(s => s > 0);
  const yesNo = answers.filter(isYesNoAnswer);
  const open = answers.filter(a => !isScoreAnswer(a) && !isYesNoAnswer(a));

  return {
    prompt,
    answers,
    stats: {
      total: answers.length,
      scoreCount: scores.length,
      scoreZero: scores.length - scored.length,
      scoreAverage: scored.length
        ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
        : null,
      yesCount: yesNo.filter(a => a.yesNo === 'yes').length,
      noCount: yesNo.filter(a => a.yesNo === 'no').length,
      openCount: open.length,
      openAnswered: open.filter(a => !!(a.answer ?? a.text)).length,
    },
  };
}

/**
 * Lê o score card de um `meeting_records.ai_metadata`. Tolerante de propósito:
 * registros gravados antes desta feature não têm a chave, e o vínculo manual
 * antigo também não — nesses casos devolve null e a UI mostra o estado vazio.
 */
export function readScorecard(
  aiMetadata: Record<string, unknown> | null | undefined,
): ElephanScorecard | null {
  const raw = (aiMetadata as { scorecard?: unknown } | null | undefined)?.scorecard;
  if (!raw || typeof raw !== 'object') return null;
  const sc = raw as Partial<ElephanScorecard>;
  if (!Array.isArray(sc.answers) || sc.answers.length === 0) return null;

  // Recalcula stats se vierem ausentes (registro gravado por versão anterior
  // do normalizador) — assim a UI nunca depende de stats que podem faltar.
  return sc.stats
    ? (sc as ElephanScorecard)
    : buildScorecard(sc.answers, sc.prompt ?? null);
}

/** Classifica as respostas para renderização, preservando a ordem original. */
export function toRows(scorecard: ElephanScorecard): ScorecardRow[] {
  return scorecard.answers.map((a): ScorecardRow => {
    const question = a.question ?? 'Pergunta sem enunciado';
    if (isScoreAnswer(a)) {
      return { kind: 'score', question, value: a.score as number, questionId: a.questionId };
    }
    if (isYesNoAnswer(a)) {
      return { kind: 'yesNo', question, value: a.yesNo === 'yes', questionId: a.questionId };
    }
    return { kind: 'open', question, value: (a.answer ?? a.text) || null, questionId: a.questionId };
  });
}

/**
 * Valor para a coluna `meeting_records.ai_score`, que é INTEGER — 8.7 seria
 * rejeitado pelo Postgres (22P02) e derrubaria o insert inteiro do registro.
 * A média exata continua em `scorecard.stats.scoreAverage`, que é o que a UI
 * mostra; a coluna serve para ordenação e para o ScoreGauge do MeetingRecordCard,
 * onde inteiro basta.
 */
export const toAiScoreColumn = (average: number | null | undefined): number | null =>
  typeof average === 'number' ? Math.round(average) : null;

/** Cor da nota — verde ≥8, âmbar ≥5, vermelho abaixo. 0 é "sem nota", não péssimo. */
export function scoreColor(value: number): string {
  if (value <= 0) return 'text-muted-foreground/40';
  if (value >= 8) return 'text-emerald-500';
  if (value >= 5) return 'text-amber-500';
  return 'text-rose-500';
}
