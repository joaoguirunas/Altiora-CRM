/**
 * useAdmReleases — release catalogue hooks (REL-02)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { type AdmRelease } from '@/hooks/useAdmClients';

/** Latest 20 releases ordered by created_at DESC */
export function useAdmReleases() {
  return useQuery({
    queryKey: ['adm-releases'],
    queryFn: async (): Promise<AdmRelease[]> => {
      const { data, error } = await supabase
        .from('adm_releases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/**
 * Releases between from_version (exclusive) and to_version (inclusive).
 * Used in UpdateClientModal changelog section.
 */
export function useAdmReleasesBetween(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['adm-releases-between', from, to],
    queryFn: async (): Promise<AdmRelease[]> => {
      // Fetch all releases and filter by semver range (simple string comparison for now)
      const { data, error } = await supabase
        .from('adm_releases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const releases = data ?? [];
      if (!to) return releases;

      // Filter: created_at between "after from" and "up to and including to"
      // This is a best-effort based on version ordering since versions are text
      const toIdx = releases.findIndex(r => r.version === to);
      if (toIdx === -1) return releases; // fallback: show all

      const fromIdx = from ? releases.findIndex(r => r.version === from) : releases.length;
      const start = toIdx;
      const end = fromIdx === -1 ? releases.length : fromIdx;

      return releases.slice(start, end);
    },
    enabled: !!to,
    staleTime: 60_000,
  });
}

/** The single latest release — for AC7 notification check */
export function useLatestAdmRelease() {
  return useQuery({
    queryKey: ['adm-releases-latest'],
    queryFn: async (): Promise<AdmRelease | null> => {
      const { data, error } = await supabase
        .from('adm_releases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
