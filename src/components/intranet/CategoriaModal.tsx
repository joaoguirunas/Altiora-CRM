import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CategoryInput, IntranetCategory } from '@/hooks/useIntranet';
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from './types';

interface CategoriaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categoria em edição; null cria uma nova. */
  category: IntranetCategory | null;
  onSave: (input: CategoryInput) => Promise<unknown>;
}

const CategoriaModal = ({ open, onOpenChange, category, onSave }: CategoriaModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [saving, setSaving] = useState(false);

  // Reabrir carrega os dados da categoria em edição (ou limpa, se for nova).
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setIcon(category?.icon ?? DEFAULT_CATEGORY_ICON);
  }, [open, category]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ name, description, icon });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-outfit text-base">
            {category ? 'Editar categoria' : 'Nova categoria'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className="text-xs text-muted-foreground">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="Ex: Treinamentos"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc" className="text-xs text-muted-foreground">
              Descrição <span className="opacity-60">(opcional)</span>
            </Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Uma linha explicando o que fica nesta seção"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  title={label}
                  aria-label={label}
                  aria-pressed={icon === key}
                  className={cn(
                    'h-9 w-9 flex items-center justify-center rounded-sm border transition-colors',
                    icon === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoriaModal;
