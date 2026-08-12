import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true when Supabase is not configured — app runs with local demo data */
export const isDemoMode = !url || !key;

export let supabase: SupabaseClient | null = null;

if (!isDemoMode) {
  supabase = createClient(url!, key!);
}
