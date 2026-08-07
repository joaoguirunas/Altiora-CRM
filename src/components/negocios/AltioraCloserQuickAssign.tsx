/**
 * AltioraCloserQuickAssign
 *
 * Botão compacto no card do Kanban (pipeline Altiora) para vincular/alterar o
 * Closer responsável sem abrir a ficha do referral.
 *
 * Visível apenas para Gestor Comercial / Admin (mesma regra do AltioraCloserSelect
 * na NegocioSidebar). Reaproveita useAtribuirCloser — logo mantém o mesmo efeito:
 * atualiza o lead, move de "Novo referral" para "Encaminhado ao comercial",
 * registra a interação e notifica o Closer.
 */

import { useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

interface AltioraCloserQuickAssignProps {
  leadId: string;
  currentCloserId?: string | null;
  /** Nome/avatar já resolvidos pelo card — evita refetch aqui. */
  currentCloserName?: string | null;
  currentCloserAvatarUrl?: string | null;
}

const initialsOf = (name?: string | null) =>
  (name ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const AltioraCloserQuickAssign = ({
  leadId,
  currentCloserId,
  currentCloserName,
  currentCloserAvatarUrl,
}: AltioraCloserQuickAssignProps) => {
  const [open, setOpen] = useState(false);
  const { data: closers = [], isLoading } = useAltioraClosers();
  const atribuirMutation = useAtribuirCloser();
  const { user } = useAuth();

  const handleSelect = (closerId: string, closerName: string) => {
    setOpen(false);
    if (closerId === currentCloserId) return;
    atribuirMutation.mutate({
      leadId,
      closerId,
      closerName,
      actorId: user?.profile?.id,
    });
  };

  const isPending = atribuirMutation.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // o card inteiro navega no click — o botão não deve disparar isso
          onClick={e => e.stopPropagation()}
          disabled={isPending}
          aria-label={currentCloserId ? 'Alterar Closer' : 'Vincular Closer'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border leading-none transition-colors',
            'disabled:opacity-60 disabled:cursor-default',
            currentCloserId
              ? 'pl-0.5 pr-2 py-0.5 text-cyan-700 bg-cyan-500/15 border-cyan-500/30 hover:bg-cyan-500/25 dark:text-cyan-300 dark:bg-cyan-400/15 dark:border-cyan-400/25 dark:hover:bg-cyan-400/25'
              : 'px-2 py-0.5 text-amber-500 bg-amber-400/10 border-amber-400/25 hover:bg-amber-400/20 dark:text-amber-400',
          )}
        >
          {currentCloserId ? (
            <>
              <Avatar className="h-4 w-4">
                <AvatarImage src={currentCloserAvatarUrl || undefined} alt={currentCloserName ?? ''} />
                <AvatarFallback className="bg-cyan-500/25 text-cyan-800 text-[7px] font-bold dark:bg-cyan-400/25 dark:text-cyan-200">
                  {initialsOf(currentCloserName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-medium truncate max-w-[110px]">
                {isPending ? 'Salvando...' : currentCloserName ?? 'Closer'}
              </span>
            </>
          ) : (
            <>
              <UserPlus className="h-2.5 w-2.5" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">
                {isPending ? 'Salvando...' : 'Vincular Closer'}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-60 p-0"
        align="end"
        onClick={e => e.stopPropagation()}
      >
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
