-- Classement (somme du journal de points), statistiques de profil et album.
-- Stickers en attente et masqués exclus, périodes, critères, départage des ex aequo
-- (date d'atteinte du score, puis nombre de stickers), droits (visiteur, utilisateur,
-- service_role).
begin;
select plan(55);

-- Données ------------------------------------------------------------------------
-- A (alice) : 230 pts depuis toujours (100 en 2025, 130 en 2026), 2 pays, 3 stickers,
--   plus un sticker en attente et un masqué, qui ne comptent pas ;
-- B (Bea)   : 130 pts en 2026, 2 pays, 2 stickers : à égalité avec A en 2026, mais
--             A a atteint ce score avant elle ;
-- C (chloe) : 3 stickers de 10 pts en France en 2026 et 1 en Norvège en 2024 ;
-- D (dan)   : seulement un sticker en attente : absent du classement.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'c@example.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'd@example.test');

insert into public.profiles (id, username, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bea', 'user'),
  ('00000000-0000-0000-0000-0000000000c3', 'chloe', 'user'),
  ('00000000-0000-0000-0000-0000000000d4', 'dan', 'user');

-- Base de test maîtrisée : on repart de zéro sticker et de quelques pays
-- (tout est annulé par le rollback final).
delete from public.spots;
delete from public.countries;
delete from public.seasons;

-- Années 2025 et 2026 colorées ; 2024 sans couleur (gris).
insert into public.seasons (year, color_hex, is_current) values
  (2025, '#FF7A59', false),
  (2026, '#5B8DEF', true);

-- Pays de test : un petit carré chacun.
create function pg_temp.square(x float8) returns extensions.geography language sql as $$
  select extensions.st_geogfromtext(format('MULTIPOLYGON(((%1$s 0,%2$s 0,%2$s 1,%1$s 1,%1$s 0)))', x, x + 1))
$$;
insert into public.countries (iso2, iso3, name_fr, tier, geom) values
  ('FR', 'FRA', 'France', 'courant', pg_temp.square(0)),
  ('ES', 'ESP', 'Espagne', 'courant', pg_temp.square(2)),
  ('NO', 'NOR', 'Norvège', 'courant', pg_temp.square(4)),
  ('DE', 'DEU', 'Allemagne', 'courant', pg_temp.square(6)),
  ('AR', 'ARG', 'Argentine', 'lointain', pg_temp.square(8)),
  ('JP', 'JPN', 'Japon', 'lointain', pg_temp.square(10)),
  ('BT', 'BTN', 'Bhoutan', 'rare', pg_temp.square(12)),
  ('KP', 'PRK', 'Corée du Nord', 'extreme', pg_temp.square(14)),
  ('AQ', 'ATA', 'Antarctique', 'extreme', pg_temp.square(16));

create function pg_temp.spot(
  author uuid, country char(2), taken date, status public.spot_status, pts int, first boolean default false
) returns uuid language sql as $$
  insert into public.spots (author_id, name, location, public_location, taken_at, year, gps_source,
    date_source, country_iso2, photo_path, status, base_points, points_total, is_first_in_country, created_at)
  values (author, 'Lieu ' || country, extensions.st_geogfromtext('POINT(0.5 0.5)'),
    extensions.st_geogfromtext('POINT(0.5 0.5)'), taken, extract(year from taken)::int, 'exif',
    'exif', country, author::text || '/x.webp', status, pts, pts, first, taken)
  returning id
$$;

select pg_temp.spot('00000000-0000-0000-0000-0000000000a1', 'FR', '2025-06-01', 'published', 100, true);
select pg_temp.spot('00000000-0000-0000-0000-0000000000a1', 'FR', '2026-02-01', 'published', 50);
select pg_temp.spot('00000000-0000-0000-0000-0000000000a1', 'AR', '2026-03-01', 'published', 80, true);
select pg_temp.spot('00000000-0000-0000-0000-0000000000a1', 'ES', '2026-04-01', 'pending_review', 500, true);
select pg_temp.spot('00000000-0000-0000-0000-0000000000a1', 'AR', '2026-05-01', 'hidden', 300);
select pg_temp.spot('00000000-0000-0000-0000-0000000000b2', 'ES', '2026-01-10', 'published', 100, true);
select pg_temp.spot('00000000-0000-0000-0000-0000000000b2', 'JP', '2026-01-11', 'published', 30, true);
select pg_temp.spot('00000000-0000-0000-0000-0000000000c3', 'FR', '2026-07-01', 'published', 10);
select pg_temp.spot('00000000-0000-0000-0000-0000000000c3', 'FR', '2026-07-02', 'published', 10);
select pg_temp.spot('00000000-0000-0000-0000-0000000000c3', 'FR', '2026-07-03', 'published', 10);
-- Sticker 2024 de C : année sans couleur dans seasons.
select pg_temp.spot('00000000-0000-0000-0000-0000000000c3', 'NO', '2024-09-01', 'published', 10);
select pg_temp.spot('00000000-0000-0000-0000-0000000000d4', 'BT', '2026-08-01', 'pending_review', 200);

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Structure -----------------------------------------------------------------------

select has_materialized_view('public', 'leaderboard', 'la vue matérialisée leaderboard existe');
select columns_are(
  'public', 'leaderboard',
  array['user_id', 'username', 'avatar_path', 'period', 'points', 'countries', 'stickers',
        'rank_points', 'rank_countries', 'rank_stickers', 'points_at'],
  'leaderboard n''a que les colonnes du contrat'
);
select ok(
  exists (
    select 1 from pg_index i
    where i.indrelid = 'public.leaderboard'::regclass and i.indisunique and i.indpred is null
  ),
  'un index unique permet le rafraîchissement concurrent'
);
select ok(public.schema_version() >= '20261125000000_classement', 'schema_version inclut la migration classement');

-- Rafraîchissement : service_role seulement ---------------------------------------------

set local role anon;
select throws_ok($$ select public.refresh_leaderboard() $$, '42501', null,
  'un visiteur ne peut pas rafraîchir le classement');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.refresh_leaderboard() $$, '42501', null,
  'un utilisateur connecté ne peut pas rafraîchir le classement');
select pg_temp.logout();
set local role service_role;
select lives_ok($$ select public.refresh_leaderboard() $$, 'service_role rafraîchit le classement');
reset role;

-- Contenu de la vue : périodes et exclusions ---------------------------------------------

select results_eq(
  $$ select period from public.leaderboard
     where user_id = '00000000-0000-0000-0000-0000000000a1' order by period $$,
  $$ values ('2025'::text), ('2026'), ('all') $$,
  'une ligne par période : depuis toujours et chaque année'
);
select results_eq(
  $$ select points, countries, stickers from public.leaderboard
     where user_id = '00000000-0000-0000-0000-0000000000a1' and period = 'all' $$,
  $$ values (230, 2, 3) $$,
  'les stickers en attente et masqués ne comptent pas (points, pays, stickers)'
);
select results_eq(
  $$ select points, countries, stickers from public.leaderboard
     where user_id = '00000000-0000-0000-0000-0000000000a1' and period = '2025' $$,
  $$ values (100, 1, 1) $$,
  'la période 2025 ne compte que les stickers de 2025'
);
select is(
  (select count(*)::int from public.leaderboard where user_id = '00000000-0000-0000-0000-0000000000d4'),
  0,
  'un utilisateur sans sticker publié n''est pas classé'
);

-- Égalités : départage stable (date d'atteinte, puis nombre de stickers), pas d'ex aequo ------

select results_eq(
  $$ select username, rank_points, rank_countries, rank_stickers from public.leaderboard
     where period = '2026' order by lower(username) $$,
  $$ values ('alice'::text, 1, 2, 3), ('Bea', 2, 1, 2), ('chloe', 3, 3, 1) $$,
  '2026 : A devant B à points égaux (score atteint avant) ; B devant A aux pays et aux stickers (atteints avant)'
);
select results_eq(
  $$ select username, rank_points, rank_countries, rank_stickers from public.leaderboard
     where period = 'all' order by lower(username) $$,
  $$ values ('alice'::text, 1, 2, 2), ('Bea', 2, 1, 3), ('chloe', 3, 3, 1) $$,
  'depuis toujours : trois à 2 pays, départagés par la date du 2e pays'
);
select is(
  (select points from public.leaderboard where user_id = '00000000-0000-0000-0000-0000000000a1' and period = 'all'),
  (select sum(points)::int from public.points_ledger where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'les points du classement sont la somme du journal'
);

-- get_leaderboard : lecture pour tous -------------------------------------------------------

set local role anon;
select throws_ok($$ select * from public.leaderboard $$, '42501', null,
  'un visiteur ne lit pas la vue matérialisée directement');
select results_eq(
  $$ select username, rank_points from public.get_leaderboard('2026', 'points') $$,
  $$ values ('alice'::text, 1), ('Bea', 2), ('chloe', 3) $$,
  'un visiteur lit le classement 2026 aux points, sans ex aequo'
);
select results_eq(
  $$ select username, rank_stickers from public.get_leaderboard('2026', 'stickers') $$,
  $$ values ('chloe'::text, 1), ('Bea', 2), ('alice', 3) $$,
  'classement 2026 aux stickers'
);
select results_eq(
  $$ select username, rank_countries from public.get_leaderboard('all', 'countries') $$,
  $$ values ('Bea'::text, 1), ('alice', 2), ('chloe', 3) $$,
  'classement depuis toujours aux pays : trois à égalité, départagés'
);
select results_eq(
  $$ select username from public.get_leaderboard() $$,
  $$ values ('alice'::text), ('Bea'), ('chloe') $$,
  'par défaut : depuis toujours, aux points'
);
select results_eq(
  $$ select username from public.get_leaderboard('all', 'points', 1) $$,
  $$ values ('alice'::text) $$,
  'p_limit limite le haut du classement'
);
select results_eq(
  $$ select username, rank_points from public.get_leaderboard('all', 'points', 1,
       '00000000-0000-0000-0000-0000000000c3') $$,
  $$ values ('alice'::text, 1), ('chloe', 3) $$,
  'p_user ajoute la ligne de l''utilisateur hors du haut du classement'
);
select is(
  (select count(*)::int from public.get_leaderboard('2026', 'points', 50,
     '00000000-0000-0000-0000-0000000000d4')),
  3,
  'p_user sans ligne n''ajoute rien'
);
select is(
  (select count(*)::int from public.get_leaderboard('1999', 'points')),
  0,
  'une année sans sticker donne un classement vide'
);
select throws_ok($$ select * from public.get_leaderboard('all', 'likes') $$, '22023', null,
  'un critère inconnu est refusé');
select throws_ok($$ select * from public.get_leaderboard('hier', 'points') $$, '22023', null,
  'une période inconnue est refusée');
select is(public.leaderboard_size('2026'), 3, 'trois participants en 2026');
select is(public.leaderboard_size('2025'), 1, 'un participant en 2025');

-- Statistiques de profil -------------------------------------------------------------------

select results_eq(
  $$ select points, rank, stickers, countries, firsts
     from public.profile_stats('00000000-0000-0000-0000-0000000000a1') $$,
  $$ values (230, 1, 3, 2, 2) $$,
  'profil de A : score, rang, stickers, pays et premiers du pays publiés'
);
select results_eq(
  $$ select points, rank, stickers, countries, firsts
     from public.profile_stats('00000000-0000-0000-0000-0000000000d4') $$,
  $$ values (0, null::int, 0, 0, 0) $$,
  'profil sans sticker publié : zéro partout et pas de rang'
);
select is(
  (select count(*)::int from public.profile_stats('00000000-0000-0000-0000-00000000ffff')),
  0,
  'profil inconnu : aucune ligne'
);

-- Album --------------------------------------------------------------------------------------

select results_eq(
  $$ select iso3, first_year, color_hex, points, stickers, gold
     from public.album('00000000-0000-0000-0000-0000000000a1') where conquered $$,
  $$ values ('FRA'::text, 2025, '#FF7A59'::text, 150, 2, true),
            ('ARG', 2026, '#5B8DEF', 80, 1, true) $$,
  'album de A : pays conquis, couleur de l''année du premier sticker, points cumulés, anneau doré'
);
select ok(
  not exists (
    select 1 from public.album('00000000-0000-0000-0000-0000000000a1')
    where conquered and iso3 = 'ESP'
  ),
  'un pays où A n''a qu''un sticker en attente n''est pas conquis'
);
select results_eq(
  $$ select color_hex from public.album('00000000-0000-0000-0000-0000000000c3')
     where conquered and iso3 = 'NOR' $$,
  $$ values ('#9A9A94'::text) $$,
  'année sans couleur : tuile grise'
);
select results_eq(
  $$ select gold from public.album('00000000-0000-0000-0000-0000000000c3')
     where conquered and iso3 = 'FRA' $$,
  $$ values (false) $$,
  'pas d''anneau doré sans premier du pays'
);
select ok(
  not exists (
    select 1 from public.album('00000000-0000-0000-0000-0000000000a1')
    where not conquered and iso3 in ('FRA', 'ARG')
  ),
  'un pays conquis n''est jamais proposé à conquérir'
);
select results_eq(
  $$ select distinct tier, points from public.album('00000000-0000-0000-0000-0000000000a1')
     where not conquered order by points, tier $$,
  $$ values ('courant'::public.country_tier, 100), ('lointain', 100), ('rare', 200), ('extreme', 300) $$,
  'pays à conquérir : points possibles (base, plus le bonus d''un pays rare ou très rare)'
);
select ok(
  (select bool_and(n = 1) from (
     select count(*) as n from public.album('00000000-0000-0000-0000-0000000000a1')
     where not conquered and suggestion_rank = 1 group by tier
   ) t),
  'une suggestion de rang 1 par niveau de rareté'
);
select is(
  (select max(suggestion_rank) from public.album('00000000-0000-0000-0000-0000000000a1') where not conquered),
  3,
  'au plus trois suggestions par niveau'
);
select results_eq(
  $$ select iso3 from public.album('00000000-0000-0000-0000-0000000000a1')
     where not conquered and tier = 'courant' and suggestion_rank = 1 $$,
  $$ values ('DEU'::text) $$,
  'un pays vierge est proposé en premier (le bonus « premier du pays » est à prendre)'
);
select results_eq(
  $$ select iso3 from public.album('00000000-0000-0000-0000-0000000000a1')
     where not conquered and tier = 'courant' and suggestion_rank > 1 order by iso3 $$,
  $$ values ('ESP'::text), ('NOR') $$,
  'puis les pays déjà pris par d''autres (ou en attente pour soi)'
);
select results_eq(
  $$ select iso3, suggestion_rank from public.album('00000000-0000-0000-0000-0000000000a1')
     where not conquered and tier = 'extreme' order by suggestion_rank $$,
  $$ select iso3, suggestion_rank from public.album('00000000-0000-0000-0000-0000000000a1')
     where not conquered and tier = 'extreme' order by suggestion_rank $$,
  'l''ordre des suggestions est stable d''un appel à l''autre'
);

-- Liste des stickers d'un profil --------------------------------------------------------------

select is(
  (select count(*)::int from public.profile_spots('00000000-0000-0000-0000-0000000000a1')),
  3,
  'un visiteur ne voit que les stickers publiés de A'
);
reset role;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.profile_spots('00000000-0000-0000-0000-0000000000a1')),
  3,
  'B ne voit pas les stickers en attente ou masqués de A'
);
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select results_eq(
  $$ select status::text, points_total from public.profile_spots('00000000-0000-0000-0000-0000000000a1') $$,
  $$ values ('hidden'::text, 300), ('pending_review', 500), ('published', 80), ('published', 50),
            ('published', 100) $$,
  'A voit tous ses stickers, du plus récent au plus ancien, avec leur statut'
);
select results_eq(
  $$ select color_hex, country_name_fr from public.profile_spots('00000000-0000-0000-0000-0000000000a1')
     where year = 2025 $$,
  $$ values ('#FF7A59'::text, 'France'::text) $$,
  'chaque sticker porte la couleur de son année et le nom du pays'
);
select hasnt_column('public', 'leaderboard', 'role', 'le classement ne montre pas le rôle');
select throws_ok($$ select * from public.leaderboard $$, '42501', null,
  'un utilisateur connecté ne lit pas la vue matérialisée directement');
select pg_temp.logout();
reset role;

-- Modération : masquer un sticker puis rafraîchir le retire du classement ------------------------

update public.spots set status = 'hidden'
  where author_id = '00000000-0000-0000-0000-0000000000b2' and country_iso2 = 'JP';
select is(
  (select points from public.leaderboard where user_id = '00000000-0000-0000-0000-0000000000b2' and period = 'all'),
  130,
  'sans rafraîchissement, le classement garde l''ancienne valeur'
);
set local role service_role;
select public.refresh_leaderboard();
reset role;
select results_eq(
  $$ select points, countries, stickers, rank_points from public.leaderboard
     where user_id = '00000000-0000-0000-0000-0000000000b2' and period = '2026' $$,
  $$ values (100, 1, 1, 2) $$,
  'après rafraîchissement, le sticker masqué ne compte plus et A passe seule en tête'
);

-- Validation d'un sticker en attente : il compte après rafraîchissement.
update public.spots set status = 'published'
  where author_id = '00000000-0000-0000-0000-0000000000d4';
set local role service_role;
select public.refresh_leaderboard();
reset role;
select results_eq(
  $$ select points, rank_points from public.leaderboard
     where user_id = '00000000-0000-0000-0000-0000000000d4' and period = '2026' $$,
  $$ values (200, 1) $$,
  'un sticker validé entre au classement'
);

-- Changement de pseudo : visible tout de suite dans get_leaderboard.
update public.profiles set username = 'dany' where id = '00000000-0000-0000-0000-0000000000d4';
select is(
  (select username from public.get_leaderboard('2026', 'points', 1)),
  'dany',
  'le pseudo est relu dans profiles'
);

-- Compte supprimé : il disparaît du classement lu, même avant le rafraîchissement.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d4';
select is(
  (select count(*)::int from public.get_leaderboard('2026', 'points')),
  3,
  'un compte supprimé n''apparaît plus'
);

-- Droits d'exécution ---------------------------------------------------------------------------

select ok(
  has_function_privilege('anon', 'public.get_leaderboard(text, text, int, uuid)', 'execute')
  and has_function_privilege('anon', 'public.profile_stats(uuid)', 'execute')
  and has_function_privilege('anon', 'public.album(uuid)', 'execute')
  and has_function_privilege('anon', 'public.profile_spots(uuid)', 'execute')
  and has_function_privilege('anon', 'public.leaderboard_size(text)', 'execute'),
  'les fonctions de lecture sont ouvertes aux visiteurs'
);
select ok(
  not has_function_privilege('anon', 'public.refresh_leaderboard()', 'execute')
  and not has_function_privilege('authenticated', 'public.refresh_leaderboard()', 'execute')
  and has_function_privilege('service_role', 'public.refresh_leaderboard()', 'execute'),
  'refresh_leaderboard est réservée à service_role'
);
select ok(
  not has_table_privilege('anon', 'public.leaderboard', 'select')
  and not has_table_privilege('authenticated', 'public.leaderboard', 'select')
  and has_table_privilege('service_role', 'public.leaderboard', 'select'),
  'lecture directe de la vue matérialisée : service_role seulement'
);

select * from finish();
rollback;
