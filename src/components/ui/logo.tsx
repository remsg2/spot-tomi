import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";

/** Mini-sticker et nom de l'app, pour les en-têtes. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="relative size-[34px] -rotate-5 overflow-hidden rounded-[9px] bg-year shadow-[0_2px_6px_rgb(0_0_0/0.2)]"
      >
        <span className="absolute inset-0 bg-band [clip-path:polygon(0_100%,0_78%,100%_45%,100%_100%)]" />
      </span>
      <span className="font-display text-xl tracking-[-0.01em]">{t.app.title}</span>
    </span>
  );
}
