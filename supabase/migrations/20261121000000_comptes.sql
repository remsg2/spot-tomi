-- Étape 3 · Comptes et profils (spécifications, sections 2.1, 7.1 à 7.3).
--
-- Principe : on part de zéro droit, puis on accorde explicitement ce qui est
-- permis. Attention : Supabase accorde par défaut l'exécution des nouvelles
-- fonctions à anon et authenticated ; il faut donc les retirer nommément. Le comportement est ainsi identique en local et sur les projets
-- hébergés (où l'accès automatique aux nouvelles tables est désactivé).

-- Rôles ----------------------------------------------------------------------

create type public.user_role as enum ('user', 'moderator', 'admin');

-- Profils --------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  -- Chemin dans le bucket avatars, toujours dans le dossier de l'utilisateur.
  avatar_path text check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  role public.user_role not null default 'user',
  suspended_at timestamptz,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil public de chaque compte. Lecture publique via la vue public_profiles uniquement.';

-- Unicité sans tenir compte de la casse : « Remi » et « remi » sont le même pseudo.
create unique index profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant all on public.profiles to service_role;
grant select on public.profiles to authenticated;
-- Colonnes modifiables par l'utilisateur : jamais role ni suspended_at.
grant insert (id, username, avatar_path, theme) on public.profiles to authenticated;
grant update (username, avatar_path, theme) on public.profiles to authenticated;

-- Fonctions de rôle, utilisées par les politiques (spécifications, 7.3).
-- security definer : elles lisent profiles sans repasser par sa RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and suspended_at is null
  )
$$;

create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin') and suspended_at is null
  )
$$;

revoke execute on function public.is_admin(), public.is_moderator() from public;
grant execute on function public.is_admin(), public.is_moderator() to anon, authenticated, service_role;

create policy "profiles : lecture de son profil (modérateurs : tous)"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_moderator()));

create policy "profiles : création de son propre profil"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles : modification de son propre profil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Vue publique : seulement ce que tout le monde peut voir, pour tous les comptes.
create view public.public_profiles
with (security_invoker = false)
as
  select id, username, avatar_path, created_at
  from public.profiles;

comment on view public.public_profiles is
  'Profils publics : pseudo, avatar, date d''inscription. Ni rôle, ni domicile.';

revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated, service_role;

-- Disponibilité d'un pseudo, pour le formulaire de première connexion.
create function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,20}$'
    and not exists (
      select 1 from public.profiles
      where lower(username) = lower(candidate) and id is distinct from auth.uid()
    )
$$;

revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated, service_role;

-- Domicile (privé) -------------------------------------------------------------
-- Sert au bonus de distance et au floutage des stickers proches (étapes 4 et 5).
-- Arrondi à ~1 km à l'enregistrement, jamais renvoyé à un autre utilisateur.

create table private.user_homes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  home extensions.geography(Point, 4326) not null,
  updated_at timestamptz not null default now()
);

alter table private.user_homes enable row level security;
revoke all on private.user_homes from public, anon, authenticated;
grant all on private.user_homes to service_role;

-- Arrondi à 0,01° : environ 1,1 km en latitude, 1,1 km ou moins en longitude.
create function public.set_my_home(lat double precision, lng double precision)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'Position invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = me) then
    raise exception 'Profil manquant' using errcode = '23503';
  end if;

  insert into private.user_homes (user_id, home, updated_at)
  values (
    me,
    extensions.st_setsrid(
      extensions.st_makepoint(round(lng::numeric, 2)::float8, round(lat::numeric, 2)::float8),
      4326
    )::extensions.geography,
    now()
  )
  on conflict (user_id) do update set home = excluded.home, updated_at = now();
end;
$$;

-- Seul le propriétaire peut relire son domicile (déjà arrondi).
create function public.get_my_home()
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select extensions.st_y(home::extensions.geometry), extensions.st_x(home::extensions.geometry)
  from private.user_homes
  where user_id = auth.uid()
$$;

create function public.clear_my_home()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from private.user_homes where user_id = auth.uid()
$$;

revoke execute on function
  public.set_my_home(double precision, double precision),
  public.get_my_home(),
  public.clear_my_home()
from public, anon;
grant execute on function
  public.set_my_home(double precision, double precision),
  public.get_my_home(),
  public.clear_my_home()
to authenticated, service_role;

-- Avatars (Storage) ------------------------------------------------------------
-- Bucket public en lecture ; chacun n'écrit que dans son dossier {auth.uid()}.
-- Le schéma storage n'existe pas sur une base Postgres seule (tests locaux) :
-- dans ce cas, cette partie est sautée.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schéma storage absent : bucket avatars non créé.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;

  execute $policy$
    create policy "avatars : lecture de son dossier"
      on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $policy$;
  execute $policy$
    create policy "avatars : ajout dans son dossier"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $policy$;
  execute $policy$
    create policy "avatars : remplacement dans son dossier"
      on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $policy$;
  execute $policy$
    create policy "avatars : suppression dans son dossier"
      on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $policy$;
end;
$$;

-- Version du schéma ------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261121000000_comptes'::text $$;
