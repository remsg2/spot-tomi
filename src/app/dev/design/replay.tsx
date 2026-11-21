"use client";

import { useState, type ReactNode } from "react";

/** Rejoue une animation CSS en remontant son contenu. */
export function Replay({ children, label }: { children: ReactNode; label: string }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-center gap-4">
      <div key={run} className="flex w-full flex-col items-center gap-4">
        {children}
      </div>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
      >
        {label}
      </button>
    </div>
  );
}
