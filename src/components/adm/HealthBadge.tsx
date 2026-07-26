import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface HealthBadgeProps {
  status: HealthStatus;
  dbVersion?: string | null;
  systemVersion?: string | null;
}

const STATUS_CONFIG: Record<HealthStatus, { label: string; className: string }> = {
  healthy:  { label: 'Saudável',   className: 'bg-green-500/10  text-green-600  border-green-500/20'  },
  degraded: { label: 'Degradado',  className: 'bg-amber-500/10  text-amber-600  border-amber-500/20'  },
  down:     { label: 'Offline',    className: 'bg-red-500/10    text-red-600    border-red-500/20'    },
  unknown:  { label: 'Desconhec.', className: 'bg-muted         text-muted-foreground border-border'  },
};

export function HealthBadge({ status, dbVersion, systemVersion }: HealthBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const title = dbVersion && systemVersion
    ? `DB: ${dbVersion} · Sistema: ${systemVersion}`
    : undefined;

  return (
    <Badge
      variant="outline"
      className={cn('rounded-[4px] text-[10px] font-medium cursor-default', cfg.className)}
      title={title}
    >
      {cfg.label}
    </Badge>
  );
}
