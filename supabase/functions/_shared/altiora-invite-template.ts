/**
 * ALTIORA — Templates de convite de reunião (R1 / R2 / R3)
 *
 * Fonte: "Fluxo Operacional — Da Indicação Avenue até agendamento R1" (slides 8–10),
 * seção "04 | Invite — Template Obrigatório".
 *
 * Usado por google-cal-upsert-event, ms-teams-upsert-event e zoom-upsert-event
 * para que o título e a descrição do convite sejam idênticos nos três provedores.
 *
 * Quando `meetings.altiora_tipo` é NULL (reunião fora do fluxo Altiora), o
 * chamador mantém o texto genérico legado — este módulo devolve `null`.
 */

export type AltioraMeetingType = 'R1' | 'R2' | 'R3';

/** Rótulo do provedor de videoconferência, usado no corpo da descrição. */
export type ConferenceProvider = 'Google Meet' | 'Microsoft Teams' | 'Zoom';

interface InviteCopy {
  /** Prefixo do título, antes de " — [Nome do Cliente]". */
  titulo: string;
  /** Primeiro parágrafo, após "Olá, [Nome do Cliente]. ". */
  objetivo: string;
}

const COPY: Record<AltioraMeetingType, InviteCopy> = {
  R1: {
    titulo: 'Wealth Planning Discovery',
    objetivo:
      'Esta é a nossa primeira conversa — o objetivo é conhecê-lo(a) melhor e entender a sua situação patrimonial.',
  },
  R2: {
    titulo: 'Wealth Planning Presentation',
    objetivo:
      'Nesta reunião, apresentarei uma análise personalizada com base no que foi conversado, além dos caminhos mais adequados para o seu momento.',
  },
  R3: {
    titulo: 'IUL Implementation',
    objetivo:
      'Nesta reunião, vamos alinhar os detalhes finais e os próximos passos para a formalização da estrutura.',
  },
};

export function isAltioraMeetingType(value: unknown): value is AltioraMeetingType {
  return value === 'R1' || value === 'R2' || value === 'R3';
}

/**
 * Formata o WhatsApp do consultor para exibição no convite.
 * Aceita o valor cru de settings_users.whatsapp (com ou sem máscara) e devolve
 * +55 (11) 91234-5678. Se não reconhecer o formato, devolve o valor original
 * apenas com espaços aparados — melhor um telefone "feio" do que nenhum.
 */
export function formatConsultorPhone(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  // 55 + DDD (2) + número (8 ou 9)
  const withCountry = digits.length === 12 || digits.length === 13 ? digits : `55${digits}`;
  const m = withCountry.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return trimmed;

  return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
}

export interface BuildInviteInput {
  tipo: AltioraMeetingType;
  clientName: string;
  provider: ConferenceProvider;
  /** Duração real do evento, em minutos. Ausente ⇒ usa os 40 min do playbook. */
  durationMinutes?: number | null;
  consultorNome?: string | null;
  /** Valor cru de settings_users.whatsapp — a formatação é feita aqui. */
  consultorTelefone?: string | null;
  /** meetings.notes — anexado ao final, quando preenchido. */
  notes?: string | null;
  /** Link da call, quando o provedor não o injeta sozinho na descrição. */
  meetingLink?: string | null;
  /**
   * Colaboradores adicionais da reunião (`meeting_collaborators`), além do
   * organizador (`consultorNome`). Opcional e retrocompatível: ausente/vazio
   * ⇒ assinatura idêntica à de hoje (só `consultorNome`). Usado hoje apenas
   * por `google-cal-upsert-event` (ver ALTIORA-28/29 e ADR-ALTIORA-01) — MS
   * Teams e Zoom seguem chamando `buildAltioraInvite` sem este parâmetro.
   * Sem telefone/WhatsApp por colaborador de propósito (ver ADR-ALTIORA-01):
   * o convite cita nomes, não vira uma lista de contatos.
   */
  colaboradores?: Array<{ nome: string | null }>;
}

export interface InviteContent {
  /** Título SEM o sufixo [ref:<meeting_id>] — quem chama anexa o sufixo. */
  title: string;
  description: string;
}

/**
 * Junta nomes em português com vírgula entre os intermediários e "e" antes
 * do último (ex: "Rafael, André e Bruna"). Devolve string vazia para lista
 * vazia — quem chama decide o fallback nesse caso.
 */
function joinNamesNaturally(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

export function buildAltioraInvite(input: BuildInviteInput): InviteContent {
  const {
    tipo,
    clientName,
    provider,
    durationMinutes,
    consultorNome,
    consultorTelefone,
    notes,
    meetingLink,
    colaboradores,
  } = input;

  const copy = COPY[tipo];
  const cliente = (clientName ?? '').trim() || 'Cliente';

  // O playbook fixa "até 40 minutos", mas se o consultor agendou outra duração
  // o convite não pode contradizer o próprio horário do evento.
  const duracao = durationMinutes && durationMinutes > 0 ? Math.round(durationMinutes) : 40;

  const title = `${copy.titulo} — ${cliente}`;

  const paragraphs: string[] = [
    `Olá, ${cliente}. ${copy.objetivo} A reunião será realizada pelo ${provider}, com duração prevista de até ${duracao} minutos.`,
  ];

  const telefone = formatConsultorPhone(consultorTelefone);
  if (telefone) {
    paragraphs.push(`Em caso de imprevisto, entre em contato pelo WhatsApp: ${telefone}.`);
  }

  // Organizador sempre citado primeiro; colaboradores adicionais (se houver)
  // são citados na sequência, de forma natural ("e" antes do último). Sem
  // colaboradores, o resultado é idêntico ao comportamento legado (só o
  // organizador, ou o fallback genérico quando nem isso existe).
  const assinatura = (consultorNome ?? '').trim();
  const colaboradorNomes = (colaboradores ?? [])
    .map((c) => (c?.nome ?? '').trim())
    .filter(Boolean);
  const nomesAssinatura = [assinatura, ...colaboradorNomes].filter(Boolean);
  const textoAssinatura = joinNamesNaturally(nomesAssinatura);
  paragraphs.push(textoAssinatura ? `${textoAssinatura} — Altiora Advisory Group` : 'Altiora Advisory Group');

  if (notes?.trim()) paragraphs.push(notes.trim());
  if (meetingLink?.trim()) paragraphs.push(`Link: ${meetingLink.trim()}`);

  return { title, description: paragraphs.join('\n\n') };
}
