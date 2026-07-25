/**
 * DriftBadge — REL-03 AC5
 *
 * Shows a red "Drift" alert badge when a client has unresolved schema drift.
 * Uses useAllClientsDrift() — one shared TanStack Query for all rows in the
 * ADM table, avoiding N+1 per-row queries.
 *
 * Returns null when the client has no detected drift (renders nothing).
 *
 * Integration:
 *   - Pass `onClick` from AdmClientRow → wired to DriftModal (Gamma AC6).
 *   - e.stopPropagation() prevents the row's onViewDetail from firing.
 */
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAllClientsDrift } from '@/hooks/useClientDrift';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DriftBadgeProps {
  /** ADM client UUID to check in the drift list */
  clientId: string;
  /**
   * Optional click handler — wired to DriftModal open state by the parent
   * (AdmClientRow / AdmClientSingle). When not provided, click does nothing
   * (badge is still visually rendered).
   */
  onClick?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DriftBadge({ clientId, onClick }: DriftBadgeProps) {
  const { data } = useAllClientsDrift();

  const hasDrift = data?.clientsWithDrift.includes(clientId) ?? false;

  // No drift → render nothing (AC5: only show when drift is detected)
  if (!hasDrift) return null;

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation(); // prevent parent row click (onViewDetail)
        onClick?.();
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
  );
}
