-- Étape 7 · Classement, profil et album (spécifications 2.5, 2.6 et 6.2 ;
-- docs/contrats.md §6).
--
-- Seuls les stickers « published » comptent : ni « pending_review », ni « hidden ».
-- Rien n'est lisible par défaut : on retire les droits accordés d'office par
-- Supabase, puis on accorde nommément ce qui est voulu.

-- Classement -------------------------------------------------------------------
-- Une ligne par utilisateur et par période : 'all' (depuis toujours) et chaque
-- année où il a au moins un sticker publié. Les rangs suivent la règle sportive
-- des ex aequo (1, 1, 3) : deux valeurs égales ont le même rang, le suivant saute.
-- Rafraîchie par refresh_leaderboard(), appelée après chaque publication et
-- chaque action de modération (étapes 5 et 8).

create materialized view public.leaderboard as
with published as (
  select s.author_id, s.year, s.points_total, s.country_iso2
  from public.spots s
  where s.status = 'published'
),
per_period as (
  select author_id, 'all'::text as period, points_total, country_iso2 from published
  union all
  select author_id, year::text, points_total, country_iso2 from published
),
totals as (
  select
    author_id as user_id,
    period,
    sum(points_total)::int as points,
    count(distinct country_iso2)::int as countries,
    count(*)::int as stickers
  from per_period
  group by author_id, period
)
select
  t.user_id,
  p.username,
  p.avatar_path,
  t.period,
  t.points,
  t.countries,
  t.stickers,
  rank() over (partition by t.period order by t.points desc)::int as rank_points,
  rank() over (partition by t.period order by t.countries desc)::int as rank_countries,
  rank() over (partition by t.period order by t.stickers desc)::int as rank_stickers
from totals t
join public.profiles p on p.id = t.user_id;

comment on materialized view public.leaderboard is
  'Classement par période (''all'' ou l''année) : points, pays et stickers publiés, avec rangs ex aequo.';

-- Index unique : indispensable à « refresh materialized view concurrently ».
create unique index leaderboard_period_user_key on public.leaderboard (period, user_id);
create index leaderboard_period_rank_points_idx on public.leaderboard (period, rank_points);
create index leaderboard_period_rank_countries_idx on public.leaderboard (period, rank_countries);
create index leaderboard_period_rank_stickers_idx on public.leaderboard (period, rank_stickers);

-- Pas de RLS sur une vue matérialisée : lecture directe réservée à service_role,
-- le public passe par get_leaderboard().
revoke all on public.leaderboard from public, anon, authenticated;
grant select on public.leaderboard to service_role;

-- Rafraîchissement sans bloquer les lectures. service_role uniquement : l'Edge
-- Function de publication et les fonctions admin (security definer) l'appellent.
create function public.refresh_leaderboard()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.leaderboard;
end;
$$;

revoke execute on function public.refresh_leaderboard() from public, anon, authenticated;
grant execute on function public.refresh_leaderboard() to service_role;

-- Lecture du classement pour tous.
--   p_period    : 'all' ou une année ('2026') ;
--   p_criterion : 'points' (défaut), 'countries' ou 'stickers' ;
--   p_limit     : nombre de premières lignes (1 à 200, 50 par défaut) ;
--   p_user      : ajoute la ligne de cet utilisateur s'il est hors du haut du classement.
-- Ordre : rang du critère, puis pseudo (sans casse) pour départager l'affichage.
-- Pseudo et avatar sont relus dans profiles : un changement de pseudo se voit
-- tout de suite, et un compte supprimé disparaît avant le prochain rafraîchissement.
create function public.get_leaderboard(
  p_period text default 'all',
  p_criterion text default 'points',
  p_limit int default 50,
  p_user uuid default null
)
returns table (
  user_id uuid,
  username text,
  avatar_path text,
  period text,
  points int,
  countries int,
  stickers int,
  rank_points int,
  rank_countries int,
  rank_stickers int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if p_period is null or (p_period <> 'all' and p_period !~ '^[0-9]{4}$') then
    raise exception 'Période de classement inconnue : %', coalesce(p_period, 'null')
      using errcode = '22023';
  end if;
  if p_criterion is null or p_criterion not in ('points', 'countries', 'stickers') then
    raise exception 'Critère de classement inconnu : %', coalesce(p_criterion, 'null')
      using errcode = '22023';
  end if;

  return query
  with ordered as (
    select
      l.user_id as o_user_id,
      pr.username as o_username,
      pr.avatar_path as o_avatar_path,
      l.period as o_period,
      l.points as o_points,
      l.countries as o_countries,
      l.stickers as o_stickers,
      l.rank_points as o_rank_points,
      l.rank_countries as o_rank_countries,
      l.rank_stickers as o_rank_stickers,
      row_number() over (
        order by
          case p_criterion
            when 'points' then l.rank_points
            when 'countries' then l.rank_countries
            else l.rank_stickers
          end,
          lower(pr.username),
          l.user_id
      ) as o_position
    from public.leaderboard l
    join public.profiles pr on pr.id = l.user_id
    where l.period = p_period
  )
  select
    o.o_user_id, o.o_username, o.o_avatar_path, o.o_period, o.o_points, o.o_countries,
    o.o_stickers, o.o_rank_points, o.o_rank_countries, o.o_rank_stickers
  from ordered o
  where o.o_position <= v_limit or o.o_user_id = p_user
  order by o.o_position;
end;
$$;

-- Nombre de participants d'une période (« 8 participants »).
create function public.leaderboard_size(p_period text default 'all')
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.leaderboard l
  join public.profiles pr on pr.id = l.user_id
  where l.period = p_period
$$;

revoke execute on function
  public.get_leaderboard(text, text, int, uuid),
  public.leaderboard_size(text)
from public, anon, authenticated;
grant execute on function
  public.get_leaderboard(text, text, int, uuid),
  public.leaderboard_size(text)
to anon, authenticated, service_role;

-- Profil -------------------------------------------------------------------------
-- Statistiques publiques d'un utilisateur, depuis toujours : score, rang aux
-- points, stickers et pays (tirés du classement, donc cohérents avec lui), et
-- nombre de « premiers du pays » publiés. Aucune ligne si le profil n'existe pas ;
-- rang null tant qu'il n'a aucun sticker publié.
create function public.profile_stats(p_user uuid)
returns table (
  user_id uuid,
  points int,
  rank int,
  stickers int,
  countries int,
  firsts int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    coalesce(l.points, 0),
    l.rank_points,
    coalesce(l.stickers, 0),
    coalesce(l.countries, 0),
    (
      select count(*)::int
      from public.spots s
      where s.author_id = pr.id and s.status = 'published' and s.is_first_in_country
    )
  from public.profiles pr
  left join public.leaderboard l on l.user_id = pr.id and l.period = 'all'
  where pr.id = p_user
$$;

-- Album : une ligne par pays conquis (au moins un sticker publié), puis des pays
-- à conquérir.
--   Pays conquis : couleur de l'année du premier sticker publié de l'utilisateur
--   dans ce pays (le plus ancien par date de prise de vue), points cumulés,
--   anneau doré s'il y a été le premier du pays. Ordre chronologique.
--   Pays à conquérir : jusqu'à 3 par niveau de rareté, avec les points de base du
--   niveau (scoring_rules.tier_*), numérotés par suggestion_rank : d'abord les pays
--   où personne n'a encore collé de sticker (bonus « premier du pays » à prendre),
--   puis un ordre pseudo-aléatoire propre à chaque utilisateur et stable.
--   L'application en affiche quelques-uns (un par niveau au moins).
create function public.album(p_user uuid)
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
    coalesce((select r.value from public.scoring_rules r where r.key = 'tier_' || k.tier::text), 0)::int,
    0, false,
    k.suggestion_rank
  from candidates k
  where k.suggestion_rank <= 3
  -- Conquis d'abord (par année puis niveau), puis les suggestions rang par rang.
  order by 5 desc, 6, 11, 4, 3
$$;

-- Stickers d'un utilisateur, du plus récent au plus ancien (date de prise de vue).
-- Pour les autres : publiés seulement. Pour soi : aussi ceux en attente et masqués,
-- avec leur statut. Jamais la position exacte.
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
  taken_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.name, s.city, s.country_iso2::text, c.name_fr, s.year, public.year_color(s.year),
    s.status, s.points_total, s.is_first_in_country, s.is_exceptional, s.taken_at
  from public.spots s
  left join public.countries c on c.iso2 = s.country_iso2
  where s.author_id = p_user
    and (s.status = 'published' or (p_user = (select auth.uid())))
  order by s.taken_at desc, s.created_at desc, s.id
$$;

revoke execute on function
  public.profile_stats(uuid),
  public.album(uuid),
  public.profile_spots(uuid)
from public, anon, authenticated;
grant execute on function
  public.profile_stats(uuid),
  public.album(uuid),
  public.profile_spots(uuid)
to anon, authenticated, service_role;

-- Version du schéma ------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261125000000_classement'::text $$;
