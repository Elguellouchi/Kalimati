-- 🛡️ Kalimati v10.5 : complément au SQL v10.3 (à lancer APRÈS lui). On peut le relancer sans risque.
-- À coller dans Supabase -> SQL Editor -> New query -> Run.
--
-- Ce script N'EFFACE AUCUNE donnée. Il ajoute seulement :
-- 1. Une taille maximale : 5 Mo pour un paquet de synchro, 64 Ko pour des scores de cohorte.
-- 2. Deux « portes » d'effacement utilisées par les boutons de l'appli :
--    - kalimati_relay_delete  : efface le paquet chiffré de la famille ;
--    - kalimati_cohort_delete : retire les scores de l'étude.
--    Elles n'effacent QUE la ligne dont le jeton secret correspond (clé familiale). Une ligne sans jeton n'est jamais effacée.
--
-- Relu par Claude le 19/11 à partir du fichier v10.5 du Drive. Changements par rapport à ce fichier :
-- - la table « kalimati_beta_telemetry » et sa porte ne sont pas créées (l'appli ne s'en sert pas) ;
-- - les portes d'effacement refusent les lignes sans jeton (sinon n'importe qui connaissant l'identifiant pouvait les effacer).

-- ---------- 1. Plafond de taille dans les portes d'écriture ----------
create or replace function public.kalimati_relay_put(p_room_hash text, p_bundle jsonb, p_write_token text, p_role text default 'Parent')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_count int;
begin
  if char_length(coalesce(p_room_hash, '')) <> 64 then raise exception 'room_hash invalide'; end if;
  if char_length(coalesce(p_write_token, '')) < 32 then raise exception 'jeton invalide'; end if;
  if p_bundle is null or jsonb_typeof(p_bundle) <> 'object' or not (p_bundle ? 'ciphertext') then raise exception 'paquet invalide'; end if;
  if octet_length(p_bundle::text) > 5242880 then raise exception 'paquet trop gros (5 Mo max)'; end if;
  v_hash := encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');

  insert into public.kalimati_encrypted_relay as r (room_hash, cipher_bundle, author_role, updated_at, write_hash)
  values (p_room_hash, p_bundle, left(coalesce(p_role, 'Parent'), 60), now(), v_hash)
  on conflict (room_hash) do update
    set cipher_bundle = excluded.cipher_bundle,
        author_role = excluded.author_role,
        updated_at = now(),
        write_hash = coalesce(r.write_hash, excluded.write_hash)
    where r.write_hash is null or r.write_hash = excluded.write_hash;

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'jeton refusé' using errcode = '42501'; end if;
  return true;
end;
$$;

create or replace function public.kalimati_cohort_put(p_cohort_id text, p_metrics jsonb, p_write_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_count int;
begin
  if char_length(coalesce(p_cohort_id, '')) not between 10 and 40 then raise exception 'cohort_id invalide'; end if;
  if char_length(coalesce(p_write_token, '')) < 32 then raise exception 'jeton invalide'; end if;
  if p_metrics is null or jsonb_typeof(p_metrics) <> 'object' then raise exception 'scores invalides'; end if;
  if octet_length(p_metrics::text) > 65536 then raise exception 'scores trop gros (64 Ko max)'; end if;
  v_hash := encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');

  insert into public.kalimati_clinical_cohort as c (cohort_id, metrics, updated_at, write_hash)
  values (p_cohort_id, p_metrics, now(), v_hash)
  on conflict (cohort_id) do update
    set metrics = excluded.metrics,
        updated_at = now(),
        write_hash = coalesce(c.write_hash, excluded.write_hash)
    where c.write_hash is null or c.write_hash = excluded.write_hash;

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'jeton refusé' using errcode = '42501'; end if;
  return true;
end;
$$;

-- ---------- 2. Portes d'effacement (droit au retrait) ----------
create or replace function public.kalimati_relay_delete(p_room_hash text, p_write_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if char_length(coalesce(p_room_hash, '')) <> 64 then raise exception 'room_hash invalide'; end if;
  if char_length(coalesce(p_write_token, '')) < 32 then raise exception 'jeton invalide'; end if;
  delete from public.kalimati_encrypted_relay
  where room_hash = p_room_hash
    and write_hash is not null
    and write_hash = encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.kalimati_cohort_delete(p_cohort_id text, p_write_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if char_length(coalesce(p_cohort_id, '')) not between 10 and 40 then raise exception 'cohort_id invalide'; end if;
  if char_length(coalesce(p_write_token, '')) < 32 then raise exception 'jeton invalide'; end if;
  delete from public.kalimati_clinical_cohort
  where cohort_id = p_cohort_id
    and write_hash is not null
    and write_hash = encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- ---------- 3. Droits : seulement les portes, jamais les tables ----------
revoke all on function public.kalimati_relay_put(text, jsonb, text, text) from public;
revoke all on function public.kalimati_cohort_put(text, jsonb, text) from public;
revoke all on function public.kalimati_relay_delete(text, text) from public;
revoke all on function public.kalimati_cohort_delete(text, text) from public;
grant execute on function public.kalimati_relay_put(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.kalimati_cohort_put(text, jsonb, text) to anon, authenticated;
grant execute on function public.kalimati_relay_delete(text, text) to anon, authenticated;
grant execute on function public.kalimati_cohort_delete(text, text) to anon, authenticated;
