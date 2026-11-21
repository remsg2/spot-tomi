-- Vide les données de démo : les comptes demo_* (auth.users) et, en cascade,
-- leurs profils, domiciles, stickers, lignes de points et signalements.
delete from auth.users where id::text like 'de300000-0000-4000-8000-%';

-- Les stickers réels publiés pendant la démo ont été calculés en tenant compte
-- des stickers de démo (premier du pays, isolement, voisins) : on recalcule tout.
select public.recompute_all_points() as stickers_recalcules;
select public.refresh_leaderboard();
