-- Lot 1 · MVP du cahier des charges V1.1 (sections 4, 5, 11, 12 et 16).
--
-- - Publication directe : tout sticker conforme est publié ; une position placée à la
--   main le signale seulement « à vérifier » aux modérateurs (needs_review).
-- - Le membre choisit l'édition et la date du collage ; commentaire facultatif.
-- - Le membre modifie son sticker : nom et commentaire à tout moment ; date, édition,
--   position (dans edit_radius_m de la position d'origine) et photo pendant
--   edit_window_days jours.
-- - Signalements avec statut (en attente, accepté, rejeté), décisions de modération
--   notifiées à l'auteur (user_notices), suppression d'un compte par un admin.
-- - Pseudos réservés, filtres de carte (pays, période), stickers proches, journal
--   d'erreurs de l'app.
--
-- Codes d'erreur ajoutés :
--   ST007  délai de modification dépassé · ST008 édition indisponible
--   ST009  date du collage invalide · ST010 position trop éloignée de l'originale
--   ST011  pseudo réservé · ST012 compte admin (retirer d'abord le rôle)

-- Sources de la date : manual = date modifiée par le membre.
alter table public.spots drop constraint spots_date_source_check;
alter table public.spots
  add constraint spots_date_source_check check (date_source in ('exif', 'device', 'manual', 'upload'));

create or replace function private.check_publish_input(
  p_lat double precision,
  p_lng double precision,
  p_altitude_m numeric,
  p_gps_source text,
  p_date_source text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_lat is null or p_lng is null or not (p_lat between -90 and 90) or not (p_lng between -180 and 180) then
    raise exception 'Position invalide.' using errcode = 'ST005';
  end if;
  if p_gps_source is null or p_gps_source not in ('exif', 'device', 'manual') then
    raise exception 'Source de la position invalide.' using errcode = 'ST005';
  end if;
  if p_date_source is null or p_date_source not in ('exif', 'device', 'manual', 'upload') then
    raise exception 'Source de la date invalide.' using errcode = 'ST005';
  end if;
  if p_altitude_m is not null and not (p_altitude_m between -500 and 9000) then
    raise exception 'Altitude invalide.' using errcode = 'ST005';
  end if;
end;
$$;

-- Édition choisie : elle doit exister, être active et ne pas être à venir.
create function private.check_edition(p_year int)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_year is null or not exists (
    select 1 from public.seasons s
    where s.year = p_year and s.status = 'active' and s.year <= public.current_edition_year()
  ) then
    raise exception 'Cette édition n''est pas disponible.' using errcode = 'ST008';
  end if;
end;
$$;

-- Date du collage : ni dans le futur, ni avant l'année de l'édition (un sticker 2026 ne
-- peut pas avoir été collé en 2025). Une journée de marge pour les fuseaux horaires.
-- exif : date de la photo ; manual : date saisie par le membre ; upload (photo sans
-- date) et device (photo prise à l'instant) : l'heure du serveur, jamais celle du client.
create function private.pasted_at(p_taken_at timestamptz, p_date_source text, p_year int)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_at timestamptz := case when p_date_source in ('upload', 'device') then now() else p_taken_at end;
begin
  if v_at is null then
    raise exception 'Date du collage manquante.' using errcode = 'ST009';
  end if;
  if v_at > now() + interval '1 day' then
    raise exception 'La date du collage ne peut pas être dans le futur.' using errcode = 'ST009';
  end if;
  if v_at < make_timestamptz(greatest(p_year, 2000), 1, 1, 0, 0, 0, 'UTC') - interval '1 day' then
    raise exception 'La date du collage est antérieure à l''édition %.', p_year using errcode = 'ST009';
  end if;
  return v_at;
end;
$$;

-- Commentaire : espaces réduits, vide = null, longueur maximale réglable.
create function private.clean_comment(p_comment text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_comment text := nullif(btrim(regexp_replace(coalesce(p_comment, ''), '[ \t]+', ' ', 'g')), '');
  v_max int := coalesce((select value from public.scoring_rules where key = 'comment_max_length'), 280)::int;
begin
  if v_comment is not null and char_length(v_comment) > v_max then
    raise exception 'Commentaire trop long : % caractères au plus.', v_max using errcode = 'ST005';
  end if;
  return v_comment;
end;
$$;

revoke all on function
  private.check_edition(int),
  private.pasted_at(timestamptz, text, int),
  private.clean_comment(text)
from public, anon, authenticated;

-- Photo très proche d'une autre (dHash à 6 bits près) : sticker publié, mais « à vérifier ».
create function private.similar_photo(p_hash bigint, p_exclude uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select s.id
  from public.spots s
  where p_hash is not null and s.photo_hash is not null and s.id is distinct from p_exclude
    and s.status <> 'hidden'
    and bit_count((s.photo_hash # p_hash)::bit(64)) <= 6
  limit 1
$$;

revoke all on function private.similar_photo(bigint, uuid) from public, anon, authenticated;

-- Publication -----------------------------------------------------------------------

drop function if exists public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text);

create function public.create_spot(
  p_author uuid,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_altitude_m numeric,
  p_taken_at timestamptz,
  p_gps_source text,
  p_date_source text,
  p_photo_path text,
  p_city text,
  p_year int default null,
  p_comment text default null,
  p_tourist boolean default false,
  p_thumb_path text default null,
  p_altitude_source text default null,
  p_photo_hash bigint default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_city text := left(nullif(btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g')), ''), 120);
  v_comment text;
  v_year int;
  v_point extensions.geography;
  v_taken_at timestamptz;
  v_similar uuid;
  v_review_reason text;
  v_id uuid;
begin
  if p_author is null then
    raise exception 'Auteur manquant.' using errcode = 'ST005';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'Le nom du lieu est obligatoire (80 caractères maximum).' using errcode = 'ST005';
  end if;
  perform private.check_publish_input(p_lat, p_lng, p_altitude_m, p_gps_source, p_date_source);
  v_comment := private.clean_comment(p_comment);

  -- Édition : celle choisie ; sans choix (ancienne version de l'app), celle de la date
  -- si elle est disponible, sinon l'édition en cours.
  v_year := p_year;
  if v_year is null then
    v_year := extract(year from (
      case when p_date_source in ('upload', 'device') then now() else coalesce(p_taken_at, now()) end
    ) at time zone 'UTC')::int;
    if not exists (
      select 1 from public.seasons s
      where s.year = v_year and s.status = 'active' and s.year <= public.current_edition_year()
    ) then
      v_year := public.current_edition_year();
    end if;
  end if;
  perform private.check_edition(v_year);
  v_taken_at := private.pasted_at(p_taken_at, p_date_source, v_year);

  if p_photo_path is null or p_photo_path !~ (
    '^' || p_author::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  ) then
    raise exception 'Chemin de photo invalide.' using errcode = 'ST005';
  end if;
  if p_thumb_path is not null and p_thumb_path <> regexp_replace(p_photo_path, '\.webp$', '.thumb.webp') then
    raise exception 'Chemin de miniature invalide.' using errcode = 'ST005';
  end if;
  if p_altitude_source is not null and p_altitude_source not in ('exif', 'dem') then
    raise exception 'Source de l''altitude invalide.' using errcode = 'ST005';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('create_spot:' || p_author::text, 0));

  if exists (select 1 from public.spots where photo_path = p_photo_path) then
    raise exception 'Cette photo a déjà été publiée.' using errcode = 'ST006';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  perform private.raise_publish_block(private.publish_block_reason(p_author, v_point));

  v_similar := private.similar_photo(p_photo_hash, null);
  v_review_reason := case
    when p_gps_source = 'manual' then 'Position placée à la main'
    when v_similar is not null then 'Photo très proche d''un autre sticker'
  end;

  insert into public.spots (
    author_id, name, location, public_location, altitude_m, altitude_source, taken_at, year,
    gps_source, date_source, country_iso2, city, photo_path, thumb_path, status,
    needs_review, review_reason, comment, is_tourist_spot, photo_hash
  )
  values (
    p_author,
    v_name,
    v_point,
    v_point,
    round(p_altitude_m, 1),
    case when p_altitude_m is null then null else coalesce(p_altitude_source, 'exif') end,
    v_taken_at,
    v_year,
    p_gps_source,
    p_date_source,
    public.country_at(v_point),
    v_city,
    p_photo_path,
    p_thumb_path,
    'published',
    v_review_reason is not null,
    v_review_reason,
    v_comment,
    coalesce(p_tourist, false),
    p_photo_hash
  )
  returning id into v_id;

  perform public.compute_spot_points(v_id, 'Publication : ' || v_name);
  return v_id;
end;
$$;

comment on function public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text, int, text, boolean, text, text, bigint) is
  'Crée un sticker publié (Edge Function publish-spot, clé service). Erreurs ST001 à ST009 : voir les migrations.';

revoke execute on function
  public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text, int, text, boolean, text, text, bigint)
from public, anon, authenticated;
grant execute on function
  public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text, int, text, boolean, text, text, bigint)
to service_role;

-- Estimation avant publication : points, catégorie, et sticker le plus proche
-- (avertissement « un sticker existe déjà à X m »). Ne laisse rien en base.

drop function if exists public.estimate_spot_points(double precision, double precision, numeric, timestamptz, text, text, text);

create function public.estimate_spot_points(
  p_lat double precision,
  p_lng double precision,
  p_altitude_m numeric default null,
  p_taken_at timestamptz default null,
  p_gps_source text default 'exif',
  p_date_source text default 'exif',
  p_city text default null,
  p_year int default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_point extensions.geography;
  v_year int := coalesce(p_year, public.current_edition_year());
  v_reason text;
  v_id uuid;
  v_nearest record;
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;
  perform private.check_publish_input(p_lat, p_lng, p_altitude_m, p_gps_source, p_date_source);
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  v_reason := private.publish_block_reason(v_me, v_point);
  if v_reason in ('missing_profile', 'suspended') then
    perform private.raise_publish_block(v_reason);
  end if;

  select s.id, s.name, s.author_id = v_me as mine,
         round(extensions.st_distance(s.location, v_point))::int as distance_m
    into v_nearest
    from public.spots s
    where s.status = 'published'
      and extensions.st_dwithin(s.location, v_point, 1000)
    order by s.location operator(extensions.<->) v_point
    limit 1;

  begin
    insert into public.spots (
      author_id, name, location, public_location, altitude_m, taken_at, year,
      gps_source, date_source, country_iso2, city, photo_path, status
    )
    values (
      v_me, 'Estimation', v_point, v_point, round(p_altitude_m, 1), coalesce(p_taken_at, now()), v_year,
      p_gps_source, p_date_source, public.country_at(v_point),
      left(nullif(btrim(coalesce(p_city, '')), ''), 120),
      v_me::text || '/' || gen_random_uuid()::text || '.webp',
      -- Hors classement pendant l'estimation : aucune ligne de journal à annuler.
      'hidden'
    )
    returning id into v_id;

    perform public.compute_spot_points(v_id);

    select jsonb_build_object(
      'pointsTotal', s.points_total,
      'status', 'published',
      'year', s.year,
      'colorHex', public.year_color(s.year),
      'countryIso2', s.country_iso2,
      'countryNameFr', c.name_fr,
      'isFirstInCountry', s.is_first_in_country,
      'category', s.rarity_category,
      'categoryLabel', public.rarity_label(s.rarity_category),
      'blocked', v_reason,
      'nearest', case when v_nearest.id is null then null else jsonb_build_object(
        'id', v_nearest.id, 'name', v_nearest.name, 'distanceM', v_nearest.distance_m, 'mine', v_nearest.mine
      ) end,
      'lines', coalesce((
        select jsonb_agg(
          jsonb_build_object('ruleKey', l.rule_key, 'label', l.label, 'detail', l.detail, 'points', l.points)
          order by l.position
        )
        from public.spot_point_lines l
        where l.spot_id = s.id
      ), '[]'::jsonb)
    )
    into v_result
    from public.spots s
    left join public.countries c on c.iso2 = s.country_iso2
    where s.id = v_id;

    raise sqlstate 'ST999';
  exception
    when sqlstate 'ST999' then
      null;
  end;

  return v_result;
end;
$$;

revoke execute on function
  public.estimate_spot_points(double precision, double precision, numeric, timestamptz, text, text, text, int)
from public, anon;
grant execute on function
  public.estimate_spot_points(double precision, double precision, numeric, timestamptz, text, text, text, int)
to authenticated, service_role;

-- Modification par le membre ------------------------------------------------------------
-- Paramètres null = inchangé. Nom et commentaire : à tout moment ; date, édition et
-- position : pendant edit_window_days jours après la publication. p_comment = '' efface.

create function public.update_my_spot(
  p_spot_id uuid,
  p_name text default null,
  p_comment text default null,
  p_taken_at timestamptz default null,
  p_year int default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_spot public.spots;
  v_rules jsonb;
  v_window int;
  v_radius float8;
  v_name text;
  v_year int;
  v_point extensions.geography;
  v_taken_at timestamptz;
  v_moved boolean := false;
  v_changes jsonb := '{}'::jsonb;
  v_city text;
begin
  if v_me is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_me and suspended_at is not null) then
    raise exception 'Ton compte est suspendu.' using errcode = 'ST002';
  end if;

  select * into v_spot from public.spots where id = p_spot_id and author_id = v_me for update;
  if not found then
    raise exception 'Sticker introuvable.' using errcode = 'P0002';
  end if;
  if v_spot.status = 'hidden' then
    raise exception 'Ce sticker est masqué par la modération.' using errcode = '42501';
  end if;

  select jsonb_object_agg(r.key, r.value) into v_rules from public.scoring_rules r;
  v_window := coalesce((v_rules ->> 'edit_window_days')::int, 7);
  v_radius := coalesce((v_rules ->> 'edit_radius_m')::float8, 200);

  if p_taken_at is not null or p_year is not null or p_lat is not null or p_lng is not null then
    if v_spot.created_at < now() - make_interval(days => v_window) then
      raise exception 'Le délai de modification (% jours) est dépassé.', v_window using errcode = 'ST007';
    end if;
  end if;

  if p_name is not null then
    v_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
    if char_length(v_name) not between 1 and 80 then
      raise exception 'Le nom du lieu est obligatoire (80 caractères maximum).' using errcode = 'ST005';
    end if;
    if v_name <> v_spot.name then
      v_changes := v_changes || jsonb_build_object('name', jsonb_build_array(v_spot.name, v_name));
      v_spot.name := v_name;
    end if;
  end if;

  if p_comment is not null then
    if private.clean_comment(p_comment) is distinct from v_spot.comment then
      v_changes := v_changes || jsonb_build_object('comment', jsonb_build_array(v_spot.comment, private.clean_comment(p_comment)));
      v_spot.comment := private.clean_comment(p_comment);
    end if;
  end if;

  v_year := coalesce(p_year, v_spot.year);
  if p_year is not null and p_year <> v_spot.year then
    perform private.check_edition(p_year);
    v_changes := v_changes || jsonb_build_object('year', jsonb_build_array(v_spot.year, p_year));
  end if;
  if p_taken_at is not null or v_year <> v_spot.year then
    v_taken_at := private.pasted_at(coalesce(p_taken_at, v_spot.taken_at), 'manual', v_year);
    if v_taken_at <> v_spot.taken_at then
      v_changes := v_changes || jsonb_build_object('taken_at', jsonb_build_array(v_spot.taken_at, v_taken_at));
      v_spot.taken_at := v_taken_at;
      v_spot.date_source := 'manual';
    end if;
  end if;
  v_spot.year := v_year;

  if p_lat is not null or p_lng is not null then
    perform private.check_publish_input(p_lat, p_lng, null, 'manual', 'manual');
    v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
    if v_spot.gps_source <> 'manual'
       and extensions.st_distance(v_point, coalesce(v_spot.original_location, v_spot.location)) > v_radius then
      raise exception 'La position doit rester à moins de % m de celle de la photo.', v_radius::int
        using errcode = 'ST010';
    end if;
    if extensions.st_distance(v_point, v_spot.location) >= 1 then
      v_moved := true;
      v_changes := v_changes || jsonb_build_object('position', jsonb_build_array(
        jsonb_build_array(extensions.st_y(v_spot.location::extensions.geometry), extensions.st_x(v_spot.location::extensions.geometry)),
        jsonb_build_array(p_lat, p_lng)));
      -- Au-delà d'un kilomètre, la ville géocodée n'est plus sûre : ville la plus proche.
      if extensions.st_distance(v_point, v_spot.location) > 1000 then
        select c.name into v_city from private.nearest_city(v_point) c;
        v_spot.city := v_city;
      end if;
      v_spot.location := v_point;
      v_spot.country_iso2 := public.country_at(v_point);
      if v_spot.gps_source = 'manual' then
        v_spot.needs_review := true;
        v_spot.review_reason := 'Position placée à la main';
      end if;
    end if;
  end if;

  if v_changes = '{}'::jsonb then
    return jsonb_build_object('id', v_spot.id, 'changed', false);
  end if;

  perform private.set_ledger_reason('Modification par l''auteur : ' || v_spot.name);
  update public.spots
  set name = v_spot.name,
      comment = v_spot.comment,
      year = v_spot.year,
      taken_at = v_spot.taken_at,
      date_source = v_spot.date_source,
      location = v_spot.location,
      city = v_spot.city,
      country_iso2 = v_spot.country_iso2,
      needs_review = v_spot.needs_review,
      review_reason = v_spot.review_reason,
      updated_at = now()
  where id = v_spot.id;
  perform private.set_ledger_reason(null);

  if v_moved then
    perform public.compute_spot_points(v_spot.id, 'Modification de la position : ' || v_spot.name);
  end if;

  insert into public.admin_audit_log (actor_id, action, target, before, after)
  values (v_me, 'spot.edit_by_author', 'spot:' || v_spot.id, '{}'::jsonb, v_changes);

  perform private.refresh_leaderboard_if_present();
  return jsonb_build_object('id', v_spot.id, 'changed', true, 'changes', v_changes);
end;
$$;

revoke execute on function
  public.update_my_spot(uuid, text, text, timestamptz, int, double precision, double precision)
from public, anon, authenticated;
grant execute on function
  public.update_my_spot(uuid, text, text, timestamptz, int, double precision, double precision)
to authenticated;

-- Ce que le formulaire de modification de l'auteur affiche : position exacte et position
-- d'origine (rayon autorisé), date, édition, délai restant. Null pour un autre membre.
create function public.my_spot_edit_info(p_spot_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'comment', s.comment,
    'year', s.year,
    'takenAt', s.taken_at,
    'gpsSource', s.gps_source,
    'lat', extensions.st_y(s.location::extensions.geometry),
    'lng', extensions.st_x(s.location::extensions.geometry),
    'originLat', extensions.st_y(coalesce(s.original_location, s.location)::extensions.geometry),
    'originLng', extensions.st_x(coalesce(s.original_location, s.location)::extensions.geometry),
    'radiusM', coalesce((select value from public.scoring_rules where key = 'edit_radius_m'), 200),
    'createdAt', s.created_at,
    'editableUntil', s.created_at + make_interval(days => coalesce(
      (select value from public.scoring_rules where key = 'edit_window_days'), 7)::int),
    'windowOpen', now() < s.created_at + make_interval(days => coalesce(
      (select value from public.scoring_rules where key = 'edit_window_days'), 7)::int),
    'needsReview', s.needs_review,
    'status', s.status
  )
  from public.spots s
  where s.id = p_spot_id and s.author_id = auth.uid()
$$;

revoke execute on function public.my_spot_edit_info(uuid) from public, anon, authenticated;
grant execute on function public.my_spot_edit_info(uuid) to authenticated;

-- Nouvelle photo d'un sticker (Edge Function publish-spot, après contrôle du WebP).
-- Renvoie les anciens chemins, que l'Edge Function supprime de Storage.
create function public.replace_spot_photo(
  p_author uuid,
  p_spot_id uuid,
  p_photo_path text,
  p_thumb_path text default null,
  p_photo_hash bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_window int := coalesce((select value from public.scoring_rules where key = 'edit_window_days'), 7)::int;
  v_similar uuid;
begin
  select * into v_spot from public.spots where id = p_spot_id and author_id = p_author for update;
  if not found then
    raise exception 'Sticker introuvable.' using errcode = 'P0002';
  end if;
  if v_spot.status = 'hidden' then
    raise exception 'Ce sticker est masqué par la modération.' using errcode = '42501';
  end if;
  if v_spot.created_at < now() - make_interval(days => v_window) then
    raise exception 'Le délai de modification (% jours) est dépassé.', v_window using errcode = 'ST007';
  end if;
  if p_photo_path is null or p_photo_path !~ (
    '^' || p_author::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  ) then
    raise exception 'Chemin de photo invalide.' using errcode = 'ST005';
  end if;
  if p_thumb_path is not null and p_thumb_path <> regexp_replace(p_photo_path, '\.webp$', '.thumb.webp') then
    raise exception 'Chemin de miniature invalide.' using errcode = 'ST005';
  end if;
  if exists (select 1 from public.spots where photo_path = p_photo_path) then
    raise exception 'Cette photo a déjà été publiée.' using errcode = 'ST006';
  end if;

  v_similar := private.similar_photo(p_photo_hash, p_spot_id);
  update public.spots
  set photo_path = p_photo_path,
      thumb_path = p_thumb_path,
      photo_hash = p_photo_hash,
      needs_review = needs_review or v_similar is not null,
      review_reason = case when v_similar is not null then 'Photo très proche d''un autre sticker' else review_reason end,
      updated_at = now()
  where id = p_spot_id;

  insert into public.admin_audit_log (actor_id, action, target, before, after)
  values (p_author, 'spot.photo_by_author', 'spot:' || p_spot_id,
    jsonb_build_object('photo_path', v_spot.photo_path), jsonb_build_object('photo_path', p_photo_path));

  return jsonb_build_object('id', p_spot_id, 'old_photo_path', v_spot.photo_path, 'old_thumb_path', v_spot.thumb_path);
end;
$$;

revoke execute on function public.replace_spot_photo(uuid, uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.replace_spot_photo(uuid, uuid, text, text, bigint) to service_role;

-- Signalements avec statut --------------------------------------------------------------

alter table public.spot_reports
  add column status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz;

comment on column public.spot_reports.status is
  'pending : à traiter ; accepted : le sticker a été masqué ou supprimé ; rejected : le sticker reste.';

-- Seuls les signalements en attente comptent (compteur et passage en revue).
create or replace function private.spot_reports_after_change()
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

  select count(*) into v_count from public.spot_reports sr
  where sr.spot_id = v_spot_id and sr.status = 'pending';
  select r.value into v_threshold from public.scoring_rules r where r.key = 'reports_before_review';

  if tg_op = 'INSERT' then
    perform private.set_ledger_reason('Signalements : sticker en cours d''examen');
  end if;
  update public.spots s
  set
    report_count = v_count,
    status = case
      when tg_op = 'INSERT' and s.status = 'published' and v_count >= coalesce(v_threshold, 3)
        then 'pending_review'::public.spot_status
      else s.status
    end
  where s.id = v_spot_id;
  perform private.set_ledger_reason(null);

  return null;
end;
$$;

drop trigger if exists spot_reports_after_change on public.spot_reports;
create trigger spot_reports_after_change
  after insert or delete or update of status on public.spot_reports
  for each row execute function private.spot_reports_after_change();

-- Avis aux membres (décisions de modération) ------------------------------------------

create table public.user_notices (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  spot_id uuid,
  kind text not null check (kind in ('spot_hidden', 'spot_restored', 'spot_deleted', 'spot_validated',
    'report_accepted', 'report_rejected', 'points_adjusted', 'badge')),
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index user_notices_user_idx on public.user_notices (user_id, created_at desc);

comment on table public.user_notices is
  'Avis aux membres : décisions de modération sur leurs stickers ou signalements, corrections de points, badges.';

alter table public.user_notices enable row level security;
revoke all on public.user_notices from public, anon, authenticated;
revoke all on sequence public.user_notices_id_seq from public, anon, authenticated;
grant all on public.user_notices to service_role;
grant usage, select on sequence public.user_notices_id_seq to service_role;
grant select, delete on public.user_notices to authenticated;
grant update (read_at) on public.user_notices to authenticated;

create policy "user_notices : lecture des siens" on public.user_notices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_notices : marquer les siens comme lus" on public.user_notices
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_notices : supprimer les siens" on public.user_notices
  for delete to authenticated using (user_id = (select auth.uid()));

create function private.notify(p_user uuid, p_spot uuid, p_kind text, p_title text, p_body text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.user_notices (user_id, spot_id, kind, title, body)
  select p_user, p_spot, p_kind, p_title, nullif(btrim(coalesce(p_body, '')), '')
  where exists (select 1 from public.profiles where id = p_user)
$$;

revoke all on function private.notify(uuid, uuid, text, text, text) from public, anon, authenticated;

-- Correction de points : l'auteur est prévenu.
create function private.points_ledger_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'correction' then
    perform private.notify(new.user_id, null, 'points_adjusted',
      case when new.points > 0 then '+' else '' end || new.points || ' points',
      new.reason);
  end if;
  return null;
end;
$$;

revoke all on function private.points_ledger_notify() from public;

create trigger points_ledger_notify
  after insert on public.points_ledger
  for each row execute function private.points_ledger_notify();

-- Décision sur les signalements en attente d'un sticker.
create function private.resolve_reports(p_spot_id uuid, p_status text, p_spot_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reports jsonb;
  r record;
begin
  select coalesce(jsonb_agg(
           jsonb_build_object('reporter_id', sr.reporter_id, 'reason', sr.reason, 'created_at', sr.created_at)
           order by sr.created_at), '[]'::jsonb)
    into v_reports
    from public.spot_reports sr
    where sr.spot_id = p_spot_id and sr.status = 'pending';

  for r in
    update public.spot_reports
    set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where spot_id = p_spot_id and status = 'pending'
    returning reporter_id
  loop
    perform private.notify(r.reporter_id, p_spot_id,
      case when p_status = 'accepted' then 'report_accepted' else 'report_rejected' end,
      case when p_status = 'accepted'
        then 'Ton signalement a été retenu'
        else 'Ton signalement n''a pas été retenu' end,
      p_spot_name);
  end loop;
  return v_reports;
end;
$$;

revoke all on function private.resolve_reports(uuid, text, text) from public, anon, authenticated;

-- Modération -----------------------------------------------------------------------------

drop function if exists public.admin_moderation_queue();
drop function if exists public.admin_search_spots(text, int);
drop view if exists private.admin_spot_rows;

create view private.admin_spot_rows as
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
    s.thumb_path
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
  rarity_reason text, thumb_path text
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
  rarity_reason text, thumb_path text
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

create or replace function public.admin_moderation_count()
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.admin_require('moderator');
  return (
    select count(*)::int
    from public.spots s
    where s.status = 'pending_review'
       or (s.status = 'published' and (
         s.needs_review
         or exists (select 1 from public.spot_reports r where r.spot_id = s.id and r.status = 'pending')
       ))
  );
end;
$$;

drop function if exists public.admin_validate_spot(uuid);
drop function if exists public.admin_hide_spot(uuid);
drop function if exists public.admin_unhide_spot(uuid);
drop function if exists public.admin_delete_spot(uuid);

-- Valider : publié, « à vérifier » levé, signalements rejetés.
create function public.admin_validate_spot(p_spot_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_before jsonb;
  v_reports jsonb;
  v_after jsonb;
begin
  perform private.admin_require('moderator');

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  v_before := private.spot_snapshot(v_spot) || jsonb_build_object('needs_review', v_spot.needs_review);

  v_reports := private.resolve_reports(p_spot_id, 'rejected', v_spot.name);

  perform private.set_ledger_reason('Validé par la modération : ' || v_spot.name);
  update public.spots
    set status = 'published', report_count = 0, needs_review = false, review_reason = null, updated_at = now()
    where id = p_spot_id;
  perform private.set_ledger_reason(null);
  if v_spot.status <> 'published' then
    perform public.compute_spot_points(p_spot_id, 'Validé par la modération : ' || v_spot.name);
    perform private.notify(v_spot.author_id, p_spot_id, 'spot_validated',
      'Ton sticker est de nouveau visible', v_spot.name);
  end if;

  select * into v_spot from public.spots where id = p_spot_id;
  v_after := private.spot_snapshot(v_spot) || jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), ''));
  perform private.audit('spot.validate', 'spot:' || p_spot_id,
    v_before || jsonb_build_object('reports', v_reports), v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Masquer : invisible du public et hors classement, réversible ; signalements retenus.
create function public.admin_hide_spot(p_spot_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before jsonb;
  v_reports jsonb;
  v_after jsonb;
begin
  perform private.admin_require('moderator');

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  if v_spot.status = 'hidden' then
    raise exception 'Ce sticker est déjà masqué' using errcode = 'ST804';
  end if;
  v_before := private.spot_snapshot(v_spot);
  v_reports := private.resolve_reports(p_spot_id, 'accepted', v_spot.name);

  perform private.set_ledger_reason('Masqué par la modération : ' || v_spot.name
    || coalesce(' (' || v_reason || ')', ''));
  update public.spots set status = 'hidden', updated_at = now()
    where id = p_spot_id
    returning * into v_spot;
  perform private.set_ledger_reason(null);

  perform private.notify(v_spot.author_id, p_spot_id, 'spot_hidden',
    'Ton sticker « ' || v_spot.name || ' » a été masqué par la modération', v_reason);

  v_after := private.spot_snapshot(v_spot) || jsonb_build_object('reason', v_reason);
  perform private.audit('spot.hide', 'spot:' || p_spot_id, v_before || jsonb_build_object('reports', v_reports), v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Démasquer : publié (la publication est directe).
create function public.admin_unhide_spot(p_spot_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_before jsonb;
  v_after jsonb;
begin
  perform private.admin_require('moderator');

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  if v_spot.status <> 'hidden' then
    raise exception 'Ce sticker n''est pas masqué' using errcode = 'ST804';
  end if;
  v_before := private.spot_snapshot(v_spot);

  perform private.set_ledger_reason('Rétabli par la modération : ' || v_spot.name);
  update public.spots set status = 'published', updated_at = now()
    where id = p_spot_id
    returning * into v_spot;
  perform private.set_ledger_reason(null);
  perform public.compute_spot_points(p_spot_id, 'Rétabli par la modération : ' || v_spot.name);

  perform private.notify(v_spot.author_id, p_spot_id, 'spot_restored',
    'Ton sticker « ' || v_spot.name || ' » est de nouveau visible', nullif(btrim(coalesce(p_reason, '')), ''));

  select * into v_spot from public.spots where id = p_spot_id;
  v_after := private.spot_snapshot(v_spot);
  perform private.audit('spot.unhide', 'spot:' || p_spot_id, v_before, v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Supprimer : définitif. Renvoie les chemins des fichiers, supprimés ensuite par la
-- Server Action (photo et miniature).
create function public.admin_delete_spot(p_spot_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before jsonb;
begin
  perform private.admin_require('moderator');

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  v_before := private.spot_snapshot(v_spot);
  perform private.resolve_reports(p_spot_id, 'accepted', v_spot.name);

  perform private.set_ledger_reason('Supprimé par la modération' || coalesce(' (' || v_reason || ')', ''));
  delete from public.spots where id = p_spot_id;
  perform private.set_ledger_reason(null);

  perform private.notify(v_spot.author_id, p_spot_id, 'spot_deleted',
    'Ton sticker « ' || v_spot.name || ' » a été supprimé par la modération', v_reason);
  perform private.audit('spot.delete', 'spot:' || p_spot_id, v_before,
    jsonb_build_object('deleted', true, 'reason', v_reason));
  perform private.refresh_leaderboard_if_present();
  return jsonb_build_object('id', p_spot_id, 'name', v_spot.name, 'deleted', true,
    'photo_path', v_spot.photo_path, 'thumb_path', v_spot.thumb_path);
end;
$$;

revoke execute on function
  public.admin_moderation_queue(),
  public.admin_search_spots(text, int),
  public.admin_validate_spot(uuid, text),
  public.admin_hide_spot(uuid, text),
  public.admin_unhide_spot(uuid, text),
  public.admin_delete_spot(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function
  public.admin_moderation_queue(),
  public.admin_search_spots(text, int),
  public.admin_validate_spot(uuid, text),
  public.admin_hide_spot(uuid, text),
  public.admin_unhide_spot(uuid, text),
  public.admin_delete_spot(uuid, text)
to authenticated;

-- Suppression d'un compte par un admin --------------------------------------------------
-- L'Edge Function delete-account (clé service) vérifie que l'appelant est admin, appelle
-- cette fonction (contrôles + journal), supprime les fichiers puis le compte Auth.

create function public.record_admin_account_deletion(p_actor uuid, p_user uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_actor from public.profiles where id = p_actor;
  if not found or v_actor.role <> 'admin' or v_actor.suspended_at is not null then
    raise exception 'Action réservée aux admins' using errcode = '42501';
  end if;
  if p_user = p_actor then
    raise exception 'Supprime ton propre compte depuis tes réglages' using errcode = 'ST803';
  end if;
  if char_length(v_reason) not between 3 and 200 then
    raise exception 'Motif obligatoire (3 à 200 caractères)' using errcode = '22023';
  end if;
  select * into v_target from public.profiles where id = p_user;
  if not found then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;
  if v_target.role = 'admin' then
    raise exception 'Retire d''abord le rôle admin de ce compte' using errcode = 'ST012';
  end if;

  insert into public.admin_audit_log (actor_id, action, target, before, after)
  values (p_actor, 'user.delete', 'user:' || p_user,
    jsonb_build_object('username', v_target.username, 'role', v_target.role,
      'stickers', (select count(*) from public.spots where author_id = p_user)),
    jsonb_build_object('deleted', true, 'reason', v_reason));
  return jsonb_build_object('id', p_user, 'username', v_target.username);
end;
$$;

revoke execute on function public.record_admin_account_deletion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_admin_account_deletion(uuid, uuid, text) to service_role;

-- Pseudos réservés ------------------------------------------------------------------------

create table private.reserved_usernames (username text primary key);
insert into private.reserved_usernames (username) values
  ('admin'), ('admins'), ('administrateur'), ('administrator'), ('moderateur'), ('moderator'),
  ('moderation'), ('modo'), ('staff'), ('equipe'), ('team'), ('support'), ('aide'), ('help'),
  ('contact'), ('root'), ('system'), ('systeme'), ('null'), ('undefined'), ('anonyme'),
  ('anonymous'), ('tomi'), ('spotomi'), ('spot_tomi'), ('spottomi'), ('officiel'), ('official'),
  ('api'), ('www'), ('me'), ('moi');

create function public.username_is_reserved(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.reserved_usernames r where r.username = lower(coalesce(candidate, ''))
  )
  or lower(coalesce(candidate, '')) like 'demo\_%'
  or lower(coalesce(candidate, '')) ~ '^(admin|modo|moderat|tomi_?officiel|spot_?tomi)'
$$;

revoke execute on function public.username_is_reserved(text) from public, anon, authenticated;
grant execute on function public.username_is_reserved(text) to anon, authenticated, service_role;

create function private.profiles_reserved_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Les comptes de démo (créés par le propriétaire de la base) gardent leur pseudo.
  if auth.uid() is not null
     and (tg_op = 'INSERT' or new.username is distinct from old.username)
     and public.username_is_reserved(new.username) then
    raise exception 'Ce pseudo est réservé.' using errcode = 'ST011';
  end if;
  return new;
end;
$$;

revoke execute on function private.profiles_reserved_username() from public;

create trigger profiles_reserved_username
  before insert or update of username on public.profiles
  for each row execute function private.profiles_reserved_username();

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,20}$'
    and not public.username_is_reserved(candidate)
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = lower(candidate) and p.id is distinct from auth.uid()
    )
$$;

-- Carte : filtres pays et période, rares par catégorie ------------------------------------
--   countries : text[]  codes ISO2 (tableau vide = tous)
--   from, to  : date    période du collage (bornes incluses)
--   rare      : bool    lieux isolés ou très rares, sites remarquables, premiers du pays

create or replace function public.spots_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit constant int := 5000;
  v_me uuid := auth.uid();
  v_filters jsonb := coalesce(filters, '{}'::jsonb);
  v_years int[];
  v_countries text[];
  v_from date;
  v_to date;
  v_author uuid;
  v_rare boolean;
  v_mine boolean;
  v_boxes extensions.geometry[];
  v_features jsonb;
  v_count int;
begin
  if min_lng is null or min_lat is null or max_lng is null or max_lat is null
     or min_lng not between -180 and 180 or max_lng not between -180 and 180
     or min_lat not between -90 and 90 or max_lat not between -90 and 90
     or min_lat > max_lat then
    raise exception 'Zone invalide' using errcode = '22023';
  end if;

  if jsonb_typeof(v_filters) <> 'object' then
    raise exception 'Filtres invalides' using errcode = '22023';
  end if;

  if v_filters ? 'years' and jsonb_typeof(v_filters -> 'years') = 'array' then
    select array_agg(value::int) into v_years
    from jsonb_array_elements_text(v_filters -> 'years');
  elsif v_filters ? 'years' and jsonb_typeof(v_filters -> 'years') <> 'null' then
    raise exception 'Filtre years invalide' using errcode = '22023';
  end if;

  if v_filters ? 'countries' and jsonb_typeof(v_filters -> 'countries') = 'array' then
    select array_agg(upper(value)) into v_countries
    from jsonb_array_elements_text(v_filters -> 'countries');
  elsif v_filters ? 'countries' and jsonb_typeof(v_filters -> 'countries') <> 'null' then
    raise exception 'Filtre countries invalide' using errcode = '22023';
  end if;

  begin
    v_from := nullif(v_filters ->> 'from', '')::date;
    v_to := nullif(v_filters ->> 'to', '')::date;
  exception when others then
    raise exception 'Filtre de période invalide' using errcode = '22023';
  end;

  v_author := nullif(v_filters ->> 'authorId', '')::uuid;
  v_rare := coalesce((v_filters ->> 'rare')::boolean, false);
  v_mine := coalesce((v_filters ->> 'mine')::boolean, false);

  if v_mine and v_me is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;

  if min_lng <= max_lng then
    v_boxes := array[extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)];
  else
    v_boxes := array[
      extensions.st_makeenvelope(min_lng, min_lat, 180, max_lat, 4326),
      extensions.st_makeenvelope(-180, min_lat, max_lng, max_lat, 4326)
    ];
  end if;

  with boxes as (
    select unnest(v_boxes) as env
  ),
  candidates as (
    select s.id, s.public_location, s.year, s.points_total, s.country_iso2, s.taken_at,
           s.is_first_in_country, s.is_exceptional, s.rarity_category, false as pending, s.author_id
    from boxes b
    join public.spots s
      on (s.public_location::extensions.geometry) operator(extensions.&&) b.env
    where s.status = 'published'
    union all
    select s.id, s.public_location, s.year, s.points_total, s.country_iso2, s.taken_at,
           s.is_first_in_country, s.is_exceptional, s.rarity_category, true as pending, s.author_id
    from boxes b
    join public.spots s
      on (s.public_location::extensions.geometry) operator(extensions.&&) b.env
    where v_me is not null
      and s.author_id = v_me
      and s.status = 'pending_review'
  ),
  filtered as (
    select c.*,
           (c.is_first_in_country or c.is_exceptional) as gold,
           coalesce(se.color_hex, '#9A9A94') as color
    from candidates c
    left join public.seasons se on se.year = c.year
    where (v_years is null or cardinality(v_years) = 0 or c.year = any (v_years))
      and (v_countries is null or cardinality(v_countries) = 0 or c.country_iso2 = any (v_countries))
      and (v_from is null or c.taken_at >= v_from::timestamp at time zone 'UTC')
      and (v_to is null or c.taken_at < (v_to + 1)::timestamp at time zone 'UTC')
      and (v_author is null or c.author_id = v_author)
      and (not v_mine or c.author_id = v_me)
      and (
        not v_rare
        or c.is_first_in_country
        or c.is_exceptional
        or c.rarity_category in ('remarquable', 'isole', 'tres_rare')
      )
    order by c.points_total desc, c.id
    limit v_limit + 1
  ),
  numbered as (
    select f.*, row_number() over (order by f.points_total desc, f.id) as n
    from filtered f
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', jsonb_build_object(
            'type', 'Point',
            'coordinates', jsonb_build_array(
              round(extensions.st_x(n.public_location::extensions.geometry)::numeric, 5),
              round(extensions.st_y(n.public_location::extensions.geometry)::numeric, 5)
            )
          ),
          'properties', jsonb_build_object(
            'id', n.id,
            'color', n.color,
            'year', n.year,
            'points', n.points_total,
            'gold', n.gold,
            'pending', n.pending
          )
        )
        order by n.n
      ) filter (where n.n <= v_limit),
      '[]'::jsonb
    ),
    count(*)
  into v_features, v_count
  from numbered n;

  return jsonb_build_object(
    'type', 'FeatureCollection',
    'features', v_features,
    'truncated', v_count > v_limit
  );
end;
$$;

-- Stickers proches d'un sticker publié (fiche) : distance en mètres.
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
  distance_m int
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.city, c.name_fr, o.year, public.year_color(o.year), o.points_total,
         o.thumb_path, o.photo_path,
         round(extensions.st_distance(o.public_location, s.public_location))::int
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

-- Stickers d'un profil : miniature et commentaire en plus.
drop function if exists public.profile_spots(uuid);

create function public.profile_spots(p_user uuid)
returns table (
  id uuid,
  name text,
  city text,
  country_iso2 text,
  country_name_fr text,
  year int,
  color_hex text,
  status public.spot_status,
  points_total int,
  is_first_in_country boolean,
  is_exceptional boolean,
  taken_at timestamptz,
  thumb_path text,
  photo_path text,
  rarity_category text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.name, s.city, s.country_iso2::text, c.name_fr, s.year, public.year_color(s.year),
    s.status, s.points_total, s.is_first_in_country, s.is_exceptional, s.taken_at,
    s.thumb_path, s.photo_path, s.rarity_category::text
  from public.spots s
  left join public.countries c on c.iso2 = s.country_iso2
  where s.author_id = p_user
    and (s.status = 'published' or (p_user = (select auth.uid())))
  order by s.taken_at desc, s.created_at desc, s.id
$$;

revoke execute on function public.profile_spots(uuid) from public, anon, authenticated;
grant execute on function public.profile_spots(uuid) to anon, authenticated, service_role;

-- Journal d'erreurs de l'app ------------------------------------------------------------------
-- Écrit par le serveur Next (instrumentation) et par le navigateur (erreurs d'affichage,
-- échecs d'envoi de photo). Gardé 30 jours. Lecture admin.

create table private.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null check (source in ('server', 'client', 'upload', 'edge')),
  message text not null,
  digest text,
  path text,
  user_agent text,
  user_id uuid
);
create index app_errors_created_idx on private.app_errors (created_at desc);

create function public.log_app_error(
  p_source text,
  p_message text,
  p_digest text default null,
  p_path text default null,
  p_user_agent text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_source is null or p_source not in ('server', 'client', 'upload', 'edge') then
    return;
  end if;
  -- Garde-fou contre l'abus : 200 erreurs par minute au plus, toutes sources confondues.
  if (select count(*) from private.app_errors where created_at > now() - interval '1 minute') >= 200 then
    return;
  end if;
  insert into private.app_errors (source, message, digest, path, user_agent, user_id)
  values (
    p_source,
    left(coalesce(nullif(btrim(p_message), ''), 'Erreur sans message'), 1000),
    left(p_digest, 100),
    left(p_path, 300),
    left(p_user_agent, 300),
    auth.uid()
  );
  delete from private.app_errors where created_at < now() - interval '30 days';
end;
$$;

revoke execute on function public.log_app_error(text, text, text, text, text) from public;
grant execute on function public.log_app_error(text, text, text, text, text) to anon, authenticated, service_role;

create function public.admin_recent_errors(p_limit int default 100)
returns table (
  id bigint, created_at timestamptz, source text, message text, digest text, path text,
  user_agent text, username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.admin_require('admin');
  return query
    select e.id, e.created_at, e.source, e.message, e.digest, e.path, e.user_agent, p.username
    from private.app_errors e
    left join public.profiles p on p.id = e.user_id
    order by e.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.admin_recent_errors(int) from public, anon, authenticated, service_role;
grant execute on function public.admin_recent_errors(int) to authenticated;

-- Cache du géocodage : la case garde aussi « site touristique ou historique à proximité »
-- (null : inconnu, cases enregistrées avant ce lot).

alter table private.geocode_cache add column tourist boolean;

drop function if exists public.geocode_cache_get(double precision, double precision);
drop function if exists public.geocode_cache_put(double precision, double precision, text, text);

create function public.geocode_cache_get(p_lat double precision, p_lng double precision)
returns table (hit boolean, city text, tourist boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select true, g.city, g.tourist
  from private.geocode_cache g
  where g.cell = private.geocode_cell(p_lat, p_lng)
    and g.created_at > now() - interval '180 days'
$$;

create function public.geocode_cache_put(
  p_lat double precision,
  p_lng double precision,
  p_city text,
  p_provider text,
  p_tourist boolean default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.geocode_cache (cell, city, provider, tourist, created_at)
  values (
    private.geocode_cell(p_lat, p_lng),
    left(nullif(btrim(coalesce(p_city, '')), ''), 120),
    left(coalesce(p_provider, 'inconnu'), 40),
    p_tourist,
    now()
  )
  on conflict (cell) do update
    set city = excluded.city, provider = excluded.provider, tourist = excluded.tourist,
        created_at = excluded.created_at
$$;

revoke execute on function
  public.geocode_cache_get(double precision, double precision),
  public.geocode_cache_put(double precision, double precision, text, text, boolean)
from public, anon, authenticated;
grant execute on function
  public.geocode_cache_get(double precision, double precision),
  public.geocode_cache_put(double precision, double precision, text, text, boolean)
to service_role;

-- Version du schéma ----------------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261130000002_cahier_lot1'::text $$;
