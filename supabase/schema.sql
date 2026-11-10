-- Data Engine Kiki's House Cleaning · esquema inicial
-- Ejecutar una sola vez en Supabase → SQL Editor.

create table if not exists visits (
  visit_id          integer primary key,
  visit_date        date not null,
  week_start        date not null,          -- domingo de la semana
  year              integer,
  week              integer,
  status            text not null,          -- realizado | agendado
  client_id         text not null,          -- hash del teléfono (anonimizado)
  is_first_visit    boolean not null default false,
  client_first_date date,
  client_source     text,
  city              text,
  region            text,
  service_family    text,
  frequency         text,
  bedrooms          numeric,
  bathrooms         numeric,
  size_bucket       text,
  price             numeric,
  tip               numeric,
  total             numeric,
  labor_cost        numeric,
  payment_code      text,
  addon_laundry     boolean,
  addon_baseboards  boolean,
  addon_windows     boolean,
  addon_oven        boolean,
  addon_fridge      boolean,
  addon_cabinets    boolean
);
create index if not exists visits_week_idx on visits (week_start);
create index if not exists visits_client_idx on visits (client_id);

create table if not exists weekly_marketing (
  year            integer not null,
  week            integer not null,
  marketing_spend numeric,
  sales           numeric,
  week_start      date primary key
);

create table if not exists meta (
  key   text primary key,
  value text
);

-- Seguridad: solo usuarios con sesión iniciada pueden leer. Nadie escribe desde la app.
alter table visits enable row level security;
alter table weekly_marketing enable row level security;
alter table meta enable row level security;

drop policy if exists "lectura autenticados" on visits;
drop policy if exists "lectura autenticados" on weekly_marketing;
drop policy if exists "lectura autenticados" on meta;
create policy "lectura autenticados" on visits for select to authenticated using (true);
create policy "lectura autenticados" on weekly_marketing for select to authenticated using (true);
create policy "lectura autenticados" on meta for select to authenticated using (true);
