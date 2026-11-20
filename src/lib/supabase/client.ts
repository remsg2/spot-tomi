"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/env/client";

let client: SupabaseClient | undefined;

/** Client Supabase du navigateur, configuré au runtime (jamais au build). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseKey } = getClientEnv();
    client = createBrowserClient(supabaseUrl, supabaseKey);
  }
  return client;
}
