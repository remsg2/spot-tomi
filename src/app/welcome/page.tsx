import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";
import { safeNextPath } from "@/lib/auth/next-path";
import { getMyProfile, requireUser } from "@/lib/auth/server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: t.welcome.title };

/** Première connexion : le pseudo est obligatoire avant toute autre page privée. */
export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Logo />
      <div className="flex items-center gap-4">
        <Sticker size={84} tilt={4} />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-normal">{t.welcome.title}</h1>
          <p className="text-sm text-muted">{t.welcome.intro}</p>
        </div>
      </div>
      <Suspense fallback={null}>
        <WelcomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WelcomeContent({ searchParams }: Pick<PageProps<"/welcome">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "/me");
  const user = await requireUser("/welcome");
  if (await getMyProfile(user.id)) redirect(next);
  return <WelcomeForm userId={user.id} next={next} />;
}
