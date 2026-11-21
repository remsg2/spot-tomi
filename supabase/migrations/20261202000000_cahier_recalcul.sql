-- Passage au cahier des charges V1.1 : remise à zéro des données de test et éditions
-- officielles.
--
-- 1. Les stickers existants n'étaient que des données de test : ils sont supprimés, avec
--    leur journal de points, leurs badges, avis, signalements et likes. Les comptes
--    restent. Les photos déjà envoyées restent dans Storage (le SQL ne peut pas les
--    effacer) : sans sticker, elles ne sont plus affichées nulle part.
-- 2. Éditions officielles (visuels dans public/editions/) : 2025 orange, 2026 rose
--    (édition en cours), 2027 vert (à venir : choisissable quand elle deviendra
--    l'édition en cours). Les autres années d'exemple disparaissent.
-- 3. Classement rafraîchi (vide).

select set_config('spot_tomi.ledger_reason', 'Remise à zéro des données de test', false);
delete from public.spots;
select set_config('spot_tomi.ledger_reason', '', false);

delete from public.points_ledger;
delete from public.user_badges;
delete from public.user_notices;
delete from public.spot_reports;
delete from public.spot_likes;

-- Plus aucun sticker : aucune couleur n'est figée.
delete from public.seasons;
insert into public.seasons (year, name, color_hex, status, is_current) values
  (2025, 'Édition 2025', '#F68A27', 'active', false),
  (2026, 'Édition 2026', '#C57CB3', 'active', true),
  (2027, 'Édition 2027', '#34B503', 'active', false);

select public.refresh_leaderboard();

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261202000000_cahier_recalcul'::text $$;
