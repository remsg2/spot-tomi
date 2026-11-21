-- Jeu de données de démo (projet dev et base locale uniquement, jamais la prod).
-- Appliqué par `supabase db reset` / `supabase db start` après les migrations.
--
-- Il ne crée ni compte ni sticker : les tests pgTAP tournent sur cette base. Le
-- générateur seed_demo_spots est chargé ensuite (supabase/demo/generator.sql,
-- voir [db.seed] dans config.toml). Pour remplir la carte en local :
--   select public.seed_demo_spots(5000);
-- Projets hébergés : workflow « Données de démo » (.github/workflows/demo.yml).

-- Saisons d'exemple (spécifications, 4.1 ; couleurs 2024-2026 à confirmer).
update public.seasons set is_current = false where is_current and year <> 2026;
insert into public.seasons (year, color_hex, is_current) values
  (2024, '#F2C230', false),
  (2025, '#FF7A59', false),
  (2026, '#5B8DEF', true)
on conflict (year) do update set color_hex = excluded.color_hex, is_current = excluded.is_current;
