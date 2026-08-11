import { useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadTaskAttachments, type TaskAttachment } from '@/hooks/useUserTasks';

export interface AssignableUser {
  id: string;
  nome: string;
}

interface NovaTarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Data pré-preenchida (o dia que está sendo visualizado), YYYY-MM-DD. */
  defaultDate: string;
  userId: string | null;
  /** Admin/gestor pode atribuir a outra pessoa; demais usuários só criam para si. */
  canAssign?: boolean;
  assignableUsers?: AssignableUser[];
  onSave: (input: {
    title: string;
    due_date: string;
    due_time: string | null;
    attachments: TaskAttachment[];
    assigned_to: string;
  }) => Promise<unknown>;
}

const ACCEPT = 'image/*,.pdf,.doc,.docx';

const NovaTarefaModal = ({
  open,
  onOpenChange,
  defaultDate,
  userId,
  canAssign = false,
  assignableUsers = [],
  onSave,
}: NovaTarefaModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [assignedTo, setAssignedTo] = useState(userId ?? '');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reabrir o modal deve sempre partir de um formulário limpo, na data em foco.
  useEffect(() => {
    if (open) {
      setTitle('');
      setDate(defaultDate);
      setTime('09:00');
      setAssignedTo(userId ?? '');
      setAttachments([]);
    }
  }, [open, defaultDate, userId]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !userId) return;

    setUploading(true);
    try {
      const novos = await uploadTaskAttachments(files, userId);
      setAttachments(prev => [...prev, ...novos]);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (path: string) => {
    setAttachments(prev => prev.filter(a => a.path !== path));
  };

  const handleSave = async () => {
    if (!title.trim() || saving || !assignedTo) return;
    setSaving(true);
    try {
      await onSave({
        title,
        due_date: date,
        due_time: time || null,
        attachments,
        assigned_to: assignedTo,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-[18px]">
        <DialogHeader>
          <DialogTitle className="font-outfit text-base">Nova tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs text-muted-foreground">Título</Label>
            <Input
              className="rounded-[10px]"
              id="task-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="Ex: Enviar proposta para cliente"
              autoFocus
            />
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="task-date" className="text-xs text-muted-foreground">Data</Label>
              <Input className="rounded-[10px]" id="task-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="task-time" className="text-xs text-muted-foreground">Horário</Label>
              <Input className="rounded-[10px]" id="task-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          {canAssign && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Atribuir a</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="rounded-[10px]">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.id === userId ? `${u.nome} (você)` : u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Anexos</Label>
            <div className="flex gap-1.5 flex-wrap">
              {attachments.map(att => (
                <span
                  key={att.path}
                  className="inline-flex items-center gap-1.5 bg-muted border border-border rounded-[10px] pl-2 pr-1 py-0.5"
                >
                  <span className="text-[11px] text-foreground max-w-[100px] truncate" title={att.name}>
                    {att.name}
                  </span>
                  <button
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
                accept={ACCEPT}
                className="hidden"
                onChange={handleFiles}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !userId}
                className="inline-flex items-center gap-1.5 text-[11px] text-primary border border-dashed border-primary/40 rounded-[10px] px-2.5 py-1.5 hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-3 h-3" />
                {uploading ? 'Enviando…' : 'Anexar arquivo ou foto'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" className="rounded-[10px]" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-[10px]" onClick={handleSave} disabled={!title.trim() || saving || uploading || !assignedTo}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovaTarefaModal;
