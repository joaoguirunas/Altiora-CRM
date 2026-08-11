import {
  BookOpen, FileText, Link2, GraduationCap, Scale, Megaphone, Wrench,
  Users, ShieldCheck, PlayCircle, Folder,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ícones oferecidos ao admin na criação de categoria. A chave é o que vai para
 * `intranet_categories.icon`; a coluna é text livre, então um ícone removido
 * daqui cai no fallback (Folder) em vez de quebrar a página.
 */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  'book-open':       { icon: BookOpen,       label: 'Treinamentos' },
  'graduation-cap':  { icon: GraduationCap,  label: 'Capacitação' },
  'play-circle':     { icon: PlayCircle,     label: 'Vídeos' },
  'file-text':       { icon: FileText,       label: 'Documentos' },
  'scale':           { icon: Scale,          label: 'Jurídico' },
  'link':            { icon: Link2,          label: 'Links úteis' },
  'megaphone':       { icon: Megaphone,      label: 'Marketing' },
  'wrench':          { icon: Wrench,         label: 'Ferramentas' },
  'users':           { icon: Users,          label: 'Pessoas' },
  'shield-check':    { icon: ShieldCheck,    label: 'Compliance' },
  'folder':          { icon: Folder,         label: 'Geral' },
};

export const DEFAULT_CATEGORY_ICON = 'folder';

export const resolveCategoryIcon = (key: string | null): LucideIcon =>
  (key && CATEGORY_ICONS[key]?.icon) || Folder;

/** Tipos aceitos pelo bucket `intranet-files` (ver migration). */
export const ACCEPT_FILES =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,video/mp4,video/webm';

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB — igual ao file_size_limit do bucket

export const formatBytes = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Host de uma URL para exibir sob o título ("drive.google.com"). */
export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
