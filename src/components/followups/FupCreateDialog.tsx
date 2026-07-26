/**
 * FupCreateDialog — FUP-AUTO-01 UI-1
 * Form for admin to manually create a FUP via agendar_fup() RPC.
 * Campos condicionais por tipo: etapa_crm → etapa_id; agendamento → titulo+mensagem; programado → template_id ou mensagem.
 */
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useCreateFupProgramado,
  type FupTipo,
  type CreateFupParams,
} from '@/hooks/useFupProgramados';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadOption {
  id: string;
  title: string | null;
  personName: string | null;
}

// ─── Lead search hook (local) ─────────────────────────────────────────────────

function useLeadSearch(query: string) {
  return useQuery({
    queryKey: ['lead-search', query],
    queryFn: async (): Promise<LeadOption[]> => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('id, title, clients_people!people_id(name)')
        .ilike('title', `%${query}%`)
        .limit(8);
      if (error) throw error;
      return (data ?? []).map(row => ({
        id: row.id,
        title: row.title,
        personName: (row.clients_people as { name?: string } | null)?.name ?? null,
      }));
    },
    enabled: query.trim().length > 1,
    staleTime: 10_000,
  });
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  lead_id: z.string().uuid('Selecione um negócio válido'),
  tipo: z.enum(['etapa_crm', 'agendamento', 'programado'] as const),
  scheduled_at: z.string().min(1, 'Data/hora obrigatória'),
  etapa_id: z.string().uuid().optional().or(z.literal('')),
  template_id: z.string().optional(),
  mensagem: z.string().optional(),
  agendamento_titulo: z.string().optional(),
  motivo: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'etapa_crm' && !data.etapa_id) {
    ctx.addIssue({ code: 'custom', path: ['etapa_id'], message: 'Etapa obrigatória para tipo Mover Etapa' });
  }
  if (data.tipo === 'programado' && !data.template_id && !data.mensagem) {
    ctx.addIssue({ code: 'custom', path: ['mensagem'], message: 'Template ou mensagem obrigatório para tipo WhatsApp' });
  }
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface FupCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optionally pre-fill a lead */
  initialLeadId?: string;
  initialLeadTitle?: string;
}

export function FupCreateDialog({ open, onOpenChange, initialLeadId, initialLeadTitle }: FupCreateDialogProps) {
  const [leadSearch, setLeadSearch] = React.useState('');
  const [selectedLead, setSelectedLead] = React.useState<LeadOption | null>(
    initialLeadId ? { id: initialLeadId, title: initialLeadTitle ?? null, personName: null } : null
  );
  const [showLeadDropdown, setShowLeadDropdown] = React.useState(false);

  const { data: leadOptions = [], isFetching: searchingLeads } = useLeadSearch(leadSearch);
  const { mutate: createFup, isPending } = useCreateFupProgramado();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      lead_id: initialLeadId ?? '',
      tipo: 'programado',
      scheduled_at: '',
      etapa_id: '',
      template_id: '',
      mensagem: '',
      agendamento_titulo: '',
      motivo: '',
    },
  });

  const tipo = form.watch('tipo');

  // Reset on open
  React.useEffect(() => {
    if (open) {
      form.reset({
        lead_id: initialLeadId ?? '',
        tipo: 'programado',
        scheduled_at: '',
        etapa_id: '',
        template_id: '',
        mensagem: '',
        agendamento_titulo: '',
        motivo: '',
      });
      setLeadSearch('');
      setSelectedLead(initialLeadId
        ? { id: initialLeadId, title: initialLeadTitle ?? null, personName: null }
        : null
      );
    }
  }, [open, initialLeadId, initialLeadTitle, form]);

  const handleLeadSelect = (lead: LeadOption) => {
    setSelectedLead(lead);
    setLeadSearch('');
    setShowLeadDropdown(false);
    form.setValue('lead_id', lead.id, { shouldValidate: true });
  };

  const onSubmit = (values: FormValues) => {
    const params: CreateFupParams = {
      lead_id: values.lead_id,
      tipo: values.tipo,
      scheduled_at: new Date(values.scheduled_at).toISOString(),
      etapa_id: values.etapa_id || null,
      template_id: values.template_id || null,
      mensagem: values.mensagem || null,
      agendamento_titulo: values.agendamento_titulo || null,
      motivo: values.motivo || null,
    };
    createFup(params, { onSuccess: () => onOpenChange(false) });
  };

  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 1);
  const minDateStr = minDateTime.toISOString().slice(0, 16);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar FUP Programado</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">

            {/* Lead search */}
            <FormField
              control={form.control}
              name="lead_id"
              render={({ fieldState }) => (
                <FormItem>
                  <FormLabel className="text-xs">Negócio *</FormLabel>
                  {selectedLead ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-xs border border-border rounded-[4px] px-3 py-2 bg-muted/30">
                        <span className="font-medium">{selectedLead.title ?? selectedLead.id}</span>
                        {selectedLead.personName && (
                          <span className="text-muted-foreground ml-1">— {selectedLead.personName}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-[32px] text-xs"
                        onClick={() => { setSelectedLead(null); form.setValue('lead_id', ''); }}
                      >
                        Trocar
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={leadSearch}
                          onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true); }}
                          onFocus={() => setShowLeadDropdown(true)}
                          onBlur={() => setTimeout(() => setShowLeadDropdown(false), 150)}
                          placeholder="Buscar negócio por título..."
                          className="pl-8 h-[32px] text-xs rounded-[4px]"
                        />
                        {searchingLeads && (
                          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {showLeadDropdown && leadOptions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 border border-border bg-popover rounded-[4px] shadow-md max-h-48 overflow-y-auto">
                          {leadOptions.map(lead => (
                            <button
                              key={lead.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                              onMouseDown={() => handleLeadSelect(lead)}
                            >
                              <span className="font-medium">{lead.title ?? lead.id}</span>
                              {lead.personName && (
                                <span className="text-muted-foreground ml-1">— {lead.personName}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {fieldState.error && (
                    <p className="text-[10px] text-destructive">{fieldState.error.message}</p>
                  )}
                </FormItem>
              )}
            />

            {/* Tipo */}
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Tipo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-[32px] text-xs rounded-[4px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="programado"  className="text-xs">📱 WhatsApp (programado)</SelectItem>
                      <SelectItem value="agendamento" className="text-xs">📅 Reunião (agendamento)</SelectItem>
                      <SelectItem value="etapa_crm"   className="text-xs">🔄 Mover Etapa CRM</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Scheduled at */}
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Data/hora agendada *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="datetime-local"
                      min={minDateStr}
                      className="h-[32px] text-xs rounded-[4px]"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Conditional: tipo=etapa_crm → etapa_id */}
            {tipo === 'etapa_crm' && (
              <FormField
                control={form.control}
                name="etapa_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">ID da Etapa *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="UUID da etapa destino"
                        className="h-[32px] text-xs rounded-[4px] font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            )}

            {/* Conditional: tipo=agendamento → titulo + mensagem */}
            {tipo === 'agendamento' && (
              <>
                <FormField
                  control={form.control}
                  name="agendamento_titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Título da reunião</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Reunião de follow-up" className="h-[32px] text-xs rounded-[4px]" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mensagem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Mensagem</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="Mensagem para o lead..." className="text-xs rounded-[4px] resize-none" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Conditional: tipo=programado → template_id or mensagem */}
            {tipo === 'programado' && (
              <>
                <FormField
                  control={form.control}
                  name="template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Template ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ID do template WhatsApp (opcional)" className="h-[32px] text-xs rounded-[4px] font-mono" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mensagem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Mensagem *</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="Mensagem personalizada (se sem template)..." className="text-xs rounded-[4px] resize-none" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Motivo (all types) */}
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Motivo (contexto)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Contexto para o agente ou operador..." className="h-[32px] text-xs rounded-[4px]" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[30px] rounded-[4px] text-xs"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-[30px] rounded-[4px] text-xs"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Criando...</>
                  : 'Criar FUP'
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
