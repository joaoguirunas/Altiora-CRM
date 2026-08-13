/**
 * Campo de convidados externos por e-mail — o "Adicionar convidados" do Google
 * Meet. Usado nos dois fluxos de criação de reunião (NovaReuniaoWizardModal e
 * AltioraAgendarReuniaoModal), sempre DEPOIS do seletor de time: quem é de casa
 * se escolhe na lista, quem é de fora se digita aqui.
 *
 * Convidado ≠ colaborador. Colaborador é co-host (corresponsável, assina o
 * convite, tem conta no CRM); convidado só entra em attendees[] do evento.
 * Ver migration 20260813180000_create_meeting_guests.sql e ADR-ALTIORA-01.
 */

import { useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Mail, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Não exportado de propósito: exportar não-componente daqui quebra o fast
// refresh do Vite. Se outro módulo precisar validar e-mail, extrair para
// src/utils em vez de exportar deste arquivo.
const isValidGuestEmail = (value: string) => EMAIL_RE.test(value.trim());

/** Normalização usada para dedup — igual à do banco (lower(email)). */
const key = (email: string) => email.trim().toLowerCase();

interface ConvidadosEmailFieldProps {
  /** E-mails já adicionados. O componente não guarda estado próprio da lista. */
  value: string[];
  onChange: (emails: string[]) => void;
  /**
   * E-mails que já participam por outra via (cliente, organizador, colegas
   * selecionados). Digitar um deles não é erro — só não duplica, e o campo
   * avisa por que não adicionou.
   */
  alreadyInvited?: string[];
  label?: string;
  disabled?: boolean;
}

export const ConvidadosEmailField = ({
  value,
  onChange,
  alreadyInvited = [],
  label = 'Convidar por e-mail',
  disabled = false,
}: ConvidadosEmailFieldProps) => {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invitedKeys = new Set(alreadyInvited.map(key));

  /**
   * Tenta adicionar um ou mais e-mails. Aceita lista separada por vírgula,
   * ponto-e-vírgula ou espaço — colar um bloco copiado do Outlook funciona.
   * Devolve true quando consumiu tudo (aí o input é limpo).
   */
  const commit = (raw: string): boolean => {
    const candidates = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!candidates.length) return false;

    const accepted: string[] = [];
    const invalid: string[] = [];
    const duplicated: string[] = [];
    const seen = new Set(value.map(key));

    for (const c of candidates) {
      if (!isValidGuestEmail(c)) { invalid.push(c); continue; }
      const k = key(c);
      if (seen.has(k) || invitedKeys.has(k)) { duplicated.push(c); continue; }
      seen.add(k);
      accepted.push(c.trim());
    }

    if (accepted.length) onChange([...value, ...accepted]);

    if (invalid.length) {
      setError(invalid.length === 1 ? `"${invalid[0]}" não é um e-mail válido.` : `${invalid.length} e-mails inválidos foram ignorados.`);
      // Devolve ao input só o que falhou, para o usuário corrigir sem redigitar.
      setDraft(invalid.join(', '));
      return false;
    }

    setError(duplicated.length ? `${duplicated[0]} já está na reunião.` : null);
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter/vírgula/Tab confirmam o e-mail. Enter é interceptado para não
    // submeter o formulário do modal com o campo ainda preenchido.
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
      if (!draft.trim()) return;
      e.preventDefault();
      if (commit(draft)) setDraft('');
      return;
    }
    // Backspace no campo vazio remove o último chip — comportamento esperado
    // em campos de tag.
    if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[,;\s]/.test(text)) return; // e-mail único: deixa o input tratar
    e.preventDefault();
    if (commit(text)) setDraft('');
  };

  const remove = (email: string) => onChange(value.filter(v => key(v) !== key(email)));

  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5" />
        {label}
      </Label>

      <Input
        type="email"
        value={draft}
        disabled={disabled}
        onChange={e => { setDraft(e.target.value); setError(null); }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        // Confirma o que ficou digitado ao sair do campo: sem isto, quem digita
        // e clica direto em "Agendar" perderia o convidado silenciosamente.
        onBlur={() => { if (draft.trim() && commit(draft)) setDraft(''); }}
        placeholder="nome@empresa.com"
        className={cn('h-9 text-[13px] rounded-[4px]', error && 'border-destructive')}
      />

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map(email => (
            <Badge
              key={key(email)}
              variant="outline"
              className="text-[11px] gap-1 pl-2 pr-1 py-0.5 rounded-[3px] font-normal max-w-full"
            >
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => remove(email)}
                className="hover:text-destructive flex-shrink-0"
                aria-label={`Remover ${email}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/50">
        Enter ou vírgula para adicionar. Recebem o convite do calendário como
        participantes, sem acesso ao CRM.
      </p>
    </div>
  );
};

export default ConvidadosEmailField;
