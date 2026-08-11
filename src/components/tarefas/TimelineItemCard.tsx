import { useRef } from 'react';
import { Check, ExternalLink, Paperclip, RotateCw, Trash2, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KIND_LABEL, KIND_STYLES, type TimelineItem } from './types';

interface TimelineItemCardProps {
  item: TimelineItem;
  onToggle: (item: TimelineItem) => void;
  onAttach: (item: TimelineItem, files: File[]) => void;
  onDelete: (item: TimelineItem) => void;
  onUpdateMeetingStatus: (item: TimelineItem) => void;
  onOpenLead: (leadId: string) => void;
}

const ACCEPT = 'image/*,.pdf,.doc,.docx';

const TimelineItemCard = ({
  item,
  onToggle,
  onAttach,
  onDelete,
  onUpdateMeetingStatus,
  onOpenLead,
}: TimelineItemCardProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styles = KIND_STYLES[item.kind];
  const isMeeting = item.kind === 'reuniao';
  const leadId = item.meeting?.negocio?.id;
  const attachments = item.task?.attachments ?? [];

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onAttach(item, files);
    e.target.value = '';
  };

  return (
    <div
      className={cn(
        'group relative flex gap-3.5 bg-card border border-border rounded-[14px] pl-4 pr-4 py-3.5 transition-colors hover:bg-muted/40',
        item.done && 'opacity-55',
      )}
    >
      {/* Faixa lateral por tipo (border-left do mock) */}
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[14px]', styles.bar)} />

      <div className="w-14 shrink-0 pt-px font-mono text-[13px] text-muted-foreground tabular-nums">
        {item.time ?? '—'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-[10px] border', styles.badge)}>
            {KIND_LABEL[item.kind]}
          </span>
          <span className={cn('text-sm font-medium text-foreground', item.done && 'line-through text-muted-foreground')}>
            {item.title}
          </span>
        </div>

        {item.subtitle && (
          <p className="mt-1 text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}

        {attachments.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {attachments.map(att => (
              <a
                key={att.path}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'flex items-center gap-1.5 bg-muted border border-border rounded-[10px] py-0.5 pr-2',
                  att.is_image && att.url ? 'pl-0.5' : 'pl-2',
                  att.url ? 'hover:bg-accent' : 'pointer-events-none opacity-60',
                )}
                title={att.name}
              >
                {att.is_image && att.url ? (
                  <img src={att.url} alt="" className="w-5 h-5 object-cover rounded-[7px]" />
                ) : (
                  <Paperclip className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-[11px] text-foreground max-w-[110px] truncate">{att.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isMeeting ? (
          <>
            {leadId && (
              <button
                onClick={() => onOpenLead(leadId)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[11px] font-medium text-muted-foreground border border-border hover:bg-muted transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3 h-3" /> Ver lead
              </button>
            )}
            {item.meeting?.google_meet_link && (
              <a
                href={item.meeting.google_meet_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[11px] font-medium text-[hsl(var(--stats-primary-text))] bg-[hsl(var(--stats-primary))] border border-[hsl(var(--stats-primary-border))] hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                <Video className="w-3 h-3" /> Link da reunião
              </a>
            )}
            <button
              onClick={() => onUpdateMeetingStatus(item)}
              title={
                item.needsStatusUpdate
                  ? 'Reunião encerrada há mais de 10min sem status atualizado'
                  : 'Atualizar status da reunião'
              }
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[11px] font-medium border transition-colors whitespace-nowrap',
                item.needsStatusUpdate
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 animate-pulse'
                  : 'text-muted-foreground border-border hover:bg-muted',
              )}
            >
              <RotateCw className="w-3 h-3" /> Atualizar status
            </button>
          </>
        ) : (
          <>
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
              title="Anexar arquivo"
              className="w-7 h-7 flex items-center justify-center rounded-[10px] bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(item)}
              title="Excluir tarefa"
              className="w-7 h-7 flex items-center justify-center rounded-[10px] bg-muted border border-border text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggle(item)}
              title={item.done ? 'Reabrir tarefa' : 'Marcar como concluída'}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                item.done
                  ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]'
                  : 'bg-muted border border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TimelineItemCard;
