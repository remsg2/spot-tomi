-- Photo prise dans l'app : position du téléphone et heure de la prise.
--
-- Sur iPhone, Safari retire la position (et parfois la date) des photos qu'il
-- transmet à un site, toujours pour une photo prise depuis le navigateur. Pour
-- une photo prise à l'instant avec le bouton « Prendre une photo », l'app lit
-- donc la position du téléphone (géolocalisation) et retient l'heure d'envoi :
-- sources « device », vérifiées comme celles de la photo (sticker publié
-- directement, position modifiable de 200 m au maximum côté client).
--
-- La date « device » est celle du serveur (now()), comme « upload » : le client
-- ne choisit jamais l'année (donc la couleur) d'un sticker sans date dans la photo.

alter table public.spots drop constraint spots_gps_source_check;
alter table public.spots
  add constraint spots_gps_source_check check (gps_source in ('exif', 'device', 'manual'));

alter table public.spots drop constraint spots_date_source_check;
alter table public.spots
  add constraint spots_date_source_check check (date_source in ('exif', 'device', 'upload'));

create or replace function private.check_publish_input(
  p_lat double precision,
  p_lng double precision,
  p_altitude_m numeric,
  p_gps_source text,
  p_date_source text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  -- NaN et ±Infinity échouent aussi à ces comparaisons.
  if p_lat is null or p_lng is null or not (p_lat between -90 and 90) or not (p_lng between -180 and 180) then
    raise exception 'Position invalide.' using errcode = 'ST005';
  end if;
  if p_gps_source is null or p_gps_source not in ('exif', 'device', 'manual') then
    raise exception 'Source de la position invalide.' using errcode = 'ST005';
  end if;
  if p_date_source is null or p_date_source not in ('exif', 'device', 'upload') then
    raise exception 'Source de la date invalide.' using errcode = 'ST005';
  end if;
  if p_altitude_m is not null and not (p_altitude_m between -500 and 9000) then
    raise exception 'Altitude invalide.' using errcode = 'ST005';
  end if;
end;
$$;

-- Date de prise retenue : celle de la photo, ou l'heure du serveur pour une photo
-- sans date (« upload ») ou prise à l'instant dans l'app (« device »).
create or replace function private.effective_taken_at(p_taken_at timestamptz, p_date_source text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_date_source in ('upload', 'device') then
    return now();
  end if;
  if p_taken_at is null or p_taken_at < timestamptz '2000-01-01 00:00:00+00'
     or p_taken_at > now() + interval '1 day' then
    raise exception 'Date de prise invalide.' using errcode = 'ST005';
  end if;
  return p_taken_at;
end;
$$;

-- Version du schéma ------------------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261129000000_capture'::text $$;
