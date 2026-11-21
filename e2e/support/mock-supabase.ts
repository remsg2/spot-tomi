import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";

/*
 * Supabase simulé pour tester les vraies routes de l'étape 7 : les appels à
 * Supabase partent du serveur Next (composants serveur), hors de portée de
 * page.route(). On lance donc `next start` avec SUPABASE_URL pointé ici.
 * Seuls les points d'accès utilisés par /leaderboard, /me et /u/[username]
 * sont simulés (PostgREST et /auth/v1/user), avec des données fixes.
 */

export const ME = "00000000-0000-4000-8000-00000000000a";
const LEA = "00000000-0000-4000-8000-00000000000b";
const HUGO = "00000000-0000-4000-8000-00000000000c";
const TOMI_FAN = "00000000-0000-4000-8000-00000000000d";
const TOMI_X_FAN = "00000000-0000-4000-8000-00000000000e";

/** Jeton de session simulé (HS256 : vérifié par /auth/v1/user, pas par JWKS). */
export const ACCESS_TOKEN = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(
    JSON.stringify({ sub: ME, role: "authenticated", aud: "authenticated", email: "remi@example.test", exp: 4102444800 }),
  ).toString("base64url"),
  Buffer.from("signature simulée").toString("base64url"),
].join(".");

const PROFILES = [
  { id: ME, username: "Remi", avatar_path: null, created_at: "2023-04-01T10:00:00Z", role: "admin" },
  { id: LEA, username: "Lea", avatar_path: `${LEA}/avatar.webp`, created_at: "2024-02-01T10:00:00Z", role: "user" },
  { id: HUGO, username: "Hugo", avatar_path: null, created_at: "2024-05-01T10:00:00Z", role: "user" },
  { id: TOMI_FAN, username: "tomi_fan", avatar_path: null, created_at: "2025-01-01T10:00:00Z", role: "user" },
  { id: TOMI_X_FAN, username: "tomiXfan", avatar_path: null, created_at: "2025-01-02T10:00:00Z", role: "user" },
];

type Row = { user_id: string; period: string; points: number; countries: number; stickers: number; ranks: [number, number, number] };

const LEADERBOARD: Row[] = [
  { user_id: LEA, period: "2026", points: 1480, countries: 9, stickers: 18, ranks: [1, 2, 2] },
  { user_id: ME, period: "2026", points: 1435, countries: 11, stickers: 27, ranks: [2, 1, 1] },
  { user_id: HUGO, period: "2026", points: 1315, countries: 8, stickers: 14, ranks: [3, 3, 3] },
  { user_id: ME, period: "all", points: 3120, countries: 19, stickers: 61, ranks: [1, 1, 1] },
  { user_id: LEA, period: "all", points: 2985, countries: 17, stickers: 44, ranks: [2, 2, 2] },
  { user_id: HUGO, period: "all", points: 2410, countries: 14, stickers: 39, ranks: [3, 3, 3] },
  { user_id: TOMI_FAN, period: "all", points: 50, countries: 1, stickers: 1, ranks: [4, 4, 4] },
];

const CRITERIA = ["points", "countries", "stickers"];

function profileOf(id: string) {
  return PROFILES.find((p) => p.id === id)!;
}

function getLeaderboard(args: Record<string, unknown>) {
  const criterion = CRITERIA.indexOf(String(args.p_criterion));
  const rows = LEADERBOARD.filter((r) => r.period === args.p_period)
    .map((r) => ({ ...r, username: profileOf(r.user_id).username }))
    .sort((a, b) => a.ranks[criterion] - b.ranks[criterion] || a.username.toLowerCase().localeCompare(b.username.toLowerCase()));
  return rows
    .filter((r, index) => index < Number(args.p_limit ?? 50) || r.user_id === args.p_user)
    .map((r) => ({
      user_id: r.user_id,
      username: r.username,
      avatar_path: profileOf(r.user_id).avatar_path,
      period: r.period,
      points: r.points,
      countries: r.countries,
      stickers: r.stickers,
      rank_points: r.ranks[0],
      rank_countries: r.ranks[1],
      rank_stickers: r.ranks[2],
    }));
}

function album(userId: string) {
  const suggestions = [
    ["NO", "NOR", "Norvège", "courant", 10],
    ["JP", "JPN", "Japon", "lointain", 25],
    ["BT", "BTN", "Bhoutan", "rare", 60],
    ["KP", "PRK", "Corée du Nord", "extreme", 150],
  ].map(([iso2, iso3, name_fr, tier, points]) => ({
    iso2, iso3, name_fr, tier, conquered: false, first_year: null, color_hex: null, points, stickers: 0, gold: false, suggestion_rank: 1,
  }));
  if (userId !== LEA && userId !== ME) return suggestions;
  return [
    { iso2: "FR", iso3: "FRA", name_fr: "France", tier: "courant", conquered: true, first_year: 2024, color_hex: "#F2C230", points: 312, stickers: 3, gold: false, suggestion_rank: null },
    { iso2: "AR", iso3: "ARG", name_fr: "Argentine", tier: "lointain", conquered: true, first_year: 2026, color_hex: "#5DB043", points: 195, stickers: 1, gold: true, suggestion_rank: null },
    ...suggestions,
  ];
}

function profileSpots(userId: string, caller: string | null) {
  const spots = [
    { id: "10000000-0000-4000-8000-000000000001", name: "Fin du monde", city: "Ushuaïa", country_iso2: "AR", country_name_fr: "Argentine", year: 2026, color_hex: "#5DB043", status: "published", points_total: 195, is_first_in_country: true, is_exceptional: false, taken_at: "2026-10-02T15:00:00Z" },
    { id: "10000000-0000-4000-8000-000000000002", name: "Pont du Gard", city: null, country_iso2: "FR", country_name_fr: "France", year: 2026, color_hex: "#5DB043", status: "pending_review", points_total: 25, is_first_in_country: false, is_exceptional: false, taken_at: "2026-08-14T09:30:00Z" },
    { id: "10000000-0000-4000-8000-000000000003", name: "Tour Eiffel", city: "Paris", country_iso2: "FR", country_name_fr: "France", year: 2024, color_hex: "#F2C230", status: "published", points_total: 10, is_first_in_country: false, is_exceptional: true, taken_at: "2024-07-14T21:00:00Z" },
  ];
  if (userId !== LEA && userId !== ME) return [];
  // Comme la base : en attente et masqués seulement pour soi.
  return spots.filter((s) => s.status === "published" || caller === userId);
}

function stats(userId: string) {
  const all = LEADERBOARD.find((r) => r.user_id === userId && r.period === "all");
  return [{ user_id: userId, points: all?.points ?? 0, rank: all?.ranks[0] ?? null, stickers: all?.stickers ?? 0, countries: all?.countries ?? 0, firsts: all ? 1 : 0 }];
}

/** ILIKE de Postgres : % et _ sont des jokers, \ échappe. */
function ilike(value: string, pattern: string): boolean {
  let regex = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "\\") regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (char === "%") regex += ".*";
    else if (char === "_") regex += ".";
    else regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${regex}$`, "i").test(value);
}

export type Call = { method: string; path: string; search: URLSearchParams; body: Record<string, unknown> | null };

export type MockSupabase = { url: string; calls: Call[]; close: () => Promise<void> };

async function readBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, unknown>) : null;
}

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAwMBAQAY3Y2wAAAAAElFTkSuQmCC",
  "base64",
);

export async function startMockSupabase(): Promise<MockSupabase> {
  const calls: Call[] = [];
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://mock");
    const body = req.method === "POST" ? await readBody(req) : null;
    calls.push({ method: req.method ?? "GET", path: url.pathname, search: url.searchParams, body });
    const caller = req.headers.authorization === `Bearer ${ACCESS_TOKEN}` ? ME : null;
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };

    if (url.pathname === "/auth/v1/user") {
      return caller
        ? json(200, { id: ME, aud: "authenticated", role: "authenticated", email: "remi@example.test", app_metadata: {}, user_metadata: {}, created_at: "2023-04-01T10:00:00Z" })
        : json(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    if (url.pathname.startsWith("/storage/v1/object/public/avatars/")) {
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(PIXEL);
    }
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    const args = body ?? {};
    switch (rpc) {
      case "current_season":
        return json(200, [{ year: 2026, color_hex: "#5DB043" }]);
      case "get_leaderboard":
        return json(200, getLeaderboard(args));
      case "leaderboard_size":
        return json(200, LEADERBOARD.filter((r) => r.period === args.p_period).length);
      case "profile_stats":
        return json(200, stats(String(args.p_user)));
      case "album":
        return json(200, album(String(args.p_user)));
      case "profile_spots":
        return json(200, profileSpots(String(args.p_user), caller));
      case "schema_version":
        return json(200, "20261125000000_classement");
    }
    if (url.pathname === "/rest/v1/public_profiles") {
      const pattern = url.searchParams.get("username")?.replace(/^ilike\./, "") ?? "%";
      return json(
        200,
        PROFILES.filter((p) => ilike(p.username, pattern)).map(({ id, username, avatar_path, created_at }) => ({ id, username, avatar_path, created_at })),
      );
    }
    if (url.pathname === "/rest/v1/profiles") {
      // RLS : chacun ne lit que son propre profil.
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const me = profileOf(ME);
      return json(200, caller && id === ME ? [{ ...me, suspended_at: null, theme: "system" }] : []);
    }
    return json(404, { code: "PGRST000", message: `Non simulé : ${req.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Cookie de session au format de @supabase/ssr (« base64- » + JSON). */
export function sessionCookie(supabaseUrl: string) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const session = {
    access_token: ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh-simule",
    user: { id: ME, aud: "authenticated", role: "authenticated", email: "remi@example.test", app_metadata: {}, user_metadata: {} },
  };
  return {
    name: `sb-${ref}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
  };
}

export const hasLocalBuild = () => existsSync(join(process.cwd(), ".next", "BUILD_ID"));

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

export type NextServer = { url: string; close: () => Promise<void> };

/** Lance la build locale (next start) branchée sur le Supabase simulé. */
export async function startNextServer(supabaseUrl: string): Promise<NextServer> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    process.execPath,
    [join(process.cwd(), "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      env: {
        ...process.env,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_simule_0123456789",
        APP_ENV: "local",
      },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${url}/`)).status < 500) {
        return {
          url,
          close: async () => {
            child.kill("SIGTERM");
          },
        };
      }
    } catch {
      // Pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill("SIGTERM");
  throw new Error("next start n'a pas démarré");
}
