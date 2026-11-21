-- Passage des données existantes au cahier des charges V1.1.
--
-- 1. Publication directe : les stickers en attente faute de GPS ou de date (et non à
--    cause de signalements) sont publiés ; une position placée à la main reste
--    signalée « à vérifier » aux modérateurs.
-- 2. Faits géographiques (île, désert, capitale) des stickers existants.
-- 3. Recalcul de tous les points avec le nouveau barème : le journal de points reçoit
--    une ligne par sticker, avec ce motif.
-- 4. Badges déjà mérités, sans avis (pas de notification en masse).
-- 5. Classement rafraîchi.
--
-- Les réglages de session ci-dessous (motif, badges silencieux) sont remis à zéro à la fin.

select set_config('spot_tomi.quiet_badges', 'on', false);
select set_config('spot_tomi.ledger_reason', 'Publication directe (cahier des charges V1.1)', false);

update public.spots s
set status = 'published'
where s.status = 'pending_review'
  and (
    select count(*) from public.spot_reports r where r.spot_id = s.id and r.status = 'pending'
  ) < coalesce((select value from public.scoring_rules where key = 'reports_before_review'), 3);

update public.spots
set needs_review = true, review_reason = 'Position placée à la main'
where gps_source = 'manual' and not needs_review;

-- Faits géographiques : un seul passage, sans badges ligne à ligne.
alter table public.spots disable trigger spots_award_badges;
update public.spots set location = location;
alter table public.spots enable trigger spots_award_badges;

select public.recompute_all_points('Nouveau barème (cahier des charges V1.1)');

select private.award_badges(p.id) from public.profiles p;

select public.refresh_leaderboard();

select set_config('spot_tomi.quiet_badges', '', false);
select set_config('spot_tomi.ledger_reason', '', false);

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261202000000_cahier_recalcul'::text $$;
