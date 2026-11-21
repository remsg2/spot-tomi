-- Lot 0 · Mise en conformité avec le cahier des charges V1.1 (sections 2, 6, 7 et 14).
--
-- 1. Plus aucune notion de domicile : ni bonus « loin de chez toi », ni position
--    floutée. public_location vaut désormais toujours location (colonne gardée :
--    la carte, la recherche et les index la lisent).
-- 2. Éditions : nom, visuel, statut (active ou archivée). La couleur d'une édition
--    passée qui a déjà des stickers est figée ; celle de l'édition en cours (ou à
--    venir) reste modifiable dans l'admin.
-- 3. Villes (GeoNames, données dans 20261130000001_villes.sql) pour l'indice de rareté.
-- 4. Nouveau barème : 100 points de base + bonus de rareté selon la catégorie du lieu
--    (courant 0, touristique 20, remarquable 50, isolé 100, très rare 200). Doublon
--    (autre sticker à moins de 200 m) : pas de bonus de rareté.
-- 5. Journal de points (points_ledger) : chaque changement de points d'un sticker
--    (publication, recalcul, masquage, suppression…) y ajoute une ligne avec son motif ;
--    les corrections manuelles d'un admin aussi. Le classement est la somme du journal,
--    avec un départage stable des ex aequo (date d'atteinte du score, puis nombre de
--    stickers).
--
-- Compatibilité avec la version précédente de l'app (la base change avant le code) :
-- les fonctions du domicile restent, sans effet, jusqu'à une prochaine migration.

-- 1. Domicile ----------------------------------------------------------------------------

create or replace function public.set_my_home(lat double precision, lng double precision)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Le domicile n'existe plus (cahier des charges V1.1) : sans effet.
  return;
end;
$$;

create or replace function public.get_my_home()
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select null::double precision, null::double precision where false
$$;

create or replace function public.clear_my_home()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

comment on function public.set_my_home(double precision, double precision) is
  'Obsolète (plus de domicile) : sans effet, gardée pour la version précédente de l''app.';
comment on function public.get_my_home() is
  'Obsolète (plus de domicile) : ne renvoie rien, gardée pour la version précédente de l''app.';
comment on function public.clear_my_home() is
  'Obsolète (plus de domicile) : sans effet, gardée pour la version précédente de l''app.';

drop function if exists public.public_location_for(uuid, extensions.geography);
drop table if exists private.user_homes;

delete from public.scoring_rules where key in ('home_points_per_1000km', 'home_blur_radius_m');

-- La position publique est la position exacte.
update public.spots set public_location = location
where not extensions.st_equals(public_location::extensions.geometry, location::extensions.geometry);

create function private.spots_public_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.public_location := new.location;
  return new;
end;
$$;

revoke execute on function private.spots_public_location() from public;

create trigger spots_public_location
  before insert or update of location, public_location on public.spots
  for each row execute function private.spots_public_location();

comment on column public.spots.public_location is
  'Position affichée : identique à location (plus de floutage depuis le retrait du domicile).';

-- 2. Éditions ------------------------------------------------------------------------------

alter table public.seasons
  add column name text,
  add column visual_path text,
  add column status text not null default 'active',
  add column created_at timestamptz not null default now();

update public.seasons set name = 'Édition ' || year where name is null;

alter table public.seasons
  alter column name set not null,
  add constraint seasons_name_check check (char_length(btrim(name)) between 1 and 60),
  add constraint seasons_status_check check (status in ('active', 'archived')),
  add constraint seasons_visual_path_check check (
    visual_path is null or visual_path ~ '^[0-9]{4}/[0-9a-f-]{36}\.(webp|png|jpg)$'
  ),
  add constraint seasons_current_active_check check (not (is_current and status = 'archived'));

comment on table public.seasons is
  'Éditions annuelles des stickers : nom, couleur, visuel, statut. Une année absente utilise le gris #9A9A94.';
comment on column public.seasons.status is
  'active : choisissable à la publication (jusqu''à l''édition en cours) ; archived : consultable seulement.';

-- Année de l'édition en cours (ou l'année civile s'il n'y en a pas).
create function public.current_edition_year()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.year from public.seasons s where s.is_current),
    extract(year from now())::int
  )
$$;

revoke execute on function public.current_edition_year() from public, anon, authenticated;
grant execute on function public.current_edition_year() to anon, authenticated, service_role;

-- Nom par défaut, garde-fous de couleur, de statut et de suppression.
create function private.seasons_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current int;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.spots s where s.year = old.year) then
      raise exception 'Une édition qui a des stickers ne peut pas être supprimée : archive-la.'
        using errcode = 'ST806';
    end if;
    return old;
  end if;

  if new.name is null or btrim(new.name) = '' then
    new.name := 'Édition ' || new.year;
  end if;
  new.name := btrim(new.name);

  if tg_op = 'UPDATE'
     and new.color_hex is distinct from old.color_hex
     and coalesce(current_setting('spot_tomi.edition_color_unlock', true), '') <> 'on' then
    select s.year into v_current from public.seasons s where s.is_current and s.year <> old.year;
    if not old.is_current
       and old.year <= coalesce(v_current, extract(year from now())::int)
       and exists (select 1 from public.spots s where s.year = old.year) then
      raise exception 'La couleur d''une édition passée est figée : ses stickers gardent leur couleur.'
        using errcode = 'ST805';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.seasons_guard() from public;

create trigger seasons_guard
  before insert or update or delete on public.seasons
  for each row execute function private.seasons_guard();

-- Éditions pour l'app : publication (selectable), filtres, légende, admin.
create function public.list_editions()
returns table (
  year int,
  name text,
  color_hex text,
  visual_path text,
  status text,
  is_current boolean,
  selectable boolean,
  color_locked boolean,
  spot_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  with cur as (select public.current_edition_year() as y)
  select
    s.year,
    s.name,
    s.color_hex,
    s.visual_path,
    s.status,
    s.is_current,
    s.status = 'active' and s.year <= cur.y,
    not s.is_current and s.year <= cur.y and coalesce(c.n, 0) > 0,
    coalesce(c.n, 0)::int
  from public.seasons s
  cross join cur
  left join (
    select sp.year, count(*) as n from public.spots sp where sp.status = 'published' group by sp.year
  ) c on c.year = s.year
  order by s.year desc
$$;

revoke execute on function public.list_editions() from public, anon, authenticated;
grant execute on function public.list_editions() to anon, authenticated, service_role;

-- Création ou modification d'une édition (admin). p_visual_path : null = inchangé,
-- '' = retiré. La couleur passe le même contrôle de contraste que admin_set_season.
create function public.admin_save_edition(
  p_year int,
  p_name text,
  p_color_hex text,
  p_status text default 'active',
  p_make_current boolean default false,
  p_visual_path text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_color text := upper(btrim(coalesce(p_color_hex, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_status text := coalesce(p_status, 'active');
  v_ratio double precision;
  v_before public.seasons;
  v_after public.seasons;
begin
  perform private.admin_require('admin');
  if p_year is null or p_year not between 2000 and 2100 then
    raise exception 'Année invalide : elle doit être comprise entre 2000 et 2100' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'Nom invalide : 1 à 60 caractères' using errcode = '22023';
  end if;
  if v_color !~ '^#[0-9A-F]{6}$' then
    raise exception 'Couleur invalide : format #RRGGBB attendu' using errcode = '22023';
  end if;
  if v_status not in ('active', 'archived') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;
  if coalesce(p_make_current, false) and v_status = 'archived' then
    raise exception 'L''édition en cours ne peut pas être archivée' using errcode = '22023';
  end if;
  if p_visual_path is not null and p_visual_path <> ''
     and p_visual_path !~ ('^' || p_year || '/[0-9a-f-]{36}\.(webp|png|jpg)$') then
    raise exception 'Chemin de visuel invalide' using errcode = '22023';
  end if;
  v_ratio := private.contrast_ratio(v_color, '#111111');
  if v_ratio < 4.5 then
    raise exception 'Contraste insuffisant avec le texte noir : % pour 1 (minimum 4,5 pour 1)',
      to_char(v_ratio, 'FM90.00') using errcode = 'ST801';
  end if;

  lock table public.seasons in share row exclusive mode;
  select * into v_before from public.seasons where year = p_year;
  if v_before.is_current and v_status = 'archived' then
    raise exception 'L''édition en cours ne peut pas être archivée' using errcode = '22023';
  end if;

  if coalesce(p_make_current, false) then
    update public.seasons set is_current = false where is_current and year <> p_year;
  end if;

  insert into public.seasons as s (year, name, color_hex, status, is_current, visual_path)
  values (
    p_year, v_name, v_color, v_status, coalesce(p_make_current, false),
    nullif(p_visual_path, '')
  )
  on conflict (year) do update
    set name = excluded.name,
        color_hex = excluded.color_hex,
        status = excluded.status,
        is_current = s.is_current or excluded.is_current,
        visual_path = case
          when p_visual_path is null then s.visual_path
          else nullif(p_visual_path, '')
        end
  returning * into v_after;

  perform private.audit(
    case when v_before.year is null then 'edition.create' else 'edition.update' end,
    'season:' || p_year,
    case when v_before.year is null then '{}'::jsonb else to_jsonb(v_before) end,
    to_jsonb(v_after) || jsonb_build_object('contrast', round(v_ratio::numeric, 2))
  );
  return to_jsonb(v_after) || jsonb_build_object('contrast', round(v_ratio::numeric, 2));
end;
$$;

revoke execute on function public.admin_save_edition(int, text, text, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_save_edition(int, text, text, text, boolean, text)
  to authenticated;

-- Visuels des éditions (Storage) : lecture publique, écriture par un admin.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schéma storage absent : bucket editions non créé.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('editions', 'editions', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
  on conflict (id) do nothing;

  execute $policy$
    create policy "editions : ajout par un admin"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'editions' and (select public.is_admin()))
  $policy$;
  execute $policy$
    create policy "editions : remplacement par un admin"
      on storage.objects for update to authenticated
      using (bucket_id = 'editions' and (select public.is_admin()))
  $policy$;
  execute $policy$
    create policy "editions : suppression par un admin"
      on storage.objects for delete to authenticated
      using (bucket_id = 'editions' and (select public.is_admin()))
  $policy$;
end;
$$;

-- 3. Villes ----------------------------------------------------------------------------------

create table public.cities (
  id int primary key,
  name text not null,
  country_iso2 char(2),
  population int not null,
  is_capital boolean not null default false,
  lng double precision not null,
  lat double precision not null,
  location extensions.geography(Point, 4326)
);
create index cities_location_idx on public.cities using gist (location);

comment on table public.cities is
  'Villes de plus de 15 000 habitants et capitales (GeoNames, CC BY 4.0) : indice de rareté et badges.';

alter table public.cities enable row level security;
revoke all on public.cities from public, anon, authenticated;
grant all on public.cities to service_role;
grant select on public.cities to anon, authenticated;
create policy "cities : lecture pour tous" on public.cities for select to anon, authenticated using (true);

-- 4. Barème et stickers ------------------------------------------------------------------------

create type public.rarity_category as enum ('courant', 'touristique', 'remarquable', 'isole', 'tres_rare');

alter table public.spots
  add column base_points int not null default 0,
  add column rarity_bonus int not null default 0,
  add column rarity_category public.rarity_category not null default 'courant',
  add column rarity_override public.rarity_category,
  add column rarity_reason text,
  add column is_tourist_spot boolean not null default false,
  add column nearest_city_km numeric,
  add column needs_review boolean not null default false,
  add column review_reason text,
  add column comment text check (comment is null or char_length(comment) <= 500),
  add column thumb_path text,
  add column original_location extensions.geography(Point, 4326),
  add column altitude_source text check (altitude_source in ('exif', 'dem')),
  add column photo_hash bigint;

update public.spots set original_location = location where original_location is null;
update public.spots set altitude_source = 'exif' where altitude_m is not null and altitude_source is null;

-- Position d'origine : référence des modifications de position par le membre.
create function private.spots_original_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.original_location := coalesce(new.original_location, new.location);
  return new;
end;
$$;

revoke execute on function private.spots_original_location() from public;

create trigger spots_original_location
  before insert on public.spots
  for each row execute function private.spots_original_location();

comment on column public.spots.thumb_path is 'Miniature WebP (480 px) dans spot-photos, à côté de la photo.';
comment on column public.spots.original_location is 'Position à la publication : une modification par le membre reste dans edit_radius_m.';
comment on column public.spots.altitude_source is 'exif : GPS de la photo ; dem : service d''élévation (modèle numérique de terrain).';
comment on column public.spots.photo_hash is 'Empreinte perceptuelle (dHash 64 bits) : détection des photos très proches.';
comment on column public.spots.review_reason is 'Pourquoi le sticker est « à vérifier » (position à la main, photo très proche…).';

comment on column public.spots.base_points is 'Points de base (règle base_points), figés au calcul.';
comment on column public.spots.rarity_bonus is 'Bonus de rareté retenu (0 pour un doublon), figé au calcul.';
comment on column public.spots.rarity_category is 'Catégorie retenue : automatique, ou choisie par la modération.';
comment on column public.spots.rarity_override is 'Catégorie choisie par un modérateur (null : automatique).';
comment on column public.spots.is_tourist_spot is 'Site touristique ou historique OpenStreetMap à proximité (géocodage).';
comment on column public.spots.needs_review is 'Position placée à la main : publié, mais signalé « à vérifier » aux modérateurs.';
comment on column public.spots.comment is 'Commentaire facultatif du membre (longueur maximale : règle comment_max_length).';
comment on column public.spots.taken_at is 'Date du collage déclarée par le membre (préremplie avec celle de la photo).';
comment on column public.spots.year is 'Édition du sticker, choisie par le membre (couleur du marqueur).';

-- is_exceptional (« Site remarquable ») suit la catégorie choisie par la modération.
update public.spots set rarity_override = 'remarquable' where is_exceptional;

delete from public.scoring_rules where key in (
  'tier_courant', 'tier_lointain', 'tier_rare', 'tier_extreme',
  'bonus_first_country', 'bonus_first_city', 'isolation_points_per_10km', 'isolation_cap',
  'bonus_exceptional', 'altitude_threshold_m', 'bonus_altitude', 'neighbor_divisor'
);

insert into public.scoring_rules (key, value) values
  ('base_points', 100),
  ('bonus_touristique', 20),
  ('bonus_remarquable', 50),
  ('bonus_isole', 100),
  ('bonus_tres_rare', 200),
  ('isole_city_km', 50),
  ('tres_rare_city_km', 300),
  ('isole_altitude_m', 3000),
  ('tres_rare_altitude_m', 4000),
  ('comment_max_length', 280),
  ('edit_window_days', 7)
on conflict (key) do nothing;

comment on table public.scoring_rules is
  'Barème (cahier des charges, 7) et paramètres. Un changement ne modifie pas les points figés : recalcul explicite.';

-- Libellé et bonus d'une catégorie.
create function public.rarity_label(p_category public.rarity_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'courant' then 'Lieu courant'
    when 'touristique' then 'Lieu touristique'
    when 'remarquable' then 'Site remarquable'
    when 'isole' then 'Lieu isolé'
    else 'Lieu très rare'
  end
$$;

revoke execute on function public.rarity_label(public.rarity_category) from public, anon, authenticated;
grant execute on function public.rarity_label(public.rarity_category) to anon, authenticated, service_role;

create function private.rarity_bonus(p_rules jsonb, p_category public.rarity_category)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'courant' then 0
    else floor(private.rule(p_rules, 'bonus_' || p_category::text))::int
  end
$$;

revoke execute on function private.rarity_bonus(jsonb, public.rarity_category) from public;

-- Catégorie automatique d'un point (indice Spotomi V1) et son motif.
-- La plus haute l'emporte : très rare > isolé > touristique > courant.
-- « Remarquable » n'est jamais automatique : un modérateur le choisit.
create function private.auto_rarity(
  p_rules jsonb,
  p_country_iso2 text,
  p_altitude_m numeric,
  p_city_m double precision,
  p_city_name text,
  p_tourist boolean
)
returns table (category public.rarity_category, reason text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tier public.country_tier;
  v_country text;
  v_city_km numeric := floor(p_city_m / 1000);
  v_city text := case
    when p_city_m is null then null
    else private.format_int(floor(p_city_m / 1000)::bigint) || ' km de la ville la plus proche ('
      || p_city_name || ')'
  end;
  v_alt text := case
    when p_altitude_m is null then null
    else private.format_int(round(p_altitude_m)::bigint) || ' m d''altitude'
  end;
begin
  select c.tier, c.name_fr into v_tier, v_country from public.countries c where c.iso2 = p_country_iso2;

  if v_tier = 'extreme' then
    return query select 'tres_rare'::public.rarity_category, 'Pays très rare : ' || v_country;
  elsif p_altitude_m >= private.rule(p_rules, 'tres_rare_altitude_m') then
    return query select 'tres_rare'::public.rarity_category, v_alt;
  elsif v_city_km >= private.rule(p_rules, 'tres_rare_city_km') then
    return query select 'tres_rare'::public.rarity_category, v_city;
  elsif p_country_iso2 is null then
    return query select 'isole'::public.rarity_category, 'En mer ou hors de tout pays'::text;
  elsif v_tier = 'rare' then
    return query select 'isole'::public.rarity_category, 'Pays rare : ' || v_country;
  elsif p_altitude_m >= private.rule(p_rules, 'isole_altitude_m') then
    return query select 'isole'::public.rarity_category, v_alt;
  elsif v_city_km >= private.rule(p_rules, 'isole_city_km') then
    return query select 'isole'::public.rarity_category, v_city;
  elsif coalesce(p_tourist, false) then
    return query select 'touristique'::public.rarity_category, 'Site touristique ou historique à proximité'::text;
  else
    return query select 'courant'::public.rarity_category, 'Ville ou lieu fréquenté'::text;
  end if;
end;
$$;

revoke execute on function private.auto_rarity(jsonb, text, numeric, double precision, text, boolean) from public;

-- Ville la plus proche d'un point (distance en mètres), ou rien sans données.
create function private.nearest_city(p_point extensions.geography)
returns table (name text, distance_m double precision)
language sql
stable
set search_path = ''
as $$
  select c.name, extensions.st_distance(c.location, p_point)
  from public.cities c
  where c.location is not null
  order by c.location operator(extensions.<->) p_point
  limit 1
$$;

revoke execute on function private.nearest_city(extensions.geography) from public;

-- 5. Journal de points ----------------------------------------------------------------------

create table public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Pas de clé étrangère : la trace d'un sticker supprimé reste lisible.
  spot_id uuid,
  year int,
  kind text not null check (kind in ('spot', 'correction')),
  base_points int not null default 0,
  rarity_bonus int not null default 0,
  points int not null,
  reason text not null check (char_length(reason) between 1 and 300),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at);
create index points_ledger_spot_idx on public.points_ledger (spot_id) where spot_id is not null;

comment on table public.points_ledger is
  'Journal de points (cahier des charges, 14) : une ligne par variation. Le score d''un membre est la '
  'somme de ses lignes ; kind = spot (suit le sticker) ou correction (manuelle, par un admin).';

alter table public.points_ledger enable row level security;
revoke all on public.points_ledger from public, anon, authenticated;
revoke all on sequence public.points_ledger_id_seq from public, anon, authenticated;
grant all on public.points_ledger to service_role;
grant usage, select on sequence public.points_ledger_id_seq to service_role;
grant select on public.points_ledger to authenticated;

create policy "points_ledger : lecture du sien (admins : tout)"
  on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Motif des lignes écrites par la suite de la transaction (fonctions admin, calcul).
create function private.set_ledger_reason(p_reason text)
returns void
language sql
volatile
set search_path = ''
as $$ select set_config('spot_tomi.ledger_reason', left(coalesce(p_reason, ''), 300), true) $$;

revoke execute on function private.set_ledger_reason(text) from public;

-- Met le journal d'un sticker en accord avec son état : ses points comptent tant qu'il
-- est publié, dans son édition. Écrit au plus une ligne par édition concernée.
create function private.sync_spot_ledger(
  p_spot_id uuid,
  p_author uuid,
  p_year int,
  p_counts boolean,
  p_base int,
  p_bonus int,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := coalesce(
    nullif(p_reason, ''),
    nullif(current_setting('spot_tomi.ledger_reason', true), ''),
    'Mise à jour du sticker'
  );
  v_actor uuid := auth.uid();
  r record;
begin
  if not exists (select 1 from public.profiles p where p.id = p_author) then
    return; -- compte en cours de suppression : son journal part avec lui
  end if;

  for r in
    with current as (
      select l.year, sum(l.base_points)::int as base, sum(l.rarity_bonus)::int as bonus
      from public.points_ledger l
      where l.spot_id = p_spot_id and l.kind = 'spot'
      group by l.year
    ),
    target as (
      select p_year as year, p_base as base, p_bonus as bonus where p_counts
    )
    select
      coalesce(t.year, c.year) as year,
      coalesce(t.base, 0) - coalesce(c.base, 0) as d_base,
      coalesce(t.bonus, 0) - coalesce(c.bonus, 0) as d_bonus
    from current c
    full join target t on t.year = c.year
  loop
    if r.d_base <> 0 or r.d_bonus <> 0 then
      insert into public.points_ledger (user_id, spot_id, year, kind, base_points, rarity_bonus, points, reason, actor_id)
      values (p_author, p_spot_id, r.year, 'spot', r.d_base, r.d_bonus, r.d_base + r.d_bonus, v_reason, v_actor);
    end if;
  end loop;
end;
$$;

revoke execute on function private.sync_spot_ledger(uuid, uuid, int, boolean, int, int, text) from public;

create function private.spots_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_spot_ledger(old.id, old.author_id, old.year, false, 0, 0,
      coalesce(nullif(current_setting('spot_tomi.ledger_reason', true), ''), 'Suppression du sticker')
        || ' : ' || old.name);
    return old;
  end if;
  perform private.sync_spot_ledger(new.id, new.author_id, new.year, new.status = 'published',
    new.base_points, new.rarity_bonus, null);
  return null;
end;
$$;

revoke execute on function private.spots_ledger_trigger() from public;

create trigger spots_ledger_change
  after insert or update of status, year, base_points, rarity_bonus on public.spots
  for each row execute function private.spots_ledger_trigger();

create trigger spots_ledger_delete
  before delete on public.spots
  for each row execute function private.spots_ledger_trigger();

-- Calcul des points (cahier des charges, 7) ------------------------------------------------
-- total = base_points + bonus de la catégorie de rareté ; doublon (autre sticker publié
-- antérieur à moins de neighbor_radius_m) : pas de bonus. Les stickers pris en compte
-- sont ceux publiés et créés avant (ou au même instant), hors lui-même : un recalcul
-- redonne les mêmes points si le barème n'a pas changé.

drop function if exists public.compute_spot_points(uuid);

create function public.compute_spot_points(p_spot_id uuid, p_reason text default null)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots%rowtype;
  v_rules jsonb;
  v_city_name text;
  v_city_m double precision;
  v_auto public.rarity_category;
  v_auto_reason text;
  v_category public.rarity_category;
  v_reason text;
  v_base int;
  v_category_bonus int;
  v_bonus int;
  v_radius numeric;
  v_has_neighbor boolean;
  v_is_first_country boolean;
begin
  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable : %', p_spot_id using errcode = 'P0002';
  end if;

  select jsonb_object_agg(r.key, r.value) into v_rules from public.scoring_rules r;
  v_base := floor(private.rule(v_rules, 'base_points'));

  select c.name, c.distance_m into v_city_name, v_city_m from private.nearest_city(v_spot.location) c;
  select a.category, a.reason into v_auto, v_auto_reason
  from private.auto_rarity(v_rules, v_spot.country_iso2, v_spot.altitude_m, v_city_m, v_city_name,
    v_spot.is_tourist_spot) a;

  if v_spot.rarity_override is not null then
    v_category := v_spot.rarity_override;
    v_reason := 'Catégorie choisie par la modération';
  else
    v_category := v_auto;
    v_reason := v_auto_reason;
  end if;
  v_category_bonus := private.rarity_bonus(v_rules, v_category);

  v_radius := private.rule(v_rules, 'neighbor_radius_m');
  v_has_neighbor := exists (
    select 1 from public.spots o
    where o.status = 'published' and o.id <> v_spot.id and o.created_at <= v_spot.created_at
      and extensions.st_dwithin(o.location, v_spot.location, v_radius::float8)
  );
  v_bonus := case when v_has_neighbor then 0 else v_category_bonus end;

  v_is_first_country := v_spot.country_iso2 is not null and not exists (
    select 1 from public.spots o
    where o.status = 'published' and o.id <> v_spot.id and o.created_at <= v_spot.created_at
      and o.country_iso2 = v_spot.country_iso2
  );

  delete from public.spot_point_lines where spot_id = v_spot.id;
  insert into public.spot_point_lines (spot_id, rule_key, position, label, detail, points)
  select v_spot.id, l.rule_key, row_number() over (order by l.ord), l.label, l.detail, l.points
  from (values
    (1, 'base', 'Sticker publié', 'Points de base', v_base, true),
    (2, 'rarity', public.rarity_label(v_category), v_reason, v_category_bonus, true),
    (3, 'duplicate', 'Sticker voisin',
      'Un autre sticker est à moins de ' || private.format_number(v_radius)
        || ' m : pas de bonus de rareté',
      -v_category_bonus, v_has_neighbor and v_category_bonus > 0)
  ) as l (ord, rule_key, label, detail, points, keep)
  where l.keep;

  perform private.set_ledger_reason(coalesce(p_reason, 'Calcul des points'));
  update public.spots
  set base_points = v_base,
      rarity_bonus = v_bonus,
      rarity_category = v_category,
      rarity_reason = v_reason,
      nearest_city_km = case when v_city_m is null then null else round((v_city_m / 1000)::numeric, 1) end,
      points_total = v_base + v_bonus,
      is_first_in_country = v_is_first_country,
      is_exceptional = coalesce(v_spot.rarity_override = 'remarquable', false),
      updated_at = now()
  where id = v_spot.id;
  perform private.set_ledger_reason(null);

  return v_base + v_bonus;
end;
$$;

comment on function public.compute_spot_points(uuid, text) is
  'Points d''un sticker : base + bonus de rareté (doublon : pas de bonus). Le journal suit (trigger).';

drop function if exists public.recompute_all_points();

create function public.recompute_all_points(p_reason text default null)
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
    perform public.compute_spot_points(v_id, coalesce(p_reason, 'Recalcul de tous les stickers'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.compute_spot_points(uuid, text), public.recompute_all_points(text)
  from public, anon, authenticated;
grant execute on function public.compute_spot_points(uuid, text), public.recompute_all_points(text)
  to service_role;

-- Potentiel d'un pays pour les tuiles « à conquérir » et la coloration : base + bonus
-- de son niveau (rare : isolé, extrême : très rare, sinon rien).
create function public.country_potential_points(p_tier public.country_tier)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select r.value from public.scoring_rules r where r.key = 'base_points'), 100)
    + case p_tier
        when 'rare' then coalesce((select r.value from public.scoring_rules r where r.key = 'bonus_isole'), 100)
        when 'extreme' then coalesce((select r.value from public.scoring_rules r where r.key = 'bonus_tres_rare'), 200)
        else 0
      end
  )::int
$$;

revoke execute on function public.country_potential_points(public.country_tier) from public, anon, authenticated;
grant execute on function public.country_potential_points(public.country_tier) to anon, authenticated, service_role;

create or replace view public.country_rarity
with (security_invoker = false)
as
  select
    c.iso2,
    c.tier,
    public.country_potential_points(c.tier) as base_points,
    coalesce(sc.spot_count, 0)::int as spot_count
  from public.countries c
  left join (
    select country_iso2, count(*) as spot_count
    from public.spots
    where status = 'published'
    group by country_iso2
  ) sc on sc.country_iso2 = c.iso2;

comment on view public.country_rarity is
  'Pays : niveau, points possibles (base + bonus du niveau) et nombre de stickers publiés.';

-- Vue publique : nouvelles colonnes à la fin (create or replace view).
create or replace view public.public_spots
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
    coalesce(se.color_hex, '#9A9A94') as color_hex,
    s.country_iso2,
    c.name_fr as country_name_fr,
    c.tier as country_tier,
    s.city,
    s.photo_path,
    s.is_exceptional,
    s.is_first_in_country,
    s.points_total,
    s.created_at,
    s.comment,
    s.base_points,
    s.rarity_bonus,
    s.rarity_category,
    s.rarity_reason,
    coalesce(se.name, 'Édition ' || s.year) as edition_name,
    s.thumb_path
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  left join public.seasons se on se.year = s.year
  where s.status = 'published';

-- Classement : somme du journal --------------------------------------------------------------
-- Départage stable (cahier des charges, 7) : à égalité, celui qui a atteint son score le
-- premier, puis celui qui a le plus de stickers. Plus d'ex aequo : rang = position.

drop materialized view if exists public.leaderboard;

create materialized view public.leaderboard as
with published as (
  select s.author_id, s.year, s.country_iso2, s.created_at
  from public.spots s
  where s.status = 'published'
),
points as (
  select l.user_id, 'all'::text as period, sum(l.points)::int as points, max(l.created_at) as points_at
  from public.points_ledger l
  group by l.user_id
  union all
  select l.user_id, l.year::text, sum(l.points)::int, max(l.created_at)
  from public.points_ledger l
  where l.year is not null
  group by l.user_id, l.year
),
stickers as (
  select p.author_id as user_id, 'all'::text as period, count(*)::int as stickers,
         count(distinct p.country_iso2)::int as countries, max(p.created_at) as stickers_at
  from published p
  group by p.author_id
  union all
  select p.author_id, p.year::text, count(*)::int, count(distinct p.country_iso2)::int, max(p.created_at)
  from published p
  group by p.author_id, p.year
),
country_firsts as (
  select f.user_id, f.period, max(f.first_at) as countries_at
  from (
    select p.author_id as user_id, 'all'::text as period, p.country_iso2, min(p.created_at) as first_at
    from published p where p.country_iso2 is not null
    group by p.author_id, p.country_iso2
    union all
    select p.author_id, p.year::text, p.country_iso2, min(p.created_at)
    from published p where p.country_iso2 is not null
    group by p.author_id, p.year, p.country_iso2
  ) f
  group by f.user_id, f.period
),
totals as (
  select
    coalesce(pt.user_id, st.user_id) as user_id,
    coalesce(pt.period, st.period) as period,
    coalesce(pt.points, 0) as points,
    coalesce(st.countries, 0) as countries,
    coalesce(st.stickers, 0) as stickers,
    coalesce(pt.points_at, st.stickers_at) as points_at,
    st.stickers_at,
    cf.countries_at
  from points pt
  full join stickers st on st.user_id = pt.user_id and st.period = pt.period
  left join country_firsts cf
    on cf.user_id = coalesce(pt.user_id, st.user_id) and cf.period = coalesce(pt.period, st.period)
)
select
  t.user_id,
  pr.username,
  pr.avatar_path,
  t.period,
  t.points,
  t.countries,
  t.stickers,
  row_number() over (
    partition by t.period order by t.points desc, t.points_at nulls last, t.stickers desc, t.user_id
  )::int as rank_points,
  row_number() over (
    partition by t.period order by t.countries desc, t.countries_at nulls last, t.stickers desc, t.user_id
  )::int as rank_countries,
  row_number() over (
    partition by t.period order by t.stickers desc, t.stickers_at nulls last, t.points desc, t.user_id
  )::int as rank_stickers,
  t.points_at
from totals t
join public.profiles pr on pr.id = t.user_id
where t.stickers > 0 or t.points <> 0;

comment on materialized view public.leaderboard is
  'Classement par période (''all'' ou l''année) : points (somme du journal), pays et stickers publiés. '
  'Rangs sans ex aequo : date d''atteinte du score, puis nombre de stickers.';

create unique index leaderboard_period_user_key on public.leaderboard (period, user_id);
create index leaderboard_period_rank_points_idx on public.leaderboard (period, rank_points);
create index leaderboard_period_rank_countries_idx on public.leaderboard (period, rank_countries);
create index leaderboard_period_rank_stickers_idx on public.leaderboard (period, rank_stickers);

revoke all on public.leaderboard from public, anon, authenticated;
grant select on public.leaderboard to service_role;

-- Album : « à conquérir » affiche les points possibles du pays.
create or replace function public.album(p_user uuid)
returns table (
  iso2 text,
  iso3 text,
  name_fr text,
  tier public.country_tier,
  conquered boolean,
  first_year int,
  color_hex text,
  points int,
  stickers int,
  gold boolean,
  suggestion_rank int
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select s.id, s.country_iso2, s.year, s.taken_at, s.created_at, s.points_total, s.is_first_in_country
    from public.spots s
    where s.author_id = p_user and s.status = 'published' and s.country_iso2 is not null
  ),
  conquered as (
    select
      m.country_iso2,
      (array_agg(m.year order by m.taken_at, m.created_at, m.id))[1] as first_year,
      min(m.taken_at) as first_taken_at,
      sum(m.points_total)::int as points,
      count(*)::int as stickers,
      bool_or(m.is_first_in_country) as gold
    from mine m
    group by m.country_iso2
  ),
  candidates as (
    select
      c.iso2,
      c.iso3,
      c.name_fr,
      c.tier,
      row_number() over (
        partition by c.tier
        order by
          exists (
            select 1 from public.spots o
            where o.country_iso2 = c.iso2 and o.status = 'published'
          ),
          md5(coalesce(p_user::text, '') || c.iso2)
      )::int as suggestion_rank
    from public.countries c
    where not exists (select 1 from conquered q where q.country_iso2 = c.iso2)
  )
  select
    c.iso2::text, c.iso3::text, c.name_fr, c.tier,
    true, q.first_year, public.year_color(q.first_year), q.points, q.stickers, q.gold,
    null::int
  from conquered q
  join public.countries c on c.iso2 = q.country_iso2
  union all
  select
    k.iso2::text, k.iso3::text, k.name_fr, k.tier,
    false, null::int, null::text,
    public.country_potential_points(k.tier),
    0, false,
    k.suggestion_rank
  from candidates k
  where k.suggestion_rank <= 3
  order by 5 desc, 6, 11, 4, 3
$$;

-- Journal d'un membre pour son profil (historique de progression) : le sien, ou celui
-- d'un autre (agrégé par jour, sans les motifs).
create function public.my_points_history(p_limit int default 100)
returns table (
  id bigint,
  spot_id uuid,
  spot_name text,
  year int,
  kind text,
  points int,
  reason text,
  created_at timestamptz,
  running_total int
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.*, sum(l.points) over (order by l.created_at, l.id)::int as running_total
    from public.points_ledger l
    where l.user_id = auth.uid()
  )
  select m.id, m.spot_id, s.name, m.year, m.kind, m.points, m.reason, m.created_at, m.running_total
  from mine m
  left join public.spots s on s.id = m.spot_id
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

revoke execute on function public.my_points_history(int) from public, anon, authenticated;
grant execute on function public.my_points_history(int) to authenticated, service_role;

-- Progression publique : score cumulé à la fin de chaque jour où il a changé.
create function public.points_progress(p_user uuid)
returns table (day date, points int)
language sql
stable
security definer
set search_path = ''
as $$
  with daily as (
    select (l.created_at at time zone 'Europe/Paris')::date as day, sum(l.points) as delta
    from public.points_ledger l
    where l.user_id = p_user
    group by 1
  )
  select d.day, (sum(d.delta) over (order by d.day))::int
  from daily d
  order by d.day
$$;

revoke execute on function public.points_progress(uuid) from public, anon, authenticated;
grant execute on function public.points_progress(uuid) to anon, authenticated, service_role;

-- Fonctions admin : points et rareté ---------------------------------------------------------

drop function if exists public.admin_recompute(uuid);

-- Recalcul explicite, motif obligatoire : un sticker (p_spot_id) ou tous (null).
create function public.admin_recompute(p_spot_id uuid default null, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_spot public.spots;
  v_count int;
  v_sum_before bigint;
  v_sum_after bigint;
  v_result jsonb;
begin
  perform private.admin_require('admin');
  if char_length(v_reason) not between 3 and 200 then
    raise exception 'Motif obligatoire (3 à 200 caractères)' using errcode = '22023';
  end if;

  if p_spot_id is null then
    select coalesce(sum(points_total), 0) into v_sum_before from public.spots;
    v_count := public.recompute_all_points('Recalcul : ' || v_reason);
    select coalesce(sum(points_total), 0) into v_sum_after from public.spots;
    v_result := jsonb_build_object('count', v_count, 'points_before', v_sum_before, 'points_after', v_sum_after);
    perform private.audit('points.recompute', 'spots:all',
      jsonb_build_object('points_total', v_sum_before),
      jsonb_build_object('count', v_count, 'points_total', v_sum_after, 'reason', v_reason));
  else
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
      raise exception 'Sticker introuvable' using errcode = 'P0002';
    end if;
    v_sum_before := v_spot.points_total;
    perform public.compute_spot_points(p_spot_id, 'Recalcul : ' || v_reason);
    select points_total into v_sum_after from public.spots where id = p_spot_id;
    v_result := jsonb_build_object('count', 1, 'spot_id', p_spot_id, 'name', v_spot.name,
      'points_before', v_sum_before, 'points_after', v_sum_after);
    perform private.audit('points.recompute', 'spot:' || p_spot_id,
      jsonb_build_object('points_total', v_sum_before),
      jsonb_build_object('points_total', v_sum_after, 'reason', v_reason));
  end if;

  perform private.refresh_leaderboard_if_present();
  return v_result;
end;
$$;

-- Correction manuelle (ajout ou retrait), motif obligatoire, tracée au journal de points
-- et au journal d'administration.
create function public.admin_adjust_points(
  p_user uuid,
  p_points int,
  p_reason text,
  p_year int default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_username text;
  v_id bigint;
begin
  perform private.admin_require('admin');
  if p_points is null or p_points = 0 or abs(p_points) > 100000 then
    raise exception 'Nombre de points invalide (non nul, 100 000 au plus)' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 3 and 200 then
    raise exception 'Motif obligatoire (3 à 200 caractères)' using errcode = '22023';
  end if;
  if p_year is not null and p_year not between 2000 and 2100 then
    raise exception 'Édition invalide' using errcode = '22023';
  end if;
  select username into v_username from public.profiles where id = p_user;
  if not found then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  insert into public.points_ledger (user_id, year, kind, points, reason, actor_id)
  values (p_user, p_year, 'correction', p_points, 'Correction : ' || v_reason, auth.uid())
  returning id into v_id;

  perform private.audit('points.adjust', 'user:' || p_user, '{}'::jsonb,
    jsonb_build_object('username', v_username, 'points', p_points, 'year', p_year, 'reason', v_reason,
      'ledger_id', v_id));
  perform private.refresh_leaderboard_if_present();
  return jsonb_build_object('id', v_id, 'user_id', p_user, 'username', v_username, 'points', p_points);
end;
$$;

-- Catégorie de rareté choisie par la modération (null : automatique), motif obligatoire.
create function public.admin_set_rarity(p_spot_id uuid, p_category text, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_category public.rarity_category;
  v_spot public.spots;
  v_before jsonb;
  v_after jsonb;
begin
  perform private.admin_require('moderator');
  if char_length(v_reason) not between 3 and 200 then
    raise exception 'Motif obligatoire (3 à 200 caractères)' using errcode = '22023';
  end if;
  if p_category is not null and p_category not in ('courant', 'touristique', 'remarquable', 'isole', 'tres_rare') then
    raise exception 'Catégorie inconnue : %', p_category using errcode = '22023';
  end if;
  v_category := p_category::public.rarity_category;

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  v_before := private.spot_snapshot(v_spot) || jsonb_build_object('rarity_override', v_spot.rarity_override);

  update public.spots set rarity_override = v_category where id = p_spot_id;
  perform public.compute_spot_points(p_spot_id, 'Catégorie de rareté : ' || v_reason);

  select * into v_spot from public.spots where id = p_spot_id;
  v_after := private.spot_snapshot(v_spot)
    || jsonb_build_object('rarity_override', v_spot.rarity_override, 'reason', v_reason);
  perform private.audit('spot.rarity', 'spot:' || p_spot_id, v_before, v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- « Site remarquable » (ancien « lieu exceptionnel ») : raccourci de admin_set_rarity.
create or replace function public.admin_set_exceptional(p_spot_id uuid, p_exceptional boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_exceptional is null then
    raise exception 'Valeur manquante' using errcode = '22023';
  end if;
  return public.admin_set_rarity(
    p_spot_id,
    case when p_exceptional then 'remarquable' end,
    case when p_exceptional then 'Site remarquable' else 'Catégorie automatique' end
  );
end;
$$;

-- Règles : contrôle des nouvelles clés (le diviseur du malus n'existe plus).
create or replace function public.admin_set_rule(p_key text, p_value numeric)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rule public.scoring_rules;
  v_after public.scoring_rules;
begin
  perform private.admin_require('admin');

  select * into v_rule from public.scoring_rules where key = p_key for update;
  if not found then
    raise exception 'Règle inconnue : %', p_key using errcode = 'P0002';
  end if;
  if p_value is null or p_value < 0 or p_value > 1000000 then
    raise exception 'Valeur invalide : un nombre entre 0 et 1 000 000 est attendu' using errcode = '22023';
  end if;
  if p_key = 'comment_max_length' and (p_value < 10 or p_value > 500) then
    raise exception 'La longueur du commentaire doit être comprise entre 10 et 500' using errcode = '22023';
  end if;

  update public.scoring_rules
    set value = p_value, updated_at = now(), updated_by = auth.uid()
    where key = p_key
    returning * into v_after;

  perform private.audit('rule.set', 'rule:' || p_key,
    jsonb_build_object('key', v_rule.key, 'value', v_rule.value),
    jsonb_build_object('key', v_after.key, 'value', v_after.value));
  return jsonb_build_object('key', v_after.key, 'value', v_after.value, 'updated_at', v_after.updated_at);
end;
$$;

revoke execute on function
  public.admin_recompute(uuid, text),
  public.admin_adjust_points(uuid, int, text, int),
  public.admin_set_rarity(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function
  public.admin_recompute(uuid, text),
  public.admin_adjust_points(uuid, int, text, int),
  public.admin_set_rarity(uuid, text, text)
to authenticated;

-- Version du schéma ----------------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261130000000_cahier_modele'::text $$;
