import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const CONTROL_PLANE_URL = "https://dtsmbqrzyxhjjjvpjfjd.supabase.co";
export const CONTROL_PLANE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0c21icXJ6eXhoampqdnBqZmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTE1NDMsImV4cCI6MjEwMDUyNzU0M30.upczKLGDYdq5ZE2xrwXxCX8nSwHWWoCmxeb-dlscDYk";

export const supabaseUrl = CONTROL_PLANE_URL;
export const supabaseAnonKey = CONTROL_PLANE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
