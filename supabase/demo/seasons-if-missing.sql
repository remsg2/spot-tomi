-- Saisons d'exemple pour une démo en production : ajoutées seulement si elles
-- manquent. Ne remplace jamais une couleur choisie dans l'admin.
insert into public.seasons (year, color_hex, is_current) values
  (2024, '#F2C230', false),
  (2025, '#FF7A59', false),
  (2026, '#5B8DEF', false)
on conflict (year) do nothing;

update public.seasons set is_current = true
where year = 2026 and not exists (select 1 from public.seasons where is_current);
