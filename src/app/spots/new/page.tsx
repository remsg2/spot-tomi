import type { Metadata } from "next";
import { Suspense } from "react";
import { SupabasePublishFlow } from "@/components/publish/supabase-publish-flow";
import { tp } from "@/i18n/publish.fr";
import { requireProfile } from "@/lib/auth/server";
import { DEFAULT_COMMENT_MAX, DEFAULT_EDIT_RADIUS_M } from "@/lib/publish/contract";
import { toEditionOptions } from "@/lib/editions";
import { getPublicEnv } from "@/lib/env/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: tp.metaTitle };

/** Ajout d'un sticker (maquettes « Ajout d'un sticker » puis « Sticker collé »). Réservé aux connectés (proxy.ts). */
export default function NewSpotPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <Suspense fallback={<p className="m-auto p-8 text-sm font-semibold text-muted">{tp.loading}</p>}>
        <NewSpot />
      </Suspense>
    </main>
  );
}

async function NewSpot() {
  const { user } = await requireProfile("/spots/new");
  const supabase = await getSupabaseServerClient();

  const [rules, editions, { supabaseUrl }] = await Promise.all([
    supabase
      .from("scoring_rules")
      .select("key, value")
      .in("key", ["edit_radius_m", "comment_max_length"])
      .returns<Array<{ key: string; value: number }>>(),
    supabase.rpc("list_editions"),
    getPublicEnv(),
  ]);

  const rule = (key: string) => Number(rules.data?.find((row) => row.key === key)?.value);
  const radius = rule("edit_radius_m");
  const commentMax = rule("comment_max_length");

  return (
    <SupabasePublishFlow
      userId={user.id}
      editRadius={Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_EDIT_RADIUS_M}
      commentMax={Number.isFinite(commentMax) && commentMax > 0 ? commentMax : DEFAULT_COMMENT_MAX}
      editions={toEditionOptions(editions.data, supabaseUrl)}
    />
  );
}
