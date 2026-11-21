import Link from "next/link";
import { t } from "@/i18n/fr";
import { getSessionUser } from "@/lib/auth/server";

/** Lien de compte de l'en-tête : « Mon profil » ou « Se connecter ». */
export async function AccountLink() {
  const user = await getSessionUser();
  return (
    <Link
      href={user ? "/me" : "/login"}
      className="inline-flex min-h-11 items-center rounded-full bg-band px-4 text-sm font-bold text-white"
    >
      {user ? t.auth.myProfile : t.auth.loginCta}
    </Link>
  );
}
