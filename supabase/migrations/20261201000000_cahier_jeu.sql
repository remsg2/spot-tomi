-- Lot 2 · « Jeu et collection » du cahier des charges V1.1 (sections 8 et 9).
--
-- - Géographie : continent des pays (données : 20261201000001_geo_extras.sql), parties
--   de terre insulaires, grands déserts, capitales (villes du lot 0). Chaque sticker
--   garde ses faits géographiques (île, désert, capitale) pour les badges.
-- - Badges automatiques, passeport, carte de conquête.
-- - Statistiques mondiales et personnelles, records, classements par pays, par continent
--   et des lieux les plus rares.
-- - Likes et fil photo.
--
-- Une donnée indisponible (altitude…) n'est jamais inventée : le record est absent.

-- Géographie --------------------------------------------------------------------------------

create type public.continent as enum (
  'afrique', 'amerique_nord', 'amerique_sud', 'antarctique', 'asie', 'europe', 'oceanie'
);

alter table public.countries add column continent public.continent;

create function public.continent_label(p_continent public.continent)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_continent
    when 'afrique' then 'Afrique'
    when 'amerique_nord' then 'Amérique du Nord'
    when 'amerique_sud' then 'Amérique du Sud'
    when 'antarctique' then 'Antarctique'
    when 'asie' then 'Asie'
    when 'europe' then 'Europe'
    else 'Océanie'
  end
$$;

revoke execute on function public.continent_label(public.continent) from public, anon, authenticated;
grant execute on function public.continent_label(public.continent) to anon, authenticated, service_role;

create table public.deserts (
  id int generated always as identity primary key,
  name text not null,
  geom extensions.geography(MultiPolygon, 4326) not null
);
create index deserts_geom_idx on public.deserts using gist ((geom::extensions.geometry));

comment on table public.deserts is 'Grands déserts (Natural Earth, domaine public) : badge « dans un désert ».';

alter table public.deserts enable row level security;
revoke all on public.deserts from public, anon, authenticated;
grant all on public.deserts to service_role;
grant select on public.deserts to anon, authenticated;
create policy "deserts : lecture pour tous" on public.deserts for select to anon, authenticated using (true);

-- Parties de terre de chaque pays ; insulaire si elle ne touche aucun autre pays (à
-- 2 km près) et reste plus petite qu'un continent (l'Australie n'est pas une île).
create table private.land_parts (
  id int generated always as identity primary key,
  iso2 char(2) not null,
  geom extensions.geometry(Polygon, 4326) not null,
  area_km2 double precision not null default 0,
  is_island boolean not null default false
);

insert into private.land_parts (iso2, geom)
select c.iso2, d.geom
from public.countries c
cross join lateral extensions.st_dump(c.geom::extensions.geometry) d
where extensions.geometrytype(d.geom) = 'POLYGON';

create index land_parts_geom_idx on private.land_parts using gist (geom);

update private.land_parts set area_km2 = extensions.st_area(geom::extensions.geography) / 1e6;

update private.land_parts lp
set is_island = lp.iso2 <> 'AQ' and lp.area_km2 < 2500000 and not exists (
  select 1 from public.countries o
  where o.iso2 <> lp.iso2
    and extensions.st_intersects(o.geom::extensions.geometry, extensions.st_buffer(lp.geom, 0.02))
);

-- Faits géographiques d'un sticker, recalculés quand sa position change.
alter table public.spots
  add column on_island boolean not null default false,
  add column desert_name text,
  add column capital_name text;

create function private.spots_geo_facts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_geom extensions.geometry := new.location::extensions.geometry;
begin
  new.on_island := exists (
    select 1 from private.land_parts lp
    where lp.is_island and extensions.st_dwithin(lp.geom, v_geom, 0.02)
  );
  select d.name into new.desert_name
  from public.deserts d
  where extensions.st_intersects(d.geom::extensions.geometry, v_geom)
  limit 1;
  select c.name into new.capital_name
  from public.cities c
  where c.is_capital and extensions.st_dwithin(c.location, new.location, 15000)
  order by c.location operator(extensions.<->) new.location
  limit 1;
  return new;
end;
$$;

revoke execute on function private.spots_geo_facts() from public;

create trigger spots_geo_facts
  before insert or update of location on public.spots
  for each row execute function private.spots_geo_facts();

-- Badges -------------------------------------------------------------------------------------

create table public.badges (
  id int generated always as identity primary key,
  code text not null unique,
  name text not null check (char_length(name) between 1 and 60),
  description text not null check (char_length(description) between 1 and 200),
  icon text not null,
  criteria_json jsonb not null,
  position int not null default 0,
  active boolean not null default true
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id int not null references public.badges (id) on delete cascade,
  spot_id uuid,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
create index user_badges_badge_idx on public.user_badges (badge_id);

comment on table public.badges is 'Badges automatiques (cahier des charges, 9.2). criteria_json : type et seuil.';
comment on table public.user_badges is 'Badges débloqués ; spot_id : le sticker qui l''a débloqué. Jamais retirés.';

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
revoke all on public.badges, public.user_badges from public, anon, authenticated;
grant all on public.badges, public.user_badges to service_role;
grant select on public.badges, public.user_badges to anon, authenticated;
create policy "badges : lecture pour tous" on public.badges for select to anon, authenticated using (true);
create policy "user_badges : lecture pour tous" on public.user_badges for select to anon, authenticated using (true);

insert into public.badges (code, name, description, icon, criteria_json, position) values
  ('premier_tomi', 'Premier Tomi', 'Coller son premier sticker.', '🐾', '{"type": "stickers", "min": 1}', 10),
  ('dix_tomis', '10 Tomis', 'Coller 10 stickers.', '🔟', '{"type": "stickers", "min": 10}', 20),
  ('dix_pays', '10 pays', 'Faire voyager Tomi dans 10 pays.', '🧭', '{"type": "countries", "min": 10}', 30),
  ('cinq_continents', '5 continents', 'Coller un sticker sur 5 continents.', '🌍', '{"type": "continents", "min": 5}', 40),
  ('altitude_3000', 'Tomi des sommets', 'Coller un sticker à plus de 3 000 m d''altitude.', '🏔️', '{"type": "altitude", "min": 3000}', 50),
  ('ile', 'Tomi insulaire', 'Coller un sticker sur une île.', '🏝️', '{"type": "island"}', 60),
  ('desert', 'Tomi du désert', 'Coller un sticker dans un grand désert.', '🏜️', '{"type": "desert"}', 70),
  ('capitale', 'Tomi de la capitale', 'Coller un sticker dans une capitale (à moins de 15 km).', '🏛️', '{"type": "capital"}', 80),
  ('site_remarquable', 'Site remarquable', 'Coller un sticker sur un site reconnu remarquable par la modération.', '⭐', '{"type": "category", "category": "remarquable"}', 90),
  ('pays_vierge', 'Pionnier', 'Coller le premier sticker d''un pays jusque-là vierge.', '🚩', '{"type": "first_in_country"}', 100);

-- Sticker publié qui remplit le critère d'un badge (le premier dans l'ordre de
-- publication), ou null.
create function private.badge_spot(p_user uuid, p_criteria jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type text := p_criteria ->> 'type';
  v_min int := coalesce((p_criteria ->> 'min')::int, 1);
begin
  case v_type
    when 'stickers' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published'
        order by s.created_at, s.id offset v_min - 1 limit 1
      );
    when 'countries' then
      return (
        select f.id from (
          select distinct on (s.country_iso2) s.id, s.created_at
          from public.spots s
          where s.author_id = p_user and s.status = 'published' and s.country_iso2 is not null
          order by s.country_iso2, s.created_at, s.id
        ) f
        order by f.created_at, f.id offset v_min - 1 limit 1
      );
    when 'continents' then
      return (
        select f.id from (
          select distinct on (c.continent) s.id, s.created_at
          from public.spots s
          join public.countries c on c.iso2 = s.country_iso2
          where s.author_id = p_user and s.status = 'published' and c.continent is not null
          order by c.continent, s.created_at, s.id
        ) f
        order by f.created_at, f.id offset v_min - 1 limit 1
      );
    when 'altitude' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published' and s.altitude_m >= v_min
        order by s.created_at, s.id limit 1
      );
    when 'island' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published' and s.on_island
        order by s.created_at, s.id limit 1
      );
    when 'desert' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published' and s.desert_name is not null
        order by s.created_at, s.id limit 1
      );
    when 'capital' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published' and s.capital_name is not null
        order by s.created_at, s.id limit 1
      );
    when 'category' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published'
          and s.rarity_category::text = p_criteria ->> 'category'
        order by s.created_at, s.id limit 1
      );
    when 'first_in_country' then
      return (
        select s.id from public.spots s
        where s.author_id = p_user and s.status = 'published' and s.is_first_in_country
        order by s.created_at, s.id limit 1
      );
    else
      return null;
  end case;
end;
$$;

revoke execute on function private.badge_spot(uuid, jsonb) from public;

-- Débloque les badges actifs que le membre remplit ; renvoie leur nombre.
create function private.award_badges(p_user uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_badge record;
  v_spot uuid;
  v_count int := 0;
  v_quiet boolean := coalesce(current_setting('spot_tomi.quiet_badges', true), '') = 'on';
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then
    return 0;
  end if;
  for v_badge in
    select b.* from public.badges b
    where b.active
      and not exists (select 1 from public.user_badges ub where ub.user_id = p_user and ub.badge_id = b.id)
    order by b.position
  loop
    v_spot := private.badge_spot(p_user, v_badge.criteria_json);
    if v_spot is not null then
      insert into public.user_badges (user_id, badge_id, spot_id)
      values (p_user, v_badge.id, v_spot)
      on conflict do nothing;
      if not v_quiet then
        perform private.notify(p_user, v_spot, 'badge', 'Badge débloqué : ' || v_badge.name, v_badge.description);
      end if;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.award_badges(uuid) from public;

create function private.spots_award_badges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform private.award_badges(new.author_id);
  end if;
  return null;
end;
$$;

revoke execute on function private.spots_award_badges() from public;

create trigger spots_award_badges
  after insert or update of status, rarity_category, is_first_in_country, location on public.spots
  for each row execute function private.spots_award_badges();

-- Badges d'un membre (profil, passeport), avec ceux à débloquer.
create function public.member_badges(p_user uuid)
returns table (
  code text, name text, description text, icon text, unlocked boolean,
  unlocked_at timestamptz, spot_id uuid, spot_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.code, b.name, b.description, b.icon, ub.user_id is not null, ub.unlocked_at,
         case when s.status = 'published' then ub.spot_id end,
         case when s.status = 'published' then s.name end
  from public.badges b
  left join public.user_badges ub on ub.badge_id = b.id and ub.user_id = p_user
  left join public.spots s on s.id = ub.spot_id
  where b.active or ub.user_id is not null
  order by (ub.user_id is null), b.position
$$;

revoke execute on function public.member_badges(uuid) from public, anon, authenticated;
grant execute on function public.member_badges(uuid) to anon, authenticated, service_role;

create function public.admin_set_badge(p_code text, p_active boolean, p_name text default null, p_description text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.badges;
  v_after public.badges;
begin
  perform private.admin_require('admin');
  select * into v_before from public.badges where code = p_code for update;
  if not found then
    raise exception 'Badge inconnu : %', p_code using errcode = 'P0002';
  end if;
  update public.badges
  set active = coalesce(p_active, active),
      name = coalesce(nullif(btrim(p_name), ''), name),
      description = coalesce(nullif(btrim(p_description), ''), description)
  where code = p_code
  returning * into v_after;
  perform private.audit('badge.set', 'badge:' || p_code, to_jsonb(v_before), to_jsonb(v_after));
  return to_jsonb(v_after);
end;
$$;

revoke execute on function public.admin_set_badge(text, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_badge(text, boolean, text, text) to authenticated;

-- Passeport -----------------------------------------------------------------------------------
-- Un tampon par pays : date du premier collage, édition de ce sticker, nombre de stickers.

create function public.passport(p_user uuid)
returns table (
  iso2 text,
  name_fr text,
  continent text,
  continent_label text,
  first_spot_id uuid,
  first_pasted_at timestamptz,
  first_year int,
  edition_name text,
  color_hex text,
  stickers int,
  points int,
  pioneer boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select s.* from public.spots s
    where s.author_id = p_user and s.status = 'published' and s.country_iso2 is not null
  ),
  firsts as (
    select distinct on (m.country_iso2) m.country_iso2, m.id, m.taken_at, m.year
    from mine m
    order by m.country_iso2, m.taken_at, m.created_at, m.id
  ),
  totals as (
    select m.country_iso2, count(*)::int as stickers, sum(m.points_total)::int as points,
           bool_or(m.is_first_in_country) as pioneer
    from mine m group by m.country_iso2
  )
  select f.country_iso2::text, c.name_fr, c.continent::text, public.continent_label(c.continent),
         f.id, f.taken_at, f.year, coalesce(se.name, 'Édition ' || f.year), public.year_color(f.year),
         t.stickers, t.points, t.pioneer
  from firsts f
  join totals t on t.country_iso2 = f.country_iso2
  join public.countries c on c.iso2 = f.country_iso2
  left join public.seasons se on se.year = f.year
  order by f.taken_at, c.name_fr
$$;

revoke execute on function public.passport(uuid) from public, anon, authenticated;
grant execute on function public.passport(uuid) to anon, authenticated, service_role;

-- Conquête mondiale -------------------------------------------------------------------------

create function public.world_conquest()
returns table (
  iso2 text,
  name_fr text,
  continent text,
  spot_count int,
  first_at timestamptz,
  first_author text
)
language sql
stable
security definer
set search_path = ''
as $$
  with firsts as (
    select distinct on (s.country_iso2) s.country_iso2, s.created_at, p.username
    from public.spots s
    join public.profiles p on p.id = s.author_id
    where s.status = 'published' and s.country_iso2 is not null
    order by s.country_iso2, s.created_at, s.id
  ),
  counts as (
    select s.country_iso2, count(*)::int as n
    from public.spots s where s.status = 'published' and s.country_iso2 is not null
    group by s.country_iso2
  )
  select c.iso2::text, c.name_fr, c.continent::text, coalesce(n.n, 0), f.created_at, f.username
  from public.countries c
  left join counts n on n.country_iso2 = c.iso2
  left join firsts f on f.country_iso2 = c.iso2
  order by c.name_fr
$$;

revoke execute on function public.world_conquest() from public, anon, authenticated;
grant execute on function public.world_conquest() to anon, authenticated, service_role;

-- Statistiques mondiales ------------------------------------------------------------------------
-- Distance cumulée : pour chaque membre, somme des distances (orthodromiques) entre ses
-- stickers publiés consécutifs, dans l'ordre des dates de collage ; puis somme sur
-- tous les membres. C'est la distance « parcourue » par Tomi de main en main.

create function public.world_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pub as (
    select s.* from public.spots s where s.status = 'published'
  ),
  legs as (
    select extensions.st_distance(
             p.location,
             lag(p.location) over (partition by p.author_id order by p.taken_at, p.created_at, p.id)
           ) as d
    from pub p
  ),
  first_by_country as (
    select distinct on (p.country_iso2) p.country_iso2, p.created_at
    from pub p where p.country_iso2 is not null
    order by p.country_iso2, p.created_at, p.id
  )
  select jsonb_build_object(
    'stickers', (select count(*) from pub),
    'countries', (select count(distinct country_iso2) from pub),
    'countriesTotal', (select count(*) from public.countries),
    'continents', (
      select count(distinct c.continent) from pub p join public.countries c on c.iso2 = p.country_iso2
    ),
    'continentsTotal', 7,
    'members', (select count(*) from public.profiles),
    'contributors', (select count(distinct author_id) from pub),
    'editions', (select count(distinct year) from pub),
    'distanceKm', (select coalesce(round((sum(d) / 1000)::numeric), 0) from legs),
    'topCountries', coalesce((
      select jsonb_agg(jsonb_build_object('iso2', t.iso2, 'nameFr', t.name_fr, 'count', t.n) order by t.n desc, t.name_fr)
      from (
        select p.country_iso2::text as iso2, c.name_fr, count(*)::int as n
        from pub p join public.countries c on c.iso2 = p.country_iso2
        group by p.country_iso2, c.name_fr
        order by n desc, c.name_fr
        limit 5
      ) t
    ), '[]'::jsonb),
    'recentConquests', coalesce((
      select jsonb_agg(jsonb_build_object('iso2', t.iso2, 'nameFr', t.name_fr, 'at', t.created_at) order by t.created_at desc)
      from (
        select f.country_iso2::text as iso2, c.name_fr, f.created_at
        from first_by_country f join public.countries c on c.iso2 = f.country_iso2
        order by f.created_at desc
        limit 5
      ) t
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.world_stats() from public, anon, authenticated;
grant execute on function public.world_stats() to anon, authenticated, service_role;

-- Likes et fil photo ------------------------------------------------------------------------------

create table public.spot_likes (
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);
create index spot_likes_user_idx on public.spot_likes (user_id, created_at desc);

alter table public.spot_likes enable row level security;
revoke all on public.spot_likes from public, anon, authenticated;
grant all on public.spot_likes to service_role;
grant select, delete on public.spot_likes to authenticated;
grant insert (spot_id, user_id) on public.spot_likes to authenticated;

create policy "spot_likes : lecture des siens" on public.spot_likes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "spot_likes : liker un sticker publié" on public.spot_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.public_spots p where p.id = spot_id)
    and exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.suspended_at is null)
  );
create policy "spot_likes : retirer son like" on public.spot_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Records ---------------------------------------------------------------------------------------
-- Une ligne par record disponible ; un record sans donnée n'apparaît pas (l'app affiche
-- « donnée indisponible »).

create function public.world_records()
returns table (
  key text,
  value numeric,
  detail text,
  spot_id uuid,
  spot_name text,
  user_id uuid,
  username text,
  color_hex text
)
language sql
stable
security definer
set search_path = ''
as $$
  with pub as (
    select s.*, p.username from public.spots s
    join public.profiles p on p.id = s.author_id
    where s.status = 'published'
  ),
  highest as (
    select 'highest'::text as key, p.altitude_m as value,
           case p.altitude_source when 'dem' then 'Altitude du terrain' else 'Altitude GPS de la photo' end as detail,
           p.id, p.name, p.author_id, p.username, public.year_color(p.year) as color
    from pub p where p.altitude_m is not null
    order by p.altitude_m desc, p.created_at limit 1
  ),
  isolated as (
    select 'most_isolated'::text, round((n.d / 1000)::numeric, 1),
           'Distance au sticker le plus proche (km)', p.id, p.name, p.author_id, p.username, public.year_color(p.year)
    from pub p
    cross join lateral (
      -- Trois voisins par l'index plan des stickers publiés, puis distance réelle.
      select min(extensions.st_distance(o.location, p.location)) as d
      from (
        select o.location from public.spots o
        where o.status = 'published' and o.id <> p.id
        order by (o.public_location::extensions.geometry) operator(extensions.<->)
          (p.public_location::extensions.geometry)
        limit 3
      ) o
    ) n
    where n.d is not null
    order by n.d desc, p.created_at limit 1
  ),
  rarest as (
    select 'rarest'::text, p.rarity_bonus::numeric, public.rarity_label(p.rarity_category) || ' · ' || coalesce(p.rarity_reason, ''),
           p.id, p.name, p.author_id, p.username, public.year_color(p.year)
    from pub p
    where p.rarity_bonus > 0
    order by p.rarity_bonus desc, p.points_total desc, p.created_at limit 1
  ),
  liked as (
    select 'most_liked'::text, count(*)::numeric, 'Nombre de likes', p.id, p.name, p.author_id, p.username, public.year_color(p.year)
    from pub p join public.spot_likes l on l.spot_id = p.id
    group by p.id, p.name, p.author_id, p.username, p.year, p.created_at
    order by count(*) desc, p.created_at limit 1
  ),
  traveler as (
    select 'top_traveler'::text, l.points::numeric, l.stickers || ' stickers · ' || l.countries || ' pays',
           null::uuid, null::text, l.user_id, l.username, null::text
    from public.leaderboard l
    where l.period = 'all' and l.rank_points = 1
  ),
  longest as (
    select 'longest_distance'::text as key, round((max(extensions.st_distance(a.location, b.location)) / 1000)::numeric) as value,
           'Entre deux stickers du même membre (km)', null::uuid, null::text, a.author_id, a.username, null::text
    from (
      select h.author_id, h.username, (extensions.st_dumppoints(h.hull)).geom::extensions.geography as location
      from (
        select p.author_id, p.username,
               extensions.st_convexhull(extensions.st_collect(p.location::extensions.geometry)) as hull
        from pub p group by p.author_id, p.username having count(*) > 1
      ) h
    ) a
    join (
      select h.author_id, (extensions.st_dumppoints(h.hull)).geom::extensions.geography as location
      from (
        select p.author_id, extensions.st_convexhull(extensions.st_collect(p.location::extensions.geometry)) as hull
        from pub p group by p.author_id having count(*) > 1
      ) h
    ) b on b.author_id = a.author_id
    group by a.author_id, a.username
    order by 2 desc limit 1
  ),
  latest_conquest as (
    select 'latest_conquest'::text, null::numeric, c.name_fr, f.id, f.name, f.author_id, f.username, public.year_color(f.year)
    from (
      select distinct on (p.country_iso2) p.* from pub p where p.country_iso2 is not null
      order by p.country_iso2, p.created_at, p.id
    ) f
    join public.countries c on c.iso2 = f.country_iso2
    order by f.created_at desc limit 1
  )
  select * from highest
  union all select * from isolated
  union all select * from rarest
  union all select * from liked
  union all select * from traveler
  union all select * from longest where value > 0
  union all select * from latest_conquest
$$;

-- Premier sticker de chaque continent.
create function public.continent_firsts()
returns table (
  continent text,
  continent_label text,
  spot_id uuid,
  spot_name text,
  country_name_fr text,
  username text,
  created_at timestamptz,
  color_hex text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (c.continent) c.continent::text, public.continent_label(c.continent), s.id, s.name,
         c.name_fr, p.username, s.created_at, public.year_color(s.year)
  from public.spots s
  join public.countries c on c.iso2 = s.country_iso2
  join public.profiles p on p.id = s.author_id
  where s.status = 'published' and c.continent is not null
  order by c.continent, s.created_at, s.id
$$;

revoke execute on function public.world_records(), public.continent_firsts() from public, anon, authenticated;
grant execute on function public.world_records(), public.continent_firsts() to anon, authenticated, service_role;

-- Like ou retrait du like ; renvoie l'état et le nombre de likes.
create function public.toggle_like(p_spot_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_liked boolean;
begin
  if v_me is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_me and suspended_at is not null) then
    raise exception 'Ton compte est suspendu.' using errcode = 'ST002';
  end if;
  if not exists (select 1 from public.spots where id = p_spot_id and status = 'published') then
    raise exception 'Sticker introuvable.' using errcode = 'P0002';
  end if;
  delete from public.spot_likes where spot_id = p_spot_id and user_id = v_me;
  if found then
    v_liked := false;
  else
    insert into public.spot_likes (spot_id, user_id) values (p_spot_id, v_me);
    v_liked := true;
  end if;
  return jsonb_build_object(
    'liked', v_liked,
    'count', (select count(*) from public.spot_likes where spot_id = p_spot_id)
  );
end;
$$;

revoke execute on function public.toggle_like(uuid) from public, anon, authenticated;
grant execute on function public.toggle_like(uuid) to authenticated;

create function public.spot_like_info(p_spot_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'count', (select count(*) from public.spot_likes l where l.spot_id = p_spot_id),
    'liked', exists (select 1 from public.spot_likes l where l.spot_id = p_spot_id and l.user_id = auth.uid())
  )
$$;

revoke execute on function public.spot_like_info(uuid) from public, anon, authenticated;
grant execute on function public.spot_like_info(uuid) to anon, authenticated, service_role;

-- Fil photo : derniers stickers publiés (pagination par date de publication).
create function public.photo_feed(p_before timestamptz default null, p_limit int default 20)
returns table (
  id uuid,
  name text,
  city text,
  country_name_fr text,
  year int,
  edition_name text,
  color_hex text,
  taken_at timestamptz,
  created_at timestamptz,
  photo_path text,
  thumb_path text,
  author_id uuid,
  author_username text,
  author_avatar_path text,
  points_total int,
  rarity_category text,
  comment text,
  like_count int,
  liked boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.city, c.name_fr, s.year, coalesce(se.name, 'Édition ' || s.year),
         coalesce(se.color_hex, '#9A9A94'), s.taken_at, s.created_at, s.photo_path, s.thumb_path,
         s.author_id, p.username, p.avatar_path, s.points_total, s.rarity_category::text, s.comment,
         (select count(*)::int from public.spot_likes l where l.spot_id = s.id),
         exists (select 1 from public.spot_likes l where l.spot_id = s.id and l.user_id = auth.uid())
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  left join public.seasons se on se.year = s.year
  where s.status = 'published' and (p_before is null or s.created_at < p_before)
  order by s.created_at desc, s.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

revoke execute on function public.photo_feed(timestamptz, int) from public, anon, authenticated;
grant execute on function public.photo_feed(timestamptz, int) to anon, authenticated, service_role;

-- Statistiques d'un membre ---------------------------------------------------------------------

create function public.member_stats(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pub as (
    select s.*, c.continent
    from public.spots s
    left join public.countries c on c.iso2 = s.country_iso2
    where s.author_id = p_user and s.status = 'published'
  ),
  isolated as (
    select p.id, p.name, round((n.d / 1000)::numeric, 1) as km
    from pub p
    cross join lateral (
      -- Trois voisins par l'index plan des stickers publiés, puis distance réelle.
      select min(extensions.st_distance(o.location, p.location)) as d
      from (
        select o.location from public.spots o
        where o.status = 'published' and o.id <> p.id
        order by (o.public_location::extensions.geometry) operator(extensions.<->)
          (p.public_location::extensions.geometry)
        limit 3
      ) o
    ) n
    where n.d is not null
    order by n.d desc limit 1
  ),
  highest as (
    select p.id, p.name, p.altitude_m from pub p where p.altitude_m is not null
    order by p.altitude_m desc, p.created_at limit 1
  )
  select jsonb_build_object(
    'stickers', (select count(*) from pub),
    'points', coalesce((select l.points from public.leaderboard l where l.user_id = p_user and l.period = 'all'), 0),
    'rank', (select l.rank_points from public.leaderboard l where l.user_id = p_user and l.period = 'all'),
    'countries', (select count(distinct country_iso2) from pub),
    'continents', coalesce((
      select jsonb_agg(jsonb_build_object('code', t.continent, 'label', public.continent_label(t.continent))
                       order by t.continent)
      from (select distinct p.continent from pub p where p.continent is not null) t
    ), '[]'::jsonb),
    'editions', coalesce((
      select jsonb_agg(jsonb_build_object('year', t.year, 'name', coalesce(se.name, 'Édition ' || t.year),
                                          'colorHex', public.year_color(t.year), 'count', t.n) order by t.year desc)
      from (select p.year, count(*)::int as n from pub p group by p.year) t
      left join public.seasons se on se.year = t.year
    ), '[]'::jsonb),
    'byCountry', coalesce((
      select jsonb_agg(jsonb_build_object('iso2', t.iso2, 'nameFr', t.name_fr, 'count', t.n) order by t.n desc, t.name_fr)
      from (
        select p.country_iso2::text as iso2, c.name_fr, count(*)::int as n
        from pub p join public.countries c on c.iso2 = p.country_iso2
        group by p.country_iso2, c.name_fr
      ) t
    ), '[]'::jsonb),
    'highest', (select jsonb_build_object('id', h.id, 'name', h.name, 'altitudeM', h.altitude_m) from highest h),
    'mostIsolated', (select jsonb_build_object('id', i.id, 'name', i.name, 'km', i.km) from isolated i),
    'badges', (select count(*) from public.user_badges ub where ub.user_id = p_user),
    'likesReceived', (select count(*) from public.spot_likes l join pub p on p.id = l.spot_id)
  )
$$;

revoke execute on function public.member_stats(uuid) from public, anon, authenticated;
grant execute on function public.member_stats(uuid) to anon, authenticated, service_role;

-- Classements par zone et des lieux les plus rares ----------------------------------------------
-- Points des stickers publiés dans la zone ; départage : le premier à atteindre son score
-- (date de son dernier sticker compté), puis le nombre de stickers.

create function public.get_area_leaderboard(p_kind text, p_code text, p_limit int default 50)
returns table (
  user_id uuid,
  username text,
  avatar_path text,
  points int,
  stickers int,
  rank int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('country', 'continent') then
    raise exception 'Zone inconnue : %', coalesce(p_kind, 'null') using errcode = '22023';
  end if;
  if p_kind = 'continent' and (p_code is null or p_code not in (
    'afrique', 'amerique_nord', 'amerique_sud', 'antarctique', 'asie', 'europe', 'oceanie')) then
    raise exception 'Continent inconnu : %', coalesce(p_code, 'null') using errcode = '22023';
  end if;

  return query
  with zone as (
    select s.author_id, s.points_total, s.created_at
    from public.spots s
    join public.countries c on c.iso2 = s.country_iso2
    where s.status = 'published'
      and ((p_kind = 'country' and c.iso2 = upper(p_code))
        or (p_kind = 'continent' and c.continent::text = p_code))
  ),
  totals as (
    select z.author_id, sum(z.points_total)::int as pts, count(*)::int as n, max(z.created_at) as reached
    from zone z group by z.author_id
  )
  select t.author_id, p.username, p.avatar_path, t.pts, t.n,
         (row_number() over (order by t.pts desc, t.reached, t.n desc, t.author_id))::int
  from totals t
  join public.profiles p on p.id = t.author_id
  order by 6
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create function public.rarest_places(p_limit int default 20)
returns table (
  id uuid,
  name text,
  city text,
  country_name_fr text,
  year int,
  color_hex text,
  rarity_category text,
  rarity_label text,
  rarity_reason text,
  points_total int,
  author_username text,
  thumb_path text,
  photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.city, c.name_fr, s.year, public.year_color(s.year), s.rarity_category::text,
         public.rarity_label(s.rarity_category), s.rarity_reason, s.points_total, p.username,
         s.thumb_path, s.photo_path
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  where s.status = 'published' and s.rarity_bonus > 0
  order by s.rarity_bonus desc, s.points_total desc, s.created_at, s.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke execute on function public.get_area_leaderboard(text, text, int), public.rarest_places(int)
  from public, anon, authenticated;
grant execute on function public.get_area_leaderboard(text, text, int), public.rarest_places(int)
  to anon, authenticated, service_role;

-- Version du schéma ----------------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261201000000_cahier_jeu'::text $$;
