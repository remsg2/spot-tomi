-- Modèle de données, points et sécurité, testés pour chaque rôle (visiteur, utilisateur,
-- modérateur, admin) ; barème du cahier des charges V1.1 : 100 points de base + bonus de
-- rareté (courant 0, touristique 20, remarquable 50, isolé 100, très rare 200), doublon
-- à moins de 200 m sans bonus ; journal de points ; éditions.
begin;
select plan(147);

-- Données de départ ---------------------------------------------------------------
-- Les saisons du seed (s'il est chargé) sont remplacées par celles du test.

delete from public.seasons;
insert into public.seasons (year, color_hex, is_current) values
  (2024, '#F2C230', false),
  (2025, '#FF7A59', false),
  (2026, '#5B8DEF', true);

-- Comptes : A, B et C, modérateur M, admin Z, suspendu S, et trois signaleurs R1 à R3.
insert into auth.users (id, email) values
  ('a4000000-0000-4000-8000-000000000001', 'a4@example.test'),
  ('a4000000-0000-4000-8000-000000000002', 'b4@example.test'),
  ('a4000000-0000-4000-8000-000000000003', 'c4@example.test'),
  ('a4000000-0000-4000-8000-000000000004', 'm4@example.test'),
  ('a4000000-0000-4000-8000-000000000005', 'z4@example.test'),
  ('a4000000-0000-4000-8000-000000000006', 's4@example.test'),
  ('a4000000-0000-4000-8000-000000000007', 'r1@example.test'),
  ('a4000000-0000-4000-8000-000000000008', 'r2@example.test'),
  ('a4000000-0000-4000-8000-000000000009', 'r3@example.test');
insert into public.profiles (id, username, role, suspended_at) values
  ('a4000000-0000-4000-8000-000000000001', 'alice_4', 'user', null),
  ('a4000000-0000-4000-8000-000000000002', 'bruno_4', 'user', null),
  ('a4000000-0000-4000-8000-000000000003', 'chloe_4', 'user', null),
  ('a4000000-0000-4000-8000-000000000004', 'modo_4', 'moderator', null),
  ('a4000000-0000-4000-8000-000000000005', 'admin_4', 'admin', null),
  ('a4000000-0000-4000-8000-000000000006', 'suspendu_4', 'user', now()),
  ('a4000000-0000-4000-8000-000000000007', 'signal_1', 'user', null),
  ('a4000000-0000-4000-8000-000000000008', 'signal_2', 'user', null),
  ('a4000000-0000-4000-8000-000000000009', 'signal_3', 'user', null);

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.pt(lat float8, lng float8) returns extensions.geography
language sql immutable as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
$$;
create function pg_temp.near(origin extensions.geography, meters float8, azimuth_deg float8)
returns extensions.geography language sql immutable as $$
  select extensions.st_project(origin, meters, radians(azimuth_deg))
$$;
-- Insère un sticker comme le ferait l'Edge Function publish-spot (service_role).
create function pg_temp.spot(
  p_id uuid, p_author uuid, p_name text, p_loc extensions.geography, p_created timestamptz,
  p_city text default null, p_altitude numeric default null,
  p_status public.spot_status default 'published', p_remarkable boolean default false,
  p_tourist boolean default false
) returns uuid language sql as $$
  insert into public.spots (
    id, author_id, name, location, public_location, altitude_m, taken_at, year, gps_source,
    date_source, country_iso2, city, photo_path, status, rarity_override, is_tourist_spot, created_at
  ) values (
    p_id, p_author, p_name, p_loc, p_loc, p_altitude,
    p_created, extract(year from p_created)::int,
    case when p_status = 'pending_review' then 'manual' else 'exif' end, 'exif',
    public.country_at(p_loc), p_city, p_author || '/' || p_id || '.webp', p_status,
    case when p_remarkable then 'remarquable'::public.rarity_category end, p_tourist, p_created
  ) returning id
$$;

-- Scénario, dans l'ordre de publication.
-- Références publiées par B, puis des stickers non validés qui ne doivent jamais compter.
do $$ begin
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002',
    'Tour Saint-Jacques', pg_temp.pt(48.8566, 2.3522), '2026-03-01 10:00+00', 'Paris');
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002',
    'Lac du Bourget', pg_temp.near(pg_temp.pt(45.8506, 6.8536), 85000, 260), '2026-03-01 10:01+00', 'Aix-les-Bains');
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000002',
    'Bouches de Kotor', pg_temp.near(pg_temp.pt(42.6507, 18.0944), 55000, 100), '2026-03-01 10:02+00', 'Risan');
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000002',
    'Route 3', pg_temp.near(pg_temp.pt(-54.8019, -68.3030), 30000, 0), '2026-03-01 10:03+00', 'Tolhuin',
    p_status => 'pending_review');
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000002',
    'Port d''Ushuaïa', pg_temp.near(pg_temp.pt(-54.8019, -68.3030), 1000, 90), '2026-03-01 10:04+00', 'Ushuaïa',
    p_status => 'hidden');
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000006', 'a4000000-0000-4000-8000-000000000001',
    'Sans GPS', pg_temp.pt(45.7640, 4.8357), '2026-03-01 10:05+00', 'Lyon', p_status => 'pending_review');
  -- Rue à 120 m d'un autre sticker à Paris (A) : lieu courant, doublon (bonus nul de toute façon).
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000011', 'a4000000-0000-4000-8000-000000000001',
    'Rue de Rivoli', pg_temp.near(pg_temp.pt(48.8566, 2.3522), 120, 90), '2026-03-01 11:00+00', 'Paris');
  -- Mont Blanc, 4 362 m (C) : très rare par l'altitude.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000012', 'a4000000-0000-4000-8000-000000000003',
    'Mont Blanc', pg_temp.pt(45.8506, 6.8536), '2026-03-01 12:00+00', null, 4362);
  -- Dubrovnik, premier de Croatie (A) : lieu courant.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000013', 'a4000000-0000-4000-8000-000000000001',
    'Remparts', pg_temp.pt(42.6507, 18.0944), '2026-03-01 13:00+00', 'Dubrovnik');
  -- Ushuaïa, premier d'Argentine (A) : une ville, lieu courant.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000001',
    'Fin du monde', pg_temp.pt(-54.8019, -68.3030), '2026-03-01 14:00+00', 'Ushuaïa');
  -- Thimphou (A) : pays rare, isolé.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000015', 'a4000000-0000-4000-8000-000000000001',
    'Dzong', pg_temp.pt(27.4728, 89.6390), '2026-03-01 15:00+00', 'Thimphou');
  -- Pyongyang (A) : pays très rare.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000016', 'a4000000-0000-4000-8000-000000000001',
    'Arc', pg_temp.pt(39.0392, 125.7625), '2026-03-01 16:00+00', 'Pyongyang');
  -- En mer à 35 km de Marseille, hors de tout pays (A) : isolé.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000017', 'a4000000-0000-4000-8000-000000000001',
    'Bouée', pg_temp.pt(42.90, 5.40), '2026-03-01 17:00+00');
  -- À 100 m du Mont Blanc, après lui (B) : très rare, mais doublon : pas de bonus.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000018', 'a4000000-0000-4000-8000-000000000002',
    'Sommet bis', pg_temp.near(pg_temp.pt(45.8506, 6.8536), 100, 0), '2026-03-01 18:00+00', null, 4300);
  -- Lyon, site touristique OpenStreetMap à proximité (A).
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000019', 'a4000000-0000-4000-8000-000000000001',
    'Fourvière', pg_temp.pt(45.7623, 4.8225), '2026-03-01 19:00+00', 'Lyon', p_tourist => true);
  -- Tibesti, à plus de 300 km de toute ville (C) : très rare.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000020', 'a4000000-0000-4000-8000-000000000003',
    'Emi Koussi', pg_temp.pt(21.0, 18.0), '2026-03-01 20:00+00');
  -- Centre de l'Islande, à 100 km de la ville la plus proche (C) : isolé.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000021', 'a4000000-0000-4000-8000-000000000003',
    'Hautes terres', pg_temp.pt(64.8, -18.5), '2026-03-01 21:00+00');
  -- Site remarquable choisi par la modération (C), à Paris.
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000022', 'a4000000-0000-4000-8000-000000000003',
    'Tour Eiffel', pg_temp.pt(48.8584, 2.2945), '2026-03-01 22:00+00', 'Paris', p_remarkable => true);
end $$;

-- Structure ----------------------------------------------------------------------------

select has_table('public', 'seasons', 'la table seasons existe');
select has_table('public', 'countries', 'la table countries existe');
select has_table('public', 'scoring_rules', 'la table scoring_rules existe');
select has_table('public', 'spots', 'la table spots existe');
select has_table('public', 'spot_point_lines', 'la table spot_point_lines existe');
select has_table('public', 'spot_reports', 'la table spot_reports existe');
select has_table('public', 'admin_audit_log', 'la table admin_audit_log existe');
select has_table('public', 'points_ledger', 'la table points_ledger existe');
select has_table('public', 'cities', 'la table cities existe');
select hasnt_table('private', 'user_homes', 'plus de domicile');
select is(
  (select count(*)::int from pg_class
   where relrowsecurity and oid in (
     'public.seasons'::regclass, 'public.countries'::regclass, 'public.scoring_rules'::regclass,
     'public.spots'::regclass, 'public.spot_point_lines'::regclass, 'public.spot_reports'::regclass,
     'public.admin_audit_log'::regclass, 'public.points_ledger'::regclass, 'public.cities'::regclass)),
  9,
  'RLS activée sur les 9 tables'
);
select has_view('public', 'public_spots', 'la vue public_spots existe');
select columns_are('public', 'public_spots', array[
  'id', 'author_id', 'author_username', 'author_avatar_path', 'name', 'lat', 'lng', 'altitude_m',
  'taken_at', 'year', 'color_hex', 'country_iso2', 'country_name_fr', 'country_tier', 'city',
  'photo_path', 'is_exceptional', 'is_first_in_country', 'points_total', 'created_at',
  'comment', 'base_points', 'rarity_bonus', 'rarity_category', 'rarity_reason', 'edition_name', 'thumb_path',
  'focus_x', 'focus_y'
], 'public_spots a exactement les colonnes du contrat');
select hasnt_column('public', 'public_spots', 'location', 'public_spots ne contient jamais location');
select hasnt_column('public', 'public_spots', 'public_location', 'public_spots expose lat/lng, pas la géographie');
select is(
  (select count(*)::int from pg_indexes
   where schemaname = 'public' and indexname in (
     'spots_location_idx', 'spots_public_location_idx', 'spots_author_created_idx',
     'spots_status_idx', 'spots_country_idx', 'spots_year_idx', 'countries_geom_idx')),
  7,
  'index GiST et index de recherche présents'
);

-- Fonctions : qui peut les exécuter.
select ok(
  not has_function_privilege('anon', 'public.compute_spot_points(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.compute_spot_points(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.compute_spot_points(uuid, text)', 'execute'),
  'compute_spot_points : service_role seulement'
);
select ok(
  not has_function_privilege('anon', 'public.recompute_all_points(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.recompute_all_points(text)', 'execute')
  and has_function_privilege('service_role', 'public.recompute_all_points(text)', 'execute'),
  'recompute_all_points : service_role seulement'
);
select hasnt_function('public', 'public_location_for', 'plus de position floutée près d''un domicile');
select ok(
  not has_function_privilege('anon', 'public.country_at(extensions.geography)', 'execute')
  and not has_function_privilege('authenticated', 'public.country_at(extensions.geography)', 'execute')
  and has_function_privilege('service_role', 'public.country_at(extensions.geography)', 'execute'),
  'country_at : service_role seulement'
);
select ok(
  has_function_privilege('anon', 'public.year_color(int)', 'execute')
  and has_function_privilege('authenticated', 'public.year_color(int)', 'execute')
  and has_function_privilege('anon', 'public.current_season()', 'execute')
  and has_function_privilege('authenticated', 'public.current_season()', 'execute'),
  'year_color et current_season : exécutables par tous'
);

-- Pays et barème par défaut ----------------------------------------------------------

select ok((select count(*) from public.countries) >= 230, 'les pays Natural Earth sont chargés');
select results_eq(
  $$ select iso2::text, tier::text from public.countries
     where iso2 in ('FR', 'HR', 'US', 'AR', 'BT', 'TM', 'KP', 'AQ') order by iso2 $$,
  $$ values ('AQ', 'extreme'), ('AR', 'lointain'), ('BT', 'rare'), ('FR', 'courant'),
            ('HR', 'courant'), ('KP', 'extreme'), ('TM', 'rare'), ('US', 'courant') $$,
  'niveaux par défaut : courant, lointain, rare, extrême'
);
select results_eq(
  $$ select name_fr from public.countries where iso2 in ('DE', 'NO', 'AR') order by iso2 $$,
  $$ values ('Argentine'), ('Allemagne'), ('Norvège') $$,
  'noms des pays en français (France et Norvège compris malgré ISO_A2 = -99)'
);
select results_eq(
  $$ select key, value from public.scoring_rules order by key $$,
  $$ values
    ('base_points', 100::numeric), ('bonus_isole', 100), ('bonus_remarquable', 50),
    ('bonus_touristique', 20), ('bonus_tres_rare', 200), ('comment_max_length', 280),
    ('daily_publish_limit', 20), ('daily_report_limit', 10), ('edit_radius_m', 200),
    ('edit_window_days', 7), ('isole_altitude_m', 3000), ('isole_city_km', 50),
    ('neighbor_radius_m', 200), ('reports_before_review', 3), ('tres_rare_altitude_m', 4000),
    ('tres_rare_city_km', 300) $$,
  'règles du barème par défaut (cahier des charges V1.1)'
);

-- Pays d'un point.
select is(public.country_at(pg_temp.pt(48.8566, 2.3522))::text, 'FR', 'country_at : Paris est en France');
select is(public.country_at(pg_temp.pt(42.6507, 18.0944))::text, 'HR', 'country_at : Dubrovnik est en Croatie');
select is(public.country_at(pg_temp.pt(-54.8019, -68.3030))::text, 'AR', 'country_at : Ushuaïa est en Argentine');
select is(public.country_at(pg_temp.pt(-80, 0))::text, 'AQ', 'country_at : intérieur de l''Antarctique');
select is(public.country_at(pg_temp.pt(43.25, 5.30))::text, 'FR', 'country_at : en mer au large de Marseille (< 25 km)');
select is(public.country_at(pg_temp.pt(-40, -140)), null, 'country_at : en plein Pacifique, aucun pays');

-- Barème : un exemple par catégorie ---------------------------------------------------

set local role service_role;
do $$ begin
  perform pg_temp.logout();
  perform public.compute_spot_points(s.id) from public.spots s
  where s.id::text like '5b000000-%' order by s.created_at;
end $$;

select results_eq(
  $$ select s.id, s.points_total, s.base_points, s.rarity_bonus, s.rarity_category::text, s.is_first_in_country
     from public.spots s
     where s.id in ('5b000000-0000-4000-8000-000000000011', '5b000000-0000-4000-8000-000000000012',
                    '5b000000-0000-4000-8000-000000000013', '5b000000-0000-4000-8000-000000000014',
                    '5b000000-0000-4000-8000-000000000015', '5b000000-0000-4000-8000-000000000016',
                    '5b000000-0000-4000-8000-000000000017', '5b000000-0000-4000-8000-000000000018',
                    '5b000000-0000-4000-8000-000000000019', '5b000000-0000-4000-8000-000000000020',
                    '5b000000-0000-4000-8000-000000000021', '5b000000-0000-4000-8000-000000000022')
     order by s.id $$,
  $$ values
    ('5b000000-0000-4000-8000-000000000011'::uuid, 100, 100, 0, 'courant', false),
    ('5b000000-0000-4000-8000-000000000012'::uuid, 300, 100, 200, 'tres_rare', false),
    ('5b000000-0000-4000-8000-000000000013'::uuid, 100, 100, 0, 'courant', true),
    ('5b000000-0000-4000-8000-000000000014'::uuid, 100, 100, 0, 'courant', true),
    ('5b000000-0000-4000-8000-000000000015'::uuid, 200, 100, 100, 'isole', true),
    ('5b000000-0000-4000-8000-000000000016'::uuid, 300, 100, 200, 'tres_rare', true),
    ('5b000000-0000-4000-8000-000000000017'::uuid, 200, 100, 100, 'isole', false),
    ('5b000000-0000-4000-8000-000000000018'::uuid, 100, 100, 0, 'tres_rare', false),
    ('5b000000-0000-4000-8000-000000000019'::uuid, 120, 100, 20, 'touristique', false),
    ('5b000000-0000-4000-8000-000000000020'::uuid, 300, 100, 200, 'tres_rare', true),
    ('5b000000-0000-4000-8000-000000000021'::uuid, 200, 100, 100, 'isole', true),
    ('5b000000-0000-4000-8000-000000000022'::uuid, 150, 100, 50, 'remarquable', false) $$,
  'points, base, bonus, catégorie et premier du pays pour chaque cas'
);
select results_eq(
  $$ select rule_key, label, detail, points from public.spot_point_lines
     where spot_id = '5b000000-0000-4000-8000-000000000012' order by position $$,
  $$ values ('base', 'Sticker publié', 'Points de base', 100),
            ('rarity', 'Lieu très rare', U&'4\202F362 m d''altitude', 200) $$,
  'Mont Blanc : base puis bonus de rareté, motif lisible'
);
select results_eq(
  $$ select rule_key, label, detail, points from public.spot_point_lines
     where spot_id = '5b000000-0000-4000-8000-000000000018' order by position $$,
  $$ values ('base', 'Sticker publié', 'Points de base', 100),
            ('rarity', 'Lieu très rare', U&'4\202F300 m d''altitude', 200),
            ('duplicate', 'Sticker voisin', 'Un autre sticker est à moins de 200 m : pas de bonus de rareté', -200) $$,
  'doublon : le bonus est annulé par une ligne négative'
);
select results_eq(
  $$ select spot_id, detail from public.spot_point_lines
     where rule_key = 'rarity' and spot_id in ('5b000000-0000-4000-8000-000000000015',
       '5b000000-0000-4000-8000-000000000016', '5b000000-0000-4000-8000-000000000017',
       '5b000000-0000-4000-8000-000000000019', '5b000000-0000-4000-8000-000000000022')
     order by spot_id $$,
  $$ values ('5b000000-0000-4000-8000-000000000015'::uuid, 'Pays rare : Bhoutan'),
            ('5b000000-0000-4000-8000-000000000016'::uuid, 'Pays très rare : Corée du Nord'),
            ('5b000000-0000-4000-8000-000000000017'::uuid, 'En mer ou hors de tout pays'),
            ('5b000000-0000-4000-8000-000000000019'::uuid, 'Site touristique ou historique à proximité'),
            ('5b000000-0000-4000-8000-000000000022'::uuid, 'Catégorie choisie par la modération') $$,
  'motifs : pays rare, très rare, en mer, touristique, choix de la modération'
);
select matches(
  (select detail from public.spot_point_lines
   where spot_id = '5b000000-0000-4000-8000-000000000020' and rule_key = 'rarity'),
  '^\d+ km de la ville la plus proche \(.+\)$',
  'Tibesti : très rare par la distance à la ville la plus proche, nommée'
);
select results_eq(
  $$ select rule_key, points from public.spot_point_lines
     where spot_id = '5b000000-0000-4000-8000-000000000011' order by position $$,
  $$ values ('base', 100), ('rarity', 0) $$,
  'lieu courant à 120 m d''un autre : pas de ligne doublon quand il n''y a pas de bonus'
);
select is(
  (select count(*)::int from public.spots s
   where s.points_total <> (select coalesce(sum(l.points), 0) from public.spot_point_lines l where l.spot_id = s.id)),
  0,
  'pour chaque sticker, la somme des lignes vaut points_total'
);
select ok(
  (select points_total = 100 from public.spots where id = '5b000000-0000-4000-8000-000000000004')
  and exists (select 1 from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000004'),
  'un sticker en attente est calculé quand même'
);
select is(
  (select count(*)::int from public.spots where public_location::text <> location::text),
  0,
  'la position publique est toujours la position exacte (plus de domicile)'
);

-- Journal de points ----------------------------------------------------------------------

select is(
  (select coalesce(sum(points), 0)::int from public.points_ledger where user_id = 'a4000000-0000-4000-8000-000000000001'),
  (select sum(points_total)::int from public.spots
   where author_id = 'a4000000-0000-4000-8000-000000000001' and status = 'published'),
  'journal de A : somme = points de ses stickers publiés'
);
select is(
  (select count(*)::int from public.points_ledger
   where spot_id in ('5b000000-0000-4000-8000-000000000004', '5b000000-0000-4000-8000-000000000005',
                     '5b000000-0000-4000-8000-000000000006')),
  0,
  'les stickers en attente ou masqués n''écrivent rien au journal'
);
select results_eq(
  $$ select year, kind, base_points, rarity_bonus, points, reason from public.points_ledger
     where spot_id = '5b000000-0000-4000-8000-000000000015' $$,
  $$ values (2026, 'spot', 100, 100, 200, 'Calcul des points') $$,
  'une ligne de journal par sticker publié, avec base, bonus, édition et motif'
);

-- Recalcul : mêmes points tant que le barème ne change pas ; barème changé : points figés
-- jusqu'au recalcul explicite, et une ligne d'écart au journal.
select is(public.recompute_all_points('Test'), (select count(*)::int from public.spots),
  'recompute_all_points recalcule tous les stickers');
select results_eq(
  $$ select points_total from public.spots
     where id in ('5b000000-0000-4000-8000-000000000011', '5b000000-0000-4000-8000-000000000012',
                  '5b000000-0000-4000-8000-000000000018', '5b000000-0000-4000-8000-000000000022')
     order by id $$,
  $$ values (100), (300), (100), (150) $$,
  'après recalcul complet, les points sont inchangés (un sticker postérieur ne compte pas)'
);
select is(
  (select count(*)::int from public.points_ledger where spot_id = '5b000000-0000-4000-8000-000000000015'),
  1,
  'un recalcul sans changement n''ajoute rien au journal'
);
select is(
  (select count(*)::int from public.spot_point_lines
   where spot_id = '5b000000-0000-4000-8000-000000000012' and rule_key = 'duplicate'),
  0,
  'le Mont Blanc ne prend pas le doublon du sticker posé après lui à 100 m'
);
update public.scoring_rules set value = 120 where key = 'bonus_isole';
select is(
  (select points_total from public.spots where id = '5b000000-0000-4000-8000-000000000015'),
  200,
  'changer le barème ne modifie pas les points figés'
);
select is(public.compute_spot_points('5b000000-0000-4000-8000-000000000015', 'Nouveau bonus'), 220,
  'le recalcul explicite applique le nouveau barème');
select results_eq(
  $$ select points, rarity_bonus, reason from public.points_ledger
     where spot_id = '5b000000-0000-4000-8000-000000000015' order by id desc limit 1 $$,
  $$ values (20, 20, 'Nouveau bonus') $$,
  'le journal reçoit l''écart, avec le motif du recalcul'
);
update public.scoring_rules set value = 100 where key = 'bonus_isole';
do $$ begin perform public.compute_spot_points('5b000000-0000-4000-8000-000000000015'); end $$;

select throws_ok(
  $$ select public.compute_spot_points('5b000000-0000-4000-8000-0000000000ff') $$,
  'P0002', null,
  'compute_spot_points refuse un sticker inconnu'
);

-- Éditions : nom par défaut, couleur figée pour une édition passée qui a des stickers.
reset role;
select is((select name from public.seasons where year = 2025), 'Édition 2025', 'nom d''édition par défaut');
do $$ begin
  perform pg_temp.spot('5b000000-0000-4000-8000-000000000023', 'a4000000-0000-4000-8000-000000000002',
    'Colisée', pg_temp.pt(41.8902, 12.4922), '2024-06-01 10:00+00', 'Rome');
end $$;
select throws_ok(
  $$ update public.seasons set color_hex = '#123456' where year = 2024 $$,
  'ST805', null, 'la couleur d''une édition passée qui a des stickers est figée'
);
select lives_ok(
  $$ update public.seasons set color_hex = '#5B8DEE' where year = 2026 $$,
  'la couleur de l''édition en cours reste modifiable'
);
update public.seasons set color_hex = '#5B8DEF' where year = 2026;
select lives_ok(
  $$ update public.seasons set color_hex = '#FF7A5A' where year = 2025 $$,
  'une édition passée sans sticker garde une couleur modifiable'
);
update public.seasons set color_hex = '#FF7A59' where year = 2025;
select throws_ok(
  $$ delete from public.seasons where year = 2024 $$,
  'ST806', null, 'une édition qui a des stickers ne se supprime pas'
);
select throws_ok(
  $$ update public.seasons set status = 'archived' where year = 2026 $$,
  '23514', null, 'l''édition en cours ne peut pas être archivée'
);

-- Visiteur (anon) ----------------------------------------------------------------------

select is((select count(*)::int from public.public_spots where id::text like '5b000000-%'), 16,
  '16 stickers de test publiés');

set local role anon;
select pg_temp.logout();

select throws_ok($$ select * from public.spots $$, '42501', null, 'un visiteur ne lit pas la table spots');
select results_eq(
  $$ select id from public.public_spots where id::text like '5b000000-%' order by id $$,
  $$ values ('5b000000-0000-4000-8000-000000000001'::uuid), ('5b000000-0000-4000-8000-000000000002'::uuid), ('5b000000-0000-4000-8000-000000000003'::uuid), ('5b000000-0000-4000-8000-000000000011'::uuid), ('5b000000-0000-4000-8000-000000000012'::uuid), ('5b000000-0000-4000-8000-000000000013'::uuid), ('5b000000-0000-4000-8000-000000000014'::uuid), ('5b000000-0000-4000-8000-000000000015'::uuid), ('5b000000-0000-4000-8000-000000000016'::uuid), ('5b000000-0000-4000-8000-000000000017'::uuid), ('5b000000-0000-4000-8000-000000000018'::uuid), ('5b000000-0000-4000-8000-000000000019'::uuid), ('5b000000-0000-4000-8000-000000000020'::uuid), ('5b000000-0000-4000-8000-000000000021'::uuid), ('5b000000-0000-4000-8000-000000000022'::uuid), ('5b000000-0000-4000-8000-000000000023'::uuid) $$,
  'public_spots : seulement les stickers publiés (ni en attente, ni masqués)'
);
select results_eq(
  $$ select author_username, color_hex, country_name_fr, country_tier::text, points_total,
            rarity_category::text, edition_name
     from public.public_spots where id = '5b000000-0000-4000-8000-000000000015' $$,
  $$ values ('alice_4', '#5B8DEF', 'Bhoutan', 'rare', 200, 'isole', 'Édition 2026') $$,
  'public_spots : auteur, couleur et nom de l''édition, pays, points et catégorie'
);
select ok(
  (select extensions.st_distance(pg_temp.pt(lat, lng), pg_temp.near(pg_temp.pt(48.8566, 2.3522), 120, 90)) < 1
   from public.public_spots where id = '5b000000-0000-4000-8000-000000000011'),
  'public_spots : la position publique est la position exacte'
);
select is(
  (select count(*)::int from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000018'),
  3,
  'un visiteur lit le détail des points d''un sticker publié'
);
select is(
  (select count(*)::int from public.spot_point_lines
   where spot_id in ('5b000000-0000-4000-8000-000000000004', '5b000000-0000-4000-8000-000000000005',
                     '5b000000-0000-4000-8000-000000000006')),
  0,
  'un visiteur ne lit pas le détail des stickers en attente ou masqués'
);
select is((select count(*)::int from public.seasons), 3, 'un visiteur lit les saisons');
select ok((select count(*) from public.countries) >= 230, 'un visiteur lit les pays');
select is((select count(*)::int from public.scoring_rules), 16, 'un visiteur lit le barème');
select throws_ok($$ select * from public.points_ledger $$, '42501', null, 'un visiteur ne lit pas le journal de points');
select ok((select count(*) from public.cities) > 20000, 'un visiteur lit les villes');
select is(public.year_color(2025), '#FF7A59', 'year_color : couleur de la saison');
select is(public.year_color(2031), '#9A9A94', 'year_color : gris pour une année sans saison');
select results_eq($$ select * from public.current_season() $$, $$ values (2026, '#5B8DEF') $$,
  'current_season : la saison courante');
select throws_ok($$ insert into public.seasons (year, color_hex) values (2030, '#000000') $$,
  '42501', null, 'un visiteur ne crée pas de saison');
select throws_ok($$ update public.countries set tier = 'extreme' where iso2 = 'FR' $$,
  '42501', null, 'un visiteur ne change pas le niveau d''un pays');
select throws_ok($$ update public.scoring_rules set value = 1000 where key = 'base_points' $$,
  '42501', null, 'un visiteur ne change pas le barème');
select throws_ok($$ select * from public.spot_reports $$, '42501', null, 'un visiteur ne lit pas les signalements');
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id) values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000007') $$,
  '42501', null, 'un visiteur ne signale pas');
select throws_ok($$ select * from public.admin_audit_log $$, '42501', null, 'un visiteur ne lit pas le journal admin');
select throws_ok(
  $$ select public.compute_spot_points('5b000000-0000-4000-8000-000000000014') $$,
  '42501', null, 'un visiteur ne lance pas de calcul de points');

-- Utilisateur A (auteur) ------------------------------------------------------------

set local role authenticated;
select pg_temp.login('a4000000-0000-4000-8000-000000000001');

select results_eq(
  $$ select id from public.spots order by id $$,
  $$ values ('5b000000-0000-4000-8000-000000000006'::uuid), ('5b000000-0000-4000-8000-000000000011'::uuid),
            ('5b000000-0000-4000-8000-000000000013'::uuid), ('5b000000-0000-4000-8000-000000000014'::uuid),
            ('5b000000-0000-4000-8000-000000000015'::uuid), ('5b000000-0000-4000-8000-000000000016'::uuid),
            ('5b000000-0000-4000-8000-000000000017'::uuid), ('5b000000-0000-4000-8000-000000000019'::uuid) $$,
  'A lit tous ses stickers dans la table (y compris en attente), et seulement les siens'
);
select ok(
  (select extensions.st_distance(location, pg_temp.near(pg_temp.pt(48.8566, 2.3522), 120, 90)) < 1
   from public.spots where id = '5b000000-0000-4000-8000-000000000011'),
  'A lit la position exacte de son sticker'
);
select ok(
  (select count(*) from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000006') > 0,
  'A lit le détail de son sticker en attente'
);
select is(
  (select count(*)::int from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000004'),
  0,
  'A ne lit pas le détail du sticker en attente de B'
);
select lives_ok(
  $$ update public.spots set name = 'Rue de Rivoli, côté Louvre' where id = '5b000000-0000-4000-8000-000000000011' $$,
  'A renomme son sticker'
);
select is(
  (select name from public.spots where id = '5b000000-0000-4000-8000-000000000011'),
  'Rue de Rivoli, côté Louvre',
  'le nouveau nom est enregistré'
);
select throws_ok(
  $$ update public.spots set points_total = 9999 where id = '5b000000-0000-4000-8000-000000000011' $$,
  '42501', null, 'A ne peut pas modifier points_total');
select throws_ok(
  $$ update public.spots set status = 'published' where id = '5b000000-0000-4000-8000-000000000006' $$,
  '42501', null, 'A ne peut pas modifier status');
select throws_ok(
  $$ update public.spots set is_first_in_country = true where id = '5b000000-0000-4000-8000-000000000011' $$,
  '42501', null, 'A ne peut pas modifier is_first_in_country');
select throws_ok(
  $$ update public.spots set is_exceptional = true where id = '5b000000-0000-4000-8000-000000000011' $$,
  '42501', null, 'A ne peut pas cocher lieu exceptionnel');
select throws_ok(
  $$ update public.spots set location = public_location where id = '5b000000-0000-4000-8000-000000000011' $$,
  '42501', null, 'A ne peut pas déplacer son sticker');
select throws_ok(
  $$ insert into public.spots (author_id, name, location, public_location, taken_at, year, gps_source,
       date_source, photo_path, status, points_total)
     values ('a4000000-0000-4000-8000-000000000001', 'Triche', 'POINT(0 0)', 'POINT(0 0)', now(), 2026,
       'exif', 'exif', 'a4000000-0000-4000-8000-000000000001/x.webp', 'published', 500) $$,
  '42501', null, 'A ne peut pas insérer de sticker (seule publish-spot le fait)');
select throws_ok(
  $$ insert into public.spot_point_lines (spot_id, rule_key, position, label, points)
     values ('5b000000-0000-4000-8000-000000000011', 'bonus', 9, 'Bonus', 100) $$,
  '42501', null, 'A ne peut pas écrire dans spot_point_lines');
select throws_ok(
  $$ update public.spot_point_lines set points = 100 where spot_id = '5b000000-0000-4000-8000-000000000011' $$,
  '42501', null, 'A ne peut pas modifier spot_point_lines');
select throws_ok(
  $$ delete from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000011' $$,
  '42501', null, 'A ne peut pas effacer le malus de spot_point_lines');
update public.spots set name = 'Piraté' where id = '5b000000-0000-4000-8000-000000000001';
delete from public.spots where id = '5b000000-0000-4000-8000-000000000001';
select is(
  (select name from public.public_spots where id = '5b000000-0000-4000-8000-000000000001'),
  'Tour Saint-Jacques',
  'A ne peut ni renommer ni supprimer le sticker de B'
);
select throws_ok(
  $$ select public.compute_spot_points('5b000000-0000-4000-8000-000000000011') $$,
  '42501', null, 'A ne peut pas relancer le calcul de ses points');
select ok(
  (select count(*) from public.points_ledger) > 0
  and not exists (select 1 from public.points_ledger where user_id <> 'a4000000-0000-4000-8000-000000000001'),
  'A lit son journal de points, et seulement le sien'
);
select throws_ok(
  $$ insert into public.points_ledger (user_id, kind, points, reason)
     values ('a4000000-0000-4000-8000-000000000001', 'correction', 1000, 'Triche') $$,
  '42501', null, 'A n''écrit pas dans le journal de points');
select throws_ok($$ insert into public.seasons (year, color_hex) values (2030, '#000000') $$,
  '42501', null, 'A ne crée pas de saison');
update public.seasons set color_hex = '#000000' where year = 2026;
update public.countries set tier = 'extreme' where iso2 = 'FR';
update public.scoring_rules set value = 1000 where key = 'base_points';
select ok(
  public.year_color(2026) = '#5B8DEF'
  and (select tier from public.countries where iso2 = 'FR') = 'courant'
  and (select value from public.scoring_rules where key = 'base_points') = 100,
  'A ne modifie ni les saisons, ni les pays, ni le barème'
);
select throws_ok($$ update public.countries set geom = geom where iso2 = 'FR' $$,
  '42501', null, 'personne ne modifie les frontières par l''API');
select is((select count(*)::int from public.admin_audit_log), 0, 'A ne voit pas le journal admin');
select throws_ok(
  $$ insert into public.admin_audit_log (action) values ('faux') $$,
  '42501', null, 'A n''écrit pas dans le journal admin');
select lives_ok(
  $$ delete from public.spots where id = '5b000000-0000-4000-8000-000000000006' $$,
  'A supprime son sticker'
);
select is(
  (select count(*)::int from public.spots where id = '5b000000-0000-4000-8000-000000000006'),
  0,
  'le sticker supprimé a disparu'
);

-- Modérateur -----------------------------------------------------------------------------

reset role;
insert into public.admin_audit_log (actor_id, action, target, before, after)
values ('a4000000-0000-4000-8000-000000000005', 'season.set', '2026', '{"color_hex": "#FF7A59"}', '{"color_hex": "#5B8DEF"}');
set local role authenticated;
select pg_temp.login('a4000000-0000-4000-8000-000000000004');

select is(
  (select count(*)::int from public.spots where id::text like '5b000000-%'),
  18,
  'le modérateur lit tous les stickers, en attente et masqués compris'
);
select ok(
  (select location is not null from public.spots where id = '5b000000-0000-4000-8000-000000000004'),
  'le modérateur lit la position exacte'
);
select ok(
  (select count(*) from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000004') > 0,
  'le modérateur lit le détail d''un sticker en attente'
);
select throws_ok(
  $$ update public.spots set status = 'published' where id = '5b000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'le modérateur ne change pas le statut en direct (fonctions admin, étape 8)');
select throws_ok(
  $$ update public.spots set is_exceptional = true where id = '5b000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'le modérateur ne coche pas lieu exceptionnel en direct');
select throws_ok($$ insert into public.seasons (year, color_hex) values (2030, '#000000') $$,
  '42501', null, 'le modérateur ne crée pas de saison');
select is((select count(*)::int from public.admin_audit_log), 0, 'le modérateur ne lit pas le journal admin');
select throws_ok(
  $$ select public.compute_spot_points('5b000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'le modérateur ne lance pas de calcul en direct');

-- Admin ----------------------------------------------------------------------------------

select pg_temp.login('a4000000-0000-4000-8000-000000000005');

select is((select count(*)::int from public.admin_audit_log), 1, 'l''admin lit le journal admin');
select throws_ok(
  $$ insert into public.admin_audit_log (action) values ('faux') $$,
  '42501', null, 'l''admin n''écrit pas dans le journal en direct');
select lives_ok(
  $$ insert into public.seasons (year, color_hex) values (2027, '#7A4FD8') $$,
  'l''admin crée une saison'
);
select lives_ok(
  $$ update public.seasons set color_hex = '#5B8DEE' where year = 2026 $$,
  'l''admin change la couleur d''une saison'
);
select throws_ok(
  $$ update public.seasons set is_current = true where year = 2027 $$,
  '23505', null, 'une seule saison courante à la fois'
);
select lives_ok(
  $$ update public.countries set tier = 'rare' where iso2 = 'IS' $$,
  'l''admin change le niveau d''un pays'
);
select lives_ok(
  $$ update public.scoring_rules set value = 55 where key = 'bonus_remarquable' $$,
  'l''admin change une valeur du barème'
);
select results_eq(
  $$ select public.year_color(2026), public.year_color(2027),
            (select tier::text from public.countries where iso2 = 'IS'),
            (select value from public.scoring_rules where key = 'bonus_remarquable'),
            (select updated_by from public.scoring_rules where key = 'bonus_remarquable') $$,
  $$ values ('#5B8DEE', '#7A4FD8', 'rare', 55::numeric, 'a4000000-0000-4000-8000-000000000005'::uuid) $$,
  'les modifications de l''admin sont enregistrées, avec l''auteur du changement de barème'
);
select throws_ok(
  $$ delete from public.scoring_rules where key = 'bonus_remarquable' $$,
  '42501', null, 'l''admin ne supprime pas de règle du barème');
select throws_ok(
  $$ update public.spots set status = 'hidden' where id = '5b000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'l''admin ne change pas le statut en direct (fonctions admin, étape 8)');
select throws_ok(
  $$ insert into public.spot_point_lines (spot_id, rule_key, position, label, points)
     values ('5b000000-0000-4000-8000-000000000001', 'bonus', 9, 'Bonus', 100) $$,
  '42501', null, 'l''admin n''écrit pas dans spot_point_lines en direct');
select lives_ok(
  $$ delete from public.seasons where year = 2027 $$,
  'l''admin supprime une saison'
);

select ok(
  (select count(*) from public.points_ledger where user_id <> 'a4000000-0000-4000-8000-000000000005') > 0,
  'l''admin lit tout le journal de points'
);

-- current_season sans saison courante : l'année en cours, en gris.
reset role;
update public.seasons set is_current = false;
set local role anon;
select pg_temp.logout();
select results_eq(
  $$ select * from public.current_season() $$,
  $$ select extract(year from now())::int, '#9A9A94'::text $$,
  'current_season : sans saison courante, l''année en cours en gris'
);

-- Signalements ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.login('a4000000-0000-4000-8000-000000000007');
select lives_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id, reason)
     values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000007', 'Photo floue') $$,
  'R1 signale le sticker d''Ushuaïa'
);
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000007') $$,
  '23505', null, 'R1 ne signale pas deux fois le même sticker');
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000013', 'a4000000-0000-4000-8000-000000000008') $$,
  '42501', null, 'R1 ne signale pas au nom de R2');
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000007') $$,
  '42501', null, 'on ne signale pas un sticker non publié');
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id, created_at)
     values ('5b000000-0000-4000-8000-000000000013', 'a4000000-0000-4000-8000-000000000007', now() - interval '2 days') $$,
  '42501', null, 'on ne choisit pas la date d''un signalement');

select pg_temp.login('a4000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'A ne signale pas son propre sticker');
select is((select count(*)::int from public.spot_reports), 0, 'A ne lit pas les signalements des autres');

select pg_temp.login('a4000000-0000-4000-8000-000000000006');
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000006') $$,
  '42501', null, 'un compte suspendu ne signale pas');

select pg_temp.login('a4000000-0000-4000-8000-000000000008');
insert into public.spot_reports (spot_id, reporter_id)
values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000008');
select is(
  (select count(*)::int from public.public_spots where id = '5b000000-0000-4000-8000-000000000014'),
  1,
  'après 2 signalements, le sticker reste publié'
);

select pg_temp.login('a4000000-0000-4000-8000-000000000009');
select lives_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000014', 'a4000000-0000-4000-8000-000000000009') $$,
  'R3 signale à son tour'
);
select is(
  (select count(*)::int from public.public_spots where id = '5b000000-0000-4000-8000-000000000014'),
  0,
  'au 3e signalement distinct, le sticker quitte la carte publique'
);
select is((select count(*)::int from public.spot_reports), 1, 'R3 ne lit que son signalement');

select pg_temp.login('a4000000-0000-4000-8000-000000000004');
select results_eq(
  $$ select status::text, report_count from public.spots where id = '5b000000-0000-4000-8000-000000000014' $$,
  $$ values ('pending_review', 3) $$,
  'le sticker est passé en pending_review avec 3 signalements'
);

select is(
  (select count(*)::int from public.spot_reports where spot_id = '5b000000-0000-4000-8000-000000000014'),
  3,
  'le modérateur lit tous les signalements'
);

-- Limite quotidienne de signalements (abaissée à 2 pour le test).
reset role;
update public.scoring_rules set value = 2 where key = 'daily_report_limit';
set local role authenticated;
select pg_temp.login('a4000000-0000-4000-8000-000000000007');
select lives_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000013', 'a4000000-0000-4000-8000-000000000007') $$,
  'R1 signale un 2e sticker dans la journée'
);
select throws_ok(
  $$ insert into public.spot_reports (spot_id, reporter_id)
     values ('5b000000-0000-4000-8000-000000000012', 'a4000000-0000-4000-8000-000000000007') $$,
  'PT429', null, 'au-delà de daily_report_limit, le signalement est refusé'
);

-- Suppression : le détail et les signalements partent avec le sticker.
reset role;
select is(
  (select sum(points)::int from public.points_ledger where spot_id = '5b000000-0000-4000-8000-000000000014'),
  0,
  'en cours d''examen, ses points sont retirés au journal'
);
delete from public.spots where id = '5b000000-0000-4000-8000-000000000014';
select is(
  (select count(*)::int from public.spot_point_lines where spot_id = '5b000000-0000-4000-8000-000000000014')
  + (select count(*)::int from public.spot_reports where spot_id = '5b000000-0000-4000-8000-000000000014'),
  0,
  'supprimer un sticker supprime son détail et ses signalements'
);
select ok(
  (select count(*) from public.points_ledger where spot_id = '5b000000-0000-4000-8000-000000000014') >= 2
  and (select sum(points) from public.points_ledger where spot_id = '5b000000-0000-4000-8000-000000000014') = 0,
  'le journal garde la trace du sticker supprimé (ajout puis retrait)'
);
delete from public.spots where id = '5b000000-0000-4000-8000-000000000013';
select results_eq(
  $$ select points, reason from public.points_ledger
     where spot_id = '5b000000-0000-4000-8000-000000000013' order by id desc limit 1 $$,
  $$ values (-100, 'Suppression du sticker : Remparts') $$,
  'supprimer un sticker publié retire ses points au journal, avec le motif'
);

select * from finish();
rollback;
