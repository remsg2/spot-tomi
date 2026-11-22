-- Cadrage des photos : point du sticker sur la photo (focus_x, focus_y).
begin;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000f0a', 'fa@example.test'),
  ('00000000-0000-0000-0000-000000000f0b', 'fb@example.test'),
  ('00000000-0000-0000-0000-000000000f0d', 'fm@example.test');
insert into public.profiles (id, username, role) values
  ('00000000-0000-0000-0000-000000000f0a', 'cadrage_a', 'user'),
  ('00000000-0000-0000-0000-000000000f0b', 'cadrage_b', 'user'),
  ('00000000-0000-0000-0000-000000000f0d', 'cadrage_modo', 'moderator');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.focus(p_id uuid) returns real[] language sql security definer as $$
  select array[focus_x, focus_y] from public.spots where id = p_id
$$;

set local role service_role;
create temp table t (label text primary key, id uuid);
grant all on t to public;
insert into t select 'paris', public.create_spot(
  p_author => '00000000-0000-0000-0000-000000000f0a', p_name => 'Pont Neuf', p_lat => 48.857, p_lng => 2.341,
  p_altitude_m => null, p_taken_at => now() - interval '1 day', p_gps_source => 'exif', p_date_source => 'exif',
  p_photo_path => '00000000-0000-0000-0000-000000000f0a/' || gen_random_uuid() || '.webp', p_city => 'Paris');

-- Edge Function : point posé juste après create_spot, pour l'auteur seulement.
select is(
  public.set_spot_focus_as('00000000-0000-0000-0000-000000000f0a', (select id from t), 0.25, 0.8) ->> 'focusX',
  '0.25', 'set_spot_focus_as enregistre le point de l''auteur');
select throws_ok(
  $$ select public.set_spot_focus_as('00000000-0000-0000-0000-000000000f0b', (select id from t), 0.5, 0.5) $$,
  'P0002', null, 'set_spot_focus_as refuse un autre auteur');
select results_eq(
  $$ select focus_x, focus_y from public.public_spots where id = (select id from t) $$,
  $$ values (0.25::real, 0.8::real) $$,
  'public_spots expose le point'
);
reset role;

select ok(
  not has_function_privilege('authenticated', 'public.set_spot_focus_as(uuid, uuid, double precision, double precision)', 'execute'),
  'set_spot_focus_as est réservé à la clé service');
select ok(
  not has_function_privilege('anon', 'public.set_spot_focus(uuid, double precision, double precision)', 'execute'),
  'un visiteur ne recadre rien');

-- Auteur ---------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000f0a');
select lives_ok(
  $$ select public.set_spot_focus((select id from t), 0.12345, 0.6789) $$,
  'l''auteur recadre sa photo');
select is(pg_temp.focus((select id from t)), array[0.123, 0.679]::real[], 'point arrondi au millième');
select throws_ok(
  $$ select public.set_spot_focus((select id from t), 1.2, 0.5) $$,
  '22023', null, 'un point hors de la photo est refusé');
select throws_ok(
  $$ select public.set_spot_focus((select id from t), 0.5, null) $$,
  '22023', null, 'les deux coordonnées sont requises');
select lives_ok(
  $$ select public.set_spot_focus((select id from t), null, null) $$,
  'null, null : retour au centre');
select is(pg_temp.focus((select id from t)), array[null, null]::real[], 'point effacé');
select is(
  (select count(*)::int from public.admin_audit_log where target = 'spot:' || (select id from t) and action = 'spot.focus'),
  0, 'le recadrage par l''auteur n''est pas journalisé');

-- Autre membre, modérateur -----------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000f0b');
select throws_ok(
  $$ select public.set_spot_focus((select id from t), 0.5, 0.5) $$,
  'P0002', null, 'un autre membre ne recadre pas la photo');
select pg_temp.login('00000000-0000-0000-0000-000000000f0d');
select lives_ok(
  $$ select public.set_spot_focus((select id from t), 0.4, 0.3) $$,
  'un modérateur recadre la photo');
reset role;
select is(
  (select after ->> 'focus_x' from public.admin_audit_log where target = 'spot:' || (select id from t) and action = 'spot.focus'),
  '0.4', 'le recadrage par un modérateur est journalisé');
select ok(
  pg_get_function_result('public.admin_moderation_queue()'::regprocedure) like '%focus_x real, focus_y real%',
  'la file de modération renvoie le point');

-- Nouvelle photo : le point repart au centre.
update public.spots
set photo_path = '00000000-0000-0000-0000-000000000f0a/' || gen_random_uuid() || '.webp'
where id = (select id from t);
select is(pg_temp.focus((select id from t)), array[null, null]::real[], 'nouvelle photo : point remis au centre');

select * from finish();
rollback;
