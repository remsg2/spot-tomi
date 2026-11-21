-- Photo prise dans l'app (sources « device ») : position du téléphone et heure
-- de la prise, vérifiées comme celles de la photo.
begin;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000070a', 'capture@example.test');
insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000070a', 'capture_pub');

-- Pays de test en plein Pacifique Sud, loin des autres tests.
insert into public.countries (iso2, iso3, name_fr, tier, geom) values (
  'XB', 'XBB', 'Pays de capture', 'courant',
  extensions.st_multi(extensions.st_makeenvelope(-100, -48, -90, -38, 4326))::extensions.geography
);

create temp table t_capture (label text primary key, id uuid not null);
grant all on t_capture to public;

select ok(public.schema_version() >= '20261129000000_capture', 'schema_version inclut la migration capture');

set local role service_role;

select lives_ok(
  $$ insert into t_capture select 'tel', public.create_spot(
       '00000000-0000-0000-0000-00000000070a', 'Photo du jour', -44, -95, 3100,
       '2020-01-01 00:00:00+00', 'device', 'device',
       '00000000-0000-0000-0000-00000000070a/' || gen_random_uuid()::text || '.webp', null) $$,
  'photo prise dans l''app (position et heure du téléphone) : le sticker est créé'
);
select lives_ok(
  $$ insert into t_capture select 'mixte', public.create_spot(
       '00000000-0000-0000-0000-00000000070a', 'Position du téléphone, date de la photo', -45, -95, null,
       '2026-06-01 12:00:00+00', 'device', 'exif',
       '00000000-0000-0000-0000-00000000070a/' || gen_random_uuid()::text || '.webp', null) $$,
  'position du téléphone et date de la photo : le sticker est créé'
);

select is(
  (select s.status from public.spots s join t_capture t on t.id = s.id where t.label = 'tel'),
  'published'::public.spot_status,
  'position et heure du téléphone : publié directement, sans modération'
);
select is(
  (select s.taken_at from public.spots s join t_capture t on t.id = s.id where t.label = 'tel'),
  now(),
  'date « device » : l''heure du serveur, jamais celle envoyée par le client'
);
select is(
  (select (s.gps_source, s.date_source) from public.spots s join t_capture t on t.id = s.id where t.label = 'tel'),
  ('device'::text, 'device'::text),
  'les sources « device » sont enregistrées'
);
select is(
  (select s.altitude_m from public.spots s join t_capture t on t.id = s.id where t.label = 'tel'),
  3100.0,
  'l''altitude du téléphone est enregistrée'
);
select is(
  (select (s.status, s.year) from public.spots s join t_capture t on t.id = s.id where t.label = 'mixte'),
  ('published'::public.spot_status, 2026),
  'position du téléphone et date de la photo : publié, année de la photo'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000070a', true),
       set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000070a', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  public.estimate_spot_points(-46, -95, null, null, 'device', 'device') ->> 'status',
  'published',
  'estimation : position et heure du téléphone, publié'
);
select is(
  public.estimate_spot_points(-46, -95, null, null, 'device', 'upload') ->> 'status',
  'published',
  'estimation : sans date dans la photo, publié aussi (publication directe)'
);
select throws_ok(
  $$ select public.estimate_spot_points(-46, -95, null, null, 'telephone', 'device') $$,
  'ST005', 'Source de la position invalide.',
  'une source de position inconnue est toujours refusée'
);

select * from finish();
rollback;
