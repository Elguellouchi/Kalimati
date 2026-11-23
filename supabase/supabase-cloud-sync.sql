-- 🛡️ Kalimati v10.3 : Supabase verrouillé (synchro équipe chiffrée + cohorte clinique).
-- À coller dans Supabase -> SQL Editor -> New query -> Run. On peut le relancer sans risque.
--
-- Ce qui change par rapport à la v10.0 :
-- 1. Personne ne peut plus lire ni modifier directement les tables avec la clé publique.
-- 2. L'appli passe par 3 « portes » (fonctions) qui vérifient un jeton secret,
--    calculé dans le téléphone à partir de la clé familiale (jamais envoyée elle-même).
-- 3. Un paquet de synchro ne peut être remplacé que par un téléphone qui a la même clé familiale.
-- 4. Les scores de la cohorte ne sont plus lisibles par personne avec la clé publique.
--    Vous les voyez toujours dans Supabase -> Table Editor (compte administrateur).
-- 5. Toujours aucun effacement possible depuis l'appli.

-- ---------- 1. Tables (inchangées, + une colonne « write_hash ») ----------
create table if not exists public.kalimati_encrypted_relay (
  room_hash text primary key check (char_length(room_hash) = 64),
  cipher_bundle jsonb not null check (jsonb_typeof(cipher_bundle) = 'object' and (cipher_bundle ? 'ciphertext')),
  author_role text default 'Parent',
  updated_at timestamptz default now()
);
alter table public.kalimati_encrypted_relay add column if not exists write_hash text;

create table if not exists public.kalimati_clinical_cohort (
  cohort_id text primary key check (char_length(cohort_id) between 10 and 40),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  updated_at timestamptz default now()
);
alter table public.kalimati_clinical_cohort add column if not exists write_hash text;

-- ---------- 2. Fermer l'accès direct aux tables ----------
alter table public.kalimati_encrypted_relay enable row level security;
alter table public.kalimati_clinical_cohort enable row level security;

drop policy if exists "Kalimati Zero-Knowledge Relay Access" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Relay Select" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Relay Insert" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Relay Update" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Clinical Cohort Upsert" on public.kalimati_clinical_cohort;
drop policy if exists "Kalimati Cohort Select" on public.kalimati_clinical_cohort;
drop policy if exists "Kalimati Cohort Insert" on public.kalimati_clinical_cohort;
drop policy if exists "Kalimati Cohort Update" on public.kalimati_clinical_cohort;

revoke all on public.kalimati_encrypted_relay from anon, authenticated;
revoke all on public.kalimati_clinical_cohort from anon, authenticated;

-- ---------- 3. Les 3 portes utilisées par l'appli ----------

-- Lire le paquet chiffré d'une famille (il faut connaître son room_hash, dérivé de la clé familiale).
create or replace function public.kalimati_relay_get(p_room_hash text)
returns table (cipher_bundle jsonb, author_role text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select r.cipher_bundle, r.author_role, r.updated_at
  from public.kalimati_encrypted_relay r
  where char_length(p_room_hash) = 64 and r.room_hash = p_room_hash;
$$;

-- Écrire le paquet chiffré : le premier téléphone pose le jeton, les suivants doivent avoir le même.
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

-- Envoyer les scores anonymes de la cohorte (écriture seule, aucune lecture possible).
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

revoke all on function public.kalimati_relay_get(text) from public;
revoke all on function public.kalimati_relay_put(text, jsonb, text, text) from public;
revoke all on function public.kalimati_cohort_put(text, jsonb, text) from public;
grant execute on function public.kalimati_relay_get(text) to anon, authenticated;
grant execute on function public.kalimati_relay_put(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.kalimati_cohort_put(text, jsonb, text) to anon, authenticated;
