-- Baseline of the schema as it exists in the live project (captured from information_schema / pg_indexes /
-- pg_proc). Everything is idempotent, so it is safe to run on the live database AND on a fresh one.
--
-- NOT captured (the queries for them were not provided): foreign keys, and the exact trigger definitions.
-- The foreign keys below are the usual ones for this app (they only take effect when a table is created
-- fresh) and the triggers are only created when no trigger already runs the same function.

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  email        text unique,
  created_at   timestamptz default now(),
  organization text
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  total_cost  numeric default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists public.project_modules (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  module_type text not null,
  title       text not null,
  quantity    integer not null default 1,
  unit_price  numeric,
  total_price numeric,
  input_json  jsonb not null default '{}'::jsonb,
  output_json jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create unique index if not exists unique_project_module_title
  on public.project_modules (project_id, title);

create table if not exists public.org_price_overrides (
  id         uuid primary key default gen_random_uuid(),
  org_name   text not null,
  code       text not null,
  items      text not null,
  abb        numeric,
  mg         numeric,
  ge         numeric,
  cutlerh    numeric,
  seimens    numeric,
  lg         numeric,
  lt         numeric,
  dsmith     numeric,
  new_price  numeric,
  mbshi      numeric,
  z          numeric,
  updated_at timestamptz default now(),
  unique (org_name, code)
);

-- ---------------------------------------------------------------- functions
-- (bodies are the live ones; `set search_path = public` is the only addition)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, organization)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'organization'
  );
  return new;
end;
$$;

create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update projects
  set updated_at = now()
  where id = coalesce(new.project_id, old.project_id);

  return null;
end;
$$;

-- ---------------------------------------------------------------- triggers
-- Guarded by FUNCTION, not by name: creating a second sign-up trigger would insert two profile rows and
-- break registration, so nothing is created if a trigger already runs these functions.
do $$
begin
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'auth.users'::regclass
      and t.tgfoid = 'public.handle_new_user'::regproc
      and not t.tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.project_modules'::regclass
      and t.tgfoid = 'public.touch_project_updated_at'::regproc
      and not t.tgisinternal
  ) then
    create trigger touch_project_updated_at_trg
      after insert or update or delete on public.project_modules
      for each row execute function public.touch_project_updated_at();
  end if;
end;
$$;
