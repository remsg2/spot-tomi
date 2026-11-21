-- Étape 6 · Carte mondiale et fiche lieu (spécifications 2.3, 2.4, 6.2 ; contrats §5).
--
-- Fournit :
-- - spots_in_bbox(...) : stickers visibles dans une zone, en GeoJSON léger, filtrés ;
-- - country_rarity : niveau de rareté de chaque pays et nombre de stickers publiés ;
-- - search_spots(q) : recherche de lieux, de pays et de pseudos, sans tenir compte des accents.
--
-- Rien ici ne renvoie la position exacte (spots.location) : uniquement public_location.
-- Comme ailleurs, on part de zéro droit puis on accorde explicitement.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Normalisation de recherche ----------------------------------------------------
-- Minuscules et sans accents (« Ushuaïa » → « ushuaia »). Déclarée immutable pour
-- pouvoir servir dans un index : le dictionnaire unaccent est nommé explicitement.

create function public.search_normalize(value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, value))
$$;

comment on function public.search_normalize(text) is
  'Texte en minuscules et sans accents, pour la recherche (search_spots).';

-- Pure et sans donnée : utilisable par tous (elle sert aussi dans les index de spots,
-- évalués lors des modifications faites par les utilisateurs).
revoke execute on function public.search_normalize(text) from public, anon, authenticated;
grant execute on function public.search_normalize(text) to anon, authenticated, service_role;

-- Index -----------------------------------------------------------------------------

-- Zone visible : l'index GiST de l'étape 4 porte sur la geography ; la carte filtre par
-- rectangle en longitude/latitude, donc en geometry. Index partiel : seuls les
-- stickers publiés apparaissent pour le public.
create index if not exists spots_public_geom_published_idx
  on public.spots using gist ((public_location::extensions.geometry))
  where status = 'published';

-- Tri par points dans une zone (plafond du nombre de marqueurs renvoyés).
create index if not exists spots_published_points_idx
  on public.spots (points_total desc)
  where status = 'published';

-- Recherche par nom de lieu ou ville (trigrammes sur le texte normalisé).
create index if not exists spots_name_search_idx
  on public.spots using gin (public.search_normalize(name) extensions.gin_trgm_ops)
  where status = 'published';
create index if not exists spots_city_search_idx
  on public.spots using gin (public.search_normalize(city) extensions.gin_trgm_ops)
  where status = 'published';

-- Recherche par pseudo (les pseudos sont en ASCII : lower suffit).
create index if not exists profiles_username_search_idx
  on public.profiles using gin (lower(username) extensions.gin_trgm_ops);

-- Stickers dans une zone -----------------------------------------------------------
--
-- Zone : min_lng, min_lat, max_lng, max_lat en degrés, longitudes dans [-180, 180].
-- Si min_lng > max_lng, la zone traverse l'antiméridien : elle est découpée en deux
-- rectangles ([min_lng, 180] et [-180, max_lng]).
--
-- filters (tous facultatifs) :
--   years    : int[]  années des stickers (tableau vide = toutes)
--   authorId : uuid   stickers d'une personne
--   rare     : bool   anneau doré (premier du pays ou lieu exceptionnel) ou base ≥ 60 points
--   mine     : bool   mes stickers (exige d'être connecté)
--
-- Visibles : les stickers publiés ; plus, pour l'auteur connecté, ses propres stickers
-- en attente (pending = true). Jamais les stickers masqués.
-- Renvoie au plus 5 000 marqueurs, les plus forts en points d'abord ; « truncated »
-- indique qu'il y en avait davantage dans la zone.

create function public.spots_in_bbox(
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
  v_rare_base constant int := 60;
  v_me uuid := auth.uid();
  v_filters jsonb := coalesce(filters, '{}'::jsonb);
  v_years int[];
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
    -- Stickers publiés : index partiel spots_public_geom_published_idx.
    select s.id, s.public_location, s.year, s.points_total, s.country_iso2,
           s.is_first_in_country, s.is_exceptional, false as pending, s.author_id
    from boxes b
    join public.spots s
      on (s.public_location::extensions.geometry) operator(extensions.&&) b.env
    where s.status = 'published'
    union all
    -- Ses propres stickers en attente (auteur connecté seulement).
    select s.id, s.public_location, s.year, s.points_total, s.country_iso2,
           s.is_first_in_country, s.is_exceptional, true as pending, s.author_id
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
    left join public.countries co on co.iso2 = c.country_iso2
    left join public.scoring_rules r on r.key = 'tier_' || co.tier::text
    where (v_years is null or cardinality(v_years) = 0 or c.year = any (v_years))
      and (v_author is null or c.author_id = v_author)
      and (not v_mine or c.author_id = v_me)
      and (
        not v_rare
        or c.is_first_in_country
        or c.is_exceptional
        or coalesce(r.value, 0) >= v_rare_base
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

comment on function public.spots_in_bbox(double precision, double precision, double precision, double precision, jsonb) is
  'Marqueurs de la carte dans une zone (GeoJSON : id, color, points, gold, pending), position publique uniquement.';

revoke execute on function public.spots_in_bbox(double precision, double precision, double precision, double precision, jsonb)
  from public, anon, authenticated;
grant execute on function public.spots_in_bbox(double precision, double precision, double precision, double precision, jsonb)
  to anon, authenticated, service_role;

-- Rareté des pays ----------------------------------------------------------------------
-- Coloration des pays au dézoom : niveau, points de base actuels et nombre de stickers
-- publiés. Vue définie par son propriétaire (security_invoker = false) : elle ne compte
-- que les stickers publiés et n'expose aucune autre colonne de spots.

create view public.country_rarity
with (security_invoker = false)
as
  select
    c.iso2,
    c.tier,
    coalesce(
      r.value,
      case c.tier
        when 'courant' then 10
        when 'lointain' then 25
        when 'rare' then 60
        else 150
      end
    )::int as base_points,
    coalesce(sc.spot_count, 0)::int as spot_count
  from public.countries c
  left join public.scoring_rules r on r.key = 'tier_' || c.tier::text
  left join (
    select country_iso2, count(*) as spot_count
    from public.spots
    where status = 'published'
    group by country_iso2
  ) sc on sc.country_iso2 = c.iso2;

comment on view public.country_rarity is
  'Pays : niveau, points de base et nombre de stickers publiés (coloration de la carte au dézoom).';

revoke all on public.country_rarity from public, anon, authenticated;
grant select on public.country_rarity to anon, authenticated, service_role;

-- Recherche ------------------------------------------------------------------------------
-- Lieux (nom ou ville), pays (nom français ou code ISO) et pseudos, cinq de chaque au plus.
-- kind = 'spot' | 'country' | 'user' ; id = uuid du sticker, code ISO2 ou uuid du profil.
-- lng/lat : position publique du sticker, point intérieur du pays, ou dernier sticker publié
-- de la personne ; bbox = [ouest, sud, est, nord] du pays ou des stickers de la personne.

create function public.search_spots(q text)
returns table (
  kind text,
  id text,
  label text,
  detail text,
  lng double precision,
  lat double precision,
  bbox double precision[],
  color text,
  points int,
  spot_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(q, ''));
  v_norm text;
  v_pattern text;
  v_prefix text;
begin
  if char_length(v_query) < 2 or char_length(v_query) > 80 then
    return;
  end if;

  v_norm := public.search_normalize(v_query);
  -- Les jokers saisis par l'utilisateur sont pris au pied de la lettre.
  v_norm := replace(replace(replace(v_norm, '\', '\\'), '%', '\%'), '_', '\_');
  v_pattern := '%' || v_norm || '%';
  v_prefix := v_norm || '%';

  return query
  select 'spot'::text, s.id::text, s.name,
         concat_ws(', ', s.city, co.name_fr),
         extensions.st_x(s.public_location::extensions.geometry),
         extensions.st_y(s.public_location::extensions.geometry),
         null::double precision[],
         coalesce(se.color_hex, '#9A9A94'),
         s.points_total,
         null::int
  from public.spots s
  left join public.countries co on co.iso2 = s.country_iso2
  left join public.seasons se on se.year = s.year
  where s.status = 'published'
    and (public.search_normalize(s.name) like v_pattern
         or public.search_normalize(s.city) like v_pattern)
  order by (public.search_normalize(s.name) like v_prefix) desc, s.points_total desc, s.name
  limit 5;

  return query
  select 'country'::text, c.iso2::text, c.name_fr,
         null::text,
         extensions.st_x(extensions.st_pointonsurface(c.geom::extensions.geometry)),
         extensions.st_y(extensions.st_pointonsurface(c.geom::extensions.geometry)),
         array[
           extensions.st_xmin(extensions.box3d(c.geom::extensions.geometry)),
           extensions.st_ymin(extensions.box3d(c.geom::extensions.geometry)),
           extensions.st_xmax(extensions.box3d(c.geom::extensions.geometry)),
           extensions.st_ymax(extensions.box3d(c.geom::extensions.geometry))
         ],
         null::text,
         null::int,
         (select count(*)::int from public.spots s
          where s.country_iso2 = c.iso2 and s.status = 'published')
  from public.countries c
  where public.search_normalize(c.name_fr) like v_pattern
     or lower(c.iso2) = lower(v_query)
  order by (public.search_normalize(c.name_fr) like v_prefix) desc, c.name_fr
  limit 5;

  return query
  select 'user'::text, p.id::text, p.username,
         null::text,
         last_spot.lng,
         last_spot.lat,
         extent.bbox,
         null::text,
         null::int,
         coalesce(extent.spot_count, 0)
  from public.profiles p
  left join lateral (
    select
      count(*)::int as spot_count,
      case when count(*) > 0 then array[
        extensions.st_xmin(extensions.st_extent(s.public_location::extensions.geometry)::extensions.box3d),
        extensions.st_ymin(extensions.st_extent(s.public_location::extensions.geometry)::extensions.box3d),
        extensions.st_xmax(extensions.st_extent(s.public_location::extensions.geometry)::extensions.box3d),
        extensions.st_ymax(extensions.st_extent(s.public_location::extensions.geometry)::extensions.box3d)
      ] end as bbox
    from public.spots s
    where s.author_id = p.id and s.status = 'published'
  ) extent on true
  left join lateral (
    select extensions.st_x(s.public_location::extensions.geometry) as lng,
           extensions.st_y(s.public_location::extensions.geometry) as lat
    from public.spots s
    where s.author_id = p.id and s.status = 'published'
    order by s.created_at desc
    limit 1
  ) last_spot on true
  where lower(p.username) like v_pattern
  order by (lower(p.username) like v_prefix) desc, extent.spot_count desc nulls last, p.username
  limit 5;
end;
$$;

comment on function public.search_spots(text) is
  'Recherche de la carte : lieux, pays et pseudos (insensible à la casse et aux accents).';

revoke execute on function public.search_spots(text) from public, anon, authenticated;
grant execute on function public.search_spots(text) to anon, authenticated, service_role;

-- Version du schéma ------------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261128000000_carte'::text $$;
