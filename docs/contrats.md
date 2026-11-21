# Contrats entre les étapes 4 à 8

Ce document fige ce que chaque étape fournit aux autres, pour qu'elles puissent être
développées en parallèle puis assemblées sans conflit. Les spécifications font foi pour
tout ce qui n'est pas précisé ici ; en cas de contradiction, **ce document l'emporte**
(il corrige quelques incohérences de la spec, signalées par ⚠︎).

## 1. Règles communes

- **Next.js 16** (App Router, `cacheComponents: true`) : avant d'écrire du code Next, lire
  le guide utile dans `node_modules/next/dist/docs/`. Une page qui lit la session, les
  cookies, `searchParams` ou Supabase doit rendre ce contenu dans un `<Suspense>`.
- **Aucune valeur d'environnement au build** : jamais de `NEXT_PUBLIC_*`. Côté serveur,
  `getSupabaseServerClient()` (`src/lib/supabase/server.ts`) ; côté client,
  `getSupabaseBrowserClient()` (`src/lib/supabase/client.ts`) ; session :
  `getSessionUser()`, `requireUser()`, `requireProfile()` (`src/lib/auth/server.ts`).
- **Design system** : utiliser `src/components/ui` (Sticker, MapMarker, ClusterStack,
  PointsBlock, PointsBreakdown, AnimatedPointsBreakdown, PrimaryButton/PrimaryLink,
  TabBar, AlbumTile, ScoreCapsule, Logo) et les jetons Tailwind (`bg-bg`, `bg-card`,
  `text-muted`, `bg-year`, `text-on-year`, `bg-band`, `border-line`, `font-display`…).
  Ne pas modifier ces composants : en créer de nouveaux dans le dossier de son étape.
  Les maquettes sources sont dans `docs/maquettes/*.dc.html`.
- **Textes** : tout en français. Chaque étape crée son module
  `src/i18n/<domaine>.fr.ts` (ex. `src/i18n/map.fr.ts`) ; ne pas modifier `src/i18n/fr.ts`
  sauf l'étape 3.
- **SQL** : partir de zéro droit puis accorder explicitement. Supabase accorde par défaut
  `EXECUTE` sur les nouvelles fonctions à `anon` et `authenticated` : les retirer
  nommément (`revoke execute … from public, anon, authenticated`) puis accorder ce qui
  est voulu. Toujours `grant … to service_role` sur les tables. Fonctions
  `security definer` avec `set search_path = ''` et noms qualifiés (`public.`,
  `extensions.st_…`). PostGIS est dans le schéma `extensions`.
- Le schéma `storage` n'existe pas sur une base Postgres seule : toute création de bucket
  ou de politique Storage est entourée de `if to_regclass('storage.buckets') is not null`
  (voir `supabase/migrations/20261121000000_comptes.sql`).
- **Tests SQL** (pgTAP, `supabase/tests/database/NN_<domaine>.test.sql`) : se connecter
  avec `set local role authenticated` + `set_config('request.jwt.claim.sub', …, true)` et
  `set_config('request.jwt.claims', …, true)` (voir `01_comptes.test.sql`).
- **Base de test locale** (pas de pile Supabase complète dans les conteneurs de dev) :
  `docker run -d --name <nom-unique> supabase/postgres:17.12.0.000` (image déjà
  téléchargée), puis `create extension pgtap with schema extensions`, application des
  migrations dans l'ordre, puis des tests. Chaque agent utilise **son propre nom de
  conteneur** et le supprime à la fin.
- Avant de rendre : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
  `npm run check:bundle`, et les tests pgTAP de son étape.

## 2. Migrations : un fichier par étape, dans cet ordre

| Fichier | Étape | Contenu |
| --- | --- | --- |
| `20261120000000_socle.sql` | 1 | PostGIS, schéma `private`, `schema_version()` |
| `20261121000000_comptes.sql` | 3 | `user_role`, `profiles`, `public_profiles`, `is_admin()`, `is_moderator()`, `private.user_homes`, `set_my_home`/`get_my_home`/`clear_my_home`, bucket `avatars` |
| `20261122000000_modele.sql` | 4 | modèle de données, points, RLS (§3) |
| `20261122000001_pays.sql` | 4 | frontières Natural Earth et niveaux par défaut (données) |
| `20261127000000_publication.sql` | 5 | bucket `spot-photos`, `create_spot`, limites (§4) — renommée : intégrée après les étapes 7 et 8 |
| `20261128000000_carte.sql` | 6 | `spots_in_bbox`, `country_rarity`, `search_spots` (§5) — renommée : intégrée en dernier |
| `20261125000000_classement.sql` | 7 | vue matérialisée `leaderboard`, `refresh_leaderboard`, `profile_stats`, `album` (§6) |
| `20261126000000_admin.sql` | 8 | fonctions admin, journal, file de modération (§7) |

Chaque migration met à jour `public.schema_version()` avec son propre nom.
Une migration ne peut pas être appliquée si une migration plus récente l'est déjà en
production : celles des étapes 5 et 6, intégrées après les étapes 7 et 8, ont donc été
renommées avec un horodatage postérieur.
Les étapes 5 à 8 testent leur SQL en appliquant d'abord les migrations 1, 3 et le
**schéma du §3 tel quel** (copie de travail locale, non commitée, si l'étape 4 n'est pas
encore là).

## 3. Étape 4 · Modèle de données (fourni à tous)

```sql
create type public.country_tier as enum ('courant', 'lointain', 'rare', 'extreme');
create type public.spot_status as enum ('published', 'pending_review', 'hidden');

create table public.seasons (
  year int primary key check (year between 2000 and 2100),
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_current boolean not null default false
);
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.countries (
  iso2 char(2) primary key,
  iso3 char(3) not null unique,
  name_fr text not null,
  tier public.country_tier not null default 'lointain',
  geom extensions.geography(MultiPolygon, 4326) not null
);

create table public.scoring_rules (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.spots (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  location extensions.geography(Point, 4326) not null,         -- exacte
  public_location extensions.geography(Point, 4326) not null,  -- arrondie près d'un domicile
  altitude_m numeric,
  taken_at timestamptz not null,
  year int not null,                     -- ⚠︎ pas de FK vers seasons : année sans couleur = gris
  gps_source text not null check (gps_source in ('exif', 'device', 'manual')),  -- device : migration capture
  date_source text not null check (date_source in ('exif', 'device', 'upload')),
  country_iso2 char(2) references public.countries (iso2),
  city text,
  photo_path text not null,
  status public.spot_status not null,
  is_exceptional boolean not null default false,
  is_first_in_country boolean not null default false,
  points_total int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- index GiST sur location et public_location ; index (author_id, created_at), (status), (country_iso2), (year)

create table public.spot_point_lines (
  spot_id uuid not null references public.spots (id) on delete cascade,
  rule_key text not null,
  position int not null,       -- ordre d'affichage
  label text not null,         -- ex. « Premier sticker du pays »
  detail text,                 -- ex. « 1 240 km du sticker le plus proche »
  points int not null,
  primary key (spot_id, rule_key)
);

create table public.spot_reports (
  spot_id uuid not null references public.spots (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (spot_id, reporter_id)
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
```

**Règles `scoring_rules`** (valeurs par défaut insérées par la migration) :
`tier_courant` 10, `tier_lointain` 25, `tier_rare` 60, `tier_extreme` 150,
`bonus_first_country` 50, `bonus_first_city` 15, `isolation_points_per_10km` 1,
`isolation_cap` 40, `bonus_exceptional` 20, `altitude_threshold_m` 3000,
`bonus_altitude` 15, `home_points_per_1000km` 5, `neighbor_radius_m` 200,
`neighbor_divisor` 4, `home_blur_radius_m` 500, `daily_publish_limit` 20,
`daily_report_limit` 10, `reports_before_review` 3, `edit_radius_m` 200.

**Fonctions fournies par l'étape 4** (toutes `security definer`) :

- `public.compute_spot_points(p_spot_id uuid) returns int` — calcule selon la spec §3.4,
  efface et réécrit `spot_point_lines`, met à jour `points_total`,
  `is_first_in_country`, `updated_at`. « Validé » = `status = 'published'` ;
  « antérieur » = `created_at` plus ancien. Isolement : distance au sticker publié le plus
  proche (hors lui-même), arrondie à la dizaine de km inférieure, `+1/10 km`, plafond 40 ;
  sans autre sticker : plafond. Malus voisin < 200 m : `floor(total / 4)`, avec une ligne
  `rule_key = 'neighbor_malus'` de valeur négative. Un sticker `pending_review` est
  calculé quand même (points affichés « en attente »). Exécutable par `service_role`
  seulement. **Doit redonner exactement les 4 exemples de la spec §3.5** (tests pgTAP).
- `public.recompute_all_points() returns int` — recalcule tous les stickers, dans l'ordre
  de `created_at`, renvoie leur nombre. `service_role` seulement.
- `public.year_color(p_year int) returns text` — couleur de `seasons`, sinon `#9A9A94`.
  Exécutable par tous.
- `public.current_season() returns table (year int, color_hex text)` — la saison
  `is_current`, sinon l'année en cours et `#9A9A94`. Exécutable par tous.
- `public.public_location_for(p_author uuid, p_point extensions.geography)
  returns extensions.geography` — si le point est à moins de `home_blur_radius_m` du
  domicile de l'auteur, renvoie un point **décalé d'au moins 300 m**, arrondi à ~1 km et
  stable (même entrée → même sortie) ; sinon le point lui-même. `service_role` seulement.

**Vue `public.public_spots`** (`security_invoker = false`, lecture pour `anon` et
`authenticated`) : seulement `status = 'published'`, **jamais `location`** :
`id, author_id, author_username, author_avatar_path, name, lat, lng` (de
`public_location`), `altitude_m, taken_at, year, color_hex` (via `year_color`),
`country_iso2, country_name_fr, country_tier, city, photo_path, is_exceptional,
is_first_in_country, points_total, created_at`.

**RLS** (spec §7.2) :
- `spots` : lecture de ses propres stickers (tous statuts) et de tout pour les
  modérateurs ; **aucune insertion** pour `authenticated` (seule l'Edge Function
  `publish-spot`, en `service_role`, insère) ; l'auteur peut modifier `name` uniquement
  (privilège de colonne) et supprimer ; modérateurs : `status`, `is_exceptional` via les
  fonctions admin de l'étape 8.
- `spot_point_lines` : lecture si le sticker parent est lisible (publié, ou à soi, ou
  modérateur) ; écriture par fonctions `security definer` uniquement.
- `seasons`, `countries`, `scoring_rules` : lecture pour tous, écriture admin.
- `spot_reports` : lecture modérateurs ; insertion par un utilisateur connecté, non
  suspendu, une fois par sticker (clé primaire), `reporter_id = auth.uid()`. Un trigger
  incrémente `spots.report_count` et passe le sticker en `pending_review` au 3ᵉ
  signalement distinct.
- `admin_audit_log` : lecture admin ; écriture par triggers/fonctions uniquement.

**Données** : `20261122000001_pays.sql` charge les pays Natural Earth 1:50m ou 1:110m
(admin 0), nom français, et les niveaux par défaut de la spec (courant : Europe de
l'Ouest et centrale, États-Unis, Canada ; rare : Bhoutan, Turkménistan, îles isolées… ;
extrême : Corée du Nord, Antarctique ; le reste lointain). `supabase/seed.sql` : saisons
d'exemple (2024 `#F2C230`, 2025 `#FF7A59`, 2026 `#5B8DEF` courante) et une fonction de
génération de stickers de démo (utilisée plus tard pour 5 000 stickers).

## 4. Étape 5 · Publication

- Bucket `spot-photos` : lecture publique, écriture dans `{auth.uid()}/`, 20 Mo, `image/webp`.
- `public.create_spot(p_author uuid, p_name text, p_lat double precision, p_lng double precision,
  p_altitude_m numeric, p_taken_at timestamptz, p_gps_source text, p_date_source text,
  p_photo_path text, p_city text) returns uuid` — `service_role` seulement : contrôle la
  suspension, la limite quotidienne, la règle « un sticker par 200 m et par jour »,
  déduit `country_iso2` (`ST_Contains`), `year` (de `taken_at`), le statut
  (`pending_review` si `gps_source = 'manual'` ou `date_source = 'upload'` ; les sources `device`,
  position et heure du téléphone pour une photo prise à l'instant, comptent comme vérifiées),
  `public_location` (via `public_location_for`), insère puis appelle
  `compute_spot_points`. Erreurs SQL avec `errcode` dédiés et messages français.
- Edge Function `supabase/functions/publish-spot` : entrée JSON
  `{ photoPath, lat, lng, altitude, takenAt, gpsSource, dateSource, name }`, sortie
  `{ spot: { id, name, city, countryNameFr, year, colorHex, status, pointsTotal,
  isFirstInCountry, isExceptional }, lines: [{ ruleKey, label, detail, points }],
  rank: { before: number | null, after: number | null } }`. Vérifie qu'il ne reste aucune
  donnée EXIF/XMP dans le WebP, et fait le géocodage inverse de la ville (Photon par
  défaut, avec cache et `User-Agent` générique).
- Pages `/spots/new` (parcours en 3 étapes puis « Sticker collé »).

## 5. Étape 6 · Carte et fiche lieu

- `public.spots_in_bbox(min_lng, min_lat, max_lng, max_lat double precision, filters jsonb)
  returns jsonb` (FeatureCollection GeoJSON légère : `id, color, points, gold, pending`)
  — `filters` : `{ "years": int[], "authorId": uuid, "rare": bool, "mine": bool }` ;
  « rare » = anneau doré ou base ≥ 60. Exécutable par tous (`mine` exige d'être connecté).
- `public.country_rarity` (vue) : `iso2, tier, base_points, spot_count`.
- `public.search_spots(q text)` : lieux, pays, pseudos.
- Pages `/` et `/spots/[id]`, et le **gabarit d'application** (`src/components/shell/`) :
  en-tête, colonne de 440 px à gauche + carte à droite à partir de 1024 px, `TabBar` en bas
  sous 768 px. Les autres étapes rendent leur contenu dans ce gabarit.
- PWA (Serwist, manifeste, icônes à partir de `public/tomi/`).

## 6. Étape 7 · Classement, profil et album

- Vue matérialisée `public.leaderboard` : `user_id, username, avatar_path, period`
  (`'all'` ou l'année), `points, countries, stickers, rank_points, rank_countries,
  rank_stickers` — seuls les stickers `published`. `public.refresh_leaderboard()`
  (`service_role`), appelée après publication et modération.
- `public.profile_stats(p_user uuid)` et `public.album(p_user uuid)` (tuiles pays : iso3,
  couleur de l'année du premier sticker de l'utilisateur dans ce pays, points ; plus
  quelques pays à conquérir avec leurs points de base).
- Pages `/leaderboard`, `/me` (remplace la page minimale de l'étape 3), `/u/[username]`.
  `/me/settings` appartient à l'étape 3.

## 7. Étape 8 · Admin

- Pages `/admin/season`, `/admin/moderation`, `/admin/scoring`, `/admin/roles`.
- Fonctions `security definer` qui vérifient `is_admin()` / `is_moderator()`, écrivent
  dans `admin_audit_log` (qui, quoi, avant, après) : `admin_set_season`,
  `admin_validate_spot`, `admin_hide_spot`, `admin_unhide_spot`, `admin_delete_spot`,
  `admin_set_exceptional`, `admin_set_rule`, `admin_set_country_tier`,
  `admin_recompute(p_spot_id uuid default null)`, `admin_set_role`, `admin_suspend`.
- Couleur de l'année : contraste ≥ 4,5:1 avec `#111111` (`isReadableYearColor`), puis
  `revalidateTag('season')`. `getCurrentYearColor()` (`src/lib/season.ts`) lit alors
  `current_season()` **au runtime uniquement**.
