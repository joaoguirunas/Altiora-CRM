/**
 * ALTIORA-24: Página de indicadores operacionais do funil Altiora (UC09).
 *
 * Rota: /crm/altiora/indicadores
 * Acesso: Admin e Gestor Comercial; Closers veem apenas seus próprios dados.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Users, Phone, Trophy, XCircle, Calendar,
  TrendingUp, DollarSign, UserCheck, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAltioraClosers } from '@/hooks/useAltioraClosers';
import {
  useAltioraMetrics, getPeriodoRange,
  type Periodo, type PeriodoRange,
} from '@/hooks/useAltioraMetrics';

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
}

const MetricCard = ({ icon: Icon, label, value, sub, colorClass = 'text-foreground/80' }: MetricCardProps) => (
  <div className="bg-card border border-border rounded-[4px] px-5 py-4 flex items-start gap-4">
    <div className="w-9 h-9 rounded-[4px] bg-muted/40 flex items-center justify-center flex-none">
      <Icon className={cn('w-4.5 h-4.5', colorClass)} strokeWidth={1.5} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium mb-0.5">
        {label}
      </p>
      <p className={cn('text-[22px] font-bold leading-tight', colorClass)}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">{sub}</p>
      )}
    </div>
  </div>
);

// ── Currency format ───────────────────────────────────────────────────────────

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ── Origens ───────────────────────────────────────────────────────────────────

const ORIGENS = [
  { value: '', label: 'Todas as origens' },
  { value: 'avenue_email', label: 'Avenue (e-mail)' },
  { value: 'manual',       label: 'Manual' },
  { value: 'indicacao',    label: 'Indicação' },
  { value: 'outros',       label: 'Outros' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const AltioraIndicadores = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isManager, isComercial } = useUserPermissions();

  // AC5: Closer vê apenas seus próprios dados
  const isCloserOnly = isComercial && !isManager;
  const myCloserId = user?.profile?.id ?? '';

  const [periodo, setPeriodo] = useState<Periodo>('mes_atual');
  const [customRange, setCustomRange] = useState<PeriodoRange>({ from: '', to: '' });
  const [selectedCloserId, setSelectedCloserId] = useState<string>(isCloserOnly ? myCloserId : '');
  const [selectedOrigem, setSelectedOrigem] = useState('');

  const { data: closers = [] } = useAltioraClosers();

  const { data: metrics, isLoading, isError } = useAltioraMetrics({
    periodo,
    customRange: periodo === 'custom' ? customRange : undefined,
    closerId: selectedCloserId || undefined,
    origem:   selectedOrigem  || undefined,
  });

  const range = getPeriodoRange(periodo, periodo === 'custom' ? customRange : undefined);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-[4px]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </Button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <h1 className="text-[16px] font-semibold text-foreground/90">
            Indicadores — Altiora
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none px-6 py-3 border-b border-border bg-card/50 flex flex-wrap items-end gap-4">
        {/* Período */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">Período</Label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="h-8 w-[160px] text-[13px] rounded-[4px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana" className="text-[13px]">Semana atual</SelectItem>
              <SelectItem value="mes_atual" className="text-[13px]">Mês atual</SelectItem>
              <SelectItem value="mes_anterior" className="text-[13px]">Mês anterior</SelectItem>
              <SelectItem value="custom" className="text-[13px]">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom range */}
        {periodo === 'custom' && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">De</Label>
              <Input
                type="date"
                value={customRange.from}
                onChange={(e) => setCustomRange(p => ({ ...p, from: e.target.value }))}
                className="h-8 text-[13px] rounded-[4px] w-[140px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">Até</Label>
              <Input
                type="date"
                value={customRange.to}
                onChange={(e) => setCustomRange(p => ({ ...p, to: e.target.value }))}
                className="h-8 text-[13px] rounded-[4px] w-[140px]"
              />
            </div>
          </>
        )}

        {/* Closer filter — apenas Admin/Gestor (AC5) */}
        {!isCloserOnly && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">Closer</Label>
            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger className="h-8 w-[160px] text-[13px] rounded-[4px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-[13px]">Todos os Closers</SelectItem>
                {closers.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Origem */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">Origem</Label>
          <Select value={selectedOrigem} onValueChange={setSelectedOrigem}>
            <SelectTrigger className="h-8 w-[160px] text-[13px] rounded-[4px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {ORIGENS.map(o => (
                <SelectItem key={o.value || '__all'} value={o.value} className="text-[13px]">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period display */}
        <p className="text-[12px] text-muted-foreground/40 ml-auto self-end pb-1">
          {range.from} → {range.to}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted/40 rounded-[4px]" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-[13px] text-red-400/70 py-8 text-center">
            Erro ao carregar indicadores. Tente novamente.
          </p>
        )}

        {/* No data (AC4) */}
        {!isLoading && !isError && metrics && !metrics.hasData && (
          <p className="text-[13px] text-muted-foreground/40 italic py-12 text-center">
            Sem dados para o período selecionado.
          </p>
        )}

        {/* Metrics grid */}
        {!isLoading && !isError && metrics?.hasData && (
          <div className="space-y-6">

            {/* Row 1: Volume */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
                Volume
              </p>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                  icon={Users}
                  label="Referrals recebidos"
                  value={metrics.totalReferrals}
                />
                <MetricCard
                  icon={UserCheck}
                  label="Atribuídos a Closers"
                  value={metrics.totalAtribuidos}
                  sub={`${metrics.totalReferrals > 0 ? Math.round((metrics.totalAtribuidos / metrics.totalReferrals) * 100) : 0}% do total`}
                  colorClass="text-violet-400"
                />
                <MetricCard
                  icon={Phone}
                  label="Contato iniciado"
                  value={metrics.totalContatoIniciado}
                  sub={`${metrics.totalAtribuidos > 0 ? Math.round((metrics.totalContatoIniciado / metrics.totalAtribuidos) * 100) : 0}% dos atribuídos`}
                  colorClass="text-blue-400"
                />
                <MetricCard
                  icon={DollarSign}
                  label="Prêmio (ganhos)"
                  value={formatCurrency(metrics.premioTotal)}
                  sub={`${metrics.totalGanhos} negócios ganhos`}
                  colorClass="text-[#00D26A]"
                />
              </div>
            </div>

            {/* Row 2: Reuniões */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
                Reuniões (AC3 — tempo medido, sem rótulo de SLA)
              </p>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                <MetricCard
                  icon={Calendar}
                  label="R1s agendadas"
                  value={metrics.totalR1}
                  sub={`${metrics.totalR1Compareceu} compareceram · ${metrics.taxaComparecimentoR1}%`}
                  colorClass="text-sky-400"
                />
                <MetricCard
                  icon={Calendar}
                  label="R2s agendadas"
                  value={metrics.totalR2}
                  sub={`${metrics.totalR2Compareceu} compareceram`}
                  colorClass="text-indigo-400"
                />
                <MetricCard
                  icon={Calendar}
                  label="R3s agendadas"
                  value={metrics.totalR3}
                  sub={`${metrics.totalR3Compareceu} compareceram`}
                  colorClass="text-purple-400"
                />
              </div>
            </div>

            {/* Row 3: Resultado */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
                Resultado
              </p>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                <MetricCard
                  icon={Trophy}
                  label="Ganhos"
                  value={metrics.totalGanhos}
                  colorClass="text-[#00D26A]"
                />
                <MetricCard
                  icon={XCircle}
                  label="Perdidos"
                  value={metrics.totalPerdidos}
                  colorClass="text-red-400"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Taxa de conversão"
                  value={`${metrics.totalReferrals > 0 ? Math.round((metrics.totalGanhos / metrics.totalReferrals) * 100) : 0}%`}
                  sub={`${metrics.totalGanhos}/${metrics.totalReferrals} referrals`}
                  colorClass="text-amber-400"
                />
              </div>
            </div>

            {/* Row 4: Top 3 motivos de perda */}
            {metrics.motivosPerdaTop3.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
                  Top 3 motivos de perda
                </p>
                <div className="bg-card border border-border rounded-[4px] overflow-hidden">
                  {metrics.motivosPerdaTop3.map((m, i) => (
                    <div
                      key={m.motivo}
                      className={cn(
                        'flex items-center justify-between px-5 py-3',
                        i < metrics.motivosPerdaTop3.length - 1 && 'border-b border-border',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-muted-foreground/30 w-4">
                          #{i + 1}
                        </span>
                        <span className="text-[13px] text-foreground/80">{m.motivo}</span>
                      </div>
                      <span className="text-[13px] font-semibold text-red-400/80">
                        {m.count}×
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default AltioraIndicadores;
