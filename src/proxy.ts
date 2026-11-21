import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parsePublicEnv } from "@/lib/env/schema";

/** Pages qui demandent d'être connecté (le reste est public). */
const PROTECTED = ["/me", "/welcome", "/spots/new", "/admin"];

/**
 * Avant chaque page :
 * - /dev/* n'existe pas en production (vrai 404) ;
 * - la session Supabase est rafraîchie (cookies) ;
 * - les pages privées renvoient vers /login si personne n'est connecté.
 * La configuration est lue au runtime (proxy en Node.js), jamais au build.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = parsePublicEnv(process.env);
  const appEnv = env.ok ? env.env.appEnv : env.appEnv;

  if (appEnv === "production" && (pathname === "/dev" || pathname.startsWith("/dev/"))) {
    return new NextResponse(null, { status: 404 });
  }
  if (!env.ok) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.env.supabaseUrl, env.env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Vérifie le jeton et le rafraîchit si besoin : ne rien insérer avant cet appel.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const isProtected = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isProtected && !isLoggedIn) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les images et le contrôle de santé.
    "/((?!_next/static|_next/image|favicon.ico|tomi/|api/health|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|webmanifest)$).*)",
  ],
};
