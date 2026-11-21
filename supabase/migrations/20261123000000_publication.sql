-- Étape 5 · Publication d'un sticker (spécifications 2.2, 2.7, 3.3, 6.1 ; contrats §4).
--
-- - Bucket spot-photos (WebP sans métadonnées, 20 Mo, lecture publique,
--   écriture dans le dossier {auth.uid()} seulement).
-- - public.create_spot : seule porte d'entrée des stickers, appelée par l'Edge
--   Function publish-spot avec la clé service (jamais par le client).
-- - public.estimate_spot_points : estimation des points avant publication,
--   pour l'utilisateur connecté, sans rien laisser en base.
-- - Cache du géocodage inverse (ville), lu et écrit par l'Edge Function.
--
-- Codes d'erreur (SQLSTATE) renvoyés, avec un message en français :
--   28000  connexion requise (estimation)
--   ST001  profil manquant (pseudo pas encore choisi)
--   ST002  compte suspendu
--   ST003  limite de publications sur 24 heures atteinte
--   ST004  déjà un sticker de cet auteur à moins de 200 m dans les 24 heures
--   ST005  données invalides (nom, position, sources, date, altitude, chemin)
--   ST006  photo déjà utilisée par un autre sticker
-- « Par jour » s'entend sur 24 heures glissantes : pas de fuseau horaire à
-- choisir, et pas de « remise à zéro » à minuit exploitable.

-- Règles communes aux deux fonctions ----------------------------------------------

-- Motif qui empêche cet auteur de publier ici maintenant, ou null.
-- Rayon : neighbor_radius_m (200 m, la même tranche que le malus voisin).
create function private.publish_block_reason(p_author uuid, p_point extensions.geography)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_suspended timestamptz;
  v_limit int := coalesce(
    (select value from public.scoring_rules where key = 'daily_publish_limit'), 20)::int;
  v_radius float8 := coalesce(
    (select value from public.scoring_rules where key = 'neighbor_radius_m'), 200)::float8;
begin
  select suspended_at into v_suspended from public.profiles where id = p_author;
  if not found then
    return 'missing_profile';
  end if;
  if v_suspended is not null then
    return 'suspended';
  end if;
  if (
    select count(*) from public.spots
    where author_id = p_author and created_at > now() - interval '24 hours'
  ) >= v_limit then
    return 'daily_limit';
  end if;
  if exists (
    select 1 from public.spots
    where author_id = p_author
      and created_at > now() - interval '24 hours'
      and extensions.st_dwithin(location, p_point, v_radius)
  ) then
    return 'nearby_today';
  end if;
  return null;
end;
$$;

-- Lève l'erreur correspondant au motif (code dédié, message français).
create function private.raise_publish_block(p_reason text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  case p_reason
    when 'missing_profile' then
      raise exception 'Choisis d''abord ton pseudo pour publier un sticker.' using errcode = 'ST001';
    when 'suspended' then
      raise exception 'Ton compte est suspendu : tu ne peux plus publier de sticker.' using errcode = 'ST002';
    when 'daily_limit' then
      raise exception 'Tu as atteint la limite de publications des dernières 24 heures. Réessaie plus tard.'
        using errcode = 'ST003';
    when 'nearby_today' then
      raise exception 'Tu as déjà collé un sticker à moins de 200 m d''ici ces dernières 24 heures.'
        using errcode = 'ST004';
    else
      null;
  end case;
end;
$$;

-- Contrôle des données d'entrée communes ; lève ST005 avec un message précis.
create function private.check_publish_input(
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
  -- NaN et ±Infinity échouent aussi à ces comparaisons.
  if p_lat is null or p_lng is null or not (p_lat between -90 and 90) or not (p_lng between -180 and 180) then
    raise exception 'Position invalide.' using errcode = 'ST005';
  end if;
  if p_gps_source is null or p_gps_source not in ('exif', 'manual') then
    raise exception 'Source de la position invalide.' using errcode = 'ST005';
  end if;
  if p_date_source is null or p_date_source not in ('exif', 'upload') then
    raise exception 'Source de la date invalide.' using errcode = 'ST005';
  end if;
  if p_altitude_m is not null and not (p_altitude_m between -500 and 9000) then
    raise exception 'Altitude invalide.' using errcode = 'ST005';
  end if;
end;
$$;

-- Date de prise retenue : celle de la photo, ou l'envoi (now()) si la photo n'en
-- a pas. Une date « upload » envoyée par le client est ignorée : il ne peut pas
-- choisir l'année (donc la couleur) d'un sticker sans date.
create function private.effective_taken_at(p_taken_at timestamptz, p_date_source text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_date_source = 'upload' then
    return now();
  end if;
  if p_taken_at is null or p_taken_at < timestamptz '2000-01-01 00:00:00+00'
     or p_taken_at > now() + interval '1 day' then
    raise exception 'Date de prise invalide.' using errcode = 'ST005';
  end if;
  return p_taken_at;
end;
$$;

revoke all on function
  private.publish_block_reason(uuid, extensions.geography),
  private.raise_publish_block(text),
  private.check_publish_input(double precision, double precision, numeric, text, text),
  private.effective_taken_at(timestamptz, text)
from public, anon, authenticated;

-- Publication ---------------------------------------------------------------------

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
  p_city text
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
  v_point extensions.geography;
  v_taken_at timestamptz;
  v_status public.spot_status;
  v_id uuid;
begin
  if p_author is null then
    raise exception 'Auteur manquant.' using errcode = 'ST005';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'Le nom du lieu est obligatoire (80 caractères maximum).' using errcode = 'ST005';
  end if;
  perform private.check_publish_input(p_lat, p_lng, p_altitude_m, p_gps_source, p_date_source);
  v_taken_at := private.effective_taken_at(p_taken_at, p_date_source);
  if p_photo_path is null or p_photo_path !~ (
    '^' || p_author::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  ) then
    raise exception 'Chemin de photo invalide.' using errcode = 'ST005';
  end if;

  -- Une publication à la fois par auteur : les limites ne peuvent pas être
  -- contournées par des envois simultanés.
  perform pg_advisory_xact_lock(hashtextextended('create_spot:' || p_author::text, 0));

  if exists (select 1 from public.spots where photo_path = p_photo_path) then
    raise exception 'Cette photo a déjà été publiée.' using errcode = 'ST006';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  perform private.raise_publish_block(private.publish_block_reason(p_author, v_point));

  -- Sans GPS ou sans date dans la photo : vérification par un modérateur.
  v_status := case
    when p_gps_source = 'manual' or p_date_source = 'upload' then 'pending_review'
    else 'published'
  end;

  insert into public.spots (
    author_id, name, location, public_location, altitude_m, taken_at, year,
    gps_source, date_source, country_iso2, city, photo_path, status
  )
  values (
    p_author,
    v_name,
    v_point,
    public.public_location_for(p_author, v_point),
    round(p_altitude_m, 1),
    v_taken_at,
    extract(year from v_taken_at at time zone 'UTC')::int,
    p_gps_source,
    p_date_source,
    public.country_at(v_point),
    v_city,
    p_photo_path,
    v_status
  )
  returning id into v_id;

  perform public.compute_spot_points(v_id);
  return v_id;
end;
$$;

comment on function public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text) is
  'Crée un sticker (Edge Function publish-spot, clé service). Erreurs ST001 à ST006 : voir la migration.';

revoke execute on function
  public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text)
from public, anon, authenticated;
grant execute on function
  public.create_spot(uuid, text, double precision, double precision, numeric, timestamptz, text, text, text, text)
to service_role;

-- Estimation avant publication ------------------------------------------------------
-- Calcule les points comme compute_spot_points le ferait pour l'utilisateur
-- connecté, puis annule tout (sous-transaction) : rien ne reste en base.
-- La ville n'est connue qu'à la publication (géocodage côté serveur) : sans
-- p_city, le bonus « première ville » peut manquer, d'où le « ≈ » affiché.
-- `blocked` signale à l'avance une publication qui serait refusée
-- (daily_limit, nearby_today), sans lever d'erreur.

create function public.estimate_spot_points(
  p_lat double precision,
  p_lng double precision,
  p_altitude_m numeric default null,
  p_taken_at timestamptz default null,
  p_gps_source text default 'exif',
  p_date_source text default 'exif',
  p_city text default null
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
  v_taken_at timestamptz;
  v_reason text;
  v_status public.spot_status;
  v_id uuid;
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;
  perform private.check_publish_input(p_lat, p_lng, p_altitude_m, p_gps_source, p_date_source);
  v_taken_at := private.effective_taken_at(coalesce(p_taken_at, now()), p_date_source);
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  v_reason := private.publish_block_reason(v_me, v_point);
  if v_reason in ('missing_profile', 'suspended') then
    perform private.raise_publish_block(v_reason);
  end if;

  v_status := case
    when p_gps_source = 'manual' or p_date_source = 'upload' then 'pending_review'
    else 'published'
  end;

  begin
    insert into public.spots (
      author_id, name, location, public_location, altitude_m, taken_at, year,
      gps_source, date_source, country_iso2, city, photo_path, status
    )
    values (
      v_me, 'Estimation', v_point, v_point, round(p_altitude_m, 1), v_taken_at,
      extract(year from v_taken_at at time zone 'UTC')::int,
      p_gps_source, p_date_source, public.country_at(v_point),
      left(nullif(btrim(coalesce(p_city, '')), ''), 120),
      -- Chemin au format réel (aucun fichier) : la ligne est annulée plus bas.
      v_me::text || '/' || gen_random_uuid()::text || '.webp',
      v_status
    )
    returning id into v_id;

    perform public.compute_spot_points(v_id);

    select jsonb_build_object(
      'pointsTotal', s.points_total,
      'status', s.status,
      'year', s.year,
      'colorHex', public.year_color(s.year),
      'countryIso2', s.country_iso2,
      'countryNameFr', c.name_fr,
      'isFirstInCountry', s.is_first_in_country,
      'blocked', v_reason,
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

    -- Annule l'insertion et les lignes de points (les variables restent).
    raise sqlstate 'ST999';
  exception
    when sqlstate 'ST999' then
      null;
  end;

  return v_result;
end;
$$;

comment on function public.estimate_spot_points(double precision, double precision, numeric, timestamptz, text, text, text) is
  'Estimation des points avant publication, pour l''utilisateur connecté. Ne laisse rien en base.';

revoke execute on function
  public.estimate_spot_points(double precision, double precision, numeric, timestamptz, text, text, text)
from public, anon;
grant execute on function
  public.estimate_spot_points(double precision, double precision, numeric, timestamptz, text, text, text)
to authenticated, service_role;

-- Cache du géocodage inverse ----------------------------------------------------------
-- Une case de 0,001° (~110 m) → la ville trouvée (ou aucune). Réservé à
-- l'Edge Function (clé service) ; aucune donnée d'utilisateur n'y est liée.

create table private.geocode_cache (
  cell text primary key,
  city text,
  provider text not null,
  created_at timestamptz not null default now()
);

alter table private.geocode_cache enable row level security;
revoke all on private.geocode_cache from public, anon, authenticated;
grant all on private.geocode_cache to service_role;

create function private.geocode_cell(p_lat double precision, p_lng double precision)
returns text
language sql
immutable
set search_path = ''
as $$ select round(p_lat::numeric, 3)::text || ',' || round(p_lng::numeric, 3)::text $$;

create function public.geocode_cache_get(p_lat double precision, p_lng double precision)
returns table (hit boolean, city text)
language sql
stable
security definer
set search_path = ''
as $$
  select true, g.city
  from private.geocode_cache g
  where g.cell = private.geocode_cell(p_lat, p_lng)
    and g.created_at > now() - interval '180 days'
$$;

create function public.geocode_cache_put(
  p_lat double precision,
  p_lng double precision,
  p_city text,
  p_provider text
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.geocode_cache (cell, city, provider, created_at)
  values (
    private.geocode_cell(p_lat, p_lng),
    left(nullif(btrim(coalesce(p_city, '')), ''), 120),
    left(coalesce(p_provider, 'inconnu'), 40),
    now()
  )
  on conflict (cell) do update
    set city = excluded.city, provider = excluded.provider, created_at = excluded.created_at
$$;

revoke all on function private.geocode_cell(double precision, double precision) from public, anon, authenticated;
revoke execute on function
  public.geocode_cache_get(double precision, double precision),
  public.geocode_cache_put(double precision, double precision, text, text)
from public, anon, authenticated;
grant execute on function
  public.geocode_cache_get(double precision, double precision),
  public.geocode_cache_put(double precision, double precision, text, text)
to service_role;

-- Photos des stickers (Storage) ---------------------------------------------------------
-- Lecture publique (URL publique des photos) ; envoi réservé au dossier
-- {auth.uid()} d'un compte non suspendu, en WebP uniquement. Pas de
-- remplacement : une photo publiée ne change plus. Le serveur vérifie ensuite
-- qu'aucune métadonnée (EXIF, XMP, ICC) n'y reste.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schéma storage absent : bucket spot-photos non créé.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('spot-photos', 'spot-photos', true, 20971520, array['image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $policy$
    create policy "spot-photos : lecture de son dossier"
      on storage.objects for select to authenticated
      using (bucket_id = 'spot-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $policy$;
  execute $policy$
    create policy "spot-photos : envoi dans son dossier"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'spot-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and lower(storage.extension(name)) = 'webp'
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.suspended_at is null
        )
      )
  $policy$;
  execute $policy$
    create policy "spot-photos : suppression dans son dossier"
      on storage.objects for delete to authenticated
      using (bucket_id = 'spot-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $policy$;
end;
$$;

-- Version du schéma ---------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261123000000_publication'::text $$;
