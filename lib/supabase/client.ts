"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasSupabasePublicEnv,
  publicSupabaseAnonKey,
  publicSupabaseUrl,
} from "@/lib/supabase/public-env";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return hasSupabasePublicEnv();
}

export function getBrowserSupabaseClient() {
  if (!hasSupabasePublicEnv()) return null;
  browserClient ??= createBrowserClient(publicSupabaseUrl!, publicSupabaseAnonKey!);
  return browserClient;
}
