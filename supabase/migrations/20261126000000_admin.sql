-- Étape 8 · Mode admin (spécifications, section 4 ; docs/contrats.md §7).
--
-- Toutes les actions passent par des fonctions security definer qui :
--   1. vérifient le rôle (is_admin() ou is_moderator(), étape 3) avant toute lecture ;
--   2. verrouillent la ligne visée, appliquent le changement ;
--   3. écrivent une ligne dans admin_audit_log (actor_id = auth.uid(), action,
--      target, before, after) ;
--   4. rafraîchissent le classement (étape 7) si la fonction existe.
--
-- Rôles (spécifications, 4) :
--   modérateur (moderator ou admin) : file de modération, valider, masquer,
--     démasquer, supprimer, « lieu exceptionnel » ;
--   admin : couleur de l'année, barème, niveaux des pays, recalcul, rôles,
--     suspension, journal, années sans couleur.
--
-- Codes d'erreur (lus par l'interface, src/lib/admin/errors.ts) :
--   42501 action non autorisée · P0002 introuvable · 22023 valeur invalide
--   ST801 contraste insuffisant · ST802 dernier admin · ST803 suspension de soi-même
--   ST804 changement de statut impossible
--
-- Photo d'un sticker supprimé : Supabase interdit de supprimer un fichier en SQL
-- (seule l'API Storage le peut). admin_delete_spot renvoie donc photo_path et la
-- Server Action de Next (src/app/admin/actions.ts) supprime le fichier avec la
-- session du modérateur, autorisée par les politiques Storage en fin de fichier.
-- Pas de clé service_role côté Next.

-- Contrôle d'accès ----------------------------------------------------------------

create function private.admin_require(p_role text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_role = 'admin' then
    if not public.is_admin() then
      raise exception 'Action réservée aux admins' using errcode = '42501';
    end if;
  elsif p_role = 'moderator' then
    if not public.is_moderator() then
      raise exception 'Action réservée aux modérateurs' using errcode = '42501';
    end if;
  else
    raise exception 'Rôle inconnu : %', p_role using errcode = '22023';
  end if;
end;
$$;

-- Journal ---------------------------------------------------------------------------

create function private.audit(p_action text, p_target text, p_before jsonb, p_after jsonb)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, target, before, after)
  values (auth.uid(), p_action, p_target, p_before, p_after)
$$;

-- Classement (étape 7) : rafraîchi s'il existe. Une erreur de rafraîchissement ne
-- bloque pas la modération (le classement sera rafraîchi à la prochaine publication).
create function private.refresh_leaderboard_if_present()
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
begin
  if to_regprocedure('public.refresh_leaderboard()') is null then
    return false;
  end if;
  begin
    execute 'select public.refresh_leaderboard()';
  exception when others then
    raise warning 'refresh_leaderboard a échoué : %', sqlerrm;
    return false;
  end;
  return true;
end;
$$;

-- Contraste WCAG 2 (même calcul que src/lib/design/color.ts) -------------------------

create function private.srgb_channel(p_value int)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case
    when p_value::float8 / 255 <= 0.03928 then (p_value::float8 / 255) / 12.92
    else power(((p_value::float8 / 255) + 0.055) / 1.055, 2.4)
  end
$$;

create function private.relative_luminance(p_hex text)
returns double precision
language plpgsql
immutable
strict
parallel safe
set search_path = ''
as $$
declare
  rgb bytea;
begin
  if p_hex !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Couleur invalide : % (format #RRGGBB attendu)', p_hex using errcode = '22023';
  end if;
  rgb := decode(substr(p_hex, 2), 'hex');
  return 0.2126 * private.srgb_channel(get_byte(rgb, 0))
       + 0.7152 * private.srgb_channel(get_byte(rgb, 1))
       + 0.0722 * private.srgb_channel(get_byte(rgb, 2));
end;
$$;

create function private.contrast_ratio(p_a text, p_b text)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select (greatest(l.a, l.b) + 0.05) / (least(l.a, l.b) + 0.05)
  from (select private.relative_luminance(p_a) as a, private.relative_luminance(p_b) as b) as l
$$;

-- Instantané d'un sticker pour le journal (sans la position exacte).
create function private.spot_snapshot(s public.spots)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'author_id', s.author_id,
    'status', s.status,
    'year', s.year,
    'country_iso2', s.country_iso2,
    'city', s.city,
    'points_total', s.points_total,
    'is_exceptional', s.is_exceptional,
    'is_first_in_country', s.is_first_in_country,
    'report_count', s.report_count,
    'photo_path', s.photo_path
  )
$$;

revoke execute on function
  private.admin_require(text),
  private.audit(text, text, jsonb, jsonb),
  private.refresh_leaderboard_if_present(),
  private.srgb_channel(int),
  private.relative_luminance(text),
  private.contrast_ratio(text, text),
  private.spot_snapshot(public.spots)
from public, anon, authenticated;

-- Lignes de la modération : position exacte, signalements et raisons.
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
    coalesce(r.reports, '[]'::jsonb) as reports
  from public.spots s
  join public.profiles p on p.id = s.author_id
  left join public.countries c on c.iso2 = s.country_iso2
  left join lateral (
    select
      count(*)::int as report_count,
      jsonb_agg(
        jsonb_build_object('reason', sr.reason, 'created_at', sr.created_at, 'reporter_username', rp.username)
        order by sr.created_at desc
      ) as reports
    from public.spot_reports sr
    left join public.profiles rp on rp.id = sr.reporter_id
    where sr.spot_id = s.id
  ) r on true;

revoke all on private.admin_spot_rows from public, anon, authenticated;

-- Couleur de l'année --------------------------------------------------------------------

create function public.admin_set_season(p_year int, p_color_hex text, p_make_current boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_color text := upper(trim(p_color_hex));
  v_ratio double precision;
  v_before public.seasons;
  v_previous_current int;
  v_after public.seasons;
begin
  perform private.admin_require('admin');

  if p_year is null or p_year not between 2000 and 2100 then
    raise exception 'Année invalide : elle doit être comprise entre 2000 et 2100' using errcode = '22023';
  end if;
  if v_color is null or v_color !~ '^#[0-9A-F]{6}$' then
    raise exception 'Couleur invalide : format #RRGGBB attendu' using errcode = '22023';
  end if;
  v_ratio := private.contrast_ratio(v_color, '#111111');
  if v_ratio < 4.5 then
    raise exception 'Contraste insuffisant avec le texte noir : % pour 1 (minimum 4,5 pour 1)',
      to_char(v_ratio, 'FM90.00') using errcode = 'ST801';
  end if;

  -- Une seule saison courante : les changements de saison sont sérialisés.
  lock table public.seasons in share row exclusive mode;

  select * into v_before from public.seasons where year = p_year;
  select s.year into v_previous_current from public.seasons s where s.is_current;

  if coalesce(p_make_current, false) then
    update public.seasons set is_current = false where is_current and year <> p_year;
  end if;

  insert into public.seasons as s (year, color_hex, is_current)
  values (p_year, v_color, coalesce(p_make_current, false))
  on conflict (year) do update
    set color_hex = excluded.color_hex,
        is_current = s.is_current or excluded.is_current
  returning * into v_after;

  perform private.audit(
    'season.set',
    'season:' || p_year,
    case when v_before.year is null then '{}'::jsonb else to_jsonb(v_before) end
      || jsonb_build_object('current_year', v_previous_current),
    to_jsonb(v_after) || jsonb_build_object('contrast', round(v_ratio::numeric, 2))
  );

  return to_jsonb(v_after) || jsonb_build_object('contrast', round(v_ratio::numeric, 2));
end;
$$;

comment on function public.admin_set_season(int, text, boolean) is
  'Admin : couleur d''une année (contraste ≥ 4,5:1 avec #111111), éventuellement année courante.';

-- Années de stickers sans couleur (alerte de l'onglet Couleur).
create function public.admin_missing_season_years()
returns table (year int, spot_count int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.admin_require('admin');
  return query
    select s.year, count(*)::int
    from public.spots s
    where not exists (select 1 from public.seasons se where se.year = s.year)
    group by s.year
    order by s.year;
end;
$$;

-- Modération -----------------------------------------------------------------------------

create function public.admin_moderation_queue()
returns table (
  id uuid, name text, status public.spot_status, author_id uuid, author_username text,
  city text, country_iso2 text, country_name_fr text, year int, color_hex text,
  taken_at timestamptz, created_at timestamptz, gps_source text, date_source text,
  lat double precision, lng double precision, public_lat double precision, public_lng double precision,
  altitude_m numeric, photo_path text, points_total int, is_exceptional boolean,
  is_first_in_country boolean, report_count int, reports jsonb
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
    where r.status in ('pending_review', 'hidden') or r.report_count > 0
    order by (r.status = 'pending_review') desc, (r.status = 'hidden'), r.report_count desc, r.created_at
    limit 200;
end;
$$;

-- Recherche d'un sticker (tous statuts) : nom, ville, pseudo ou identifiant (ou lien).
create function public.admin_search_spots(p_query text, p_limit int default 20)
returns table (
  id uuid, name text, status public.spot_status, author_id uuid, author_username text,
  city text, country_iso2 text, country_name_fr text, year int, color_hex text,
  taken_at timestamptz, created_at timestamptz, gps_source text, date_source text,
  lat double precision, lng double precision, public_lat double precision, public_lng double precision,
  altitude_m numeric, photo_path text, points_total int, is_exceptional boolean,
  is_first_in_country boolean, report_count int, reports jsonb
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

-- Nombre de stickers à traiter (badge de l'onglet) : en attente, ou signalés et visibles.
create function public.admin_moderation_count()
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
       or (s.status = 'published' and exists (select 1 from public.spot_reports r where r.spot_id = s.id))
  );
end;
$$;

-- Valider : publié, signalements classés, points recalculés s'il n'était pas publié.
create function public.admin_validate_spot(p_spot_id uuid)
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
  v_before := private.spot_snapshot(v_spot);

  select coalesce(jsonb_agg(
           jsonb_build_object('reporter_id', r.reporter_id, 'reason', r.reason, 'created_at', r.created_at)
           order by r.created_at), '[]'::jsonb)
    into v_reports
    from public.spot_reports r
    where r.spot_id = p_spot_id;
  delete from public.spot_reports where spot_id = p_spot_id;

  update public.spots
    set status = 'published', report_count = 0, updated_at = now()
    where id = p_spot_id;
  if v_spot.status <> 'published' then
    perform public.compute_spot_points(p_spot_id);
  end if;

  select * into v_spot from public.spots where id = p_spot_id;
  v_after := private.spot_snapshot(v_spot);
  perform private.audit('spot.validate', 'spot:' || p_spot_id,
    v_before || jsonb_build_object('reports', v_reports), v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Masquer : invisible du public et exclu du classement, réversible.
create function public.admin_hide_spot(p_spot_id uuid)
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
  if v_spot.status = 'hidden' then
    raise exception 'Ce sticker est déjà masqué' using errcode = 'ST804';
  end if;
  v_before := private.spot_snapshot(v_spot);

  update public.spots set status = 'hidden', updated_at = now()
    where id = p_spot_id
    returning * into v_spot;

  v_after := private.spot_snapshot(v_spot);
  perform private.audit('spot.hide', 'spot:' || p_spot_id, v_before, v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Démasquer : retour au statut d'avant le masquage (lu dans le journal).
create function public.admin_unhide_spot(p_spot_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_before jsonb;
  v_previous text;
  v_status public.spot_status;
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

  select l.before ->> 'status' into v_previous
    from public.admin_audit_log l
    where l.action = 'spot.hide' and l.target = 'spot:' || p_spot_id
    order by l.id desc
    limit 1;
  v_status := case
    when v_previous in ('published', 'pending_review') then v_previous::public.spot_status
    when v_spot.gps_source = 'manual' or v_spot.date_source = 'upload' then 'pending_review'
    else 'published'
  end;

  update public.spots set status = v_status, updated_at = now()
    where id = p_spot_id
    returning * into v_spot;

  v_after := private.spot_snapshot(v_spot);
  perform private.audit('spot.unhide', 'spot:' || p_spot_id, v_before, v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Supprimer : définitif (lignes de points et signalements en cascade). Renvoie le
-- chemin de la photo, que la Server Action supprime ensuite de Storage.
create function public.admin_delete_spot(p_spot_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_before jsonb;
begin
  perform private.admin_require('moderator');

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  v_before := private.spot_snapshot(v_spot);

  delete from public.spots where id = p_spot_id;

  perform private.audit('spot.delete', 'spot:' || p_spot_id, v_before,
    jsonb_build_object('deleted', true));
  perform private.refresh_leaderboard_if_present();
  return jsonb_build_object('id', p_spot_id, 'name', v_spot.name, 'deleted', true, 'photo_path', v_spot.photo_path);
end;
$$;

-- Lieu exceptionnel : relance le calcul des points du sticker.
create function public.admin_set_exceptional(p_spot_id uuid, p_exceptional boolean)
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
  if p_exceptional is null then
    raise exception 'Valeur manquante' using errcode = '22023';
  end if;

  select * into v_spot from public.spots where id = p_spot_id for update;
  if not found then
    raise exception 'Sticker introuvable' using errcode = 'P0002';
  end if;
  v_before := private.spot_snapshot(v_spot);

  update public.spots set is_exceptional = p_exceptional, updated_at = now() where id = p_spot_id;
  perform public.compute_spot_points(p_spot_id);

  select * into v_spot from public.spots where id = p_spot_id;
  v_after := private.spot_snapshot(v_spot);
  perform private.audit('spot.exceptional', 'spot:' || p_spot_id, v_before, v_after);
  perform private.refresh_leaderboard_if_present();
  return v_after;
end;
$$;

-- Barème -----------------------------------------------------------------------------------
-- Points figés (spécifications, 3.4) : changer une règle ne touche pas aux stickers
-- existants ; l'admin lance un recalcul explicite s'il le souhaite.

create function public.admin_set_rule(p_key text, p_value numeric)
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
  -- NaN et l'infini numeric sont plus grands que tout nombre : refusés ici.
  if p_value is null or p_value < 0 or p_value > 1000000 then
    raise exception 'Valeur invalide : un nombre entre 0 et 1 000 000 est attendu' using errcode = '22023';
  end if;
  if p_key = 'neighbor_divisor' and p_value < 1 then
    raise exception 'Le diviseur du malus doit valoir au moins 1' using errcode = '22023';
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

create function public.admin_set_country_tier(p_iso2 text, p_tier public.country_tier)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_iso2 text := upper(trim(p_iso2));
  v_country record;
begin
  perform private.admin_require('admin');
  if p_tier is null then
    raise exception 'Niveau manquant' using errcode = '22023';
  end if;

  select c.iso2, c.name_fr, c.tier into v_country
    from public.countries c
    where c.iso2 = v_iso2
    for update;
  if not found then
    raise exception 'Pays inconnu : %', v_iso2 using errcode = 'P0002';
  end if;

  update public.countries set tier = p_tier where iso2 = v_iso2;

  perform private.audit('country.tier', 'country:' || v_iso2,
    jsonb_build_object('iso2', v_iso2, 'name_fr', v_country.name_fr, 'tier', v_country.tier),
    jsonb_build_object('iso2', v_iso2, 'name_fr', v_country.name_fr, 'tier', p_tier));
  return jsonb_build_object('iso2', v_iso2, 'name_fr', v_country.name_fr, 'tier', p_tier);
end;
$$;

-- Recalcul explicite : un sticker (p_spot_id) ou tous (null).
create function public.admin_recompute(p_spot_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_spot public.spots;
  v_count int;
  v_sum_before bigint;
  v_sum_after bigint;
  v_result jsonb;
begin
  perform private.admin_require('admin');

  if p_spot_id is null then
    select coalesce(sum(points_total), 0) into v_sum_before from public.spots;
    v_count := public.recompute_all_points();
    select coalesce(sum(points_total), 0) into v_sum_after from public.spots;
    v_result := jsonb_build_object('count', v_count, 'points_before', v_sum_before, 'points_after', v_sum_after);
    perform private.audit('points.recompute', 'spots:all',
      jsonb_build_object('points_total', v_sum_before),
      jsonb_build_object('count', v_count, 'points_total', v_sum_after));
  else
    select * into v_spot from public.spots where id = p_spot_id for update;
    if not found then
      raise exception 'Sticker introuvable' using errcode = 'P0002';
    end if;
    v_sum_before := v_spot.points_total;
    perform public.compute_spot_points(p_spot_id);
    select points_total into v_sum_after from public.spots where id = p_spot_id;
    v_result := jsonb_build_object('count', 1, 'spot_id', p_spot_id, 'name', v_spot.name,
      'points_before', v_sum_before, 'points_after', v_sum_after);
    perform private.audit('points.recompute', 'spot:' || p_spot_id,
      jsonb_build_object('points_total', v_sum_before),
      jsonb_build_object('points_total', v_sum_after));
  end if;

  perform private.refresh_leaderboard_if_present();
  return v_result;
end;
$$;

-- Utilisateurs et rôles ---------------------------------------------------------------------

-- Liste pour l'onglet Rôles : jamais d'email ni de domicile.
create function public.admin_list_users(p_query text default null, p_limit int default 200)
returns table (
  id uuid, username text, avatar_path text, role public.user_role, suspended_at timestamptz,
  created_at timestamptz, spot_count int, published_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_like text := '%' || replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform private.admin_require('admin');
  return query
    select p.id, p.username, p.avatar_path, p.role, p.suspended_at, p.created_at,
           coalesce(st.total, 0), coalesce(st.published, 0)
    from public.profiles p
    left join lateral (
      select count(*)::int as total, (count(*) filter (where s.status = 'published'))::int as published
      from public.spots s
      where s.author_id = p.id
    ) st on true
    where v_query = '' or p.username ilike v_like
    order by p.role desc, lower(p.username)
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

-- Ne jamais laisser l'app sans admin actif : un admin ne peut pas se retirer son rôle
-- (ni être suspendu) s'il est le dernier.
create function public.admin_set_role(p_user uuid, p_role public.user_role)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform private.admin_require('admin');
  if p_user is null or p_role is null then
    raise exception 'Utilisateur ou rôle manquant' using errcode = '22023';
  end if;

  -- Sérialise les changements touchant les admins (deux admins qui se retirent
  -- mutuellement leur rôle en même temps).
  perform 1 from public.profiles where role = 'admin' for update;
  select * into v_profile from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  if v_profile.role = 'admin' and p_role <> 'admin' and not exists (
    select 1 from public.profiles
    where role = 'admin' and suspended_at is null and id <> p_user
  ) then
    raise exception 'Il doit rester au moins un admin : nomme d''abord un autre admin' using errcode = 'ST802';
  end if;

  update public.profiles set role = p_role where id = p_user;

  perform private.audit('user.role', 'user:' || p_user,
    jsonb_build_object('username', v_profile.username, 'role', v_profile.role),
    jsonb_build_object('username', v_profile.username, 'role', p_role));
  return jsonb_build_object('id', p_user, 'username', v_profile.username, 'role', p_role);
end;
$$;

create function public.admin_suspend(p_user uuid, p_suspended boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_after public.profiles;
begin
  perform private.admin_require('admin');
  if p_user is null or p_suspended is null then
    raise exception 'Utilisateur ou valeur manquante' using errcode = '22023';
  end if;
  if p_suspended and p_user = auth.uid() then
    raise exception 'Tu ne peux pas suspendre ton propre compte' using errcode = 'ST803';
  end if;

  perform 1 from public.profiles where role = 'admin' for update;
  select * into v_profile from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  if p_suspended and v_profile.role = 'admin' and v_profile.suspended_at is null and not exists (
    select 1 from public.profiles
    where role = 'admin' and suspended_at is null and id <> p_user
  ) then
    raise exception 'Il doit rester au moins un admin actif' using errcode = 'ST802';
  end if;

  update public.profiles
    set suspended_at = case when p_suspended then coalesce(suspended_at, now()) else null end
    where id = p_user
    returning * into v_after;

  perform private.audit(
    case when p_suspended then 'user.suspend' else 'user.unsuspend' end,
    'user:' || p_user,
    jsonb_build_object('username', v_profile.username, 'suspended_at', v_profile.suspended_at),
    jsonb_build_object('username', v_after.username, 'suspended_at', v_after.suspended_at));
  return jsonb_build_object('id', p_user, 'username', v_after.username, 'suspended_at', v_after.suspended_at);
end;
$$;

-- Journal (lecture admin) ----------------------------------------------------------------

create function public.admin_audit_recent(p_limit int default 50, p_before_id bigint default null)
returns table (
  id bigint, created_at timestamptz, actor_id uuid, actor_username text,
  action text, target text, before jsonb, after jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.admin_require('admin');
  return query
    select l.id, l.created_at, l.actor_id, p.username, l.action, l.target, l.before, l.after
    from public.admin_audit_log l
    left join public.profiles p on p.id = l.actor_id
    where p_before_id is null or l.id < p_before_id
    order by l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Droits : rien pour les visiteurs ; les utilisateurs connectés peuvent appeler,
-- et chaque fonction refuse elle-même ceux qui n'ont pas le bon rôle.

revoke execute on function
  public.admin_set_season(int, text, boolean),
  public.admin_missing_season_years(),
  public.admin_moderation_queue(),
  public.admin_search_spots(text, int),
  public.admin_moderation_count(),
  public.admin_validate_spot(uuid),
  public.admin_hide_spot(uuid),
  public.admin_unhide_spot(uuid),
  public.admin_delete_spot(uuid),
  public.admin_set_exceptional(uuid, boolean),
  public.admin_set_rule(text, numeric),
  public.admin_set_country_tier(text, public.country_tier),
  public.admin_recompute(uuid),
  public.admin_list_users(text, int),
  public.admin_set_role(uuid, public.user_role),
  public.admin_suspend(uuid, boolean),
  public.admin_audit_recent(int, bigint)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_set_season(int, text, boolean),
  public.admin_missing_season_years(),
  public.admin_moderation_queue(),
  public.admin_search_spots(text, int),
  public.admin_moderation_count(),
  public.admin_validate_spot(uuid),
  public.admin_hide_spot(uuid),
  public.admin_unhide_spot(uuid),
  public.admin_delete_spot(uuid),
  public.admin_set_exceptional(uuid, boolean),
  public.admin_set_rule(text, numeric),
  public.admin_set_country_tier(text, public.country_tier),
  public.admin_recompute(uuid),
  public.admin_list_users(text, int),
  public.admin_set_role(uuid, public.user_role),
  public.admin_suspend(uuid, boolean),
  public.admin_audit_recent(int, bigint)
to authenticated;

-- Storage : photos des stickers supprimés par un modérateur ---------------------------------
-- L'API Storage exige les droits de lecture et de suppression sur storage.objects.
-- Le schéma storage n'existe pas sur une base Postgres seule (tests locaux).

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Schéma storage absent : politiques de modération de spot-photos non créées.';
    return;
  end if;

  execute $policy$
    create policy "spot-photos : lecture par les modérateurs"
      on storage.objects for select to authenticated
      using (bucket_id = 'spot-photos' and (select public.is_moderator()))
  $policy$;
  execute $policy$
    create policy "spot-photos : suppression par les modérateurs"
      on storage.objects for delete to authenticated
      using (bucket_id = 'spot-photos' and (select public.is_moderator()))
  $policy$;
end;
$$;

-- Version du schéma ----------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261126000000_admin'::text $$;
