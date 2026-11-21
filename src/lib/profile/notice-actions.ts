"use server";

import { getSessionUser } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Marque comme lus les avis du membre connecté (la RLS limite aux siens). */
export async function markNoticesRead(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("user_notices")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  return { ok: !error };
}
