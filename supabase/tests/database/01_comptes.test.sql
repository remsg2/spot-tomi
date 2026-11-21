-- Étape 3 : profils, rôles et pseudos réservés, testés pour chaque rôle
-- (visiteur, utilisateur A, utilisateur B, admin).
begin;
select plan(31);

-- Comptes de test (auth.users est géré par Supabase Auth en temps normal).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test');

-- Se connecter en tant qu'un utilisateur : rôle « authenticated » + identité.
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Structure -------------------------------------------------------------------

select has_table('public', 'profiles', 'la table profiles existe');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS activée sur profiles');
select has_view('public', 'public_profiles', 'la vue public_profiles existe');
select hasnt_column('public', 'public_profiles', 'role', 'la vue publique ne montre pas le rôle');
select hasnt_column('public', 'public_profiles', 'suspended_at', 'la vue publique ne montre pas la suspension');
select hasnt_table('private', 'user_homes', 'plus de table des domiciles (cahier des charges V1.1)');

-- Utilisateur A ---------------------------------------------------------------

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000a', 'tomi_fan') $$,
  'A crée son propre profil'
);
select throws_ok(
  $$ insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000b', 'usurpateur') $$,
  '42501', null,
  'A ne peut pas créer le profil de B'
);
select is(public.username_available('nouveau_pseudo'), true, 'un pseudo libre est disponible');
select is(public.username_available('ab'), false, 'un pseudo trop court est refusé');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null,
  'A ne peut pas se donner le rôle admin'
);
select throws_ok(
  $$ update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null,
  'A ne peut pas modifier sa suspension'
);
select lives_ok(
  $$ update public.profiles set username = 'Tomi_Fan', theme = 'dark' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'A modifie son pseudo et son thème'
);
select throws_ok(
  $$ update public.profiles set username = 'pas bon !' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null,
  'un pseudo invalide est refusé par la base'
);

-- Plus de domicile : les anciennes fonctions restent, sans effet (version précédente de l'app).
select lives_ok($$ select public.set_my_home(45.12345, 6.98765) $$, 'set_my_home ne fait plus rien, sans erreur');
select is((select count(*)::int from public.get_my_home()), 0, 'get_my_home ne renvoie plus rien');

-- Pseudos réservés.
select throws_ok(
  $$ update public.profiles set username = 'Admin' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'ST011', null,
  'un pseudo réservé est refusé'
);
select throws_ok(
  $$ update public.profiles set username = 'demo_lea2' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'ST011', null,
  'les pseudos demo_* sont réservés aux comptes de démo'
);
select is(public.username_available('moderateur'), false, 'un pseudo réservé n''est pas disponible');

-- Utilisateur B ---------------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$ insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000b', 'TOMI_FAN') $$,
  '23505', null,
  'le pseudo est unique sans tenir compte de la casse'
);
select is(public.username_available('tomi_fan'), false, 'un pseudo pris n''est pas disponible');
select lives_ok(
  $$ insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000b', 'bea') $$,
  'B crée son profil'
);
select is(
  (select count(*)::int from public.profiles),
  1,
  'B ne voit que son propre profil dans la table'
);
select is(
  (select count(*)::int from public.public_profiles),
  2,
  'B voit tous les pseudos dans la vue publique'
);
update public.profiles set username = 'pirate' where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select username from public.public_profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Tomi_Fan',
  'B ne peut pas modifier le profil de A'
);
select is(public.is_admin(), false, 'B n''est pas admin');

-- Visiteur --------------------------------------------------------------------

select pg_temp.logout();
set local role anon;

select throws_ok($$ select * from public.profiles $$, '42501', null, 'un visiteur ne lit pas la table profiles');
select is((select count(*)::int from public.public_profiles), 2, 'un visiteur lit la vue publique');
select throws_ok(
  $$ select public.set_my_home(1, 1) $$,
  '42501', null,
  'un visiteur n''appelle pas les anciennes fonctions du domicile'
);

-- Admin -----------------------------------------------------------------------

reset role;
insert into public.profiles (id, username, role)
  values ('00000000-0000-0000-0000-0000000000ad', 'chef', 'admin');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000ad');
select is(public.is_admin(), true, 'l''admin est reconnu par is_admin()');

-- Suppression du compte : tout part en cascade -----------------------------------

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'supprimer le compte supprime le profil'
);

select * from finish();
rollback;
