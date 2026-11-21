import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EditionsManager } from "@/components/admin/editions-manager";
import { ModerationList } from "@/components/admin/moderation-list";
import { SeasonEditor } from "@/components/admin/season-editor";
import { smallTitle } from "@/components/admin/styles";
import { ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { getEditions, getMissingSeasonYears, getModerationQueue, getSeasons } from "@/lib/admin/data";
import { getPublicEnv } from "@/lib/env/server";
import { applySeasonAction, moderateSpotAction, saveEditionAction, setExceptionalAction, setRarityAction } from "../actions";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.season };

/** Onglet Éditions (admin) : couleur de l'édition en cours (maquette Admin), puis toutes les éditions. */
export default function SeasonPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <SeasonContent />
    </Suspense>
  );
}

async function SeasonContent() {
  await requireStaff("admin", "/admin/season");
  const [seasons, missingYears, queue, editions, { supabaseUrl }] = await Promise.all([
    getSeasons(),
    getMissingSeasonYears(),
    getModerationQueue(),
    getEditions(),
    getPublicEnv(),
  ]);
  const current = seasons.find((season) => season.is_current) ?? null;
  // Rendu à la requête (après lecture de la session) : l'année civile est celle du jour.
  const initialYear = current?.year ?? new Date().getFullYear();
  const todo = queue.filter((entry) => entry.status !== "hidden");

  return (
    <>
      <SeasonEditor
        seasons={seasons}
        missingYears={missingYears}
        initialYear={initialYear}
        currentYear={current?.year ?? null}
        action={applySeasonAction}
      />

      <EditionsManager editions={editions} action={saveEditionAction} supabaseUrl={supabaseUrl} />

      {todo.length > 0 && (
        <section aria-labelledby="season-to-moderate" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="season-to-moderate" className={smallTitle}>
              {ta.moderation.title}
            </h2>
            <Link href="/admin/moderation" className="inline-flex min-h-11 items-center text-[13px] font-semibold underline underline-offset-4">
              {ta.moderation.seeAll(todo.length)}
            </Link>
          </div>
          <ModerationList
            entries={todo.slice(0, 2)}
            empty={ta.moderation.empty}
            actions={{ moderate: moderateSpotAction, setExceptional: setExceptionalAction, setRarity: setRarityAction }}
          />
        </section>
      )}
    </>
  );
}
