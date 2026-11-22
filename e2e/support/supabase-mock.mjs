#!/usr/bin/env node
/**
 * Faux Supabase (PostgREST) pour les tests de bout en bout locaux : la build est
 * démarrée avec SUPABASE_URL pointant ici (playwright.config.ts). Il sert les
 * lectures de la carte et de la fiche lieu (étape 6) avec un petit jeu de données,
 * y compris celles faites côté serveur, que Playwright ne peut pas intercepter.
 * Les tests peuvent encore remplacer une réponse côté navigateur (page.route).
 *
 * Usage : node e2e/support/supabase-mock.mjs [port]  (défaut : 54329)
 */
import { createServer } from "node:http";

export const MOCK_PORT = Number(process.argv[2] ?? process.env.SUPABASE_MOCK_PORT ?? 54329);

const SEASONS = [
  { year: 2026, name: "Édition 2026", color_hex: "#5B8DEF", is_current: true, status: "active", visual_path: null },
  { year: 2025, name: "Édition 2025", color_hex: "#FF7A59", is_current: false, status: "active", visual_path: null },
  { year: 2024, name: "Édition 2024", color_hex: "#F2C230", is_current: false, status: "archived", visual_path: null },
];
const color = (year) => SEASONS.find((s) => s.year === year)?.color_hex ?? "#9A9A94";

const AUTHORS = {
  remi: { id: "00000000-0000-4000-8000-0000000000a1", username: "Remi" },
  lea: { id: "00000000-0000-4000-8000-0000000000a2", username: "Lea" },
  hugo: { id: "00000000-0000-4000-8000-0000000000a3", username: "Hugo" },
};

function spot(n, data) {
  return {
    id: `00000000-0000-4000-8000-00000000c0${String(n).padStart(2, "0")}`,
    author_avatar_path: null,
    altitude_m: null,
    is_exceptional: false,
    is_first_in_country: false,
    created_at: data.taken_at,
    photo_path: `${data.author.id}/${n}.webp`,
    thumb_path: null,
    comment: null,
    edition_name: `Édition ${data.year}`,
    rarity_category: "courant",
    rarity_reason: null,
    focus_x: null,
    focus_y: null,
    author_id: data.author.id,
    author_username: data.author.username,
    color_hex: color(data.year),
    ...data,
  };
}

export const SPOTS = [
  spot(1, {
    name: "Ushuaïa", city: "Ushuaïa", country_iso2: "AR", country_name_fr: "Argentine", country_tier: "lointain",
    lat: -54.8019, lng: -68.303, taken_at: "2025-03-14T15:00:00Z", year: 2025, points_total: 120,
    is_first_in_country: true, rarity_category: "touristique", rarity_reason: "Site touristique à moins de 300 m",
    comment: "Au bout du monde, face au canal Beagle.", focus_x: 0.3, focus_y: 0.25, author: AUTHORS.remi,
  }),
  spot(2, {
    name: "Mont Blanc", city: "Chamonix", country_iso2: "FR", country_name_fr: "France", country_tier: "courant",
    lat: 45.8326, lng: 6.8652, taken_at: "2026-08-12T10:00:00Z", year: 2026, points_total: 300,
    is_exceptional: true, altitude_m: 4808, rarity_category: "tres_rare", rarity_reason: "Altitude 4 808 m",
    author: AUTHORS.lea,
  }),
  spot(3, {
    name: "Dubrovnik", city: "Dubrovnik", country_iso2: "HR", country_name_fr: "Croatie", country_tier: "courant",
    lat: 42.6507, lng: 18.0944, taken_at: "2026-06-03T09:00:00Z", year: 2026, points_total: 120,
    is_first_in_country: true, rarity_category: "touristique", rarity_reason: "Site touristique à moins de 300 m",
    author: AUTHORS.hugo,
  }),
  spot(4, {
    name: "Pont des Arts", city: "Paris", country_iso2: "FR", country_name_fr: "France", country_tier: "courant",
    lat: 48.8583, lng: 2.3375, taken_at: "2024-05-01T12:00:00Z", year: 2024, points_total: 100, author: AUTHORS.lea,
  }),
  spot(5, {
    name: "Dzong de Paro", city: "Paro", country_iso2: "BT", country_name_fr: "Bhoutan", country_tier: "rare",
    lat: 27.43, lng: 89.41, taken_at: "2026-02-10T08:00:00Z", year: 2026, points_total: 200,
    rarity_category: "isole", rarity_reason: "Pays rare : Bhoutan", author: AUTHORS.remi,
  }),
  spot(6, {
    name: "Taveuni est", city: null, country_iso2: "FJ", country_name_fr: "Fidji", country_tier: "lointain",
    lat: -16.8, lng: 179.9, taken_at: "2026-07-01T08:00:00Z", year: 2026, points_total: 200,
    rarity_category: "isole", rarity_reason: "Île à plus de 50 km d'une ville de 15 000 habitants", author: AUTHORS.hugo,
  }),
  spot(7, {
    name: "Taveuni ouest", city: null, country_iso2: "FJ", country_name_fr: "Fidji", country_tier: "lointain",
    lat: -16.8, lng: -179.9, taken_at: "2026-07-02T08:00:00Z", year: 2026, points_total: 200,
    rarity_category: "isole", rarity_reason: "Île à plus de 50 km d'une ville de 15 000 habitants", author: AUTHORS.hugo,
  }),
];

/** Détail des points (compute_spot_points) : base, bonus de rareté. */
const LINES = {
  [SPOTS[0].id]: [
    { rule_key: "base", position: 1, label: "Sticker publié", detail: "Points de base", points: 100 },
    { rule_key: "rarity", position: 2, label: "Lieu touristique", detail: "Site touristique à moins de 300 m", points: 20 },
  ],
  [SPOTS[1].id]: [
    { rule_key: "base", position: 1, label: "Sticker publié", detail: "Points de base", points: 100 },
    { rule_key: "rarity", position: 2, label: "Lieu très rare", detail: "Altitude 4 808 m", points: 200 },
  ],
};

/** Vue country_rarity : points possibles par pays (base 100 + bonus du niveau). */
const COUNTRY_RARITY = [
  { iso2: "AR", tier: "lointain", base_points: 100, spot_count: 1 },
  { iso2: "FR", tier: "courant", base_points: 100, spot_count: 2 },
  { iso2: "HR", tier: "courant", base_points: 100, spot_count: 1 },
  { iso2: "BT", tier: "rare", base_points: 200, spot_count: 1 },
  { iso2: "FJ", tier: "lointain", base_points: 100, spot_count: 2 },
  { iso2: "KP", tier: "extreme", base_points: 300, spot_count: 0 },
  { iso2: "TM", tier: "rare", base_points: 200, spot_count: 0 },
];

function inBox(s, a) {
  if (s.lat < a.min_lat || s.lat > a.max_lat) return false;
  return a.min_lng <= a.max_lng ? s.lng >= a.min_lng && s.lng <= a.max_lng : s.lng >= a.min_lng || s.lng <= a.max_lng;
}

/** Même logique que spots_in_bbox (sans les stickers en attente ni l'auteur connecté). */
export function spotsInBbox(args) {
  const filters = args.filters ?? {};
  const features = SPOTS.filter((s) => inBox(s, args))
    .filter((s) => !filters.years?.length || filters.years.includes(s.year))
    .filter((s) => !filters.authorId || s.author_id === filters.authorId)
    .filter((s) => !filters.rare || s.is_first_in_country || s.is_exceptional || ["remarquable", "isole", "tres_rare"].includes(s.rarity_category))
    .filter((s) => !filters.countries?.length || filters.countries.includes(s.country_iso2))
    .filter((s) => !filters.from || s.taken_at.slice(0, 10) >= filters.from)
    .filter((s) => !filters.to || s.taken_at.slice(0, 10) <= filters.to)
    .sort((a, b) => b.points_total - a.points_total)
    .map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { id: s.id, color: s.color_hex, points: s.points_total, gold: s.is_first_in_country || s.is_exceptional, pending: false },
    }));
  return { type: "FeatureCollection", features, truncated: false };
}

/** Distance en mètres (haversine). */
function distanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

/** Même logique que nearby_spots : stickers publiés à 50 km au plus, du plus proche au plus loin. */
function nearby(id, limit) {
  const origin = SPOTS.find((s) => s.id === id);
  if (!origin) return [];
  return SPOTS.filter((s) => s.id !== id)
    .map((s) => ({ s, d: distanceM(origin, s) }))
    .filter(({ d }) => d <= 50_000)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(({ s, d }) => ({
      id: s.id, name: s.name, city: s.city, country_name_fr: s.country_name_fr, year: s.year,
      color_hex: s.color_hex, points_total: s.points_total, thumb_path: s.thumb_path, distance_m: Math.round(d),
      focus_x: s.focus_x, focus_y: s.focus_y,
    }));
}

/** Éditions (list_editions) : choisissables jusqu'à l'édition en cours. */
function editions() {
  return SEASONS.map((season) => ({
    ...season,
    selectable: season.status === "active" && season.year <= 2026,
    color_locked: !season.is_current && SPOTS.some((s) => s.year === season.year),
    spot_count: SPOTS.filter((s) => s.year === season.year).length,
  }));
}

const normalize = (value) => (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function search(q) {
  const n = normalize(q);
  if (n.trim().length < 2) return [];
  const spots = SPOTS.filter((s) => normalize(s.name).includes(n) || normalize(s.city).includes(n)).map((s) => ({
    kind: "spot", id: s.id, label: s.name, detail: [s.city, s.country_name_fr].filter(Boolean).join(", "),
    lng: s.lng, lat: s.lat, bbox: null, color: s.color_hex, points: s.points_total, spot_count: null,
  }));
  const countries = [...new Map(SPOTS.map((s) => [s.country_iso2, s])).values()]
    .filter((s) => normalize(s.country_name_fr).includes(n))
    .map((s) => ({
      kind: "country", id: s.country_iso2, label: s.country_name_fr, detail: null, lng: s.lng, lat: s.lat,
      bbox: [s.lng - 3, s.lat - 3, s.lng + 3, s.lat + 3], color: null, points: null,
      spot_count: SPOTS.filter((x) => x.country_iso2 === s.country_iso2).length,
    }));
  const users = Object.values(AUTHORS).filter((a) => normalize(a.username).includes(n)).map((a) => ({
    kind: "user", id: a.id, label: a.username, detail: null, lng: null, lat: null, bbox: null, color: null, points: null,
    spot_count: SPOTS.filter((s) => s.author_id === a.id).length,
  }));
  return [...spots.slice(0, 5), ...countries.slice(0, 5), ...users.slice(0, 5)];
}

/** Filtres PostgREST utilisés par l'app : col=eq.x et col=in.(a,b). */
function applyFilters(rows, params) {
  let out = rows;
  for (const [key, value] of params) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (value.startsWith("eq.")) out = out.filter((row) => String(row[key]) === value.slice(3));
    else if (value.startsWith("in.(")) {
      const set = new Set(value.slice(4, -1).split(",").map((v) => v.replace(/^"|"$/g, "")));
      out = out.filter((row) => set.has(String(row[key])));
    }
  }
  const order = params.get("order");
  if (order) {
    const [column, direction] = order.split(".");
    out = [...out].sort((a, b) => (a[column] > b[column] ? 1 : -1) * (direction === "desc" ? -1 : 1));
  }
  return out;
}

function pick(rows, select) {
  if (!select || select === "*") return rows;
  const columns = select.split(",").map((c) => c.trim()).filter((c) => !c.includes(":") && !c.includes("("));
  return rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null])));
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, accept, accept-profile, content-profile, prefer, range, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range",
};

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${MOCK_PORT}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (url.pathname === "/health") return send(res, 200, { ok: true });

  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = url.pathname.slice("/rest/v1/rpc/".length);
    const body = req.method === "POST" ? await readBody(req) : Object.fromEntries(url.searchParams);
    if (fn === "schema_version") return send(res, 200, "20261202000000_cahier_recalcul");
    if (fn === "spots_in_bbox") return send(res, 200, spotsInBbox(body));
    if (fn === "search_spots") return send(res, 200, search(String(body.q ?? "")));
    if (fn === "year_color") return send(res, 200, color(Number(body.p_year)));
    // Couleur de l'année en cours, lue par le layout racine (étape 8).
    if (fn === "current_season") return send(res, 200, [{ year: 2026, color_hex: color(2026) }]);
    if (fn === "list_editions") return send(res, 200, editions());
    // Onglet Stats (world_stats renvoie un objet JSON déjà en camelCase).
    if (fn === "world_stats") {
      const countries = new Set(SPOTS.map((s) => s.country_iso2));
      return send(res, 200, {
        stickers: SPOTS.length, countries: countries.size, countriesTotal: 249, continents: 4, continentsTotal: 7,
        members: 3, contributors: 3, editions: 3, distanceKm: 61234,
        topCountries: [{ iso2: "FR", nameFr: "France", count: 2 }, { iso2: "FJ", nameFr: "Fidji", count: 2 }],
        recentConquests: [{ iso2: "FJ", nameFr: "Fidji", at: "2026-07-01T08:00:00Z" }],
      });
    }
    if (fn === "rarest_places") {
      return send(res, 200, SPOTS.filter((s) => ["isole", "tres_rare"].includes(s.rarity_category))
        .sort((a, b) => b.points_total - a.points_total).slice(0, Number(body.p_limit ?? 10))
        .map((s) => ({ id: s.id, name: s.name, city: s.city, country_name_fr: s.country_name_fr, year: s.year, rarity_category: s.rarity_category,
          rarity_label: s.rarity_category === "tres_rare" ? "Lieu très rare" : "Lieu isolé", rarity_reason: s.rarity_reason,
          points_total: s.points_total, color_hex: s.color_hex, author_username: s.author_username, thumb_path: s.thumb_path })));
    }
    if (["world_records", "continent_firsts", "photo_feed", "world_conquest"].includes(fn)) return send(res, 200, []);
    if (fn === "nearby_spots") return send(res, 200, nearby(String(body.p_spot_id), Number(body.p_limit ?? 6)));
    if (fn === "spot_like_info") return send(res, 200, { count: body.p_spot_id === SPOTS[0].id ? 3 : 0, liked: false });
    return send(res, 404, { code: "PGRST202", message: `Fonction inconnue : ${fn}` });
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.slice("/rest/v1/".length);
    const params = url.searchParams;
    const tables = {
      seasons: SEASONS,
      country_rarity: COUNTRY_RARITY,
      public_spots: SPOTS,
      spot_point_lines: Object.entries(LINES).flatMap(([spot_id, lines]) => lines.map((l) => ({ spot_id, ...l }))),
      // Barème (page /points) : valeurs par défaut, numeric renvoyé en texte comme PostgREST.
      scoring_rules: [
        { key: "base_points", value: "100" }, { key: "bonus_touristique", value: "20" },
        { key: "bonus_remarquable", value: "50" }, { key: "bonus_isole", value: "100" },
        { key: "bonus_tres_rare", value: "200" },
      ],
      countries: [
        { name_fr: "Argentine", tier: "lointain" }, { name_fr: "Bhoutan", tier: "rare" },
        { name_fr: "Corée du Nord", tier: "extreme" }, { name_fr: "France", tier: "courant" },
      ],
    };
    if (table in tables) return send(res, 200, pick(applyFilters(tables[table], params), params.get("select")));
    // Vue de l'étape 7 absente, comme tant qu'elle n'est pas livrée.
    return send(res, 404, { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` });
  }

  if (url.pathname.startsWith("/storage/v1/object/public/")) {
    // Photo factice : un carré gris (PNG 1×1).
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64",
    );
    res.writeHead(200, { "content-type": "image/png", ...CORS });
    res.end(png);
    return;
  }

  if (url.pathname.startsWith("/auth/v1/")) return send(res, 401, { message: "Pas de session (faux Supabase)" });
  send(res, 404, { message: "Introuvable" });
});

server.listen(MOCK_PORT, "127.0.0.1", () => {
  console.log(`Faux Supabase sur http://127.0.0.1:${MOCK_PORT}`);
});
