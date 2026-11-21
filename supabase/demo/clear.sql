-- Vide les données de démo : les comptes demo_* (auth.users) et, en cascade,
-- leurs profils, stickers, lignes de points, journal, badges, likes et signalements.
delete from auth.users where id::text like 'de300000-0000-4000-8000-%';

-- Les stickers réels publiés pendant la démo ont été calculés en tenant compte
-- des stickers de démo (premier du pays, doublons) : on recalcule tout.
select public.recompute_all_points('Suppression des données de démo') as stickers_recalcules;
select public.refresh_leaderboard();
