-- Étape 6 : carte (spots_in_bbox), rareté des pays et recherche,
-- testées pour un visiteur, deux utilisateurs (A et B) et service_role.
begin;
select plan(54);

-- Données -------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a6', 'a6@example.test'),
  ('00000000-0000-0000-0000-0000000000b6', 'b6@example.test');
insert into public.profiles (id, username) values
  ('00000000-0000-0000-0000-0000000000a6', 'Remi_Carte'),
  ('00000000-0000-0000-0000-0000000000b6', 'Lea_Carte');

insert into public.seasons (year, color_hex, is_current) values
  (2025, '#FF7A59', false),
  (2026, '#5B8DEF', true)
on conflict (year) do update set color_hex = excluded.color_hex;

-- Pays de test (rectangles grossiers ; codes réservés pour ne gêner aucune donnée réelle).
create function pg_temp.box(x1 float8, y1 float8, x2 float8, y2 float8)
returns extensions.geography language sql as $$
  select extensions.st_multi(extensions.st_makeenvelope(x1, y1, x2, y2, 4326))::extensions.geography
$$;
insert into public.countries (iso2, iso3, name_fr, tier, geom) values
  ('XF', 'XFR', 'Francie de test', 'courant', pg_temp.box(-5, 42, 8, 51)),
  ('XA', 'XAR', 'Argentine de test', 'lointain', pg_temp.box(-73, -55, -53, -22)),
  ('XB', 'XBT', 'Bhoutan de test', 'rare', pg_temp.box(88, 26, 92, 28.5)),
  ('XJ', 'XFJ', 'Fidji de test', 'lointain', pg_temp.box(177, -19, 180, -16));

create function pg_temp.pt(lng float8, lat float8)
returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
$$;

-- s1 : publié à Paris (la position publique est la position exacte : plus de domicile).
-- s2 : en attente (A) ; s3 : masqué (A) ; s4 : Ushuaïa (B), premier du pays ;
-- s5 : Bhoutan (B), pays rare ; s6 / s7 : de part et d'autre de l'antiméridien.
insert into public.spots (id, author_id, name, location, public_location, taken_at, year,
  gps_source, date_source, country_iso2, city, photo_path, status, is_first_in_country, points_total)
values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000a6', 'Pont des Arts',
   pg_temp.pt(2.3375, 48.8583), pg_temp.pt(2.35, 48.87), '2026-03-01', 2026, 'exif', 'exif', 'XF', 'Paris',
   'a6/1.webp', 'published', false, 12),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-0000000000a6', 'Lyon en attente',
   pg_temp.pt(4.83, 45.76), pg_temp.pt(4.83, 45.76), '2026-04-01', 2026, 'manual', 'exif', 'XF', 'Lyon',
   'a6/2.webp', 'pending_review', false, 10),
  ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-0000000000a6', 'Marseille masqué',
   pg_temp.pt(5.37, 43.29), pg_temp.pt(5.37, 43.29), '2026-05-01', 2026, 'exif', 'exif', 'XF', 'Marseille',
   'a6/3.webp', 'hidden', false, 10),
  ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-0000000000b6', 'Ushuaïa',
   pg_temp.pt(-68.3, -54.8), pg_temp.pt(-68.3, -54.8), '2025-03-14', 2025, 'exif', 'exif', 'XA', 'Ushuaïa',
   'b6/4.webp', 'published', true, 195),
  ('00000000-0000-0000-0000-000000000c05', '00000000-0000-0000-0000-0000000000b6', 'Dzong de Paro',
   pg_temp.pt(89.4, 27.43), pg_temp.pt(89.4, 27.43), '2026-06-01', 2026, 'exif', 'exif', 'XB', 'Paro',
   'b6/5.webp', 'published', false, 60),
  ('00000000-0000-0000-0000-000000000c06', '00000000-0000-0000-0000-0000000000b6', 'Taveuni est',
   pg_temp.pt(179.9, -16.8), pg_temp.pt(179.9, -16.8), '2026-07-01', 2026, 'exif', 'exif', 'XJ', null,
   'b6/6.webp', 'published', false, 30),
  ('00000000-0000-0000-0000-000000000c07', '00000000-0000-0000-0000-0000000000b6', 'Taveuni ouest',
   pg_temp.pt(-179.9, -16.8), pg_temp.pt(-179.9, -16.8), '2026-07-02', 2026, 'exif', 'exif', null, null,
   'b6/7.webp', 'published', false, 31);
update public.spots set rarity_category = 'isole' where id = '00000000-0000-0000-0000-000000000c05';

-- Identifiants des marqueurs renvoyés pour une zone et des filtres.
create function pg_temp.ids(x1 float8, y1 float8, x2 float8, y2 float8, f jsonb default '{}')
returns text[] language sql as $$
  select coalesce(array_agg(feature -> 'properties' ->> 'id' order by feature -> 'properties' ->> 'id'), '{}')
  from jsonb_array_elements(public.spots_in_bbox(x1, y1, x2, y2, f) -> 'features') feature
$$;
create function pg_temp.feature(spot uuid)
returns jsonb language sql as $$
  select feature
  from jsonb_array_elements(public.spots_in_bbox(-180, -90, 180, 90, '{}') -> 'features') feature
  where feature -> 'properties' ->> 'id' = spot::text
$$;
grant execute on function pg_temp.ids(float8, float8, float8, float8, jsonb), pg_temp.feature(uuid)
  to anon, authenticated;

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Structure -------------------------------------------------------------------------

select has_function('public', 'spots_in_bbox',
  array['double precision', 'double precision', 'double precision', 'double precision', 'jsonb'],
  'spots_in_bbox existe avec la signature du contrat');
select has_view('public', 'country_rarity', 'la vue country_rarity existe');
select has_function('public', 'search_spots', array['text'], 'search_spots existe');
select is(
  (select prosecdef from pg_proc where oid = 'public.spots_in_bbox(float8, float8, float8, float8, jsonb)'::regprocedure),
  true, 'spots_in_bbox est security definer');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.spots_in_bbox(float8, float8, float8, float8, jsonb)'::regprocedure),
  'spots_in_bbox fixe un search_path vide');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.search_spots(text)'::regprocedure),
  'search_spots fixe un search_path vide');
select ok(public.schema_version() >= '20261128000000_carte', 'schema_version inclut la migration carte');

-- Droits ----------------------------------------------------------------------------

select ok(has_function_privilege('anon', 'public.spots_in_bbox(float8, float8, float8, float8, jsonb)', 'execute'),
  'un visiteur peut appeler spots_in_bbox');
select ok(has_function_privilege('authenticated', 'public.search_spots(text)', 'execute'),
  'un connecté peut appeler search_spots');
select ok(has_table_privilege('anon', 'public.country_rarity', 'select'), 'un visiteur peut lire country_rarity');
select ok(not has_table_privilege('anon', 'public.country_rarity', 'insert'), 'un visiteur ne peut pas écrire dans country_rarity');
select ok(
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid in ('public.spots_in_bbox(float8, float8, float8, float8, jsonb)'::regprocedure,
                    'public.search_spots(text)'::regprocedure)
      and a.grantee = 0
  ),
  'aucune exécution accordée à PUBLIC');
select hasnt_column('public', 'country_rarity', 'location', 'country_rarity n''expose aucune position');

-- Visiteur ------------------------------------------------------------------------------

set local role anon;
select pg_temp.logout();

select is(
  pg_temp.ids(-180, -90, 180, 90),
  array['00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c04',
        '00000000-0000-0000-0000-000000000c05', '00000000-0000-0000-0000-000000000c06',
        '00000000-0000-0000-0000-000000000c07'],
  'un visiteur ne voit que les stickers publiés (ni en attente, ni masqués)');

select is(
  pg_temp.feature('00000000-0000-0000-0000-000000000c01') -> 'geometry' -> 'coordinates',
  '[2.3375, 48.8583]'::jsonb,
  'la position renvoyée est la position publique (la position exacte, sans domicile)');

select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.feature('00000000-0000-0000-0000-000000000c04') -> 'properties') k),
  array['color', 'gold', 'id', 'pending', 'points', 'year'],
  'propriétés légères : id, color, year, points, gold, pending');

select is(
  pg_temp.feature('00000000-0000-0000-0000-000000000c04') -> 'properties',
  jsonb_build_object('id', '00000000-0000-0000-0000-000000000c04', 'color', '#FF7A59', 'year', 2025,
                     'points', 195, 'gold', true, 'pending', false),
  'couleur et année de l''édition du sticker, points et anneau doré');

select is(
  pg_temp.ids(-10, 40, 10, 52),
  array['00000000-0000-0000-0000-000000000c01'],
  'seuls les stickers de la zone sont renvoyés');

select is(
  public.spots_in_bbox(-180, -90, 180, 90) ->> 'type', 'FeatureCollection', 'réponse GeoJSON');
select is(
  (public.spots_in_bbox(-180, -90, 180, 90) -> 'features' -> 0 -> 'properties' ->> 'id'),
  '00000000-0000-0000-0000-000000000c04',
  'les marqueurs les plus forts en points d''abord');

-- Antiméridien : de 170° E à 170° O en passant par 180°.
select is(
  pg_temp.ids(170, -20, -170, -10),
  array['00000000-0000-0000-0000-000000000c06', '00000000-0000-0000-0000-000000000c07'],
  'une zone qui traverse l''antiméridien renvoie les deux côtés');
select is(
  pg_temp.ids(170, -20, 180, -10),
  array['00000000-0000-0000-0000-000000000c06'],
  'sans traversée, seulement le côté est');

-- Filtres
select is(pg_temp.ids(-180, -90, 180, 90, '{"years": [2025]}'),
  array['00000000-0000-0000-0000-000000000c04'], 'filtre année');
select is(cardinality(pg_temp.ids(-180, -90, 180, 90, '{"years": []}')), 5, 'liste d''années vide = toutes les années');
select is(pg_temp.ids(-180, -90, 180, 90, '{"authorId": "00000000-0000-0000-0000-0000000000a6"}'),
  array['00000000-0000-0000-0000-000000000c01'], 'filtre personne : seulement ses stickers publiés');
select is(pg_temp.ids(-180, -90, 180, 90, '{"rare": true}'),
  array['00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000c05'],
  'filtre « Rares » : anneau doré, lieu isolé ou très rare');
select is(pg_temp.ids(-180, -90, 180, 90, '{"rare": true, "years": [2026]}'),
  array['00000000-0000-0000-0000-000000000c05'], 'les filtres se combinent');
select is(pg_temp.ids(-180, -90, 180, 90, '{"countries": ["xa", "XB"]}'),
  array['00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000c05'], 'filtre pays (codes ISO)');
select is(pg_temp.ids(-180, -90, 180, 90, '{"from": "2026-05-15", "to": "2026-07-01"}'),
  array['00000000-0000-0000-0000-000000000c05', '00000000-0000-0000-0000-000000000c06'],
  'filtre période : dates du collage, bornes incluses');
select throws_ok(
  $$ select public.spots_in_bbox(-180, -90, 180, 90, '{"from": "pas une date"}') $$,
  '22023', null, 'une période invalide est refusée');
select throws_ok(
  $$ select public.spots_in_bbox(-180, -90, 180, 90, '{"mine": true}') $$,
  '28000', 'Connexion requise', '« Mes stickers » exige d''être connecté');
select throws_ok(
  $$ select public.spots_in_bbox(-200, -90, 180, 90) $$,
  '22023', 'Zone invalide', 'une zone invalide est refusée');

select is(
  (select array_agg(spot_count order by iso2) from public.country_rarity where iso2 in ('XA', 'XB', 'XF')),
  array[1, 1, 1], 'country_rarity compte seulement les stickers publiés');
select is(
  (select array_agg(base_points order by iso2) from public.country_rarity where iso2 in ('XA', 'XB', 'XF')),
  array[100, 200, 100], 'country_rarity donne les points possibles : base, plus le bonus d''un pays rare');
select results_eq(
  $$ select id, distance_m > 0 from public.nearby_spots('00000000-0000-0000-0000-000000000c06') $$,
  $$ values ('00000000-0000-0000-0000-000000000c07'::uuid, true) $$,
  'stickers proches : de l''autre côté de l''antiméridien, les publiés seulement');
select is_empty(
  $$ select * from public.nearby_spots('00000000-0000-0000-0000-000000000c02') $$,
  'pas de stickers proches pour un sticker non publié');

-- Recherche
select is(
  (select array_agg(id) from public.search_spots('ushuaia') where kind = 'spot'),
  array['00000000-0000-0000-0000-000000000c04'], 'recherche d''un lieu sans tenir compte des accents');
-- Les vrais pays (migration 20261122000001_pays) répondent aussi : « Argentine » (AR).
select ok(
  (select array_agg(id::text) from public.search_spots('ARGENTINE') where kind = 'country') @> array['XA'],
  'recherche d''un pays, sans tenir compte de la casse');
select is(
  (select array_agg(label) from public.search_spots('lea_c') where kind = 'user'),
  array['Lea_Carte'], 'recherche d''un pseudo');
select is(
  (select spot_count from public.search_spots('lea_c') where kind = 'user'), 4,
  'nombre de stickers publiés de la personne');
select is(
  (select count(*)::int from public.search_spots('attente')), 0, 'un sticker en attente n''est pas trouvé');
select is(
  (select count(*)::int from public.search_spots('masqu')), 0, 'un sticker masqué n''est pas trouvé');
select is((select count(*)::int from public.search_spots('a')), 0, 'une recherche trop courte ne renvoie rien');
select is((select count(*)::int from public.search_spots('100%')), 0, 'les jokers saisis sont pris au pied de la lettre');

-- Utilisateur A ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a6');

select is(
  pg_temp.ids(-180, -90, 180, 90, '{"mine": true}'),
  array['00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02'],
  'A voit ses stickers publiés et en attente, jamais le masqué');
select is(
  (select feature -> 'properties' -> 'pending'
   from jsonb_array_elements(public.spots_in_bbox(-180, -90, 180, 90, '{"mine": true}') -> 'features') feature
   where feature -> 'properties' ->> 'id' = '00000000-0000-0000-0000-000000000c02'),
  'true'::jsonb, 'son sticker en attente est marqué pending');
select ok(
  '00000000-0000-0000-0000-000000000c02' = any (pg_temp.ids(-180, -90, 180, 90)),
  'A voit aussi son sticker en attente sans filtre');

-- Utilisateur B ---------------------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000000b6');
select ok(
  not ('00000000-0000-0000-0000-000000000c02' = any (pg_temp.ids(-180, -90, 180, 90))),
  'B ne voit pas le sticker en attente de A');
select is(
  pg_temp.ids(-180, -90, 180, 90, '{"mine": true, "years": [2025]}'),
  array['00000000-0000-0000-0000-000000000c04'], '« Mes stickers » de B, combiné à l''année');
select is(
  pg_temp.feature('00000000-0000-0000-0000-000000000c01') -> 'geometry' -> 'coordinates',
  '[2.3375, 48.8583]'::jsonb,
  'connectée, B reçoit aussi la position publique du sticker de A');

-- Visiteur : pas d'accès direct à spots ------------------------------------------------------

reset role;
set local role anon;
select pg_temp.logout();
select throws_ok($$ select id from public.spots $$, '42501', null, 'un visiteur ne lit pas la table spots');

-- Plafond --------------------------------------------------------------------------------------

reset role;
insert into public.spots (author_id, name, location, public_location, taken_at, year,
  gps_source, date_source, photo_path, status, points_total)
select '00000000-0000-0000-0000-0000000000b6', 'Démo ' || g,
  pg_temp.pt(-60 + (g % 100) * 0.01, -80 + (g / 100) * 0.01),
  pg_temp.pt(-60 + (g % 100) * 0.01, -80 + (g / 100) * 0.01),
  '2026-01-01', 2026, 'exif', 'exif', 'b6/demo.webp', 'published', g % 90
from generate_series(1, 5001) g;

set local role anon;
select is(
  jsonb_array_length(public.spots_in_bbox(-61, -81, -58, -78) -> 'features'), 5000,
  'au plus 5 000 marqueurs renvoyés');
select is(
  public.spots_in_bbox(-61, -81, -58, -78) -> 'truncated', 'true'::jsonb,
  'la réponse signale qu''il en reste');
select is(
  public.spots_in_bbox(-10, 40, 10, 52) -> 'truncated', 'false'::jsonb,
  'truncated vaut false sous le plafond');
reset role;

select * from finish();
rollback;
