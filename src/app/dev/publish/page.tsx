import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getPublicEnvResult } from "@/lib/env/server";
import { DemoPublishFlow } from "./demo-publish-flow";

/*
 * Banc d'essai du parcours de publication, réservé au développement (absent
 * en production) : le vrai parcours, sans Supabase. Page interne : ses
 * textes ne passent pas par src/i18n.
 */

export const metadata: Metadata = {
  title: "Banc d'essai · publication",
  robots: { index: false, follow: false },
};

export default function PublishBenchPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <Suspense fallback={null}>
        <DevOnly>
          <DemoPublishFlow />
        </DevOnly>
      </Suspense>
    </main>
  );
}

async function DevOnly({ children }: { children: ReactNode }) {
  const env = await getPublicEnvResult();
  const appEnv = env.ok ? env.env.appEnv : env.appEnv;
  if (appEnv === "production") notFound();
  return children;
}
