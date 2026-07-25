/**
 * DriftBadge — REL-03 AC5
 *
 * Shows a red "Drift" alert badge when a client has unresolved schema drift.
 * Uses useAllClientsDrift() — one shared TanStack Query for all rows in the
 * ADM table, avoiding N+1 per-row queries.
 *
 * Clicking opens DriftModal (AC6 — Gamma) directly via local open state.
 * Returns null when the client has no detected drift.
 */
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAllClientsDrift } from '@/hooks/useClientDrift';
import { DriftModal } from './DriftModal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DriftBadgeProps {
  /** ADM client UUID to check in the drift list */
  clientId: string;
  /** Forwarded to DriftModal title — optional */
  clientName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DriftBadge({ clientId, clientName }: DriftBadgeProps) {
  const [open, setOpen] = React.useState(false);
  const { data } = useAllClientsDrift();

  const hasDrift = data?.clientsWithDrift.includes(clientId) ?? false;

  // No drift → render nothing (AC5: only show when drift is detected)
  if (!hasDrift) return null;

  return (
    <>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation(); // prevent parent row click (onViewDetail)
          setOpen(true);
        }}
        className={cn(
          'inline-flex items-center gap-1',
          'rounded-[4px] border px-1.5 py-0.5',
          'text-[10px] font-medium leading-none',
          'bg-red-500/10 text-red-600 border-red-500/20',
          'hover:bg-red-500/20 transition-colors cursor-pointer',
        )}
        title="Schema drift detectado — clique para detalhes"
        aria-label="Schema drift detectado"
      >
        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
        Drift
      </button>

      {/* DriftModal — lazy mount: only rendered when open to avoid unnecessary fetches */}
      {open && (
        <DriftModal
          clientId={clientId}
          clientName={clientName}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
