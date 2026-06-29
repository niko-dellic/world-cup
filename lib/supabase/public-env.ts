export const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabasePublicEnv() {
  return Boolean(publicSupabaseUrl && publicSupabaseAnonKey);
}
