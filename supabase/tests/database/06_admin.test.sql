-- Étape 8 : fonctions admin, testées pour chaque rôle (visiteur, utilisateur,
-- modérateur, admin). Chaque action réussie doit écrire une ligne dans
-- admin_audit_log ; chaque refus ne doit rien changer.
begin;
select plan(176);

-- Comptes de test ------------------------------------------------------------------
-- U : utilisateur ; R1, R2 : auteurs de signalements ; M : modérateur ; A : admin ;
-- B : utilisateur promu admin à la fin.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000801', 'u8@example.test'),
  ('00000000-0000-0000-0000-000000000802', 'r1@example.test'),
  ('00000000-0000-0000-0000-000000000803', 'r2@example.test'),
  ('00000000-0000-0000-0000-000000000808', 'modo8@example.test'),
  ('00000000-0000-0000-0000-00000000080a', 'admin8@example.test'),
  ('00000000-0000-0000-0000-00000000080b', 'bis8@example.test');

insert into public.profiles (id, username, role) values
  ('00000000-0000-0000-0000-000000000801', 'etape8_user', 'user'),
  ('00000000-0000-0000-0000-000000000802', 'etape8_r1', 'user'),
  ('00000000-0000-0000-0000-000000000803', 'etape8_r2', 'user'),
  ('00000000-0000-0000-0000-000000000808', 'etape8_modo', 'moderator'),
  ('00000000-0000-0000-0000-00000000080a', 'etape8_admin', 'admin'),
  ('00000000-0000-0000-0000-00000000080b', 'etape8_bis', 'user');

-- A est le seul admin actif pendant le test (règle du dernier admin).
update public.profiles set role = 'user'
  where role = 'admin' and id <> '00000000-0000-0000-0000-00000000080a';

-- Pays et saisons : la France existe (données de l'étape 4) ; l'année 2019 n'a pas de couleur.
insert into public.countries (iso2, iso3, name_fr, tier, geom)
values ('FR', 'FRA', 'France', 'courant',
        extensions.st_geogfromtext('MULTIPOLYGON(((-5 41, 10 41, 10 51, -5 51, -5 41)))'))
on conflict do nothing;
delete from public.seasons where year in (2019, 2031, 2032);

create function pg_temp.make_spot(
  p_id uuid, p_name text, p_city text, p_lng float8, p_lat float8, p_year int,
  p_status public.spot_status, p_gps text, p_age interval
) returns void language sql as $$
  insert into public.spots (
    id, author_id, name, location, public_location, taken_at, year, gps_source, date_source,
    country_iso2, city, photo_path, status, created_at
  ) values (
    p_id, '00000000-0000-0000-0000-000000000801', p_name,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    make_timestamptz(p_year, 6, 1, 12, 0, 0, 'UTC'), p_year, p_gps, 'exif',
    'FR', p_city, '00000000-0000-0000-0000-000000000801/' || p_id || '.webp', p_status, now() - p_age
  )
$$;

-- S1 : sans GPS, en attente · S2 : publié, signalé 2 fois · S3 : publié en 2019 · S4 : à supprimer.
select pg_temp.make_spot('00000000-0000-0000-0000-0000000081a1', 'Tour Eiffel', 'Paris', 2.2945, 48.8584, 2026, 'pending_review', 'manual', '1 day');
select pg_temp.make_spot('00000000-0000-0000-0000-0000000081a2', 'Fourvière', 'Lyon', 4.8227, 45.7623, 2026, 'published', 'exif', '4 days');
select pg_temp.make_spot('00000000-0000-0000-0000-0000000081a3', 'Vieux-Port', 'Marseille', 5.3698, 43.2951, 2019, 'published', 'exif', '3 days');
select pg_temp.make_spot('00000000-0000-0000-0000-0000000081a4', 'Miroir d''eau', 'Bordeaux', -0.5698, 44.8412, 2026, 'published', 'exif', '2 days');
select public.compute_spot_points(id) from public.spots
  where id::text like '00000000-0000-0000-0000-0000000081a_';

insert into public.spot_reports (spot_id, reporter_id, reason) values
  ('00000000-0000-0000-0000-0000000081a2', '00000000-0000-0000-0000-000000000802', 'Photo floue'),
  ('00000000-0000-0000-0000-0000000081a2', '00000000-0000-0000-0000-000000000803', 'Pas un sticker');

-- Classement (étape 7) : si refresh_leaderboard n'existe pas encore, une version
-- factice compte ses appels.
create temp table refresh_calls (n int);
create temp table fake_refresh as
  select to_regprocedure('public.refresh_leaderboard()') is null as installed;
do $$
begin
  if (select installed from fake_refresh) then
    create function public.refresh_leaderboard() returns void language sql
      as 'insert into pg_temp.refresh_calls values (1)';
  end if;
end;
$$;

-- Outils -----------------------------------------------------------------------------
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Lectures de contrôle, quel que soit le rôle courant.
create function pg_temp.audit_count(p_action text, p_target text, p_actor uuid) returns int
language sql security definer as $$
  select count(*)::int from public.admin_audit_log
  where action = p_action and target = p_target and actor_id = p_actor
$$;
create function pg_temp.audit_last(p_action text, p_target text) returns public.admin_audit_log
language sql security definer as $$
  select * from public.admin_audit_log
  where action = p_action and target = p_target order by id desc limit 1
$$;
-- Lignes écrites depuis le début des refus (le seed ou d'autres étapes peuvent en avoir écrit avant).
create temp table audit_baseline as select coalesce(max(id), 0) as max_id from public.admin_audit_log;
create function pg_temp.audit_total() returns int language sql security definer as $$
  select count(*)::int from public.admin_audit_log
  where id > (select max_id from pg_temp.audit_baseline)
$$;
create function pg_temp.notice_title(p_user uuid, p_kind text) returns text language sql security definer as $$
  select title from public.user_notices where user_id = p_user and kind = p_kind order by id desc limit 1
$$;
create function pg_temp.spot(p_id uuid) returns public.spots language sql security definer as $$
  select * from public.spots where id = p_id
$$;
create function pg_temp.lines_sum(p_id uuid) returns int language sql security definer as $$
  select coalesce(sum(points), 0)::int from public.spot_point_lines where spot_id = p_id
$$;
create function pg_temp.is_public(p_id uuid) returns boolean language sql security definer as $$
  select exists (select 1 from public.public_spots where id = p_id)
$$;
-- Avec la fonction factice : au moins p_min appels ; avec celle de l'étape 7 : rien à compter.
create function pg_temp.leaderboard_refreshed(p_min int) returns boolean language sql security definer as $$
  select case when (select installed from pg_temp.fake_refresh)
    then (select count(*) from pg_temp.refresh_calls) >= p_min else true end
$$;

-- Un appel par fonction, avec des arguments valides : seul le rôle peut faire échouer.
create function pg_temp.calls(p_kind text) returns text[] language sql as $$
  select case p_kind
    when 'moderator' then array[
      $c$select * from public.admin_moderation_queue()$c$,
      $c$select * from public.admin_search_spots('Paris')$c$,
      $c$select public.admin_moderation_count()$c$,
      $c$select public.admin_validate_spot('00000000-0000-0000-0000-0000000081a1')$c$,
      $c$select public.admin_hide_spot('00000000-0000-0000-0000-0000000081a3')$c$,
      $c$select public.admin_unhide_spot('00000000-0000-0000-0000-0000000081a3')$c$,
      $c$select public.admin_delete_spot('00000000-0000-0000-0000-0000000081a4')$c$,
      $c$select public.admin_set_exceptional('00000000-0000-0000-0000-0000000081a3', true)$c$
    ]
    else array[
      $c$select public.admin_set_season(2031, '#5DB043', true)$c$,
      $c$select * from public.admin_missing_season_years()$c$,
      $c$select public.admin_set_rule('bonus_touristique', 16)$c$,
      $c$select public.admin_set_country_tier('FR', 'lointain')$c$,
      $c$select public.admin_recompute(null, 'Test des droits')$c$,
      $c$select public.admin_adjust_points('00000000-0000-0000-0000-000000000801', 10, 'Test des droits')$c$,
      $c$select public.admin_save_edition(2033, 'Édition 2033', '#5DB043')$c$,
      $c$select * from public.admin_recent_errors()$c$,
      $c$select * from public.admin_list_users()$c$,
      $c$select public.admin_set_role('00000000-0000-0000-0000-000000000801', 'moderator')$c$,
      $c$select public.admin_suspend('00000000-0000-0000-0000-000000000801', true)$c$,
      $c$select * from public.admin_audit_recent()$c$
    ]
  end
$$;
create function pg_temp.refused(p_calls text[], p_who text) returns setof text language plpgsql as $$
declare
  c text;
begin
  foreach c in array p_calls loop
    return next throws_ok(c, '42501', null, p_who || ' : refusé · ' || c);
  end loop;
end;
$$;

-- Structure et droits ------------------------------------------------------------------

select has_function('public', 'admin_set_season', array['integer', 'text', 'boolean'], 'admin_set_season existe');
select has_function('public', 'admin_recompute', array['uuid', 'text'], 'admin_recompute existe (motif obligatoire)');
select ok(
  not has_function_privilege('anon', 'public.admin_validate_spot(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_set_role(uuid, public.user_role)', 'execute'),
  'un visiteur n''a aucun droit d''exécution sur les fonctions admin'
);
select ok(
  pg_get_function_result('public.admin_list_users(text, integer)'::regprocedure) !~* '(email|home|domicile)',
  'la liste des utilisateurs ne contient ni email ni domicile'
);
select ok(public.schema_version() >= '20261126000000_admin', 'schema_version inclut la migration admin');

-- Contraste WCAG calculé en SQL.
select ok(abs(private.contrast_ratio('#000000', '#FFFFFF') - 21) < 1e-9, 'contraste noir sur blanc = 21');
select ok(abs(private.contrast_ratio('#5DB043', '#111111') - 6.9747) < 1e-4, 'contraste de #5DB043 sur #111111 ≈ 6,97');
select ok(private.contrast_ratio('#1D4ED8', '#111111') < 4.5, '#1D4ED8 est illisible sous du texte noir');

-- Visiteur : tout est refusé ------------------------------------------------------------

set local role anon;
select pg_temp.logout();
select * from pg_temp.refused(pg_temp.calls('moderator') || pg_temp.calls('admin'), 'visiteur');

-- Utilisateur : tout est refusé ---------------------------------------------------------

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000801');
select * from pg_temp.refused(pg_temp.calls('moderator') || pg_temp.calls('admin'), 'utilisateur');

-- Modérateur : la modération seulement ----------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-000000000808');
select * from pg_temp.refused(pg_temp.calls('admin'), 'modérateur');

select is(pg_temp.audit_total(), 0, 'aucun refus n''a écrit dans le journal');
select is((pg_temp.spot('00000000-0000-0000-0000-0000000081a1')).status::text, 'pending_review', 'aucun refus n''a modifié de sticker');

-- File de modération.
select ok(public.admin_moderation_count() >= 2, 'le badge compte le sticker en attente et le sticker signalé');
select is(
  (select count(*)::int from public.admin_moderation_queue()
    where id in ('00000000-0000-0000-0000-0000000081a1', '00000000-0000-0000-0000-0000000081a2')),
  2, 'la file contient le sticker en attente et le sticker signalé');
select is(
  (select count(*)::int from public.admin_moderation_queue() where id = '00000000-0000-0000-0000-0000000081a3'),
  0, 'un sticker publié non signalé n''est pas dans la file');
select is(
  (select report_count from public.admin_moderation_queue() where id = '00000000-0000-0000-0000-0000000081a2'),
  2, 'la file donne le nombre de signalements');
select is(
  (select array_agg(r ->> 'reason' order by r ->> 'reason')
     from public.admin_moderation_queue() q, jsonb_array_elements(q.reports) r
     where q.id = '00000000-0000-0000-0000-0000000081a2'),
  array['Pas un sticker', 'Photo floue'], 'la file donne les raisons des signalements');
select ok(
  (select abs(lat - 48.8584) < 1e-9 and abs(lng - 2.2945) < 1e-9 from public.admin_moderation_queue()
    where id = '00000000-0000-0000-0000-0000000081a1'),
  'la file donne la position exacte aux modérateurs');
select is(
  (select count(*)::int from public.admin_search_spots('marseille') where id = '00000000-0000-0000-0000-0000000081a3'),
  1, 'recherche d''un sticker par ville');
select is(
  (select count(*)::int from public.admin_search_spots('https://spot-tomi.vercel.app/spots/00000000-0000-0000-0000-0000000081A3')
    where id = '00000000-0000-0000-0000-0000000081a3'),
  1, 'recherche d''un sticker par son lien');
select is((select count(*)::int from public.admin_search_spots('   ')), 0, 'une recherche vide ne renvoie rien');

-- Valider un sticker en attente : publié, points calculés, journalisé.
select lives_ok($$ select public.admin_validate_spot('00000000-0000-0000-0000-0000000081a1') $$, 'le modérateur valide le sticker en attente');
select is((pg_temp.spot('00000000-0000-0000-0000-0000000081a1')).status::text, 'published', 'le sticker validé est publié');
select ok((pg_temp.spot('00000000-0000-0000-0000-0000000081a1')).points_total > 0, 'ses points sont calculés');
select is(
  (pg_temp.spot('00000000-0000-0000-0000-0000000081a1')).points_total,
  pg_temp.lines_sum('00000000-0000-0000-0000-0000000081a1'),
  'le total est la somme des lignes de détail');
select ok(pg_temp.is_public('00000000-0000-0000-0000-0000000081a1'), 'le sticker validé apparaît dans public_spots');
select is(pg_temp.audit_count('spot.validate', 'spot:00000000-0000-0000-0000-0000000081a1', '00000000-0000-0000-0000-000000000808'),
  1, 'valider écrit une ligne dans le journal (auteur = modérateur)');
select is((pg_temp.audit_last('spot.validate', 'spot:00000000-0000-0000-0000-0000000081a1')).before ->> 'status',
  'pending_review', 'le journal garde le statut d''avant');

-- Valider un sticker signalé : signalements classés.
select lives_ok($$ select public.admin_validate_spot('00000000-0000-0000-0000-0000000081a2') $$, 'le modérateur valide le sticker signalé');
select is((pg_temp.spot('00000000-0000-0000-0000-0000000081a2')).report_count, 0, 'ses signalements sont classés');
select is(
  jsonb_array_length((pg_temp.audit_last('spot.validate', 'spot:00000000-0000-0000-0000-0000000081a2')).before -> 'reports'),
  2, 'le journal garde les signalements classés');
select is(
  (select count(*)::int from public.admin_moderation_queue() where id = '00000000-0000-0000-0000-0000000081a2'),
  0, 'le sticker validé quitte la file');

-- Masquer puis démasquer.
select lives_ok($$ select public.admin_hide_spot('00000000-0000-0000-0000-0000000081a3') $$, 'le modérateur masque un sticker');
select is((pg_temp.spot('00000000-0000-0000-0000-0000000081a3')).status::text, 'hidden', 'le sticker masqué a le statut hidden');
select ok(not pg_temp.is_public('00000000-0000-0000-0000-0000000081a3'), 'masquer retire le sticker de public_spots');
select is(pg_temp.audit_count('spot.hide', 'spot:00000000-0000-0000-0000-0000000081a3', '00000000-0000-0000-0000-000000000808'),
  1, 'masquer écrit une ligne dans le journal');
select throws_ok($$ select public.admin_hide_spot('00000000-0000-0000-0000-0000000081a3') $$, 'ST804', null, 'masquer deux fois est refusé');
select is(
  (select status::text from public.admin_moderation_queue() where id = '00000000-0000-0000-0000-0000000081a3'),
  'hidden', 'les stickers masqués restent listés pour pouvoir les démasquer');
select lives_ok($$ select public.admin_unhide_spot('00000000-0000-0000-0000-0000000081a3') $$, 'le modérateur démasque le sticker');
select is((pg_temp.spot('00000000-0000-0000-0000-0000000081a3')).status::text, 'published', 'démasquer rend le statut d''avant');
select ok(pg_temp.is_public('00000000-0000-0000-0000-0000000081a3'), 'le sticker démasqué revient dans public_spots');
select is(pg_temp.audit_count('spot.unhide', 'spot:00000000-0000-0000-0000-0000000081a3', '00000000-0000-0000-0000-000000000808'),
  1, 'démasquer écrit une ligne dans le journal');
select throws_ok($$ select public.admin_unhide_spot('00000000-0000-0000-0000-0000000081a3') $$, 'ST804', null, 'démasquer un sticker visible est refusé');

-- Site remarquable (ancien « lieu exceptionnel ») : catégorie choisie, recalcul.
select lives_ok($$ select public.admin_set_exceptional('00000000-0000-0000-0000-0000000081a3', true) $$, 'le modérateur marque un site remarquable');
select ok((pg_temp.spot('00000000-0000-0000-0000-0000000081a3')).is_exceptional, 'le sticker est remarquable');
select is((pg_temp.spot('00000000-0000-0000-0000-0000000081a3')).rarity_category::text, 'remarquable', 'sa catégorie de rareté est « remarquable »');
select ok(
  (pg_temp.spot('00000000-0000-0000-0000-0000000081a3')).points_total > ((pg_temp.audit_last('spot.rarity', 'spot:00000000-0000-0000-0000-0000000081a3')).before ->> 'points_total')::int,
  'marquer un site remarquable relance le calcul et ajoute le bonus');
select is(pg_temp.audit_count('spot.rarity', 'spot:00000000-0000-0000-0000-0000000081a3', '00000000-0000-0000-0000-000000000808'),
  1, 'marquer un site remarquable écrit une ligne dans le journal');
select throws_ok(
  $$ select public.admin_set_rarity('00000000-0000-0000-0000-0000000081a3', 'isole', '') $$,
  '22023', null, 'changer la catégorie demande un motif');

-- Supprimer.
select is(
  public.admin_delete_spot('00000000-0000-0000-0000-0000000081a4') ->> 'photo_path',
  '00000000-0000-0000-0000-000000000801/00000000-0000-0000-0000-0000000081a4.webp',
  'supprimer renvoie le chemin de la photo à effacer de Storage');
select ok((pg_temp.spot('00000000-0000-0000-0000-0000000081a4')).id is null, 'le sticker supprimé n''existe plus');
select is(pg_temp.audit_count('spot.delete', 'spot:00000000-0000-0000-0000-0000000081a4', '00000000-0000-0000-0000-000000000808'),
  1, 'supprimer écrit une ligne dans le journal');
select is((pg_temp.audit_last('spot.delete', 'spot:00000000-0000-0000-0000-0000000081a4')).before ->> 'name',
  'Miroir d''eau', 'le journal garde le sticker supprimé');
select throws_ok($$ select public.admin_validate_spot('00000000-0000-0000-0000-0000000081a4') $$, 'P0002', null, 'un sticker inexistant est signalé');

select ok(pg_temp.leaderboard_refreshed(4), 'le classement est rafraîchi après validation, masquage et suppression');

-- Admin : couleur de l'année ----------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000080a');

select throws_ok($$ select public.admin_set_season(2031, '#333333', true) $$, 'ST801', null, 'une couleur illisible (#333333) est refusée');
select throws_ok($$ select public.admin_set_season(2031, '#1D4ED8', true) $$, 'ST801', null, 'une couleur au contraste < 4,5:1 (#1D4ED8) est refusée');
select throws_ok($$ select public.admin_set_season(2031, 'vert', true) $$, '22023', null, 'une couleur mal écrite est refusée');
select throws_ok($$ select public.admin_set_season(1999, '#5DB043', true) $$, '22023', null, 'une année hors limites est refusée');
select is((select count(*)::int from public.seasons where year = 2031), 0, 'aucune saison n''est créée par un refus');

select lives_ok($$ select public.admin_set_season(2031, '#5db043', true) $$, 'l''admin choisit la couleur 2031');
select is((select color_hex from public.seasons where year = 2031), '#5DB043', 'la couleur est enregistrée en majuscules');
select is((select year from public.current_season()), 2031, '2031 devient la saison courante');
select is((select color_hex from public.current_season()), '#5DB043', 'current_season() renvoie la nouvelle couleur');
select is((select count(*)::int from public.seasons where is_current), 1, 'une seule saison courante');
select is(pg_temp.audit_count('season.set', 'season:2031', '00000000-0000-0000-0000-00000000080a'),
  1, 'choisir la couleur écrit une ligne dans le journal');

select lives_ok($$ select public.admin_set_season(2032, '#F2C230', true) $$, 'l''admin passe à la saison 2032');
select is((select count(*)::int from public.seasons where is_current), 1, 'toujours une seule saison courante');
select is((select is_current from public.seasons where year = 2031), false, 'l''ancienne saison n''est plus courante');
select lives_ok($$ select public.admin_set_season(2031, '#FF7A59', false) $$, 'l''admin corrige une ancienne année sans la rendre courante');
select is((select year from public.current_season()), 2032, 'la saison courante ne change pas');
select is((select color_hex from public.seasons where year = 2031), '#FF7A59', 'l''ancienne année garde sa nouvelle couleur');
select is(pg_temp.audit_count('season.set', 'season:2031', '00000000-0000-0000-0000-00000000080a'),
  2, 'chaque changement de couleur est journalisé');

select ok(
  (select spot_count >= 1 from public.admin_missing_season_years() where year = 2019),
  'les années de stickers sans couleur sont listées');
select is(
  (select count(*)::int from public.admin_missing_season_years() where year = 2031),
  0, 'une année qui a une couleur n''est pas en alerte');

-- Admin : barème --------------------------------------------------------------------------

select lives_ok($$ select public.admin_set_rule('bonus_touristique', 16) $$, 'l''admin modifie un bonus');
select is((select value from public.scoring_rules where key = 'bonus_touristique'), 16::numeric, 'le bonus est modifié');
select is((select updated_by from public.scoring_rules where key = 'bonus_touristique'),
  '00000000-0000-0000-0000-00000000080a'::uuid, 'l''auteur de la modification est enregistré');
select is(pg_temp.audit_count('rule.set', 'rule:bonus_touristique', '00000000-0000-0000-0000-00000000080a'),
  1, 'modifier une règle écrit une ligne dans le journal');
select throws_ok($$ select public.admin_set_rule('bonus_inconnu', 1) $$, 'P0002', null, 'une règle inconnue est refusée');
select throws_ok($$ select public.admin_set_rule('bonus_touristique', -1) $$, '22023', null, 'une valeur négative est refusée');
select throws_ok($$ select public.admin_set_rule('comment_max_length', 5) $$, '22023', null, 'un commentaire de moins de 10 caractères est refusé');

select lives_ok($$ select public.admin_set_country_tier('fr', 'rare') $$, 'l''admin change le niveau d''un pays');
select is((select tier::text from public.countries where iso2 = 'FR'), 'rare', 'le niveau du pays est modifié');
select is(pg_temp.audit_count('country.tier', 'country:FR', '00000000-0000-0000-0000-00000000080a'),
  1, 'changer un niveau de pays écrit une ligne dans le journal');
select throws_ok($$ select public.admin_set_country_tier('ZZ', 'rare') $$, 'P0002', null, 'un pays inconnu est refusé');

select throws_ok($$ select public.admin_recompute('00000000-0000-0000-0000-0000000081a1') $$, '22023', null,
  'un recalcul sans motif est refusé');
select is((public.admin_recompute('00000000-0000-0000-0000-0000000081a1', 'Contrôle') ->> 'count')::int, 1, 'recalcul d''un sticker');
select is(pg_temp.audit_count('points.recompute', 'spot:00000000-0000-0000-0000-0000000081a1', '00000000-0000-0000-0000-00000000080a'),
  1, 'le recalcul d''un sticker écrit une ligne dans le journal');
select ok((public.admin_recompute(null, 'Contrôle général') ->> 'count')::int >= 3, 'recalcul de tous les stickers');
select is(pg_temp.audit_count('points.recompute', 'spots:all', '00000000-0000-0000-0000-00000000080a'),
  1, 'le recalcul de tous les stickers écrit une ligne dans le journal');
select throws_ok($$ select public.admin_recompute('00000000-0000-0000-0000-0000000081ff', 'Contrôle') $$, 'P0002', null, 'recalcul d''un sticker inexistant refusé');

-- Admin : correction manuelle des points --------------------------------------------------------

select throws_ok($$ select public.admin_adjust_points('00000000-0000-0000-0000-000000000801', 50, '  ') $$, '22023', null,
  'une correction sans motif est refusée');
select lives_ok($$ select public.admin_adjust_points('00000000-0000-0000-0000-000000000801', -50, 'Doublon signalé') $$,
  'l''admin retire 50 points avec un motif');
select is(
  (select points from public.points_ledger where user_id = '00000000-0000-0000-0000-000000000801' and kind = 'correction'),
  -50, 'la correction est inscrite au journal de points');
select is(pg_temp.audit_count('points.adjust', 'user:00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-00000000080a'),
  1, 'la correction écrit une ligne dans le journal d''administration');
select is(
  pg_temp.notice_title('00000000-0000-0000-0000-000000000801', 'points_adjusted'),
  '-50 points', 'le membre est prévenu de la correction');

-- Admin : éditions -------------------------------------------------------------------------------

select lives_ok($$ select public.admin_save_edition(2033, 'Édition bleue', '#5B8DEF', 'active', false) $$, 'l''admin crée une édition');
select is((select name from public.seasons where year = 2033), 'Édition bleue', 'le nom de l''édition est enregistré');
select throws_ok($$ select public.admin_save_edition(2033, '', '#5B8DEF') $$, '22023', null, 'une édition sans nom est refusée');
select lives_ok($$ select public.admin_save_edition(2033, 'Édition bleue', '#5B8DEF', 'archived', false) $$, 'l''admin archive une édition');
select throws_ok($$ select public.admin_save_edition(2033, 'Édition bleue', '#5B8DEF', 'archived', true) $$, '22023', null,
  'une édition archivée ne peut pas être l''édition en cours');
select throws_ok($$ select public.admin_save_edition(2026, 'Édition 2026', '#5DB043') $$, 'ST805', null,
  'la couleur d''une édition passée qui a des stickers est figée');
select is(pg_temp.audit_count('edition.create', 'season:2033', '00000000-0000-0000-0000-00000000080a'),
  1, 'créer une édition écrit une ligne dans le journal');

-- Admin : rôles et suspension -----------------------------------------------------------

select is(
  (select spot_count from public.admin_list_users('etape8_user')), 3,
  'la liste des utilisateurs donne le nombre de stickers');
select is(
  (select role::text from public.admin_list_users('etape8_mo')), 'moderator',
  'la liste des utilisateurs donne le rôle');

select lives_ok($$ select public.admin_set_role('00000000-0000-0000-0000-000000000801', 'moderator') $$, 'l''admin nomme un modérateur');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000801'), 'moderator', 'le rôle est changé');
select is(pg_temp.audit_count('user.role', 'user:00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-00000000080a'),
  1, 'changer un rôle écrit une ligne dans le journal');
select throws_ok($$ select public.admin_set_role('00000000-0000-0000-0000-00000000080a', 'user') $$, 'ST802', null,
  'le dernier admin ne peut pas se retirer son rôle');
select throws_ok($$ select public.admin_suspend('00000000-0000-0000-0000-00000000080a', true) $$, 'ST803', null,
  'un admin ne peut pas suspendre son propre compte');
select throws_ok($$ select public.admin_set_role('00000000-0000-0000-0000-0000000008ff', 'user') $$, 'P0002', null,
  'un utilisateur inexistant est signalé');

select lives_ok($$ select public.admin_suspend('00000000-0000-0000-0000-000000000801', true) $$, 'l''admin suspend un compte');
select isnt((select suspended_at from public.profiles where id = '00000000-0000-0000-0000-000000000801'), null, 'le compte est suspendu');
select is(pg_temp.audit_count('user.suspend', 'user:00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-00000000080a'),
  1, 'suspendre écrit une ligne dans le journal');

-- Un modérateur suspendu perd ses droits.
select pg_temp.login('00000000-0000-0000-0000-000000000801');
select throws_ok($$ select public.admin_moderation_count() $$, '42501', null, 'un modérateur suspendu est refusé');

select pg_temp.login('00000000-0000-0000-0000-00000000080a');
select lives_ok($$ select public.admin_suspend('00000000-0000-0000-0000-000000000801', false) $$, 'l''admin lève la suspension');
select is((select suspended_at from public.profiles where id = '00000000-0000-0000-0000-000000000801'), null, 'le compte n''est plus suspendu');
select is(pg_temp.audit_count('user.unsuspend', 'user:00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-00000000080a'),
  1, 'lever la suspension écrit une ligne dans le journal');

-- Journal lisible par l'admin, avec le pseudo de l'auteur.
select ok(
  (select count(*) from public.admin_audit_recent(200) where actor_username = 'etape8_admin') >= 10,
  'l''admin lit le journal récent avec le pseudo des auteurs');
select is(
  (select count(*)::int from public.admin_audit_recent(200)
    where actor_username = 'etape8_modo' and action like 'spot.%'),
  6, 'le journal contient les 6 actions du modérateur');

-- Avec un second admin, le premier peut renoncer à son rôle.
select lives_ok($$ select public.admin_set_role('00000000-0000-0000-0000-00000000080b', 'admin') $$, 'l''admin nomme un second admin');
select lives_ok($$ select public.admin_set_role('00000000-0000-0000-0000-00000000080a', 'moderator') $$, 'l''admin renonce à son rôle');
select throws_ok($$ select public.admin_set_rule('bonus_first_city', 15) $$, '42501', null, 'l''ancien admin n''a plus accès au barème');
select lives_ok($$ select public.admin_moderation_count() $$, 'l''ancien admin, devenu modérateur, modère toujours');

-- Bilan : une ligne par action réussie.
reset role;
select is(
  (select count(*)::int from public.admin_audit_log
    where actor_id in ('00000000-0000-0000-0000-000000000808', '00000000-0000-0000-0000-00000000080a')
      and action in ('season.set', 'spot.validate', 'spot.hide', 'spot.unhide', 'spot.delete',
                     'spot.rarity', 'rule.set', 'country.tier', 'points.recompute', 'points.adjust',
                     'edition.create', 'edition.update', 'user.role', 'user.suspend', 'user.unsuspend')),
  21, 'chaque action réussie a écrit exactement une ligne dans admin_audit_log');

select * from finish();
rollback;
