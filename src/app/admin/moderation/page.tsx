import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ModerationList } from "@/components/admin/moderation-list";
import { buttonGhost, input, sectionTitle } from "@/components/admin/styles";
import { ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { getModerationQueue, searchSpots } from "@/lib/admin/data";
import { cn } from "@/lib/cn";
import { moderateSpotAction, setExceptionalAction, setRarityAction } from "../actions";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.moderation };

const actions = { moderate: moderateSpotAction, setExceptional: setExceptionalAction, setRarity: setRarityAction };

/** Onglet Modération (modérateurs et admins) : file, masqués, recherche d'un sticker. */
export default function ModerationPage({ searchParams }: PageProps<"/admin/moderation">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ModerationContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ModerationContent({ searchParams }: Pick<PageProps<"/admin/moderation">, "searchParams">) {
  await requireStaff("moderator", "/admin/moderation");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const view = params.vue === "masques" ? "hidden" : "todo";

  const queue = query ? [] : await getModerationQueue();
  const todo = queue.filter((entry) => entry.status !== "hidden");
  const hidden = queue.filter((entry) => entry.status === "hidden");
  const results = query ? await searchSpots(query) : [];

  return (
    <>
      <form role="search" action="/admin/moderation" className="flex gap-2">
        <label htmlFor="moderation-search" className="sr-only">
          {ta.moderation.searchLabel}
        </label>
        <input
          id="moderation-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={ta.moderation.searchPlaceholder}
          className={cn(input, "flex-1")}
        />
        <button type="submit" className={buttonGhost}>
          {ta.moderation.searchSubmit}
        </button>
      </form>

      {query ? (
        <section aria-labelledby="moderation-results" className="flex flex-col gap-2.5">
          <h2 id="moderation-results" className={sectionTitle}>
            {ta.moderation.searchResults(results.length, query)}
          </h2>
          <ModerationList entries={results} empty={ta.moderation.searchEmpty(query)} actions={actions} />
        </section>
      ) : (
        <section aria-labelledby="moderation-title" className="flex flex-col gap-2.5">
          <h2 id="moderation-title" className={sectionTitle}>
            {ta.moderation.title}
          </h2>
          <nav aria-label={ta.moderation.filtersLabel} className="flex gap-2">
            {(
              [
                ["todo", "/admin/moderation", ta.moderation.filters.todo, todo.length],
                ["hidden", "/admin/moderation?vue=masques", ta.moderation.filters.hidden, hidden.length],
              ] as const
            ).map(([key, href, label, count]) => (
              <Link
                key={key}
                href={href}
                aria-current={view === key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[13px]",
                  view === key ? "border-text bg-text font-bold text-bg" : "border-line font-semibold text-muted",
                )}
              >
                {label} <span aria-hidden="true">·</span> {count}
              </Link>
            ))}
          </nav>
          <ModerationList
            entries={view === "hidden" ? hidden : todo}
            empty={view === "hidden" ? ta.moderation.emptyHidden : ta.moderation.empty}
            actions={actions}
          />
        </section>
      )}
    </>
  );
}
