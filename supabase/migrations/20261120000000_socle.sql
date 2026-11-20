-- Étape 1 · Socle
-- Migration de départ, appliquée à l'identique sur spot-tomi-dev et spot-tomi-prod.
-- Elle prépare seulement les extensions et le schéma privé : les tables arrivent à l'étape 4.

create extension if not exists postgis with schema extensions;

-- Schéma des données jamais exposées par l'API (ex. domiciles des utilisateurs).
-- Il n'est pas listé dans les schémas exposés par PostgREST (voir supabase/config.toml).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Version du schéma, lisible par tous : sert au contrôle de santé après chaque migration.
create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261120000000_socle'::text $$;

grant execute on function public.schema_version() to anon, authenticated;
