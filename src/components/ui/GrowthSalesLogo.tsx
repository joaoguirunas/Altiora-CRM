import { cn } from '@/lib/utils';

// Diamond logo mark extracted from logo-vertical.svg (path 1)
const ICON_PATH =
  'M753.957 74.9443L765.473 55L789.168 96.043L802.473 73L973.946 370H631L641.393 352H594L604.97 333H560L731.473 36L753.957 74.9443Z' +
  'M794.364 105.043L936.945 352H651.784L646.588 361H958.357L802.473 91L794.364 105.043Z' +
  'M575.588 324H610.166L748.761 83.9443L731.473 54L575.588 324Z' +
  'M677 310H853L765 157L677 310Z';

export function GSSymbol({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="550 25 440 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block flex-shrink-0', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={ICON_PATH} fill="hsl(var(--primary))" />
    </svg>
  );
}

export function GSLockup({
  symbolSize = 28,
  textSize = 13,
  className,
}: {
  symbolSize?: number;
  textSize?: number;
  className?: string;
}) {
  const dotSize = Math.max(5, Math.round(symbolSize * 0.18));

  return (
    <span className={cn('inline-flex flex-col select-none', className)} style={{ gap: 4 }}>
      {/* Wordmark row: "Altiora" + gold dot */}
      <span className="inline-flex items-end" style={{ gap: 5 }}>
        <span
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: symbolSize,
            fontWeight: 300,
            letterSpacing: '-0.01em',
            color: 'hsl(var(--foreground))',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Altiora
        </span>
        <span
          style={{
            width: dotSize,
            height: dotSize,
            background: 'hsl(var(--gold, var(--primary)))',
            marginBottom: 3,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
      </span>

      {/* Tagline */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: Math.max(8, Math.round(textSize * 0.82)),
          fontWeight: 600,
          letterSpacing: '0.18em',
          color: 'hsl(var(--primary))',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        Advisory CRM
      </span>

      {/* Underline */}
      <span
        style={{
          width: 40,
          height: 2,
          background: 'hsl(var(--primary))',
          display: 'block',
          marginTop: 1,
        }}
      />
    </span>
  );
}
