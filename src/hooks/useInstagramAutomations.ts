import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TriggerType = 'incoming_dm' | 'post_comment' | 'story_mention' | 'story_reply';
export type ActionType  = 'send_dm' | 'reply_comment' | 'reply_and_dm';
export type FilterOp    = 'any' | 'all';
export type FilterType  = 'always' | 'is_first_contact' | 'message_contains' | 'message_not_contains';

export interface AutomationFilter {
  type: FilterType;
  value?: string;
}

export interface QuickReply {
  title: string;
}

export interface InstagramAutomation {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  target_post_id: string | null;
  filter_operator: FilterOp;
  filters: AutomationFilter[];
  action_type: ActionType;
  action_dm_text: string | null;
  action_dm_quick_replies: QuickReply[];
  action_comment_text: string | null;
  action_comment_texts: string[];
  cooldown_hours: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface InstagramAutomationLog {
  id: string;
  automation_id: string | null;
  automation_name: string | null;
  trigger_type: string | null;
  person_id: string | null;
  person_name: string | null;
  ig_message_id: string | null;
  message_text: string | null;
  filters_matched: string[] | null;
  action_executed: string | null;
  status: 'success' | 'failed' | 'skipped' | 'cooldown';
  error_message: string | null;
  executed_at: string;
}

export type AutomationUpsert = Omit<InstagramAutomation, 'id' | 'created_at' | 'updated_at'>;

// ── Queries ───────────────────────────────────────────────────────────────────

const QK = 'instagram_automations';
const QK_LOG = 'instagram_automation_log';

export function useInstagramAutomations() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_automations')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InstagramAutomation[];
    },
  });
}

export function useInstagramAutomationLog(
  automationId?: string | null,
  limit = 50,
  responsavelId?: string,
) {
  return useQuery({
    queryKey: [QK_LOG, automationId ?? 'all', responsavelId ?? 'all'],
    queryFn: async () => {
      // Restrict to people assigned to this user via leads.user_id
      let allowedPeopleIds: string[] | null = null;
      if (responsavelId) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('people_id')
          .eq('user_id', responsavelId)
          .not('people_id', 'is', null);
        allowedPeopleIds = [...new Set((leadsData ?? []).map((l: { people_id: string }) => l.people_id))];
        if (allowedPeopleIds.length === 0) return [] as InstagramAutomationLog[];
      }

      let q = supabase
        .from('instagram_automation_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(limit);
      if (automationId) q = q.eq('automation_id', automationId);
      if (allowedPeopleIds) q = (q as any).in('person_id', allowedPeopleIds);
      const { data, error } = await q;
      if (error) throw error;
      return data as InstagramAutomationLog[];
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateInstagramAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AutomationUpsert) => {
      const { data, error } = await supabase
        .from('instagram_automations')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as InstagramAutomation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateInstagramAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InstagramAutomation> & { id: string }) => {
      const { data, error } = await supabase
        .from('instagram_automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as InstagramAutomation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteInstagramAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instagram_automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

// ── Instagram Posts (for PostPicker) ─────────────────────────────────────────

export interface InstagramPost {
  id: string;
  thumbnail_url: string | null;
  media_url: string | null;
  caption: string | null;
  timestamp: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  media_product_type: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  no_instagram_config: 'Instagram não está ligado',
  invalid_token: 'Token Instagram expirou — reconecte em Configurações',
};

function toReadableError(err: unknown): string {
  const code = (err as { error?: string })?.error;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  const msg = (err as { message?: string })?.message;
  if (msg) return msg;
  return 'Não foi possível carregar posts';
}

export function useInstagramPosts(enabled: boolean) {
  return useQuery({
    queryKey: ['instagram-posts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('instagram-posts-list');
      if (error) throw error;
      if (data?.error) throw data;
      return (data?.posts ?? []) as InstagramPost[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
    select: (posts) => posts,
    meta: { toReadableError },
  });
}

// ── Aggregates (daily) ─────────────────────────────────────────────────────

export interface InstagramLogAggregates {
  commentsReceived: number;
  success: number;
  skipped: number;
  cooldown: number;
}

export function useInstagramLogAggregates() {
  return useQuery({
    queryKey: [QK_LOG, 'daily-aggregates'],
    queryFn: async (): Promise<InstagramLogAggregates> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const iso = todayStart.toISOString();

      const [countRes, logRes] = await Promise.all([
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('message_type', 'comentario')
          .eq('from_contact', 'cliente')
          .gte('created_at', iso),
        supabase
          .from('instagram_automation_log')
          .select('status')
          .eq('trigger_type', 'post_comment')
          .gte('executed_at', iso),
      ]);

      const logs = logRes.data ?? [];
      return {
        commentsReceived: countRes.count ?? 0,
        success:  logs.filter(l => l.status === 'success').length,
        skipped:  logs.filter(l => l.status === 'skipped').length,
        cooldown: logs.filter(l => l.status === 'cooldown').length,
      };
    },
    staleTime: 60 * 1000,
  });
}

// ── Unmatched comments (AC3) ───────────────────────────────────────────────

export interface UnmatchedComment {
  id: number;
  ig_message_id: string | null;
  message_text: string;
  created_at: string;
}

export function useInstagramUnmatchedComments(
  automationId: string,
  targetPostId: string | null,
) {
  return useQuery({
    queryKey: [QK_LOG, 'unmatched', automationId, targetPostId ?? 'all'],
    queryFn: async (): Promise<UnmatchedComment[]> => {
      let q = supabase
        .from('messages')
        .select('id, ig_message_id, content, created_at, media_metadata')
        .eq('message_type', 'comentario')
        .eq('from_contact', 'cliente')
        .order('created_at', { ascending: false })
        .limit(20);

      if (targetPostId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = (q as any).eq('media_metadata->>post_id', targetPostId);
      }

      const { data: msgs, error: msgsErr } = await q;
      if (msgsErr) throw msgsErr;
      if (!msgs || msgs.length === 0) return [];

      const igIds = (msgs as { ig_message_id: string | null }[])
        .map(m => m.ig_message_id)
        .filter(Boolean) as string[];

      if (igIds.length === 0) return [];

      const { data: matched } = await supabase
        .from('instagram_automation_log')
        .select('ig_message_id')
        .eq('automation_id', automationId)
        .in('ig_message_id', igIds);

      const matchedSet = new Set((matched ?? []).map(l => l.ig_message_id));

      return (msgs as { id: number; ig_message_id: string | null; content: string; created_at: string }[])
        .filter(m => !matchedSet.has(m.ig_message_id))
        .slice(0, 5)
        .map(m => ({
          id:            m.id,
          ig_message_id: m.ig_message_id,
          message_text:  m.content,
          created_at:    m.created_at,
        }));
    },
    enabled: !!automationId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Subscription check (AC5) ───────────────────────────────────────────────

/** Returns true = comments subscribed, false = not subscribed, null = unknown/unavailable */
export function useInstagramCommentSubscribed() {
  return useQuery({
    queryKey: ['instagram-comment-subscribed'],
    queryFn: async (): Promise<boolean | null> => {
      // omni_channel_configs is not in generated types — use sbUntyped pattern
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cfg } = await (supabase as any)
        .from('omni_channel_configs')
        .select('credentials')
        .eq('channel', 'instagram')
        .maybeSingle();

      if (!cfg?.credentials) return null;
      const creds = cfg.credentials as Record<string, string>;
      const { access_token, page_id } = creds;
      if (!access_token || !page_id) return null;

      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `https://graph.facebook.com/v25.0/${page_id}?fields=subscribed_apps%7Bsubscribed_fields%7D&access_token=${encodeURIComponent(access_token)}`,
          { signal: controller.signal },
        );
        clearTimeout(tid);
        if (!res.ok) return null;
        const json = await res.json() as {
          subscribed_apps?: { data?: { subscribed_fields?: string[] }[] };
          error?: unknown;
        };
        if (json.error) return null;
        const apps = json.subscribed_apps?.data ?? [];
        return apps.some(app => app.subscribed_fields?.includes('comments'));
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
