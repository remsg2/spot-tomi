-- Générateur de stickers de démo, chargé après seed.sql (local) ou par le workflow
-- « Données de démo » (projets hébergés). Comptes et stickers reconnaissables à
-- leur identifiant d'auteur « de300000-0000-4000-8000-… » : voir clear.sql.

-- Stickers de démo -----------------------------------------------------------------
-- Crée (une seule fois) 8 comptes demo_* avec profil, puis n stickers répartis dans le
-- monde autour de lieux réels (surtout en France et en Europe), datés de 2025 à
-- aujourd'hui (édition de l'année du collage), et calcule leurs points du plus ancien au
-- plus récent. Environ 1 % masqués, 2 % de sites remarquables, 3 % « à vérifier »
-- (position à la main), 10 % près d'un site touristique, un quart avec un commentaire.
-- Réservée au propriétaire de la base (postgres) : jamais exposée par l'API.

create or replace function public.seed_demo_spots(n int default 100)
returns int
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_users uuid[];
  v_ids uuid[];
  v_id uuid;
begin
  if n is null or n < 0 then
    raise exception 'Nombre de stickers invalide : %', n using errcode = '22023';
  end if;

  -- Comptes de démo (auth.users est géré par Supabase Auth en temps normal).
  create temporary table if not exists pg_temp.demo_users (
    id uuid primary key, username text
  ) on commit drop;
  insert into pg_temp.demo_users values
    ('de300000-0000-4000-8000-000000000001', 'demo_lea'),
    ('de300000-0000-4000-8000-000000000002', 'demo_remi'),
    ('de300000-0000-4000-8000-000000000003', 'demo_hugo'),
    ('de300000-0000-4000-8000-000000000004', 'demo_camille'),
    ('de300000-0000-4000-8000-000000000005', 'demo_pierre'),
    ('de300000-0000-4000-8000-000000000006', 'demo_ines'),
    ('de300000-0000-4000-8000-000000000007', 'demo_malo'),
    ('de300000-0000-4000-8000-000000000008', 'demo_zoe')
  on conflict (id) do nothing;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated',
    d.username || '@demo.spot-tomi.test', now(), now()
  from pg_temp.demo_users d
  on conflict (id) do nothing;

  insert into public.profiles (id, username)
  select d.id, d.username from pg_temp.demo_users d
  on conflict (id) do nothing;

  select array_agg(d.id order by d.id) into v_users from pg_temp.demo_users d;

  with anchors (city, lat, lng, alt, weight) as (values
    -- France
    ('Paris', 48.8566, 2.3522, 35, 30), ('Lyon', 45.7640, 4.8357, 170, 12),
    ('Marseille', 43.2965, 5.3698, 12, 10), ('Bordeaux', 44.8378, -0.5792, 15, 8),
    ('Nantes', 47.2184, -1.5536, 20, 8), ('Lille', 50.6292, 3.0573, 25, 7),
    ('Toulouse', 43.6047, 1.4442, 145, 7), ('Brest', 48.3904, -4.4861, 50, 4),
    ('Strasbourg', 48.5734, 7.7521, 140, 5), ('Nice', 43.7102, 7.2620, 10, 5),
    ('Chamonix-Mont-Blanc', 45.9237, 6.8694, 1035, 3), ('Ajaccio', 41.9192, 8.7386, 20, 2),
    ('Biarritz', 43.4832, -1.5586, 30, 2), ('Rennes', 48.1173, -1.6778, 40, 4),
    -- Europe
    ('Londres', 51.5072, -0.1276, 20, 6), ('Bruxelles', 50.8503, 4.3517, 60, 4),
    ('Amsterdam', 52.3676, 4.9041, 0, 4), ('Berlin', 52.5200, 13.4050, 35, 4),
    ('Barcelone', 41.3874, 2.1686, 15, 5), ('Madrid', 40.4168, -3.7038, 650, 3),
    ('Lisbonne', 38.7223, -9.1393, 50, 4), ('Rome', 41.9028, 12.4964, 20, 4),
    ('Venise', 45.4408, 12.3155, 1, 2), ('Genève', 46.2044, 6.1432, 375, 3),
    ('Zermatt', 46.0207, 7.7491, 1608, 1), ('Vienne', 48.2082, 16.3738, 190, 2),
    ('Prague', 50.0755, 14.4378, 200, 2), ('Cracovie', 50.0647, 19.9450, 220, 1),
    ('Copenhague', 55.6761, 12.5683, 5, 2), ('Stockholm', 59.3293, 18.0686, 25, 1),
    ('Oslo', 59.9139, 10.7522, 20, 1), ('Reykjavik', 64.1466, -21.9426, 15, 1),
    ('Dublin', 53.3498, -6.2603, 20, 2), ('Édimbourg', 55.9533, -3.1883, 50, 1),
    ('Dubrovnik', 42.6507, 18.0944, 10, 1), ('Athènes', 37.9838, 23.7275, 70, 2),
    ('Istanbul', 41.0082, 28.9784, 40, 1),
    -- Afrique et Moyen-Orient
    ('Marrakech', 31.6295, -7.9811, 470, 2), ('Dakar', 14.7167, -17.4677, 20, 1),
    ('Le Caire', 30.0444, 31.2357, 25, 1), ('Nairobi', -1.2921, 36.8219, 1700, 1),
    ('Le Cap', -33.9249, 18.4241, 20, 1), ('Zanzibar', -6.1659, 39.2026, 10, 1),
    ('Moshi', -3.3349, 37.3404, 900, 1), ('Dubaï', 25.2048, 55.2708, 5, 1),
    ('Thimphou', 27.4728, 89.6390, 2330, 1),
    -- Asie et Océanie
    ('Tokyo', 35.6762, 139.6503, 40, 2), ('Kyoto', 35.0116, 135.7681, 50, 1),
    ('Séoul', 37.5665, 126.9780, 40, 1), ('Bangkok', 13.7563, 100.5018, 5, 1),
    ('Hanoï', 21.0278, 105.8342, 15, 1), ('Bali', -8.4095, 115.1889, 50, 1),
    ('Katmandou', 27.7172, 85.3240, 1400, 1), ('Namche Bazar', 27.8069, 86.7140, 3440, 1),
    ('Sydney', -33.8688, 151.2093, 20, 1), ('Auckland', -36.8509, 174.7645, 20, 1),
    ('Nouméa', -22.2758, 166.4580, 10, 1),
    -- Amériques
    ('New York', 40.7128, -74.0060, 10, 3), ('Montréal', 45.5019, -73.5674, 40, 3),
    ('San Francisco', 37.7749, -122.4194, 20, 1), ('Mexico', 19.4326, -99.1332, 2240, 1),
    ('La Havane', 23.1136, -82.3666, 20, 1), ('Lima', -12.0464, -77.0428, 150, 1),
    ('Cusco', -13.5320, -71.9675, 3400, 1), ('La Paz', -16.4897, -68.1193, 3640, 1),
    ('Rio de Janeiro', -22.9068, -43.1729, 10, 1), ('Buenos Aires', -34.6037, -58.3816, 25, 1),
    ('Ushuaïa', -54.8019, -68.3030, 20, 1), ('Antarctique (base Vernadsky)', -65.2459, -64.2576, 10, 1)
  ),
  weighted as (
    select a.*, sum(a.weight) over (order by a.city) as cum, sum(a.weight) over () as total
    from anchors a
  ),
  draws as (
    select g, random() as r_anchor, random() as r_dist, random() as r_az, random() as r_user,
      random() as r_date, random() as r_delay, random() as r_status, random() as r_kind
    from generate_series(1, n) g
  ),
  placed as (
    select d.*, w.city, w.alt,
      extensions.st_project(
        extensions.st_setsrid(extensions.st_makepoint(w.lng, w.lat), 4326)::extensions.geography,
        15000 * sqrt(d.r_dist), 2 * pi() * d.r_az
      ) as loc,
      v_users[1 + floor(d.r_user * array_length(v_users, 1))::int] as author_id,
      timestamptz '2025-01-01' + d.r_date * (now() - timestamptz '2025-01-01') as taken_at
    from draws d
    cross join lateral (
      select * from weighted w where w.cum >= d.r_anchor * w.total order by w.cum limit 1
    ) w
  ),
  inserted as (
    insert into public.spots (
      author_id, name, location, public_location, altitude_m, altitude_source, taken_at, year, gps_source,
      date_source, country_iso2, city, photo_path, status, is_exceptional, rarity_override,
      is_tourist_spot, needs_review, review_reason, comment, created_at
    )
    select
      p.author_id,
      (array['Lampadaire', 'Panneau', 'Banc', 'Gare', 'Pont', 'Café', 'Phare', 'Belvédère',
             'Port', 'Marché', 'Musée', 'Arrêt de bus', 'Boîte aux lettres', 'Refuge'])
        [1 + floor(p.r_kind * 14)::int] || ' · ' || p.city,
      p.loc,
      p.loc,
      round((p.alt + p.r_dist * 120)::numeric, 1),
      'exif',
      p.taken_at,
      -- Édition de l'année du collage si elle existe, sinon l'édition en cours.
      coalesce(
        (select se.year from public.seasons se where se.year = extract(year from p.taken_at)::int),
        public.current_edition_year()
      ),
      case when p.r_status between 0.94 and 0.97 then 'manual' else 'exif' end,
      'exif',
      public.country_at(p.loc),
      p.city,
      p.author_id || '/demo-' || gen_random_uuid() || '.webp',
      case when p.r_status < 0.01 then 'hidden'::public.spot_status else 'published'::public.spot_status end,
      p.r_status > 0.98,
      case when p.r_status > 0.98 then 'remarquable'::public.rarity_category end,
      p.r_kind > 0.9,
      p.r_status between 0.94 and 0.97,
      case when p.r_status between 0.94 and 0.97 then 'Position placée à la main' end,
      case when p.r_delay < 0.25 then
        (array['Collé avec les copains en rentrant de balade.', 'Tomi a trouvé une belle vue !',
               'Juste à côté de l''entrée.', 'Premier sticker du voyage.', 'Il y avait du vent ce jour-là.'])
          [1 + floor(p.r_az * 5)::int]
      end,
      least(now(), p.taken_at + p.r_delay * interval '3 days')
    from placed p
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from inserted;

  -- Points figés, dans l'ordre de publication.
  for v_id in
    select s.id from public.spots s where s.id = any (v_ids) order by s.created_at, s.id
  loop
    perform public.compute_spot_points(v_id, 'Publication (démo)');
  end loop;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke execute on function public.seed_demo_spots(int) from public, anon, authenticated, service_role;
