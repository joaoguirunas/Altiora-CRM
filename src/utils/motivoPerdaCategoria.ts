/**
 * motivoPerdaCategoria.ts
 *
 * Mapeia a etapa atual do referral Altiora para a categoria de motivo de
 * perda correta, já que o mesmo botão "Marcar como Perdido" precisa
 * mostrar listas diferentes dependendo de quando a perda acontece:
 *
 *   pre_venda   — antes de qualquer reunião existir (Novo referral → R1 agendada)
 *   reprovacao  — logo após a R1, mesmo com comparecimento (R1 realizada, Análise Finvity)
 *   pos_r2      — processo avançou mas não fechou (R2 agendada em diante, até Em contratação)
 *
 * Pipelines não-Altiora e etapas fora dessas faixas retornam `null` — nesse
 * caso a lista de motivos usada é a genérica (category IS NULL em leads_loss_reasons).
 */

export type MotivoPerdaCategoria = 'pre_venda' | 'reprovacao' | 'pos_r2';

const PRE_VENDA_STAGES = ['Novo referral', 'Encaminhado ao comercial', 'Contato iniciado', 'R1 agendada'];
const REPROVACAO_STAGES = ['R1 realizada', 'Análise Finvity'];
const POS_R2_STAGES = [
  'R2 agendada',
  'R2 realizada',
  'R3 agendada',
  'R3 realizada / fechamento',
  'Em contratação',
];

/** Retorna a categoria de motivo de perda para a etapa informada, ou `null` se não mapeada. */
export function getMotivoPerdaCategoria(stageName: string | null | undefined): MotivoPerdaCategoria | null {
  if (!stageName) return null;
  const nome = stageName.trim();
  if (PRE_VENDA_STAGES.includes(nome)) return 'pre_venda';
  if (REPROVACAO_STAGES.includes(nome)) return 'reprovacao';
  if (POS_R2_STAGES.includes(nome)) return 'pos_r2';
  return null;
}
