import { Download, ExternalLink, EyeOff, FileText, Image, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntranetItem } from '@/hooks/useIntranet';
import { formatBytes, hostOf } from './types';

interface ItemCardProps {
  item: IntranetItem;
  /** Ações de edição só aparecem para admin. */
  canManage: boolean;
  onEdit: (item: IntranetItem) => void;
  onDelete: (item: IntranetItem) => void;
}

const ItemCard = ({ item, canManage, onEdit, onDelete }: ItemCardProps) => {
  return (
    <div
      className={cn(
        'group bg-card border border-border rounded-sm p-3.5 transition-colors hover:border-primary/40',
        !item.published && 'border-dashed opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate" title={item.title}>
            {item.title}
          </h4>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!item.published && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-[10px] px-1.5 py-0.5"
              title="Rascunho — não visível para o time"
            >
              <EyeOff className="w-3 h-3" /> Rascunho
            </span>
          )}
          {canManage && (
            // Sempre visíveis no touch; o hover só realça no desktop.
            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(item)}
                className="p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Editar item"
                aria-label={`Editar ${item.title}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(item)}
                className="p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                title="Excluir item"
                aria-label={`Excluir ${item.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary bg-primary/10 rounded-[10px] px-2 py-1 hover:bg-primary/20 transition-colors max-w-full"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{hostOf(item.url)}</span>
          </a>
        )}

        {item.attachments.map(att => {
          const Icon = att.is_image ? Image : FileText;
          // Sem signed URL (falha ao assinar) o anexo aparece desabilitado em
          // vez de virar um link morto.
          const disabled = !att.url;

          return (
            <a
              key={att.path}
              href={att.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              download={att.name}
              aria-disabled={disabled}
              onClick={e => { if (disabled) e.preventDefault(); }}
              title={disabled ? 'Link expirado — recarregue a página' : `Baixar ${att.name}`}
              className={cn(
                'inline-flex items-center gap-1.5 text-[11px] text-foreground bg-muted border border-border rounded-[10px] px-2 py-1 transition-colors max-w-full',
                disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent',
              )}
            >
              <Icon className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="truncate max-w-[160px]">{att.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {formatBytes(att.size)}
              </span>
              {!disabled && <Download className="w-3 h-3 shrink-0 text-muted-foreground" />}
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default ItemCard;
