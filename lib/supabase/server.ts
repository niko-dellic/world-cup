import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hasSupabaseAdminEnv,
  hasSupabasePublicEnv,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "@/lib/supabase/env";

export async function createServerSupabaseClient() {
  if (!hasSupabasePublicEnv()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always set cookies; route handlers can.
        }
      },
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (!hasSupabaseAdminEnv()) return null;
  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabasePublicServerClient(): SupabaseClient | null {
  if (!hasSupabasePublicEnv()) return null;
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseReadClient(): SupabaseClient | null {
  return createSupabaseAdminClient() ?? createSupabasePublicServerClient();
}
