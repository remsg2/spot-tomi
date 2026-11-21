-- Jeu de données de démo (projet dev et base locale uniquement, jamais la prod).
-- Appliqué par `supabase db reset` / `supabase db start` après les migrations.
--
-- Il ne crée ni compte ni sticker : les tests pgTAP tournent sur cette base. Le
-- générateur seed_demo_spots est chargé ensuite (supabase/demo/generator.sql,
-- voir [db.seed] dans config.toml). Pour remplir la carte en local :
--   select public.seed_demo_spots(5000);
-- Projets hébergés : workflow « Données de démo » (.github/workflows/demo.yml).

-- Éditions officielles (visuels dans public/editions/), comme en production. Imposées
-- en dev, même si des stickers existent déjà : la couleur d'une édition passée est sinon figée.
select set_config('spot_tomi.edition_color_unlock', 'on', false);
update public.seasons set is_current = false where is_current and year <> 2026;
insert into public.seasons (year, name, color_hex, status, is_current) values
  (2025, 'Édition 2025', '#F68A27', 'active', false),
  (2026, 'Édition 2026', '#C57CB3', 'active', true),
  (2027, 'Édition 2027', '#34B503', 'active', false)
on conflict (year) do update
  set name = excluded.name, color_hex = excluded.color_hex, is_current = excluded.is_current;
select set_config('spot_tomi.edition_color_unlock', '', false);
