import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { getPublicEnvResult } from "@/lib/env/server";
import { DEV_ACCENT } from "./fixtures";

/** Pages de prévisualisation : jamais en production (la build est la même partout). */
export async function DevOnly({ children }: { children: ReactNode }) {
  const env = await getPublicEnvResult();
  const appEnv = env.ok ? env.env.appEnv : env.appEnv;
  if (appEnv === "production") notFound();
  return (
    // Couleur de l'année des maquettes, sans dépendre de la base.
    <div className="flex flex-1 flex-col" style={{ "--year": DEV_ACCENT } as CSSProperties}>
      {children}
    </div>
  );
}
