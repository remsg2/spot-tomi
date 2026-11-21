import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Déconnexion (formulaire POST, pour éviter une déconnexion par simple lien). */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
