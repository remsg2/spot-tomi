import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const base =
  "relative inline-flex min-h-14 items-center justify-center overflow-hidden rounded-[18px] bg-year px-6 font-display text-base text-on-year shadow-card transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text";

function Band() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-band [clip-path:polygon(82%_100%,100%_38%,100%_100%)]"
    />
  );
}

type CommonProps = { children: ReactNode; fullWidth?: boolean; className?: string };

/** Bouton principal : fond couleur de l'année, texte noir, coin en bande noire. */
export function PrimaryButton({
  children,
  fullWidth,
  className,
  type = "button",
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(base, fullWidth && "w-full", className)} {...props}>
      <span className="relative">{children}</span>
      <Band />
    </button>
  );
}

/** Même apparence, pour un lien de navigation. */
export function PrimaryLink({
  children,
  href,
  fullWidth,
  className,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={cn(base, fullWidth && "w-full", className)}>
      <span className="relative">{children}</span>
      <Band />
    </Link>
  );
}
