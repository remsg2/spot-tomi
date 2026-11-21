import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { getMyProfile, getSessionUser } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour de Google, d'Apple ou du lien magique (flux PKCE : ?code=…), et
 * passage après une connexion par mot de passe. Sans pseudo, direction /welcome.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL(`/login?erreur&next=${encodeURIComponent(next)}`, origin));
  }

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?erreur&next=${encodeURIComponent(next)}`, origin));
    }
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, origin));
  }

  const profile = await getMyProfile(user.id);
  const destination = profile ? next : `/welcome?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(destination, origin));
}
