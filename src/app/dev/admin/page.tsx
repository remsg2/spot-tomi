import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ModerationList } from "@/components/admin/moderation-list";
import { SeasonEditor } from "@/components/admin/season-editor";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import type { ModerationEntry } from "@/lib/admin/types";
import { getPublicEnvResult } from "@/lib/env/server";
import {
  previewExceptionalAction,
  previewFocusAction,
  previewModerationAction,
  previewRarityAction,
  previewSeasonAction,
} from "./actions";

/*
 * Partie client de l'admin isolée, réservée au développement (absente en
 * production) : sans Supabase, l'accès réel à /admin n'est pas simulable, donc
 * Playwright teste ici l'onglet Couleur avec des données d'exemple et des
 * actions simulées. Page interne : textes hors de src/i18n.
 */

export const metadata: Metadata = {
  title: "Admin (démo)",
  robots: { index: false, follow: false },
};

const SEASONS = [
  { year: 2026, color_hex: "#5B8DEF", is_current: true },
  { year: 2025, color_hex: "#FF7A59", is_current: false },
  { year: 2024, color_hex: "#F2C230", is_current: false },
];

const SAMPLE: ModerationEntry = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Tour Eiffel",
  status: "pending_review",
  author_id: "00000000-0000-4000-8000-0000000000aa",
  author_username: "Nico",
  city: "Paris",
  country_iso2: "FR",
  country_name_fr: "France",
  year: 2026,
  color_hex: "#5B8DEF",
  taken_at: "2026-06-01T12:00:00Z",
  created_at: "2026-06-02T08:00:00Z",
  gps_source: "manual",
  date_source: "exif",
  lat: 48.85837,
  lng: 2.294481,
  public_lat: 48.85837,
  public_lng: 2.294481,
  altitude_m: null,
  photo_path: "",
  photo_url: null,
  points_total: 10,
  is_exceptional: false,
  is_first_in_country: false,
  report_count: 0,
  reports: [],
};

const QUEUE: ModerationEntry[] = [
  SAMPLE,
  {
    ...SAMPLE,
    id: "00000000-0000-4000-8000-000000000002",
    name: "Fourvière",
    author_username: "Bea",
    // Image locale en guise de photo : de quoi essayer le recadrage.
    photo_url: "/editions/2026.webp",
    focus_x: 0.3,
    focus_y: 0.7,
    city: "Lyon",
    status: "published",
    gps_source: "exif",
    lat: 45.7623,
    lng: 4.8227,
    public_lat: 45.766,
    public_lng: 4.83,
    points_total: 85,
    report_count: 2,
    reports: [
      { reason: "Photo floue", created_at: "2026-06-03T09:00:00Z", reporter_username: "r1" },
      { reason: null, created_at: "2026-06-04T10:00:00Z", reporter_username: null },
    ],
  },
];

export default function DevAdminPage() {
  return (
    <Suspense fallback={null}>
      <DevOnly>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3.5 px-4 pt-4 pb-12">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-[26px] font-normal leading-none">Admin (démo)</h1>
            <ThemeSwitcher />
          </div>
          <AdminTabs level="admin" moderationCount={QUEUE.length} />
          <SeasonEditor
            seasons={SEASONS}
            missingYears={[{ year: 2019, spot_count: 3 }]}
            initialYear={2027}
            currentYear={2026}
            action={previewSeasonAction}
          />
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-base font-normal">À modérer</h2>
            <ModerationList
              entries={QUEUE}
              empty="Rien à modérer."
              actions={{
                moderate: previewModerationAction,
                setExceptional: previewExceptionalAction,
                setRarity: previewRarityAction,
                setFocus: previewFocusAction,
              }}
            />
          </section>
        </main>
      </DevOnly>
    </Suspense>
  );
}

/** La configuration est lue au runtime : la même build sert en local et en production. */
async function DevOnly({ children }: { children: ReactNode }) {
  const env = await getPublicEnvResult();
  if ((env.ok ? env.env.appEnv : env.appEnv) === "production") notFound();
  return children;
}
