-- Étape 4 · Modèle de données, points et sécurité
-- (spécifications, sections 3, 4.1, 4.2 et 7 ; docs/contrats.md, section 3).
--
-- Même principe qu'à l'étape 3 : zéro droit au départ, puis des droits explicites.
-- Supabase accorde par défaut tout sur les nouvelles tables, vues, séquences et
-- fonctions du schéma public à anon et authenticated : on les retire nommément.
--
-- Les points sont calculés côté serveur uniquement (compute_spot_points), puis figés
-- avec leur détail dans spot_point_lines. Le client ne peut jamais écrire
-- points_total, status, is_first_in_country ni spot_point_lines.

-- Types ------------------------------------------------------------------------

create type public.country_tier as enum ('courant', 'lointain', 'rare', 'extreme');
create type public.spot_status as enum ('published', 'pending_review', 'hidden');

-- Saisons : couleur de chaque année (spécifications, 4.1) ---------------------------

create table public.seasons (
  year int primary key check (year between 2000 and 2100),
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_current boolean not null default false
);
-- Une seule saison courante. L'index n'est pas différable : pour changer de saison,
-- retirer d'abord is_current de l'ancienne, puis le poser sur la nouvelle.
create unique index seasons_one_current on public.seasons (is_current) where is_current;

comment on table public.seasons is
  'Couleur de chaque année. Une année absente utilise le gris #9A9A94 (year_color).';

-- Pays : frontières Natural Earth et niveau de rareté (spécifications, 3.1) ----------

create table public.countries (
  iso2 char(2) primary key,
  iso3 char(3) not null unique,
  name_fr text not null,
  tier public.country_tier not null default 'lointain',
  geom extensions.geography(MultiPolygon, 4326) not null
);
create index countries_geom_idx on public.countries using gist (geom);
-- country_at teste l'appartenance en géométrie plane (lon/lat), comme les données
-- Natural Earth sont dessinées : une frontière droite sur une carte (ex. le
-- 49e parallèle) resterait sinon un arc de grand cercle en geography.
create index countries_geom_geometry_idx on public.countries using gist ((geom::extensions.geometry));

comment on table public.countries is
  'Pays Natural Earth admin 0 (20261122000001_pays.sql), niveau ajustable par un admin.';

-- Barème (spécifications, 3.1 à 3.3) --------------------------------------------------

create table public.scoring_rules (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.scoring_rules is
  'Valeurs du barème. Un changement ne modifie pas les points déjà figés (recalcul explicite).';

insert into public.scoring_rules (key, value) values
  ('tier_courant', 10),
  ('tier_lointain', 25),
  ('tier_rare', 60),
  ('tier_extreme', 150),
  ('bonus_first_country', 50),
  ('bonus_first_city', 15),
  ('isolation_points_per_10km', 1),
  ('isolation_cap', 40),
  ('bonus_exceptional', 20),
  ('altitude_threshold_m', 3000),
  ('bonus_altitude', 15),
  ('home_points_per_1000km', 5),
  ('neighbor_radius_m', 200),
  ('neighbor_divisor', 4),
  ('home_blur_radius_m', 500),
  ('daily_publish_limit', 20),
  ('daily_report_limit', 10),
  ('reports_before_review', 3),
  ('edit_radius_m', 200);

-- Stickers -----------------------------------------------------------------------------

create table public.spots (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  location extensions.geography(Point, 4326) not null,         -- exacte
  public_location extensions.geography(Point, 4326) not null,  -- arrondie près d'un domicile
  altitude_m numeric,
  taken_at timestamptz not null,
  year int not null,                     -- pas de FK vers seasons : année sans couleur = gris
  gps_source text not null check (gps_source in ('exif', 'manual')),
  date_source text not null check (date_source in ('exif', 'upload')),
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
create index spots_location_idx on public.spots using gist (location);
create index spots_public_location_idx on public.spots using gist (public_location);
create index spots_author_created_idx on public.spots (author_id, created_at);
create index spots_status_idx on public.spots (status);
create index spots_country_idx on public.spots (country_iso2);
create index spots_year_idx on public.spots (year);

comment on table public.spots is
  'Stickers. Lecture publique via la vue public_spots uniquement (jamais location).';
comment on column public.spots.location is 'Position exacte : auteur, modérateurs et service_role seulement.';
comment on column public.spots.public_location is 'Position affichée : décalée et arrondie près du domicile de l''auteur.';

-- Détail des points, figé au calcul ------------------------------------------------------

create table public.spot_point_lines (
  spot_id uuid not null references public.spots (id) on delete cascade,
  rule_key text not null,
  position int not null,       -- ordre d'affichage
  label text not null,         -- ex. « Premier sticker du pays »
  detail text,                 -- ex. « 1 240 km du sticker le plus proche »
  points int not null,
  primary key (spot_id, rule_key)
);

comment on table public.spot_point_lines is
  'Une ligne par critère qui rapporte des points, plus la base et le malus voisin. '
  'rule_key : base_country, first_country, first_city, isolation, exceptional, altitude, '
  'home_distance, neighbor_malus. La somme des lignes vaut spots.points_total.';

-- Signalements ---------------------------------------------------------------------------

create table public.spot_reports (
  spot_id uuid not null references public.spots (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (spot_id, reporter_id)
);
create index spot_reports_reporter_created_idx on public.spot_reports (reporter_id, created_at);

-- Journal des actions admin (spécifications, 4) --------------------------------------------

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- Vue publique des stickers ------------------------------------------------------------------
-- security_invoker = false : la vue lit spots avec les droits de son propriétaire et
-- n'expose que les stickers publiés, sans jamais la position exacte.

create view public.public_spots
with (security_invoker = false)
as
  select
    s.id,
    s.author_id,
    p.username as author_username,
    p.avatar_path as author_avatar_path,
    s.name,
    extensions.st_y(s.public_location::extensions.geometry) as lat,
    extensions.st_x(s.public_location::extensions.geometry) as lng,
    s.altitude_m,
    s.taken_at,
    s.year,
    -- Équivaut à public.year_color(s.year), sans appel de fonction par ligne.
    coalesce(se.color_hex, '#9A9A94') as color_hex,
    s.country_iso2,
    c.name_fr as country_name_fr,
    c.tier as country_tier,
    s.city,
    s.photo_path,
    s.is_exceptional,
    s.is_first_in_country,
    s.points_total,
    s.created_at
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  left join public.seasons se on se.year = s.year
  where s.status = 'published';

comment on view public.public_spots is
  'Stickers publiés, position publique seulement (lat, lng de public_location).';

revoke all on public.public_spots from public, anon, authenticated;
grant select on public.public_spots to anon, authenticated, service_role;

-- Droits et RLS ----------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.countries enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.spots enable row level security;
alter table public.spot_point_lines enable row level security;
alter table public.spot_reports enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on
  public.seasons, public.countries, public.scoring_rules, public.spots,
  public.spot_point_lines, public.spot_reports, public.admin_audit_log
from public, anon, authenticated;
revoke all on sequence public.admin_audit_log_id_seq from public, anon, authenticated;

grant all on
  public.seasons, public.countries, public.scoring_rules, public.spots,
  public.spot_point_lines, public.spot_reports, public.admin_audit_log
to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

-- seasons : lecture pour tous, écriture admin.
grant select on public.seasons to anon, authenticated;
grant insert, update, delete on public.seasons to authenticated;

create policy "seasons : lecture pour tous"
  on public.seasons for select to anon, authenticated
  using (true);
create policy "seasons : ajout par un admin"
  on public.seasons for insert to authenticated
  with check ((select public.is_admin()));
create policy "seasons : modification par un admin"
  on public.seasons for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "seasons : suppression par un admin"
  on public.seasons for delete to authenticated
  using ((select public.is_admin()));

-- countries : lecture pour tous ; un admin change le niveau ou le nom, pas les frontières.
grant select on public.countries to anon, authenticated;
grant update (tier, name_fr) on public.countries to authenticated;

create policy "countries : lecture pour tous"
  on public.countries for select to anon, authenticated
  using (true);
create policy "countries : modification par un admin"
  on public.countries for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- scoring_rules : lecture pour tous ; un admin change les valeurs (pas les clés).
grant select on public.scoring_rules to anon, authenticated;
grant update (value) on public.scoring_rules to authenticated;

create policy "scoring_rules : lecture pour tous"
  on public.scoring_rules for select to anon, authenticated
  using (true);
create policy "scoring_rules : modification par un admin"
  on public.scoring_rules for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- spots : aucune insertion par l'API (seule l'Edge Function publish-spot, en
-- service_role, insère) ; l'auteur lit ses stickers, renomme et supprime les siens ;
-- les modérateurs lisent tout. Statut et lieu exceptionnel : fonctions admin (étape 8).
grant select, delete on public.spots to authenticated;
grant update (name) on public.spots to authenticated;

create policy "spots : lecture de ses stickers (modérateurs : tous)"
  on public.spots for select to authenticated
  using (author_id = (select auth.uid()) or (select public.is_moderator()));
create policy "spots : l'auteur renomme son sticker"
  on public.spots for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "spots : l'auteur supprime son sticker"
  on public.spots for delete to authenticated
  using (author_id = (select auth.uid()));

-- spot_point_lines : lecture si le sticker parent est lisible ; écriture par
-- compute_spot_points (security definer) uniquement.
grant select on public.spot_point_lines to anon, authenticated;

create policy "spot_point_lines : lecture des stickers publiés"
  on public.spot_point_lines for select to anon
  using (exists (select 1 from public.public_spots p where p.id = spot_id));
create policy "spot_point_lines : lecture des stickers lisibles"
  on public.spot_point_lines for select to authenticated
  using (
    exists (select 1 from public.public_spots p where p.id = spot_id)
    -- Sous la RLS de spots : ses propres stickers, ou tous pour un modérateur.
    or exists (select 1 from public.spots s where s.id = spot_id)
  );

-- spot_reports : un utilisateur connecté et non suspendu signale une fois un sticker
-- publié d'un autre ; il relit ses signalements, les modérateurs les lisent tous.
grant select on public.spot_reports to authenticated;
grant insert (spot_id, reporter_id, reason) on public.spot_reports to authenticated;

create policy "spot_reports : lecture des siens (modérateurs : tous)"
  on public.spot_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_moderator()));
create policy "spot_reports : signalement par un compte actif"
  on public.spot_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.suspended_at is null
    )
    and exists (
      select 1 from public.public_spots p
      where p.id = spot_id and p.author_id <> (select auth.uid())
    )
  );

-- admin_audit_log : lecture admin ; écriture par fonctions et triggers uniquement.
grant select on public.admin_audit_log to authenticated;

create policy "admin_audit_log : lecture par un admin"
  on public.admin_audit_log for select to authenticated
  using ((select public.is_admin()));

-- Utilitaires privés -------------------------------------------------------------------------

-- 1240 → « 1 240 » (espace fine insécable, comme Intl.NumberFormat("fr-FR")).
create function private.format_int(n bigint)
returns text
language sql
immutable
set search_path = ''
as $$ select regexp_replace(n::text, '(\d)(?=(\d{3})+$)', '\1' || chr(8239), 'g') $$;

-- 5 → « 5 », 2.5 → « 2,5 ».
create function private.format_number(n numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when n = trunc(n) then private.format_int(n::bigint)
    else replace(trim_scale(n)::text, '.', ',')
  end
$$;

-- Valeur d'une règle du barème, chargé en jsonb ; une règle absente est une erreur.
create function private.rule(p_rules jsonb, p_key text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_rules ->> p_key is null then
    raise exception 'Règle de barème manquante : %', p_key using errcode = 'P0002';
  end if;
  return (p_rules ->> p_key)::numeric;
end;
$$;

-- Horodatage des modifications.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger spots_touch_updated_at
  before update on public.spots
  for each row execute function private.touch_updated_at();

-- Qui a changé le barème, et quand.
create function private.scoring_rules_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger scoring_rules_touch
  before update on public.scoring_rules
  for each row execute function private.scoring_rules_touch();

revoke execute on function
  private.format_int(bigint),
  private.format_number(numeric),
  private.rule(jsonb, text),
  private.touch_updated_at(),
  private.scoring_rules_touch()
from public;

-- Couleur de l'année ---------------------------------------------------------------------------

create function public.year_color(p_year int)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.color_hex from public.seasons s where s.year = p_year), '#9A9A94')
$$;

create function public.current_season()
returns table (year int, color_hex text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.year, s.color_hex from public.seasons s where s.is_current
  union all
  select extract(year from now())::int, '#9A9A94'
  where not exists (select 1 from public.seasons s where s.is_current)
$$;

revoke execute on function public.year_color(int), public.current_season()
  from public, anon, authenticated;
grant execute on function public.year_color(int), public.current_season()
  to anon, authenticated, service_role;

-- Pays d'un point ----------------------------------------------------------------------------
-- Le pays qui contient le point ; sinon le plus proche à moins de 25 km (côte, port,
-- îlot absent du 1:50m). Hors de tout pays : null.

create function public.country_at(p_point extensions.geography)
returns char(2)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select c.iso2 from public.countries c
      where extensions.st_intersects(c.geom::extensions.geometry, p_point::extensions.geometry)
      order by c.iso2
      limit 1
    ),
    (
      select c.iso2 from public.countries c
      where extensions.st_dwithin(c.geom, p_point, 25000)
      order by extensions.st_distance(c.geom, p_point), c.iso2
      limit 1
    )
  )
$$;

revoke execute on function public.country_at(extensions.geography) from public, anon, authenticated;
grant execute on function public.country_at(extensions.geography) to service_role;

-- Position publique d'un sticker (spécifications, 2.7) ------------------------------------------
-- À moins de home_blur_radius_m du domicile de l'auteur : centre d'une maille d'environ
-- 1,1 km de côté (0,01° en latitude, largeur corrigée de la latitude) qui contient le
-- point ; si ce centre est à moins de 300 m du point, la maille voisine au nord (au sud
-- près du pôle), donc au moins 800 m. Même entrée, même sortie. Sinon le point lui-même.

create function public.public_location_for(p_author uuid, p_point extensions.geography)
returns extensions.geography
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  min_offset_m constant double precision := 300;
  step_lat constant double precision := 0.01;
  v_home extensions.geography;
  v_radius double precision;
  v_lat double precision;
  v_lng double precision;
  v_step_lng double precision;
  v_cell_lat double precision;
  v_cell_lng double precision;
  v_result extensions.geography;
begin
  if p_point is null then
    return null;
  end if;

  select h.home into v_home from private.user_homes h where h.user_id = p_author;
  select r.value into v_radius from public.scoring_rules r where r.key = 'home_blur_radius_m';
  if v_home is null or not extensions.st_dwithin(p_point, v_home, coalesce(v_radius, 500)) then
    return p_point;
  end if;

  v_lat := extensions.st_y(p_point::extensions.geometry);
  v_lng := extensions.st_x(p_point::extensions.geometry);

  v_cell_lat := least((floor(v_lat / step_lat) + 0.5) * step_lat, 90 - step_lat / 2);
  v_step_lng := step_lat / greatest(cos(radians(v_cell_lat)), 0.05);
  v_cell_lng := (floor(v_lng / v_step_lng) + 0.5) * v_step_lng;
  if v_cell_lng > 180 then
    v_cell_lng := v_cell_lng - v_step_lng;
  elsif v_cell_lng < -180 then
    v_cell_lng := v_cell_lng + v_step_lng;
  end if;

  v_result := extensions.st_setsrid(
    extensions.st_makepoint(round(v_cell_lng::numeric, 6)::float8, round(v_cell_lat::numeric, 6)::float8),
    4326
  )::extensions.geography;

  if extensions.st_distance(v_result, p_point) < min_offset_m then
    v_cell_lat := case
      when v_cell_lat + step_lat < 90 then v_cell_lat + step_lat
      else v_cell_lat - step_lat
    end;
    v_result := extensions.st_setsrid(
      extensions.st_makepoint(round(v_cell_lng::numeric, 6)::float8, round(v_cell_lat::numeric, 6)::float8),
      4326
    )::extensions.geography;
  end if;

  return v_result;
end;
$$;

revoke execute on function public.public_location_for(uuid, extensions.geography)
  from public, anon, authenticated;
grant execute on function public.public_location_for(uuid, extensions.geography) to service_role;

-- Calcul des points (spécifications, 3.2 à 3.4) ------------------------------------------------
-- total = base_pays + premier_pays + premiere_ville + isolement + exceptionnel
--       + altitude + distance_domicile ; voisin validé à moins de 200 m : floor(total / 4).
--
-- Les autres stickers pris en compte sont les stickers « validés antérieurs » : publiés,
-- créés avant celui-ci (ou au même instant), hors lui-même. Le calcul d'un sticker ne
-- dépend donc que de ce qui existait à sa publication : un recalcul (recompute_all_points)
-- redonne les mêmes points si le barème n'a pas changé, et un sticker posé plus tard
-- à côté ne fait jamais perdre de points au premier.

create function public.compute_spot_points(p_spot_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots%rowtype;
  v_rules jsonb;
  v_tier public.country_tier;
  v_country_name text;
  v_city text;
  v_base int;
  v_is_first_country boolean := false;
  v_first_country int := 0;
  v_first_city int := 0;
  v_nearest_m double precision;
  v_isolation_raw numeric;
  v_isolation_cap int;
  v_isolation int;
  v_exceptional int := 0;
  v_altitude int := 0;
  v_home extensions.geography;
  v_home_m double precision;
  v_home_points int := 0;
  v_neighbor_radius numeric;
  v_has_neighbor boolean;
  v_divisor numeric;
  v_subtotal int;
  v_total int;
begin
  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable : %', p_spot_id using errcode = 'P0002';
  end if;

  select jsonb_object_agg(r.key, r.value) into v_rules from public.scoring_rules r;

  -- Points de base du pays : « lointain » si le pays est inconnu (en mer).
  select c.tier, c.name_fr into v_tier, v_country_name
  from public.countries c where c.iso2 = v_spot.country_iso2;
  v_tier := coalesce(v_tier, 'lointain');
  v_base := floor(private.rule(v_rules, 'tier_' || v_tier::text));

  -- Premier sticker du pays.
  v_is_first_country := v_spot.country_iso2 is not null and not exists (
    select 1 from public.spots o
    where o.status = 'published' and o.id <> v_spot.id and o.created_at <= v_spot.created_at
      and o.country_iso2 = v_spot.country_iso2
  );
  if v_is_first_country then
    v_first_country := floor(private.rule(v_rules, 'bonus_first_country'));
  end if;

  -- Première ville (même nom, sans tenir compte de la casse, dans le même pays).
  v_city := nullif(btrim(v_spot.city), '');
  if v_city is not null and not exists (
    select 1 from public.spots o
    where o.status = 'published' and o.id <> v_spot.id and o.created_at <= v_spot.created_at
      and o.country_iso2 is not distinct from v_spot.country_iso2
      and lower(btrim(o.city)) = lower(v_city)
  ) then
    v_first_city := floor(private.rule(v_rules, 'bonus_first_city'));
  end if;

  -- Isolement : distance au sticker validé le plus proche, à la dizaine de km inférieure.
  select extensions.st_distance(o.location, v_spot.location) into v_nearest_m
  from public.spots o
  where o.status = 'published' and o.id <> v_spot.id and o.created_at <= v_spot.created_at
  order by o.location operator(extensions.<->) v_spot.location
  limit 1;

  v_isolation_cap := floor(private.rule(v_rules, 'isolation_cap'));
  if v_nearest_m is null then
    v_isolation := v_isolation_cap;
  else
    v_isolation_raw := floor(v_nearest_m / 10000) * private.rule(v_rules, 'isolation_points_per_10km');
    v_isolation := least(v_isolation_cap, floor(v_isolation_raw));
  end if;

  -- Lieu exceptionnel, coché par un modérateur.
  if v_spot.is_exceptional then
    v_exceptional := floor(private.rule(v_rules, 'bonus_exceptional'));
  end if;

  -- Altitude GPS de la photo.
  if v_spot.altitude_m > private.rule(v_rules, 'altitude_threshold_m') then
    v_altitude := floor(private.rule(v_rules, 'bonus_altitude'));
  end if;

  -- Distance au domicile de l'auteur, par 1 000 km entiers ; 0 sans domicile.
  select h.home into v_home from private.user_homes h where h.user_id = v_spot.author_id;
  if v_home is not null then
    v_home_m := extensions.st_distance(v_home, v_spot.location);
    v_home_points := floor(floor(v_home_m / 1000000) * private.rule(v_rules, 'home_points_per_1000km'));
  end if;

  v_subtotal := v_base + v_first_country + v_first_city + v_isolation
    + v_exceptional + v_altitude + v_home_points;

  -- Malus anti-triche : un autre sticker validé à moins de neighbor_radius_m.
  v_neighbor_radius := private.rule(v_rules, 'neighbor_radius_m');
  v_divisor := private.rule(v_rules, 'neighbor_divisor');
  v_has_neighbor := v_divisor > 1 and exists (
    select 1 from public.spots o
    where o.status = 'published' and o.id <> v_spot.id and o.created_at <= v_spot.created_at
      and extensions.st_dwithin(o.location, v_spot.location, v_neighbor_radius::float8)
  );
  if v_has_neighbor then
    v_total := floor(v_subtotal / v_divisor);
  else
    v_total := v_subtotal;
  end if;

  -- Détail figé, une ligne par critère qui rapporte des points.
  delete from public.spot_point_lines where spot_id = v_spot.id;

  insert into public.spot_point_lines (spot_id, rule_key, position, label, detail, points)
  select v_spot.id, l.rule_key, row_number() over (order by l.ord), l.label, l.detail, l.points
  from (values
    (1, 'base_country',
      case v_tier
        when 'courant' then 'Pays courant'
        when 'lointain' then 'Pays lointain'
        when 'rare' then 'Pays rare'
        else 'Pays extrême'
      end,
      coalesce(v_country_name, 'Hors frontières') || ', points de base',
      v_base, true),
    (2, 'first_country', 'Premier sticker du pays', 'Personne avant toi dans ce pays',
      v_first_country, v_first_country > 0),
    (3, 'first_city', 'Première ville', v_city,
      v_first_city, v_first_city > 0),
    (4, 'isolation', 'Isolement',
      case
        when v_nearest_m is null then 'Aucun autre sticker, plafond'
        else private.format_int((floor(v_nearest_m / 10000) * 10)::bigint)
          || ' km du sticker le plus proche'
          || case when v_isolation_raw >= v_isolation_cap then ', plafond' else '' end
      end,
      v_isolation, v_isolation > 0),
    (5, 'exceptional', 'Lieu exceptionnel', 'Sommet, monument célèbre ou site Unesco',
      v_exceptional, v_exceptional > 0),
    (6, 'altitude', 'Altitude',
      private.format_int(round(v_spot.altitude_m)::bigint) || ' m, plus de '
        || private.format_number(private.rule(v_rules, 'altitude_threshold_m')) || ' m',
      v_altitude, v_altitude > 0),
    (7, 'home_distance', 'Loin de chez toi',
      private.format_int((floor(v_home_m / 100000) * 100)::bigint) || ' km, +'
        || private.format_number(private.rule(v_rules, 'home_points_per_1000km')) || ' par 1' || chr(8239) || '000 km',
      v_home_points, v_home_points > 0),
    -- Sans la distance exacte : elle permettrait de trianguler la position exacte d'un
    -- sticker affiché à une position arrondie (près d'un domicile).
    (8, 'neighbor_malus', 'Sticker voisin',
      'Autre sticker à moins de ' || private.format_number(v_neighbor_radius)
        || ' m, total divisé par ' || private.format_number(v_divisor),
      v_total - v_subtotal, v_has_neighbor)
  ) as l (ord, rule_key, label, detail, points, keep)
  where l.keep;

  update public.spots
  set points_total = v_total, is_first_in_country = v_is_first_country, updated_at = now()
  where id = v_spot.id;

  return v_total;
end;
$$;

-- Recalcul explicite de tous les stickers, du plus ancien au plus récent.
create function public.recompute_all_points()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in select s.id from public.spots s order by s.created_at, s.id loop
    perform public.compute_spot_points(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.compute_spot_points(uuid), public.recompute_all_points()
  from public, anon, authenticated;
grant execute on function public.compute_spot_points(uuid), public.recompute_all_points()
  to service_role;

-- Signalements : limite quotidienne et passage en revue au 3e signalement --------------------

create function private.spot_reports_check_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit numeric;
begin
  select r.value into v_limit from public.scoring_rules r where r.key = 'daily_report_limit';
  if v_limit is not null and (
    select count(*) from public.spot_reports sr
    where sr.reporter_id = new.reporter_id and sr.created_at > now() - interval '1 day'
  ) >= v_limit then
    -- PT429 : PostgREST répond en HTTP 429.
    raise exception 'Tu as atteint la limite de % signalements par jour.', private.format_number(v_limit)
      using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create function private.spot_reports_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spot_id uuid;
  v_count int;
  v_threshold numeric;
begin
  if tg_op = 'DELETE' then
    v_spot_id := old.spot_id;
  else
    v_spot_id := new.spot_id;
  end if;

  select count(*) into v_count from public.spot_reports sr where sr.spot_id = v_spot_id;
  select r.value into v_threshold from public.scoring_rules r where r.key = 'reports_before_review';

  update public.spots s
  set
    report_count = v_count,
    status = case
      when tg_op = 'INSERT' and s.status = 'published' and v_count >= coalesce(v_threshold, 3)
        then 'pending_review'::public.spot_status
      else s.status
    end
  where s.id = v_spot_id;

  return null;
end;
$$;

create trigger spot_reports_check_limit
  before insert on public.spot_reports
  for each row execute function private.spot_reports_check_limit();

create trigger spot_reports_after_change
  after insert or delete on public.spot_reports
  for each row execute function private.spot_reports_after_change();

revoke execute on function
  private.spot_reports_check_limit(),
  private.spot_reports_after_change()
from public;

-- Version du schéma ----------------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261122000000_modele'::text $$;
