-- Étape 5 : publication d'un sticker (create_spot, estimation, cache de
-- géocodage, bucket spot-photos), testée pour chaque rôle.
begin;
select plan(76);

-- Comptes de test -----------------------------------------------------------------
-- A : utilisateur avec domicile (Paris) ; B : autre utilisateur ; C : limite
-- quotidienne ; S : suspendu ; N : compte sans profil.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000050a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000050b', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000050c', 'c@example.test'),
  ('00000000-0000-0000-0000-000000000505', 's@example.test'),
  ('00000000-0000-0000-0000-00000000050e', 'n@example.test');
insert into public.profiles (id, username, suspended_at) values
  ('00000000-0000-0000-0000-00000000050a', 'alice_pub', null),
  ('00000000-0000-0000-0000-00000000050b', 'bruno_pub', null),
  ('00000000-0000-0000-0000-00000000050c', 'chloe_pub', null),
  ('00000000-0000-0000-0000-000000000505', 'suspendu_pub', now());
insert into private.user_homes (user_id, home) values (
  '00000000-0000-0000-0000-00000000050a',
  extensions.st_setsrid(extensions.st_makepoint(2.35, 48.85), 4326)::extensions.geography
);

-- Pays de test en plein Pacifique Sud (aucune terre à moins de 25 km).
insert into public.countries (iso2, iso3, name_fr, tier, geom) values (
  'XA', 'XAA', 'Pays de test', 'courant',
  extensions.st_multi(extensions.st_makeenvelope(-125, -48, -105, -38, 4326))::extensions.geography
);

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Publication par l'Edge Function (clé service) : un libellé par sticker.
create temp table t_spots (label text primary key, id uuid not null);
grant all on t_spots to public;

create function pg_temp.pub(
  p_label text,
  p_author uuid,
  p_lat float8,
  p_lng float8,
  p_gps text default 'exif',
  p_date text default 'exif',
  p_taken timestamptz default '2026-06-01 12:00:00+00',
  p_alt numeric default null,
  p_name text default null,
  p_path text default null
) returns uuid language plpgsql as $$
declare
  v uuid;
begin
  v := public.create_spot(
    p_author, coalesce(p_name, '  Lieu   ' || p_label || ' '), p_lat, p_lng, p_alt, p_taken, p_gps, p_date,
    coalesce(p_path, p_author::text || '/' || gen_random_uuid()::text || '.webp'), '  Ville test '
  );
  insert into t_spots values (p_label, v);
  return v;
end;
$$;

create function pg_temp.spot(p_label text) returns public.spots language sql as $$
  select s.* from public.spots s join t_spots t on t.id = s.id where t.label = p_label
$$;

-- Structure et droits --------------------------------------------------------------

select has_function(
  'public', 'create_spot',
  array['uuid', 'text', 'double precision', 'double precision', 'numeric', 'timestamp with time zone', 'text', 'text', 'text', 'text'],
  'create_spot existe avec la signature du contrat'
);
select has_function('public', 'estimate_spot_points', 'la fonction d''estimation existe');
select ok(
  not has_function_privilege('anon', 'public.create_spot(uuid, text, float8, float8, numeric, timestamptz, text, text, text, text)', 'execute'),
  'un visiteur ne peut pas exécuter create_spot'
);
select ok(
  not has_function_privilege('authenticated', 'public.create_spot(uuid, text, float8, float8, numeric, timestamptz, text, text, text, text)', 'execute'),
  'un utilisateur connecté ne peut pas exécuter create_spot'
);
select ok(
  has_function_privilege('service_role', 'public.create_spot(uuid, text, float8, float8, numeric, timestamptz, text, text, text, text)', 'execute'),
  'service_role peut exécuter create_spot'
);
select ok(
  not has_function_privilege('anon', 'public.estimate_spot_points(float8, float8, numeric, timestamptz, text, text, text)', 'execute'),
  'un visiteur ne peut pas estimer de points'
);
select ok(
  has_function_privilege('authenticated', 'public.estimate_spot_points(float8, float8, numeric, timestamptz, text, text, text)', 'execute'),
  'un utilisateur connecté peut estimer ses points'
);
select ok(
  not has_function_privilege('authenticated', 'public.geocode_cache_put(float8, float8, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.geocode_cache_get(float8, float8)', 'execute'),
  'le cache de géocodage est fermé aux utilisateurs'
);
select ok(
  has_function_privilege('service_role', 'public.geocode_cache_put(float8, float8, text, text)', 'execute'),
  'service_role écrit dans le cache de géocodage'
);
select ok(public.schema_version() >= '20261123000000_publication', 'schema_version inclut la migration publication');

-- Un utilisateur ne peut pas créer de sticker lui-même ------------------------------

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000050a');
select throws_ok(
  $$ select pg_temp.pub('triche', '00000000-0000-0000-0000-00000000050a', -44, -115) $$,
  '42501', null,
  'un utilisateur connecté ne peut pas appeler create_spot'
);
select throws_ok(
  $$ insert into public.spots (author_id, name, location, public_location, taken_at, year, gps_source, date_source, photo_path, status)
     values ('00000000-0000-0000-0000-00000000050a', 'x', 'POINT(0 0)', 'POINT(0 0)', now(), 2026, 'exif', 'exif', 'x', 'published') $$,
  '42501', null,
  'un utilisateur connecté ne peut pas insérer de sticker directement'
);
select pg_temp.logout();

-- Publication (service_role) --------------------------------------------------------

set local role service_role;

select lives_ok(
  $$ select pg_temp.pub('a1', '00000000-0000-0000-0000-00000000050a', -44, -115, p_alt => 3500.04) $$,
  'GPS et date dans la photo : le sticker est créé'
);
select lives_ok(
  $$ select pg_temp.pub('a2', '00000000-0000-0000-0000-00000000050a', -44.1, -115, p_gps => 'manual') $$,
  'position placée à la main : le sticker est créé'
);
select lives_ok(
  $$ select pg_temp.pub('a3', '00000000-0000-0000-0000-00000000050a', -44.2, -115, p_date => 'upload', p_taken => '2024-01-01 00:00:00+00') $$,
  'sans date dans la photo : le sticker est créé'
);

-- Un sticker par tranche de 200 m et par 24 heures, pour un même auteur.
select throws_ok(
  $$ select pg_temp.pub('a4', '00000000-0000-0000-0000-00000000050a', -44.00135, -115) $$,
  'ST004', 'Tu as déjà collé un sticker à moins de 200 m d''ici ces dernières 24 heures.',
  'même auteur à 150 m dans la journée : refusé (ST004)'
);
select throws_ok(
  $$ select pg_temp.pub('a4', '00000000-0000-0000-0000-00000000050a', -44.1009, -115, p_gps => 'manual') $$,
  'ST004', null,
  'la règle des 200 m compte aussi les stickers en attente'
);
select lives_ok(
  $$ select pg_temp.pub('a5', '00000000-0000-0000-0000-00000000050a', -43.9973, -115) $$,
  'même auteur à 300 m : accepté'
);
select lives_ok(
  $$ select pg_temp.pub('b1', '00000000-0000-0000-0000-00000000050b', -44.0004, -115) $$,
  'un autre auteur à 45 m : accepté'
);

-- Suspension, profil, données invalides.
select throws_ok(
  $$ select pg_temp.pub('s1', '00000000-0000-0000-0000-000000000505', -45, -115) $$,
  'ST002', 'Ton compte est suspendu : tu ne peux plus publier de sticker.',
  'compte suspendu : refusé (ST002)'
);
select throws_ok(
  $$ select pg_temp.pub('n1', '00000000-0000-0000-0000-00000000050e', -45, -115) $$,
  'ST001', null,
  'compte sans profil : refusé (ST001)'
);
select throws_ok(
  $$ select pg_temp.pub('x1', '00000000-0000-0000-0000-00000000050b', -46, -115, p_name => '   ') $$,
  'ST005', 'Le nom du lieu est obligatoire (80 caractères maximum).',
  'nom du lieu vide : refusé (ST005)'
);
select throws_ok(
  $$ select pg_temp.pub('x2', '00000000-0000-0000-0000-00000000050b', -46, -115, p_name => repeat('a', 81)) $$,
  'ST005', null,
  'nom du lieu de 81 caractères : refusé'
);
select lives_ok(
  $$ select pg_temp.pub('b80', '00000000-0000-0000-0000-00000000050b', -46, -115, p_name => repeat('é', 80)) $$,
  'nom du lieu de 80 caractères : accepté'
);
select throws_ok(
  $$ select pg_temp.pub('x3', '00000000-0000-0000-0000-00000000050b', 91, -115) $$,
  'ST005', 'Position invalide.',
  'latitude hors limites : refusée'
);
select throws_ok(
  $$ select pg_temp.pub('x4', '00000000-0000-0000-0000-00000000050b', -46.5, -115, p_gps => 'gps') $$,
  'ST005', 'Source de la position invalide.',
  'source de position inconnue : refusée'
);
select throws_ok(
  $$ select pg_temp.pub('x5', '00000000-0000-0000-0000-00000000050b', -46.5, -115, p_date => 'camera') $$,
  'ST005', 'Source de la date invalide.',
  'source de date inconnue : refusée'
);
select throws_ok(
  $$ select pg_temp.pub('x6', '00000000-0000-0000-0000-00000000050b', -46.5, -115, p_taken => now() + interval '3 days') $$,
  'ST005', 'Date de prise invalide.',
  'date de prise dans le futur : refusée'
);
select throws_ok(
  $$ select pg_temp.pub('x7', '00000000-0000-0000-0000-00000000050b', -46.5, -115, p_alt => 12000) $$,
  'ST005', 'Altitude invalide.',
  'altitude impossible : refusée'
);
select throws_ok(
  $$ select pg_temp.pub('x8', '00000000-0000-0000-0000-00000000050b', -46.5, -115,
       p_path => '00000000-0000-0000-0000-00000000050a/00000000-0000-4000-8000-000000000001.webp') $$,
  'ST005', 'Chemin de photo invalide.',
  'photo rangée dans le dossier d''un autre : refusée'
);
select throws_ok(
  $$ select pg_temp.pub('x9', '00000000-0000-0000-0000-00000000050b', -46.5, -115,
       p_path => '00000000-0000-0000-0000-00000000050b/photo.jpg') $$,
  'ST005', null,
  'photo qui n''est pas un WebP nommé par un UUID : refusée'
);
select lives_ok(
  $$ select pg_temp.pub('b2', '00000000-0000-0000-0000-00000000050b', -47, -115,
       p_path => '00000000-0000-0000-0000-00000000050b/00000000-0000-4000-8000-000000000002.webp') $$,
  'photo neuve : acceptée'
);
select throws_ok(
  $$ select pg_temp.pub('b3', '00000000-0000-0000-0000-00000000050b', -47.5, -115,
       p_path => '00000000-0000-0000-0000-00000000050b/00000000-0000-4000-8000-000000000002.webp') $$,
  'ST006', null,
  'la même photo ne sert pas deux fois (ST006)'
);

-- Limite de 20 publications sur 24 heures.
select lives_ok(
  $$ select pg_temp.pub('c' || i, '00000000-0000-0000-0000-00000000050c', -40 - i * 0.01, -110) from generate_series(1, 20) i $$,
  'C publie 20 stickers dans la journée'
);
select throws_ok(
  $$ select pg_temp.pub('c21', '00000000-0000-0000-0000-00000000050c', -40.5, -110) $$,
  'ST003', 'Tu as atteint la limite de publications des dernières 24 heures. Réessaie plus tard.',
  'le 21e sticker de la journée est refusé (ST003)'
);

-- Domicile : position publique décalée d'au moins 300 m à moins de 500 m.
select lives_ok(
  $$ select pg_temp.pub('home', '00000000-0000-0000-0000-00000000050a', 48.8518, 2.35) $$,
  'A publie à 200 m de son domicile'
);
select lives_ok(
  $$ select pg_temp.pub('away', '00000000-0000-0000-0000-00000000050a', 48.87, 2.35) $$,
  'A publie à 2 km de son domicile'
);

reset role;

-- Résultats ------------------------------------------------------------------------

select is((pg_temp.spot('a1')).status, 'published'::public.spot_status, 'GPS et date dans la photo : publié');
select is((pg_temp.spot('a2')).status, 'pending_review'::public.spot_status, 'position manuelle : en attente');
select is((pg_temp.spot('a3')).status, 'pending_review'::public.spot_status, 'date d''envoi : en attente');
select is((pg_temp.spot('a1')).year, 2026, 'l''année vient de la date de prise');
select is((pg_temp.spot('a3')).taken_at, now(), 'sans date dans la photo, la date d''envoi est retenue (jamais celle du client)');
select is((pg_temp.spot('a3')).year, extract(year from now() at time zone 'UTC')::int, 'sans date, l''année est celle de l''envoi');
select is((pg_temp.spot('a1')).country_iso2, 'XA'::char(2), 'le pays est déduit du point (country_at)');
select is((pg_temp.spot('a1')).city, 'Ville test', 'la ville est enregistrée sans espaces superflus');
select is((pg_temp.spot('a1')).name, 'Lieu a1', 'le nom est nettoyé (espaces)');
select is((pg_temp.spot('a1')).altitude_m, 3500.0, 'l''altitude est enregistrée (arrondie au décimètre)');
select is(
  ((pg_temp.spot('a1')).gps_source, (pg_temp.spot('a1')).date_source, (pg_temp.spot('a2')).gps_source, (pg_temp.spot('a3')).date_source),
  ('exif'::text, 'exif'::text, 'manual'::text, 'upload'::text),
  'les sources de la position et de la date sont enregistrées'
);
select ok(
  extensions.st_equals((pg_temp.spot('a1')).location::extensions.geometry,
    extensions.st_setsrid(extensions.st_makepoint(-115, -44), 4326)),
  'la position exacte est enregistrée'
);
select ok(
  exists (select 1 from public.spot_point_lines where spot_id = (pg_temp.spot('a1')).id),
  'compute_spot_points a écrit le détail des points'
);
select is(
  (select sum(points)::int from public.spot_point_lines where spot_id = (pg_temp.spot('a1')).id),
  (pg_temp.spot('a1')).points_total,
  'le total est la somme des lignes'
);
select ok(
  (pg_temp.spot('a2')).points_total > 0 and exists (select 1 from public.spot_point_lines where spot_id = (pg_temp.spot('a2')).id),
  'un sticker en attente a quand même ses points calculés'
);
select ok(
  extensions.st_distance((pg_temp.spot('home')).public_location, (pg_temp.spot('home')).location) >= 300,
  'à moins de 500 m du domicile, la position publique est décalée d''au moins 300 m'
);
select ok(
  extensions.st_equals((pg_temp.spot('home')).public_location::extensions.geometry,
    public.public_location_for('00000000-0000-0000-0000-00000000050a', (pg_temp.spot('home')).location)::extensions.geometry),
  'la position publique est stable (même entrée, même sortie)'
);
select ok(
  extensions.st_equals((pg_temp.spot('away')).public_location::extensions.geometry, (pg_temp.spot('away')).location::extensions.geometry),
  'loin du domicile, la position publique est la position exacte'
);

-- Fenêtre glissante : un sticker de plus de 24 heures ne compte plus.
update public.spots set created_at = now() - interval '25 hours'
  where id in ((pg_temp.spot('a1')).id, (pg_temp.spot('c1')).id);
set local role service_role;
select lives_ok(
  $$ select pg_temp.pub('a6', '00000000-0000-0000-0000-00000000050a', -44.00135, -115) $$,
  'après 24 heures, A peut recoller à 150 m de son premier sticker'
);
select lives_ok(
  $$ select pg_temp.pub('c21', '00000000-0000-0000-0000-00000000050c', -40.5, -110) $$,
  'après 24 heures, le quota de C se libère'
);
reset role;

-- Estimation (utilisateur connecté) ---------------------------------------------------

create temp table t_counts as
  select (select count(*) from public.spots) as spots, (select count(*) from public.spot_point_lines) as lines;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000050a');

select is(
  (public.estimate_spot_points(-41, -120, null, '2026-05-01 10:00:00+00', 'exif', 'exif') ->> 'status'),
  'published',
  'estimation avec GPS et date : publié'
);
select is(
  (public.estimate_spot_points(-41, -120, null, null, 'manual', 'exif') ->> 'status'),
  'pending_review',
  'estimation avec position manuelle : en attente'
);
select is(
  (public.estimate_spot_points(-41, -120, null, '2026-05-01 10:00:00+00', 'exif', 'exif') ->> 'countryIso2'),
  'XA',
  'l''estimation indique le pays'
);
select ok(
  jsonb_array_length(public.estimate_spot_points(-41, -120, null, '2026-05-01 10:00:00+00', 'exif', 'exif') -> 'lines') > 0,
  'l''estimation renvoie les lignes de détail'
);
select is(
  (select sum((l ->> 'points')::int)::int from jsonb_array_elements(
    public.estimate_spot_points(-41, -120, 3200, '2026-05-01 10:00:00+00', 'exif', 'exif') -> 'lines') l),
  (public.estimate_spot_points(-41, -120, 3200, '2026-05-01 10:00:00+00', 'exif', 'exif') ->> 'pointsTotal')::int,
  'le total estimé est la somme des lignes estimées'
);
select is(
  (public.estimate_spot_points(-43.998, -115, null, '2026-05-01 10:00:00+00', 'exif', 'exif') ->> 'blocked'),
  'nearby_today',
  'l''estimation prévient d''un sticker déjà collé à moins de 200 m aujourd''hui'
);
select ok(
  (public.estimate_spot_points(-41, -120, null, '2026-05-01 10:00:00+00', 'exif', 'exif') -> 'blocked') = 'null'::jsonb,
  'aucun blocage loin de ses stickers du jour'
);

select pg_temp.login('00000000-0000-0000-0000-000000000505');
select throws_ok(
  $$ select public.estimate_spot_points(-41, -120) $$,
  'ST002', null,
  'compte suspendu : pas d''estimation'
);
select pg_temp.logout();
select throws_ok(
  $$ select public.estimate_spot_points(-41, -120) $$,
  '28000', null,
  'sans identité, pas d''estimation'
);

set local role anon;
select throws_ok(
  $$ select public.estimate_spot_points(-41, -120) $$,
  '42501', null,
  'un visiteur ne peut pas estimer'
);
reset role;

select is(
  ((select count(*) from public.spots), (select count(*) from public.spot_point_lines)),
  (select (spots, lines) from t_counts),
  'l''estimation ne laisse rien en base'
);

-- Cache du géocodage (service_role) ---------------------------------------------------

set local role service_role;
select lives_ok(
  $$ select public.geocode_cache_put(-54.80123, -68.30321, 'Ushuaïa', 'photon') $$,
  'service_role met une ville en cache'
);
select results_eq(
  $$ select hit, city from public.geocode_cache_get(-54.8009, -68.3031) $$,
  $$ values (true, 'Ushuaïa'::text) $$,
  'la ville est retrouvée pour un point de la même case (~110 m)'
);
select is_empty(
  $$ select * from public.geocode_cache_get(-54.81, -68.30) $$,
  'rien pour une autre case'
);
reset role;

-- Bucket spot-photos (seulement si le schéma storage est présent) --------------------

create function pg_temp.storage_tests() returns setof text language plpgsql as $$
begin
  if to_regclass('storage.buckets') is null then
    return next skip('schéma storage absent (base Postgres seule)', 5);
    return;
  end if;

  return next results_eq(
    $q$ select public, file_size_limit::bigint, allowed_mime_types from storage.buckets where id = 'spot-photos' $q$,
    $q$ values (true, 20971520::bigint, array['image/webp']) $q$,
    'bucket spot-photos : public, 20 Mo, WebP seulement'
  );

  set local role authenticated;
  perform pg_temp.login('00000000-0000-0000-0000-00000000050a');
  return next lives_ok(
    $q$ insert into storage.objects (bucket_id, name, owner)
        values ('spot-photos', '00000000-0000-0000-0000-00000000050a/00000000-0000-4000-8000-0000000000a1.webp',
                '00000000-0000-0000-0000-00000000050a') $q$,
    'A envoie une photo dans son dossier'
  );
  return next throws_ok(
    $q$ insert into storage.objects (bucket_id, name, owner)
        values ('spot-photos', '00000000-0000-0000-0000-00000000050b/00000000-0000-4000-8000-0000000000a2.webp',
                '00000000-0000-0000-0000-00000000050a') $q$,
    '42501', null,
    'A ne peut pas envoyer dans le dossier de B'
  );
  return next throws_ok(
    $q$ insert into storage.objects (bucket_id, name, owner)
        values ('spot-photos', '00000000-0000-0000-0000-00000000050a/photo.jpg', '00000000-0000-0000-0000-00000000050a') $q$,
    '42501', null,
    'seuls les fichiers .webp sont acceptés'
  );
  perform pg_temp.login('00000000-0000-0000-0000-000000000505');
  return next throws_ok(
    $q$ insert into storage.objects (bucket_id, name, owner)
        values ('spot-photos', '00000000-0000-0000-0000-000000000505/00000000-0000-4000-8000-0000000000a3.webp',
                '00000000-0000-0000-0000-000000000505') $q$,
    '42501', null,
    'un compte suspendu ne peut plus envoyer de photo'
  );
  perform pg_temp.logout();
  reset role;
end;
$$;

select * from pg_temp.storage_tests();

select * from finish();
rollback;
