import { ta } from "@/i18n/admin.fr";

/** Attente d'une page de l'admin (lecture de la session et de la base). */
export function AdminSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3.5">
      <span className="sr-only" role="status">
        {ta.loading}
      </span>
      <div className="h-[340px] animate-pulse rounded-[22px] border border-line bg-card motion-reduce:animate-none" />
      <div className="h-[120px] animate-pulse rounded-[18px] border border-line bg-card motion-reduce:animate-none" />
    </div>
  );
}
