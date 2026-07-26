/**
 * AdmClientModal — create/edit an ADM client.
 * Uses react-hook-form + Zod. TypeScript strict — no `any`.
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
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
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import {
  type AdmClient,
  useCreateAdmClient,
  useUpdateAdmClient,
} from '@/hooks/useAdmClients';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório (mín. 2 caracteres)'),
  slug: z.string()
    .min(2, 'Slug obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  supabase_url: z.string().url('URL válida obrigatória (https://...)'),
  anon_key: z.string().min(10, 'Chave anon obrigatória'),
  service_role_key: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  notes: z.string().optional(),
  target_version: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdmClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Populated when editing. Null when creating. */
  client: AdmClient | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdmClientModal({ open, onOpenChange, client }: AdmClientModalProps) {
  const isEdit = !!client;
  const { mutate: create, isPending: isCreating } = useCreateAdmClient();
  const { mutate: update, isPending: isUpdating } = useUpdateAdmClient();
  const isPending = isCreating || isUpdating;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      supabase_url: '',
      anon_key: '',
      service_role_key: '',
      contact_name: '',
      contact_email: '',
      notes: '',
      target_version: '',
      status: 'active',
    },
  });

  // Populate form when editing
  React.useEffect(() => {
    if (open && client) {
      form.reset({
        name: client.name,
        slug: client.slug,
        supabase_url: client.supabase_url,
        anon_key: client.anon_key,
        service_role_key: client.service_role_key ?? '',
        contact_name: client.contact_name ?? '',
        contact_email: client.contact_email ?? '',
        notes: client.notes ?? '',
        target_version: client.target_version ?? '',
        status: (client.status as 'active' | 'inactive' | 'suspended') ?? 'active',
      });
    } else if (open && !client) {
      form.reset();
    }
  }, [open, client, form]);

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      supabase_url: values.supabase_url,
      anon_key: values.anon_key,
      service_role_key: values.service_role_key || null,
      contact_name: values.contact_name || null,
      contact_email: values.contact_email || null,
      notes: values.notes || null,
      target_version: values.target_version || null,
      status: values.status,
    };

    if (isEdit && client) {
      update(
        { id: client.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      create(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
            {/* Identification */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Acme Corp" className="h-[32px] text-xs rounded-[4px]" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Slug *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="acme-corp"
                        className="h-[32px] text-xs rounded-[4px] font-mono"
                        disabled={isEdit}
                        onChange={e => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Supabase credentials */}
            <Separator />
            <p className="text-xs font-semibold text-foreground">Credenciais Supabase</p>
            <FormField
              control={form.control}
              name="supabase_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Supabase URL *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://xxxxx.supabase.co"
                      className="h-[32px] text-xs rounded-[4px] font-mono"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="anon_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Anon Key *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="eyJ..."
                        className="h-[32px] text-xs rounded-[4px] font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="service_role_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Service Role Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="eyJ..."
                        className="h-[32px] text-xs rounded-[4px] font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact */}
            <Separator />
            <p className="text-xs font-semibold text-foreground">Contato</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nome do contato</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="João Silva" className="h-[32px] text-xs rounded-[4px]" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">E-mail do contato</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="joao@acme.com" className="h-[32px] text-xs rounded-[4px]" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Status / Version */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-[32px] text-xs rounded-[4px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active" className="text-xs">Ativo</SelectItem>
                        <SelectItem value="inactive" className="text-xs">Inativo</SelectItem>
                        <SelectItem value="suspended" className="text-xs">Suspenso</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Versão alvo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="1.0.0"
                        className="h-[32px] text-xs rounded-[4px] font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Notas internas sobre este cliente..."
                      className="text-xs rounded-[4px] resize-none"
                    />
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
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{isEdit ? 'Salvando...' : 'Criando...'}</>
                  : isEdit ? 'Salvar alterações' : 'Criar cliente'
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
