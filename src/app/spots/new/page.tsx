import type { Metadata } from "next";
import { Suspense } from "react";
import { SupabasePublishFlow } from "@/components/publish/supabase-publish-flow";
import { tp } from "@/i18n/publish.fr";
import { requireProfile } from "@/lib/auth/server";
import { DEFAULT_EDIT_RADIUS_M } from "@/lib/publish/contract";
import type { LatLng } from "@/lib/publish/geo";
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

  const [rule, home] = await Promise.all([
    supabase.from("scoring_rules").select("value").eq("key", "edit_radius_m").maybeSingle<{ value: number }>(),
    // Domicile de l'utilisateur lui-même (déjà arrondi à ~1 km) : centre de la carte sans GPS.
    supabase.rpc("get_my_home"),
  ]);

  const radius = Number(rule.data?.value);
  const homeRow = Array.isArray(home.data) ? (home.data[0] as { lat: number; lng: number } | undefined) : undefined;
  const fallbackCenter: LatLng | null = homeRow ? { lat: homeRow.lat, lng: homeRow.lng } : null;

  return (
    <SupabasePublishFlow
      userId={user.id}
      editRadius={Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_EDIT_RADIUS_M}
      fallbackCenter={fallbackCenter}
    />
  );
}
