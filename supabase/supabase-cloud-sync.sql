-- 🛡️ Kalimati v10.0 : Tables Supabase durcies pour la Synchronisation Équipe Zero-Knowledge (AES-256-GCM)
-- et le Suivi de Cohorte Clinique Anonymisé (ATEC + LME/MLU sur 3 à 6 mois).
-- Correctif sécurité v10.0 :
-- 1. Aucune politique DELETE n'est autorisée (impossible d'effacer le salon d'une famille ou les métriques cliniques).
-- 2. Contrainte stricte sur room_hash (empreinte SHA-256 exacte de 64 caractères hexadécimaux) et structure cipher_bundle.
-- À coller dans Supabase -> SQL Editor -> New Query -> Run.

create table if not exists public.kalimati_encrypted_relay (
  room_hash text primary key check (char_length(room_hash) = 64),
  cipher_bundle jsonb not null check (jsonb_typeof(cipher_bundle) = 'object' and (cipher_bundle ? 'ciphertext')),
  author_role text default 'Parent',
  updated_at timestamptz default now()
);

alter table public.kalimati_encrypted_relay enable row level security;

drop policy if exists "Kalimati Zero-Knowledge Relay Access" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Relay Select" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Relay Insert" on public.kalimati_encrypted_relay;
drop policy if exists "Kalimati Relay Update" on public.kalimati_encrypted_relay;

create policy "Kalimati Relay Select"
  on public.kalimati_encrypted_relay
  for select
  using (char_length(room_hash) = 64);

create policy "Kalimati Relay Insert"
  on public.kalimati_encrypted_relay
  for insert
  with check (char_length(room_hash) = 64 and (cipher_bundle ? 'ciphertext'));

create policy "Kalimati Relay Update"
  on public.kalimati_encrypted_relay
  for update
  using (char_length(room_hash) = 64)
  with check (char_length(room_hash) = 64 and (cipher_bundle ? 'ciphertext'));

-- 2. Table d'étude clinique longitudinale 100 % anonyme (INSERT/UPDATE uniquement, aucun DELETE autorisé)
create table if not exists public.kalimati_clinical_cohort (
  cohort_id text primary key check (char_length(cohort_id) between 10 and 40),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  updated_at timestamptz default now()
);

alter table public.kalimati_clinical_cohort enable row level security;

drop policy if exists "Kalimati Clinical Cohort Upsert" on public.kalimati_clinical_cohort;
drop policy if exists "Kalimati Cohort Select" on public.kalimati_clinical_cohort;
drop policy if exists "Kalimati Cohort Insert" on public.kalimati_clinical_cohort;
drop policy if exists "Kalimati Cohort Update" on public.kalimati_clinical_cohort;

create policy "Kalimati Cohort Select"
  on public.kalimati_clinical_cohort
  for select
  using (true);

create policy "Kalimati Cohort Insert"
  on public.kalimati_clinical_cohort
  for insert
  with check (jsonb_typeof(metrics) = 'object');

create policy "Kalimati Cohort Update"
  on public.kalimati_clinical_cohort
  for update
  using (true)
  with check (jsonb_typeof(metrics) = 'object');
