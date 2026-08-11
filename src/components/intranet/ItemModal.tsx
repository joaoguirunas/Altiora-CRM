import { useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  normalizeUrl, uploadIntranetFiles,
  type IntranetAttachment, type IntranetCategory, type IntranetItem, type ItemInput,
} from '@/hooks/useIntranet';
import { ACCEPT_FILES, MAX_FILE_BYTES, formatBytes } from './types';

interface ItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Item em edição; null cria um novo. */
  item: IntranetItem | null;
  /** Categoria pré-selecionada ao criar (a seção onde o admin clicou). */
  defaultCategoryId: string | null;
  categories: IntranetCategory[];
  onSave: (input: Omit<ItemInput, 'category_id'> & { category_id: string }) => Promise<unknown>;
}

const ItemModal = ({
  open, onOpenChange, item, defaultCategoryId, categories, onSave,
}: ItemModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [attachments, setAttachments] = useState<IntranetAttachment[]>([]);
  const [published, setPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryId(item?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '');
    setTitle(item?.title ?? '');
    setDescription(item?.description ?? '');
    setUrl(item?.url ?? '');
    setAttachments(item?.attachments ?? []);
    setPublished(item?.published ?? true);
  }, [open, item, defaultCategoryId, categories]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;

    // O bucket rejeita acima do limite com um erro genérico — avisamos antes de subir.
    const tooBig = picked.filter(f => f.size > MAX_FILE_BYTES);
    tooBig.forEach(f => toast.error(`"${f.name}" passa de ${formatBytes(MAX_FILE_BYTES)}`));

    const files = picked.filter(f => f.size <= MAX_FILE_BYTES);
    if (!files.length) return;

    setUploading(true);
    try {
      const novos = await uploadIntranetFiles(files);
      setAttachments(prev => [...prev, ...novos]);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (path: string) => {
    // Só remove da lista local: o arquivo no bucket vira órfão se o admin
    // cancelar, o que é inofensivo e evita apagar anexo de item já salvo.
    setAttachments(prev => prev.filter(a => a.path !== path));
  };

  // Espelha o CHECK do banco: item precisa de link OU anexo para levar a algum lugar.
  const hasContent = !!url.trim() || attachments.length > 0;
  const canSave = !!title.trim() && !!categoryId && hasContent && !saving && !uploading;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        category_id: categoryId,
        title,
        description,
        url: normalizeUrl(url),
        attachments,
        published,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-outfit text-base">
            {item ? 'Editar item' : 'Novo item'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="item-title" className="text-xs text-muted-foreground">Título</Label>
            <Input
              id="item-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Modelo de contrato — pessoa física"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc" className="text-xs text-muted-foreground">
              Descrição <span className="opacity-60">(opcional)</span>
            </Label>
            <Textarea
              id="item-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Quando usar, o que o time precisa saber"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-url" className="text-xs text-muted-foreground">Link</Label>
            <Input
              id="item-url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="drive.google.com/..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Anexos</Label>
            <div className="flex gap-1.5 flex-wrap">
              {attachments.map(att => (
                <span
                  key={att.path}
                  className="inline-flex items-center gap-1.5 bg-muted border border-border rounded-[10px] pl-2 pr-1 py-0.5"
                >
                  <span className="text-[11px] text-foreground max-w-[140px] truncate" title={att.name}>
                    {att.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatBytes(att.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.path)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remover anexo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_FILES}
                className="hidden"
                onChange={handleFiles}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-[11px] text-primary border border-dashed border-primary/40 rounded-[10px] px-2.5 py-1.5 hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-3 h-3" />
                {uploading ? 'Enviando…' : 'Anexar arquivo'}
              </button>
            </div>
            {!hasContent && (
              <p className="text-[11px] text-muted-foreground">
                Informe um link, um anexo, ou os dois.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <Label htmlFor="item-published" className="text-xs text-foreground">Publicado</Label>
              <p className="text-[11px] text-muted-foreground">
                {published ? 'Visível para todo o time' : 'Rascunho — só você vê'}
              </p>
            </div>
            <Switch id="item-published" checked={published} onCheckedChange={setPublished} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ItemModal;
