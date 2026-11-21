-- Cahier des charges V1.1, lots 1 et 2 : modification par l'auteur, signalements avec
-- statut et avis aux membres, éditions, likes et fil photo, badges, passeport,
-- statistiques, records, classements par zone, journal d'erreurs, suppression d'un
-- compte par un admin.
begin;
select plan(56);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c0a', 'a@example.test'),
  ('00000000-0000-0000-0000-000000000c0b', 'b@example.test'),
  ('00000000-0000-0000-0000-000000000c01', 'r1@example.test'),
  ('00000000-0000-0000-0000-000000000c02', 'r2@example.test'),
  ('00000000-0000-0000-0000-000000000c0d', 'm@example.test'),
  ('00000000-0000-0000-0000-000000000c0e', 'z@example.test');
insert into public.profiles (id, username, role) values
  ('00000000-0000-0000-0000-000000000c0a', 'cahier_a', 'user'),
  ('00000000-0000-0000-0000-000000000c0b', 'cahier_b', 'user'),
  ('00000000-0000-0000-0000-000000000c01', 'cahier_r1', 'user'),
  ('00000000-0000-0000-0000-000000000c02', 'cahier_r2', 'user'),
  ('00000000-0000-0000-0000-000000000c0d', 'cahier_modo', 'moderator'),
  ('00000000-0000-0000-0000-000000000c0e', 'cahier_admin', 'admin');

delete from public.seasons;
insert into public.seasons (year, color_hex, is_current) values
  (2025, '#FF7A59', false),
  (2026, '#5B8DEF', true);

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.spot(p_id uuid) returns public.spots language sql security definer as $$
  select * from public.spots where id = p_id
$$;
create function pg_temp.notices(p_user uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(kind order by id), '{}') from public.user_notices where user_id = p_user
$$;

-- Publications (Edge Function, clé service) ---------------------------------------------------
-- A : Paris (2026), Reykjavik (île, capitale), Pyongyang (très rare), Sahara (désert) ;
-- B : Lyon (2025).
set local role service_role;
create temp table t (label text primary key, id uuid);
grant all on t to public;
insert into t select 'paris', public.create_spot(
  p_author => '00000000-0000-0000-0000-000000000c0a', p_name => 'Pont Neuf', p_lat => 48.857, p_lng => 2.341,
  p_altitude_m => null, p_taken_at => '2026-05-01 12:00+00', p_gps_source => 'exif', p_date_source => 'exif',
  p_photo_path => '00000000-0000-0000-0000-000000000c0a/' || gen_random_uuid() || '.webp', p_city => 'Paris');
insert into t select 'reykjavik', public.create_spot(
  p_author => '00000000-0000-0000-0000-000000000c0a', p_name => 'Hallgrímskirkja', p_lat => 64.1417, p_lng => -21.9266,
  p_altitude_m => 3050, p_taken_at => '2026-06-01 12:00+00', p_gps_source => 'exif', p_date_source => 'exif',
  p_photo_path => '00000000-0000-0000-0000-000000000c0a/' || gen_random_uuid() || '.webp', p_city => 'Reykjavik');
insert into t select 'pyongyang', public.create_spot(
  p_author => '00000000-0000-0000-0000-000000000c0a', p_name => 'Arc', p_lat => 39.0392, p_lng => 125.7625,
  p_altitude_m => null, p_taken_at => '2026-07-01 12:00+00', p_gps_source => 'exif', p_date_source => 'exif',
  p_photo_path => '00000000-0000-0000-0000-000000000c0a/' || gen_random_uuid() || '.webp', p_city => 'Pyongyang');
insert into t select 'sahara', public.create_spot(
  p_author => '00000000-0000-0000-0000-000000000c0a', p_name => 'Dune', p_lat => 25.0, p_lng => 9.0,
  p_altitude_m => null, p_taken_at => '2026-08-01 12:00+00', p_gps_source => 'manual', p_date_source => 'exif',
  p_photo_path => '00000000-0000-0000-0000-000000000c0a/' || gen_random_uuid() || '.webp', p_city => null);
insert into t select 'lyon', public.create_spot(
  p_author => '00000000-0000-0000-0000-000000000c0b', p_name => 'Bellecour', p_lat => 45.7578, p_lng => 4.832,
  p_altitude_m => null, p_taken_at => '2025-09-01 12:00+00', p_gps_source => 'exif', p_date_source => 'exif',
  p_photo_path => '00000000-0000-0000-0000-000000000c0b/' || gen_random_uuid() || '.webp', p_city => 'Lyon',
  p_year => 2025, p_comment => 'Au pied de la statue');
select public.refresh_leaderboard();
reset role;

-- Faits géographiques et badges ---------------------------------------------------------------

select is(
  ((pg_temp.spot((select id from t where label = 'reykjavik'))).on_island,
   (pg_temp.spot((select id from t where label = 'reykjavik'))).capital_name),
  (true, 'Reykjavík'::text),
  'Reykjavik : sur une île, dans une capitale');
select ok((pg_temp.spot((select id from t where label = 'sahara'))).desert_name is not null, 'le Sahara est un désert');
select ok(not (pg_temp.spot((select id from t where label = 'lyon'))).on_island, 'Lyon n''est pas sur une île');
select results_eq(
  $$ select b.code from public.user_badges ub join public.badges b on b.id = ub.badge_id
     where ub.user_id = '00000000-0000-0000-0000-000000000c0a' order by b.position $$,
  $$ values ('premier_tomi'), ('altitude_3000'), ('ile'), ('desert'), ('capitale'), ('pays_vierge') $$,
  'A débloque les badges mérités à la publication'
);
select ok(
  (select spot_id = (select id from t where label = 'paris') from public.user_badges ub join public.badges b on b.id = ub.badge_id
   where ub.user_id = '00000000-0000-0000-0000-000000000c0a' and b.code = 'premier_tomi'),
  'chaque badge garde le sticker qui l''a débloqué');
select ok('badge' = any (pg_temp.notices('00000000-0000-0000-0000-000000000c0a')), 'un avis annonce chaque badge');
select results_eq(
  $$ select code, unlocked from public.member_badges('00000000-0000-0000-0000-000000000c0a') where code in ('premier_tomi', 'dix_tomis') $$,
  $$ values ('premier_tomi', true), ('dix_tomis', false) $$,
  'member_badges : débloqués d''abord, puis ceux à débloquer'
);

-- Passeport, conquête, statistiques, records ------------------------------------------------------

select results_eq(
  $$ select iso2, first_year, continent from public.passport('00000000-0000-0000-0000-000000000c0a') $$,
  $$ values ('FR', 2026, 'europe'), ('IS', 2026, 'europe'), ('KP', 2026, 'asie'), ('DZ', 2026, 'afrique') $$,
  'passeport : un tampon par pays, dans l''ordre des collages, avec l''édition et le continent'
);
select is(
  (select spot_count from public.world_conquest() where iso2 = 'FR'),
  2, 'conquête : nombre de stickers publiés par pays');
select is(
  (select count(*)::int from public.world_conquest() where spot_count = 0) > 100,
  true, 'conquête : les pays vierges sont listés');
select results_eq(
  $$ select (s ->> 'stickers')::int, (s ->> 'countries')::int, (s ->> 'continents')::int, (s ->> 'contributors')::int,
            (s ->> 'editions')::int
     from (select public.world_stats() as s) w $$,
  $$ values (5, 4, 3, 2, 2) $$,
  'statistiques mondiales : stickers, pays, continents, contributeurs, éditions'
);
select ok((public.world_stats() ->> 'distanceKm')::int > 10000, 'distance cumulée entre les stickers de chaque membre');
select results_eq(
  $$ select key, value from public.world_records() where key in ('highest', 'rarest') order by key $$,
  $$ values ('highest', 3050::numeric), ('rarest', 200) $$,
  'records : le plus haut (altitude GPS), le plus rare (bonus)'
);
select is(
  (select username from public.world_records() where key = 'top_traveler'),
  'cahier_a', 'record : le plus grand voyageur est le premier au classement');
select is(
  (select count(*)::int from public.continent_firsts()),
  3, 'premier sticker de chaque continent conquis');
select results_eq(
  $$ select (m ->> 'stickers')::int, jsonb_array_length(m -> 'continents'), (m -> 'highest' ->> 'altitudeM')::numeric
     from (select public.member_stats('00000000-0000-0000-0000-000000000c0a') as m) t $$,
  $$ values (4, 3, 3050::numeric) $$,
  'statistiques de A : stickers, continents, altitude maximale'
);
select is(
  (select username from public.get_area_leaderboard('continent', 'europe') where rank = 1),
  'cahier_a', 'classement d''un continent');
select results_eq(
  $$ select username, points, rank from public.get_area_leaderboard('country', 'fr') $$,
  $$ values ('cahier_a'::text, 100, 1), ('cahier_b', 100, 2) $$,
  'classement d''un pays : à points égaux, celle qui les a atteints la première');
select throws_ok($$ select * from public.get_area_leaderboard('planete', 'terre') $$, '22023', null, 'zone inconnue refusée');
select is(
  (select rarity_category from public.rarest_places(1)), 'tres_rare', 'lieux les plus rares : très rare d''abord');
select ok((select count(*) from public.points_progress('00000000-0000-0000-0000-000000000c0a')) >= 1, 'progression des points par jour');

-- Éditions ---------------------------------------------------------------------------------

select results_eq(
  $$ select year, selectable, color_locked from public.list_editions() order by year $$,
  $$ values (2025, true, true), (2026, true, false) $$,
  'éditions : choisissables jusqu''à l''édition en cours ; couleur figée pour une édition passée qui a des stickers'
);

-- Modification par l'auteur ------------------------------------------------------------------

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000c0b');
select lives_ok(
  $$ select public.update_my_spot((select id from t where label = 'lyon'), p_comment => 'Nouveau commentaire',
       p_year => 2026, p_taken_at => '2026-01-15 12:00+00') $$,
  'B change le commentaire, l''édition et la date de son sticker'
);
select results_eq(
  $$ select comment, year, date_source from public.spots where id = (select id from t where label = 'lyon') $$,
  $$ values ('Nouveau commentaire'::text, 2026, 'manual'::text) $$,
  'les modifications sont enregistrées'
);
select is(
  (select sum(points)::int from public.points_ledger
   where spot_id = (select id from t where label = 'lyon') and year = 2025),
  0, 'changer d''édition déplace les points au journal (édition 2025 → 2026)');
select is(
  (public.my_spot_edit_info((select id from t where label = 'lyon')) ->> 'windowOpen')::boolean,
  true, 'my_spot_edit_info : fenêtre de modification ouverte (horloge du serveur)');
select is(
  public.my_spot_edit_info((select id from t where label = 'paris')),
  null, 'my_spot_edit_info : rien pour le sticker d''un autre membre');
select throws_ok(
  $$ select public.update_my_spot((select id from t where label = 'lyon'), p_lat => 45.80, p_lng => 4.832) $$,
  'ST010', null, 'une position à plus de 200 m de celle de la photo est refusée'
);
select lives_ok(
  $$ select public.update_my_spot((select id from t where label = 'lyon'), p_lat => 45.7586, p_lng => 4.832) $$,
  'B déplace son sticker de moins de 200 m'
);
select throws_ok(
  $$ select public.update_my_spot((select id from t where label = 'paris'), p_comment => 'Piraté') $$,
  'P0002', null, 'B ne modifie pas le sticker de A'
);
select throws_ok(
  $$ select public.update_my_spot((select id from t where label = 'lyon'), p_taken_at => '2027-01-01 12:00+00') $$,
  'ST009', null, 'une date du collage dans le futur est refusée'
);
reset role;
update public.spots set created_at = now() - interval '10 days' where id = (select id from t where label = 'lyon');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000c0b');
select is(
  (public.my_spot_edit_info((select id from t where label = 'lyon')) ->> 'windowOpen')::boolean,
  false, 'my_spot_edit_info : fenêtre fermée après edit_window_days jours');
select throws_ok(
  $$ select public.update_my_spot((select id from t where label = 'lyon'), p_year => 2025) $$,
  'ST007', null, 'après edit_window_days jours, la date, l''édition et la position sont figées'
);
select lives_ok(
  $$ select public.update_my_spot((select id from t where label = 'lyon'), p_name => 'Place Bellecour', p_comment => '') $$,
  'le nom et le commentaire restent modifiables'
);
select is(
  (select comment from public.spots where id = (select id from t where label = 'lyon')),
  null, 'un commentaire vide efface le commentaire');

-- Likes et fil photo ---------------------------------------------------------------------------

select is((public.toggle_like((select id from t where label = 'paris')) ->> 'liked')::boolean, true, 'B like le sticker de A');
select is((public.spot_like_info((select id from t where label = 'paris')) ->> 'count')::int, 1, 'un like compté');
select is((public.toggle_like((select id from t where label = 'paris')) ->> 'liked')::boolean, false, 'un second appel retire le like');
select lives_ok($$ select public.toggle_like((select id from t where label = 'paris')) $$, 'B like à nouveau');
select results_eq(
  $$ select name, like_count, liked from public.photo_feed() where author_username = 'cahier_a' and name = 'Pont Neuf' $$,
  $$ values ('Pont Neuf'::text, 1, true) $$,
  'fil photo : nombre de likes et « liké par moi »'
);
select is((select count(*)::int from public.photo_feed(null, 2)), 2, 'fil photo : pagination');

-- Signalements avec statut et avis --------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-000000000c01');
insert into public.spot_reports (spot_id, reporter_id, reason)
values ((select id from t where label = 'pyongyang'), '00000000-0000-0000-0000-000000000c01', 'Faux');
select pg_temp.login('00000000-0000-0000-0000-000000000c02');
insert into public.spot_reports (spot_id, reporter_id, reason)
values ((select id from t where label = 'reykjavik'), '00000000-0000-0000-0000-000000000c02', 'Douteux');

select pg_temp.login('00000000-0000-0000-0000-000000000c0d');
select ok(
  (select count(*) from public.admin_moderation_queue() where needs_review) >= 1,
  'la file de modération contient les stickers « à vérifier » (position à la main)'
);
select lives_ok($$ select public.admin_hide_spot((select id from t where label = 'pyongyang'), 'Photo truquée') $$,
  'le modérateur masque le sticker signalé, avec un motif');
select lives_ok($$ select public.admin_validate_spot((select id from t where label = 'reykjavik')) $$,
  'le modérateur garde l''autre sticker signalé');
reset role;
select results_eq(
  $$ select r.reporter_id, r.status, r.reviewed_by from public.spot_reports r order by r.reporter_id $$,
  $$ values ('00000000-0000-0000-0000-000000000c01'::uuid, 'accepted'::text, '00000000-0000-0000-0000-000000000c0d'::uuid),
            ('00000000-0000-0000-0000-000000000c02'::uuid, 'rejected', '00000000-0000-0000-0000-000000000c0d'::uuid) $$,
  'chaque dossier a un statut et le modérateur qui l''a traité'
);
select ok('report_accepted' = any (pg_temp.notices('00000000-0000-0000-0000-000000000c01')), 'R1 est prévenu que son signalement est retenu');
select ok('report_rejected' = any (pg_temp.notices('00000000-0000-0000-0000-000000000c02')), 'R2 est prévenu que son signalement n''est pas retenu');
select ok('spot_hidden' = any (pg_temp.notices('00000000-0000-0000-0000-000000000c0a')), 'A est prévenue que son sticker est masqué');
select is(
  (select body from public.user_notices where kind = 'spot_hidden' and user_id = '00000000-0000-0000-0000-000000000c0a'),
  'Photo truquée', 'l''avis donne le motif');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000c0b');
select is(
  (select count(*)::int from public.user_notices where user_id <> '00000000-0000-0000-0000-000000000c0b'),
  0, 'B ne lit que ses propres avis');

-- Journal d'erreurs -------------------------------------------------------------------------------

set local role anon;
select pg_temp.logout();
select lives_ok($$ select public.log_app_error('client', 'Erreur de test', null, '/carte', 'Navigateur') $$,
  'un visiteur peut signaler une erreur d''affichage');
select throws_ok($$ select * from private.app_errors $$, '42501', null, 'un visiteur ne lit pas le journal d''erreurs');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000c0e');
select is((select message from public.admin_recent_errors(1)), 'Erreur de test', 'l''admin lit le journal d''erreurs');

-- Suppression d'un compte par un admin ------------------------------------------------------------

reset role;
select throws_ok(
  $$ select public.record_admin_account_deletion('00000000-0000-0000-0000-000000000c0d', '00000000-0000-0000-0000-000000000c0b', 'Spam') $$,
  '42501', null, 'un modérateur ne supprime pas de compte'
);
select is(
  public.record_admin_account_deletion('00000000-0000-0000-0000-000000000c0e', '00000000-0000-0000-0000-000000000c0b', 'Spam répété') ->> 'username',
  'cahier_b', 'un admin supprime un compte, avec un motif journalisé'
);
delete from auth.users where id = '00000000-0000-0000-0000-000000000c0b';
select is(
  (select count(*)::int from public.points_ledger where user_id = '00000000-0000-0000-0000-000000000c0b')
  + (select count(*)::int from public.spot_likes where user_id = '00000000-0000-0000-0000-000000000c0b'),
  0, 'le compte supprimé emporte son journal de points et ses likes');

select * from finish();
rollback;
