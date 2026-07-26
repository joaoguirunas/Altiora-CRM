/**
 * pipelineLabels.ts
 *
 * Centraliza a lógica de terminologia por pipeline.
 * No pipeline Altiora, "Negócio" é substituído por "Referral" na UI.
 *
 * Uso:
 *   const label = getEntityLabel(pipeline.name); // "Referral" ou "Negócio"
 *   const plural = getEntityLabelPlural(pipeline.name); // "Referrals" ou "Negócios"
 */

/** Padrão (case-insensitive) para identificar o pipeline Altiora pelo nome. */
export const ALTIORA_PIPELINE_NAME_PATTERN = 'altiora';

/**
 * Retorna `true` se o nome do pipeline corresponde ao pipeline Altiora.
 * A verificação é case-insensitive para evitar problemas de capitalização.
 */
export function isAltioraPipeline(pipelineName: string): boolean {
  return pipelineName.toLowerCase().includes(ALTIORA_PIPELINE_NAME_PATTERN);
}

/**
 * Retorna o label singular da entidade de acordo com o pipeline.
 * - Pipeline Altiora → "Referral"
 * - Demais pipelines → "Negócio"
 *
 * @param pipelineName - nome do pipeline selecionado (string vazia = não-Altiora)
 */
export function getEntityLabel(pipelineName: string): string {
  return isAltioraPipeline(pipelineName) ? 'Referral' : 'Negócio';
}

/**
 * Retorna o label plural da entidade de acordo com o pipeline.
 * - Pipeline Altiora → "Referrals"
 * - Demais pipelines → "Negócios"
 *
 * @param pipelineName - nome do pipeline selecionado
 */
export function getEntityLabelPlural(pipelineName: string): string {
  return isAltioraPipeline(pipelineName) ? 'Referrals' : 'Negócios';
}
