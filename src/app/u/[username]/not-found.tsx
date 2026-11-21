import Link from "next/link";
import { ColumnPage } from "@/components/leaderboard/column-page";
import { PrimaryLink, Sticker } from "@/components/ui";
import { profileFr as p } from "@/i18n/profile.fr";

/** Pseudo inconnu : page 404 du profil public. */
export default function UserNotFound() {
  return (
    <ColumnPage className="items-center justify-center text-center">
      <Sticker size={120} tilt={-6} band="404" />
      <h1 className="font-display text-2xl font-normal">{p.notFound.title}</h1>
      <p className="max-w-xs text-sm text-muted">{p.notFound.body}</p>
      <PrimaryLink href="/leaderboard">{p.notFound.leaderboard}</PrimaryLink>
      <Link href="/" className="min-h-11 content-center text-sm font-semibold underline underline-offset-4">
        {p.notFound.map}
      </Link>
    </ColumnPage>
  );
}
