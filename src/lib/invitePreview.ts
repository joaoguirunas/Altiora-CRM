/**
 * Preview editável do convite de reunião (título + corpo do e-mail).
 *
 * O texto que o cliente recebe é montado no servidor
 * (`google-cal-upsert-event` e irmãs). Para o modal de agendamento poder
 * mostrar esse texto já preenchido — e deixar o closer ajustá-lo —, este
 * módulo reproduz a mesma decisão do servidor:
 *
 *   R1/R2/R3  → template do playbook (`buildAltioraInvite`, importado do
 *               MESMO arquivo que a edge function usa, para não existirem
 *               duas cópias do texto que podem divergir).
 *   demais    → texto genérico "Reunião — <cliente>" / "Agendado via app".
 *
 * Fora daqui ficam, de propósito, as duas coisas que o servidor anexa depois e
 * que o closer não edita: o sufixo `[ref:<meeting_id>]` do título (usado pelo
 * Elephan.ai para casar a gravação com a reunião) e a linha `Link: ...`.
 */

import {
  buildAltioraInvite,
  isAltioraMeetingType,
  type AltioraMeetingType,
} from '../../supabase/functions/_shared/altiora-invite-template';

export interface InvitePreviewInput {
  /** R1/R2/R3 ⇒ template Altiora. Qualquer outro valor ⇒ texto genérico. */
  tipo?: AltioraMeetingType | string | null;
  clientName?: string | null;
  durationMinutes?: number | null;
  /** Nome do organizador (assina o convite). */
  consultorNome?: string | null;
  /** WhatsApp cru do organizador — a formatação é do template. */
  consultorTelefone?: string | null;
  notes?: string | null;
  /** Co-hosts que assinam o convite junto com o organizador. */
  colaboradores?: Array<{ nome: string | null }>;
}

export interface InvitePreview {
  title: string;
  description: string;
}

export function buildInvitePreview(input: InvitePreviewInput): InvitePreview {
  const clientName = (input.clientName ?? '').trim() || 'Cliente';

  if (isAltioraMeetingType(input.tipo)) {
    return buildAltioraInvite({
      tipo: input.tipo,
      clientName,
      // O modal só agenda por Google Meet hoje; Teams/Zoom entram pela mesma
      // coluna de override quando o texto é editado.
      provider: 'Google Meet',
      durationMinutes: input.durationMinutes ?? null,
      consultorNome: input.consultorNome ?? null,
      consultorTelefone: input.consultorTelefone ?? null,
      notes: input.notes ?? null,
      colaboradores: input.colaboradores,
    });
  }

  const notes = (input.notes ?? '').trim();
  return {
    title: `Reunião — ${clientName}`,
    description: notes ? `${notes}\n\nAgendado via app.` : 'Agendado via app.',
  };
}
