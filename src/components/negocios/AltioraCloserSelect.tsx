/**
 * ALTIORA-07 — AltioraCloserSelect
 *
 * Campo "Closer responsável" para a ficha do referral Altiora.
 * Exibido na NegocioSidebar quando o pipeline é o Pipeline Altiora.
 *
 * AC2: Gestor Comercial vê select de Closers ativos.
 *      Ao salvar: atualiza lead, move etapa, registra interação, notifica Closer.
 */

import { useState } from 'react';
import { Check, ChevronDown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAltioraClosers, useAtribuirCloser } from '@/hooks/useAltioraClosers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AltioraCloserSelectProps {
  leadId: string;
  currentCloserId?: string | null;
  currentCloserName?: string | null;
  /** Apenas Gestor Comercial e Admin podem atribuir */
  canEdit?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AltioraCloserSelect = ({
  leadId,
  currentCloserId,
  currentCloserName,
  canEdit = false,
}: AltioraCloserSelectProps) => {
  const [open, setOpen] = useState(false);
  const { data: closers = [], isLoading } = useAltioraClosers();
  const atribuirMutation = useAtribuirCloser();
  const { user } = useAuth();

  // Resolve actorId (settings_users.id do usuário autenticado)
  const resolveActorId = async (): Promise<string | undefined> => {
    if (!user?.id) return undefined;
    const { data } = await supabase
      .from('settings_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    return data?.id ?? undefined;
  };

  const handleSelect = async (closerId: string, closerName: string) => {
    setOpen(false);
    if (closerId === currentCloserId) return;

    const actorId = await resolveActorId();
    atribuirMutation.mutate({ leadId, closerId, closerName, actorId });
  };

  const selectedCloser = closers.find(c => c.id === currentCloserId);
  const displayName = selectedCloser?.name ?? currentCloserName ?? null;

  // ── Leitura apenas ────────────────────────────────────────────────────────
  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-foreground">
        <User className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        <span className={cn(!displayName && 'text-muted-foreground/40 italic')}>
          {displayName ?? 'Nenhum Closer atribuído'}
        </span>
      </div>
    );
  }

  // ── Edição ────────────────────────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={atribuirMutation.isPending || isLoading}
          className="w-full justify-between h-8 text-[13px] font-normal rounded-[4px]"
        >
          <span className="flex items-center gap-2 truncate">
            <User className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className={cn('truncate', !displayName && 'text-muted-foreground/40 italic')}>
              {atribuirMutation.isPending
                ? 'Salvando...'
                : displayName ?? 'Selecionar Closer'}
            </span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar Closer..." className="h-9 text-[13px]" />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Carregando...' : 'Nenhum Closer encontrado.'}
            </CommandEmpty>
            <CommandGroup>
              {closers.map(closer => (
                <CommandItem
                  key={closer.id}
                  value={closer.name}
                  onSelect={() => handleSelect(closer.id, closer.name)}
                  className="text-[13px] cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-3.5 w-3.5',
                      closer.id === currentCloserId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{closer.name}</span>
                    {closer.email && (
                      <span className="text-[11px] text-muted-foreground/50">{closer.email}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
