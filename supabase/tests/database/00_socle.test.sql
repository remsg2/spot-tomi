begin;
select plan(7);

select has_extension('postgis', 'PostGIS est installé');
select has_schema('private', 'le schéma private existe');

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'un visiteur (anon) ne peut pas utiliser le schéma private'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'un utilisateur connecté ne peut pas utiliser le schéma private'
);
select ok(
  has_schema_privilege('service_role', 'private', 'usage'),
  'service_role peut utiliser le schéma private'
);

select has_function('public', 'schema_version', 'la fonction schema_version existe');

set local role anon;
select matches(public.schema_version(), '^\d{14}_', 'anon peut lire la version du schéma');
reset role;

select * from finish();
rollback;
