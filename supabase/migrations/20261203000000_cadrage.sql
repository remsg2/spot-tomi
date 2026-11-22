-- Cadrage des photos : point du sticker sur la photo.
--
-- Une photo est souvent recadrée à l'affichage (fiche, fil photo, miniatures) : sans
-- repère, le sticker peut sortir du cadre. Le membre touche son sticker sur la photo en
-- publiant (ou plus tard en modifiant son sticker) ; un modérateur peut le corriger.
-- focus_x et focus_y vont de 0 (gauche, haut) à 1 (droite, bas) ; null : centre.
--
-- 1. Colonnes spots.focus_x / focus_y, remises à null quand la photo change.
-- 2. set_spot_focus (auteur ou modérateur) et set_spot_focus_as (Edge Function publish-spot).
-- 3. Point exposé par public_spots, nearby_spots, photo_feed, rarest_places et la file de
--    modération.

-- 1. Colonnes ---------------------------------------------------------------------------------

alter table public.spots
  add column focus_x real,
  add column focus_y real,
  add constraint spots_focus_check check (
    (focus_x is null and focus_y is null)
    or (focus_x between 0 and 1 and focus_y between 0 and 1)
  );

comment on column public.spots.focus_x is 'Position horizontale du sticker sur la photo (0 à 1), null : centre.';
comment on column public.spots.focus_y is 'Position verticale du sticker sur la photo (0 à 1), null : centre.';

-- Nouvelle photo : l'ancien point ne vaut plus, sauf s'il est fourni avec elle.
create function private.reset_focus_on_photo_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.photo_path is distinct from old.photo_path
     and new.focus_x is not distinct from old.focus_x
     and new.focus_y is not distinct from old.focus_y then
    new.focus_x := null;
    new.focus_y := null;
  end if;
  return new;
end;
$$;

create trigger spots_reset_focus
  before update of photo_path on public.spots
  for each row execute function private.reset_focus_on_photo_change();

-- 2. Écriture ---------------------------------------------------------------------------------

-- Point arrondi à 0,001 (au-delà, rien ne se voit), ou null pour revenir au centre.
create function private.write_spot_focus(p_spot_id uuid, p_x double precision, p_y double precision)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_x real;
  v_y real;
begin
  if (p_x is null) <> (p_y is null) then
    raise exception 'Les deux coordonnées du cadrage sont requises.' using errcode = '22023';
  end if;
  if p_x is not null and (p_x not between 0 and 1 or p_y not between 0 and 1
                          or p_x = 'NaN'::double precision or p_y = 'NaN'::double precision) then
    raise exception 'Cadrage hors de la photo.' using errcode = '22023';
  end if;
  v_x := round(p_x::numeric, 3)::real;
  v_y := round(p_y::numeric, 3)::real;
  update public.spots set focus_x = v_x, focus_y = v_y, updated_at = now() where id = p_spot_id;
  return jsonb_build_object('id', p_spot_id, 'focusX', v_x, 'focusY', v_y);
end;
$$;

revoke execute on function private.write_spot_focus(uuid, double precision, double precision) from public;

-- Auteur (à tout moment : le cadrage ne change ni les points ni la position) ou modérateur
-- (journalisé). Un sticker masqué n'est recadré que par un modérateur.
create function public.set_spot_focus(p_spot_id uuid, p_x double precision, p_y double precision)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_spot public.spots;
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable.' using errcode = 'P0002';
  end if;

  if v_spot.author_id = v_me and v_spot.status <> 'hidden' then
    return private.write_spot_focus(p_spot_id, p_x, p_y);
  end if;
  if not public.is_moderator() then
    raise exception 'Sticker introuvable.' using errcode = 'P0002';
  end if;

  v_result := private.write_spot_focus(p_spot_id, p_x, p_y);
  insert into public.admin_audit_log (actor_id, action, target, before, after)
  values (v_me, 'spot.focus', 'spot:' || p_spot_id,
    jsonb_build_object('focus_x', v_spot.focus_x, 'focus_y', v_spot.focus_y),
    jsonb_build_object('focus_x', v_result -> 'focusX', 'focus_y', v_result -> 'focusY'));
  return v_result;
end;
$$;

revoke execute on function public.set_spot_focus(uuid, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.set_spot_focus(uuid, double precision, double precision) to authenticated;

-- Edge Function publish-spot (clé service), juste après create_spot : l'auteur est
-- vérifié par la fonction, pas par la session.
create function public.set_spot_focus_as(
  p_author uuid,
  p_spot_id uuid,
  p_x double precision,
  p_y double precision
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.spots where id = p_spot_id and author_id = p_author) then
    raise exception 'Sticker introuvable.' using errcode = 'P0002';
  end if;
  return private.write_spot_focus(p_spot_id, p_x, p_y);
end;
$$;

revoke execute on function public.set_spot_focus_as(uuid, uuid, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.set_spot_focus_as(uuid, uuid, double precision, double precision)
  to service_role;

-- 3. Lecture ----------------------------------------------------------------------------------

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
    s.thumb_path,
    s.focus_x,
    s.focus_y
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  left join public.seasons se on se.year = s.year
  where s.status = 'published';

drop function public.nearby_spots(uuid, int, double precision);

create function public.nearby_spots(p_spot_id uuid, p_limit int default 6, p_radius_m double precision default 50000)
returns table (
  id uuid,
  name text,
  city text,
  country_name_fr text,
  year int,
  color_hex text,
  points_total int,
  thumb_path text,
  photo_path text,
  distance_m int,
  focus_x real,
  focus_y real
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.city, c.name_fr, o.year, public.year_color(o.year), o.points_total,
         o.thumb_path, o.photo_path,
         round(extensions.st_distance(o.public_location, s.public_location))::int,
         o.focus_x, o.focus_y
  from public.spots s
  join public.spots o
    on o.status = 'published' and o.id <> s.id
   and extensions.st_dwithin(o.public_location, s.public_location, least(coalesce(p_radius_m, 50000), 500000))
  left join public.countries c on c.iso2 = o.country_iso2
  where s.id = p_spot_id and s.status = 'published'
  order by o.public_location operator(extensions.<->) s.public_location
  limit least(greatest(coalesce(p_limit, 6), 1), 20)
$$;

revoke execute on function public.nearby_spots(uuid, int, double precision) from public, anon, authenticated;
grant execute on function public.nearby_spots(uuid, int, double precision) to anon, authenticated, service_role;

drop function public.photo_feed(timestamptz, int);

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
  liked boolean,
  focus_x real,
  focus_y real
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
         exists (select 1 from public.spot_likes l where l.spot_id = s.id and l.user_id = auth.uid()),
         s.focus_x, s.focus_y
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

drop function public.rarest_places(int);

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
  photo_path text,
  focus_x real,
  focus_y real
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.city, c.name_fr, s.year, public.year_color(s.year), s.rarity_category::text,
         public.rarity_label(s.rarity_category), s.rarity_reason, s.points_total, p.username,
         s.thumb_path, s.photo_path, s.focus_x, s.focus_y
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  where s.status = 'published' and s.rarity_bonus > 0
  order by s.rarity_bonus desc, s.points_total desc, s.created_at, s.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke execute on function public.rarest_places(int) from public, anon, authenticated;
grant execute on function public.rarest_places(int) to anon, authenticated, service_role;

-- File de modération : le point en plus (vue privée recréée, colonnes à la fin).
drop function public.admin_moderation_queue();
drop function public.admin_search_spots(text, int);

create or replace view private.admin_spot_rows as
  select
    s.id,
    s.name,
    s.status,
    s.author_id,
    p.username as author_username,
    s.city,
    s.country_iso2::text as country_iso2,
    c.name_fr as country_name_fr,
    s.year,
    public.year_color(s.year) as color_hex,
    s.taken_at,
    s.created_at,
    s.gps_source,
    s.date_source,
    extensions.st_y(s.location::extensions.geometry) as lat,
    extensions.st_x(s.location::extensions.geometry) as lng,
    extensions.st_y(s.public_location::extensions.geometry) as public_lat,
    extensions.st_x(s.public_location::extensions.geometry) as public_lng,
    s.altitude_m,
    s.photo_path,
    s.points_total,
    s.is_exceptional,
    s.is_first_in_country,
    coalesce(r.report_count, 0) as report_count,
    coalesce(r.reports, '[]'::jsonb) as reports,
    s.needs_review,
    s.review_reason,
    s.comment,
    s.rarity_category::text as rarity_category,
    s.rarity_override::text as rarity_override,
    s.rarity_reason,
    s.thumb_path,
    s.focus_x,
    s.focus_y
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  left join lateral (
    select
      (count(*) filter (where sr.status = 'pending'))::int as report_count,
      jsonb_agg(
        jsonb_build_object('reason', sr.reason, 'created_at', sr.created_at,
          'reporter_username', rp.username, 'status', sr.status)
        order by sr.created_at desc
      ) as reports
    from public.spot_reports sr
    left join public.profiles rp on rp.id = sr.reporter_id
    where sr.spot_id = s.id
  ) r on true;

revoke all on private.admin_spot_rows from public, anon, authenticated;

create function public.admin_moderation_queue()
returns table (
  id uuid, name text, status public.spot_status, author_id uuid, author_username text,
  city text, country_iso2 text, country_name_fr text, year int, color_hex text,
  taken_at timestamptz, created_at timestamptz, gps_source text, date_source text,
  lat double precision, lng double precision, public_lat double precision, public_lng double precision,
  altitude_m numeric, photo_path text, points_total int, is_exceptional boolean,
  is_first_in_country boolean, report_count int, reports jsonb,
  needs_review boolean, review_reason text, comment text, rarity_category text, rarity_override text,
  rarity_reason text, thumb_path text, focus_x real, focus_y real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.admin_require('moderator');
  return query
    select r.*
    from private.admin_spot_rows r
    where r.status in ('pending_review', 'hidden') or r.report_count > 0 or r.needs_review
    order by (r.status = 'pending_review') desc, (r.report_count > 0) desc, r.needs_review desc,
      (r.status = 'hidden'), r.report_count desc, r.created_at
    limit 200;
end;
$$;

create function public.admin_search_spots(p_query text, p_limit int default 20)
returns table (
  id uuid, name text, status public.spot_status, author_id uuid, author_username text,
  city text, country_iso2 text, country_name_fr text, year int, color_hex text,
  taken_at timestamptz, created_at timestamptz, gps_source text, date_source text,
  lat double precision, lng double precision, public_lat double precision, public_lng double precision,
  altitude_m numeric, photo_path text, points_total int, is_exceptional boolean,
  is_first_in_country boolean, report_count int, reports jsonb,
  needs_review boolean, review_reason text, comment text, rarity_category text, rarity_override text,
  rarity_reason text, thumb_path text, focus_x real, focus_y real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_uuid text := lower(substring(v_query from '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}'));
  v_like text;
begin
  perform private.admin_require('moderator');
  if v_query = '' then
    return;
  end if;
  v_like := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select r.*
    from private.admin_spot_rows r
    where (v_uuid is not null and r.id::text = v_uuid)
       or r.name ilike v_like
       or r.city ilike v_like
       or r.author_username ilike v_like
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke execute on function public.admin_moderation_queue(), public.admin_search_spots(text, int)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_moderation_queue(), public.admin_search_spots(text, int)
  to authenticated;

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261203000000_cadrage'::text $$;
