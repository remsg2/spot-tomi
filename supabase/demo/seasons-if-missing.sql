-- Éditions officielles pour une démo en production : ajoutées seulement si elles
-- manquent. Ne remplace jamais une couleur choisie dans l'admin.
insert into public.seasons (year, name, color_hex, status, is_current) values
  (2025, 'Édition 2025', '#F68A27', 'active', false),
  (2026, 'Édition 2026', '#C57CB3', 'active', false),
  (2027, 'Édition 2027', '#34B503', 'active', false)
on conflict (year) do nothing;

update public.seasons set is_current = true
where year = 2026 and not exists (select 1 from public.seasons where is_current);
