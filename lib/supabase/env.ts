import {
  hasSupabasePublicEnv,
  publicSupabaseAnonKey,
  publicSupabaseUrl,
} from "@/lib/supabase/public-env";

export const supabaseUrl = publicSupabaseUrl;
export const supabaseAnonKey = publicSupabaseAnonKey;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export { hasSupabasePublicEnv };

export function hasSupabaseAdminEnv() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}
