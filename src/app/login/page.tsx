import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LegalLinks } from "@/components/legal/legal-page";
import { BackLink, Logo, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSessionUser } from "@/lib/auth/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t.auth.loginTitle };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <BackLink href="/" label={t.nav.back} />
        <Logo />
      </div>
      <div className="flex items-center gap-4">
        <Sticker size={84} tilt={-5} />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-normal">{t.auth.loginTitle}</h1>
          <p className="text-sm text-muted">{t.auth.loginIntro}</p>
        </div>
      </div>
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
      <LegalLinks />
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getSessionUser()) redirect(next);

  return (
    <>
      {params.erreur !== undefined && (
        <p role="alert" className="rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
          {t.auth.callbackError}
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}
