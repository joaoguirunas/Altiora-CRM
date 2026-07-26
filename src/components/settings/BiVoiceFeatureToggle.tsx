/**
 * BiVoiceFeatureToggle — AC5/AC6/AC7/AC8 of BI-VOICE-04
 *
 * Renders a Switch to enable/disable the BI Voice Chat beta flag.
 * - Role-guarded: only gestores / super_adm can toggle (frontend + RLS server-side).
 * - Confirmation dialog on enable (false → true) with Gemini API cost warning.
 * - Reflects DB value on mount; persists via useUpdateSettings.
 */

import { useState, useEffect } from 'react';
import { Mic, AlertTriangle, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BiVoiceFeatureToggle = () => {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { user } = useAuth();

  const isGestor = user?.profile?.gestor === true || user?.profile?.super_adm === true;
  const isPending = updateSettings.isPending;

  const betaEnabled = settings?.bi_voice_chat_beta_enabled ?? false;

  // Pending-confirm state: when user flips false → true, show dialog first
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Keep local optimistic value in sync with DB
  const [localEnabled, setLocalEnabled] = useState(betaEnabled);
  useEffect(() => {
    setLocalEnabled(betaEnabled);
  }, [betaEnabled]);

  const handleToggle = (next: boolean) => {
    if (!isGestor) return;

    if (next && !localEnabled) {
      // Enable path: always show confirmation dialog first
      setConfirmOpen(true);
      return;
    }

    // Disable path: apply immediately
    setLocalEnabled(false);
    updateSettings.mutate(
      { bi_voice_chat_beta_enabled: false },
      {
        onError: () => {
          // Roll back optimistic update on error
          setLocalEnabled(true);
        },
      },
    );
  };

  const handleConfirmEnable = () => {
    setConfirmOpen(false);
    setLocalEnabled(true);
    updateSettings.mutate(
      { bi_voice_chat_beta_enabled: true },
      {
        onSuccess: () => {
          toast.success('BI Voice Chat beta habilitado.');
        },
        onError: () => {
          setLocalEnabled(false);
          toast.error('Não foi possível habilitar o BI Voice Chat. Verifique suas permissões.');
        },
      },
    );
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando…
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 rounded-[6px] border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-3">
          <Mic className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium leading-tight">BI Voice Chat (beta)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Habilita o assistente de voz BI PRO™ powered by Gemini Live.
              {!isGestor && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  Apenas gestores podem alterar.
                </span>
              )}
            </p>
          </div>
        </div>

        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-muted-foreground mt-0.5" />
        ) : (
          <Switch
            checked={localEnabled}
            onCheckedChange={handleToggle}
            disabled={!isGestor || isPending}
            aria-label="Ativar BI Voice Chat beta"
          />
        )}
      </div>

      {/* Cost confirmation dialog — shown only on false → true transition */}
      <Dialog open={confirmOpen} onOpenChange={open => { if (!open) setConfirmOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Habilitar BI Voice Chat
            </DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              Cada minuto de conversa por voz tem custo de uso da{' '}
              <strong className="text-foreground">Gemini API (per-tenant)</strong>.
              Habilite apenas para usuários autorizados.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>O custo é debitado por minuto de áudio entrada + saída.</li>
              <li>Desabilite quando não estiver em uso para evitar custos desnecessários.</li>
              <li>Esta ação é registrada para auditoria.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmEnable}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Habilitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BiVoiceFeatureToggle;
