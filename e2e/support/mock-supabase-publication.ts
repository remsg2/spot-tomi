import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { ACCESS_TOKEN, ME } from "./mock-supabase";

/*
 * Supabase simulé pour la vraie route /spots/new (étape 5). Contrairement au
 * banc d'essai /dev/publish, ce sont les vrais services du navigateur
 * (supabase-js : RPC, Storage, Functions) et la vraie page serveur
 * (session, profil, scoring_rules) qui l'appellent. Il répond aux requêtes
 * CORS du navigateur et garde chaque appel (corps brut compris).
 */

export type RecordedCall = { method: string; path: string; headers: IncomingHttpHeaders; body: Buffer };

export type PublicationMockState = {
  /** Réponse de estimate_spot_points (champ `blocked` compris). */
  estimate: Record<string, unknown>;
  /** Réponse de publish-spot : statut et corps JSON. */
  publish: (body: Record<string, unknown>) => { status: number; json: unknown };
};

export type PublicationSupabase = {
  url: string;
  calls: RecordedCall[];
  state: PublicationMockState;
  close: () => Promise<void>;
};

export const EDIT_RADIUS_M = 150;

export const ESTIMATE = {
  pointsTotal: 120,
  status: "published",
  year: 2026,
  colorHex: "#5DB043",
  countryIso2: "AR",
  countryNameFr: "Argentine",
  isFirstInCountry: true,
  category: "touristique",
  categoryLabel: "Lieu touristique",
  blocked: null,
  nearest: null,
  lines: [
    { ruleKey: "base", label: "Sticker publié", detail: "Points de base", points: 100 },
    { ruleKey: "rarity", label: "Lieu touristique", detail: "Site touristique à moins de 300 m", points: 20 },
  ],
};

/** Éditions (list_editions) : 2027 annoncée mais pas encore choisissable. */
export const EDITIONS = [
  { year: 2027, name: "Édition 2027", color_hex: "#34B503", visual_path: null, status: "active", is_current: false, selectable: false, color_locked: false, spot_count: 0 },
  { year: 2026, name: "Édition 2026", color_hex: "#C57CB3", visual_path: null, status: "active", is_current: true, selectable: true, color_locked: false, spot_count: 4 },
  { year: 2025, name: "Édition 2025", color_hex: "#F68A27", visual_path: null, status: "active", is_current: false, selectable: true, color_locked: true, spot_count: 9 },
];

export function publishResult(body: Record<string, unknown>) {
  return {
    spot: {
      id: "0b8e9a7c-2222-4d3e-8f00-abcdefabcdef",
      name: String(body.name),
      city: "Ushuaïa",
      countryNameFr: "Argentine",
      year: 2026,
      colorHex: "#5DB043",
      status: "published",
      pointsTotal: 120,
      isFirstInCountry: true,
      isExceptional: false,
    },
    lines: ESTIMATE.lines,
    rank: { before: 3, after: 2 },
  };
}

export async function startPublicationSupabase(): Promise<PublicationSupabase> {
  const calls: RecordedCall[] = [];
  const state: PublicationMockState = {
    estimate: { ...ESTIMATE },
    publish: (body) => ({ status: 200, json: publishResult(body) }),
  };

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url ?? "/", "http://mock");
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    calls.push({ method: req.method ?? "GET", path: url.pathname, headers: req.headers, body: raw });

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const authorized = req.headers.authorization === `Bearer ${ACCESS_TOKEN}`;
    const body = () => (raw.length ? (JSON.parse(raw.toString("utf8")) as Record<string, unknown>) : {});

    if (url.pathname === "/auth/v1/user") {
      return authorized
        ? json(200, { id: ME, aud: "authenticated", role: "authenticated", email: "remi@example.test", app_metadata: {}, user_metadata: {} })
        : json(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    if (url.pathname === "/rest/v1/profiles") {
      return json(200, authorized
        ? [{ id: ME, username: "Remi", avatar_path: null, role: "user", suspended_at: null, theme: "system", created_at: "2024-01-01T00:00:00Z" }]
        : []);
    }
    if (url.pathname === "/rest/v1/scoring_rules") {
      return json(200, [{ key: "edit_radius_m", value: EDIT_RADIUS_M }, { key: "comment_max_length", value: 280 }]);
    }

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    if (rpc === "current_season") return json(200, [{ year: 2026, color_hex: "#5DB043" }]);
    if (rpc === "list_editions") return json(200, EDITIONS);
    if (rpc === "estimate_spot_points") {
      return authorized ? json(200, state.estimate) : json(401, { code: "42501", message: "permission denied" });
    }

    if (req.method === "POST" && url.pathname.startsWith("/storage/v1/object/spot-photos/")) {
      if (!authorized) return json(403, { statusCode: "403", error: "Unauthorized", message: "RLS" });
      const key = url.pathname.slice("/storage/v1/object/".length);
      return json(200, { Id: "11111111-2222-4333-8444-555555555555", Key: key });
    }
    if (req.method === "POST" && url.pathname === "/functions/v1/publish-spot") {
      if (!authorized) return json(401, { error: { code: "unauthorized", message: "Connexion requise." } });
      const { status, json: payload } = state.publish(body());
      return json(status, payload);
    }
    return json(404, { code: "PGRST000", message: `Non simulé : ${req.method} ${url.pathname}` });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    state,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Le WebP contenu dans un envoi Storage (corps multipart). */
export function webpFromMultipart(body: Buffer): Buffer {
  const start = body.indexOf("RIFF");
  if (start < 0 || body.toString("latin1", start + 8, start + 12) !== "WEBP") throw new Error("Pas de WebP dans l'envoi");
  return body.subarray(start, start + 8 + body.readUInt32LE(start + 4));
}
