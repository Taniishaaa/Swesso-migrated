-- Row Level Security. Replaces the 17 live policies (several were duplicates, e.g. two sets on `profiles`,
-- and all were granted to `public`) with one policy per command, granted to `authenticated` only.
-- Semantics are unchanged: you only see/modify your own profile, your own projects, the modules of your own
-- projects, and your own organization's price overrides.
-- ENABLE ROW LEVEL SECURITY is idempotent (it is also what makes the policies take effect at all).

alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.project_modules     enable row level security;
alter table public.org_price_overrides enable row level security;

-- ---------------------------------------------------------------- drop the old policies
drop policy if exists "Profiles - insert own"                 on public.profiles;
drop policy if exists "Profiles - select own"                 on public.profiles;
drop policy if exists "Profiles - update own"                 on public.profiles;
drop policy if exists "Users can insert their own profile"    on public.profiles;
drop policy if exists "Users can update their own profile"    on public.profiles;
drop policy if exists "Users can view their own profile"      on public.profiles;

drop policy if exists "Projects - delete own"                 on public.projects;
drop policy if exists "Projects - insert own"                 on public.projects;
drop policy if exists "Projects - select own"                 on public.projects;
drop policy if exists "Projects - update own"                 on public.projects;

drop policy if exists "Project modules - delete own"          on public.project_modules;
drop policy if exists "Project modules - insert own"          on public.project_modules;
drop policy if exists "Project modules - select own"          on public.project_modules;
drop policy if exists "Project modules - update own"          on public.project_modules;

drop policy if exists "insert own org prices"                 on public.org_price_overrides;
drop policy if exists "read own org prices"                   on public.org_price_overrides;
drop policy if exists "update own org prices"                 on public.org_price_overrides;

-- re-runnable: also drop the new names first
drop policy if exists profiles_select_own  on public.profiles;
drop policy if exists profiles_insert_own  on public.profiles;
drop policy if exists profiles_update_own  on public.profiles;
drop policy if exists projects_select_own  on public.projects;
drop policy if exists projects_insert_own  on public.projects;
drop policy if exists projects_update_own  on public.projects;
drop policy if exists projects_delete_own  on public.projects;
drop policy if exists project_modules_select_own on public.project_modules;
drop policy if exists project_modules_insert_own on public.project_modules;
drop policy if exists project_modules_update_own on public.project_modules;
drop policy if exists project_modules_delete_own on public.project_modules;
drop policy if exists org_price_overrides_select_own_org on public.org_price_overrides;
drop policy if exists org_price_overrides_insert_own_org on public.org_price_overrides;
drop policy if exists org_price_overrides_update_own_org on public.org_price_overrides;

-- ---------------------------------------------------------------- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- projects
create policy projects_select_own on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy projects_insert_own on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy projects_update_own on public.projects
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy projects_delete_own on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- project_modules (through the parent project)
create policy project_modules_select_own on public.project_modules
  for select to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_modules.project_id and p.user_id = (select auth.uid())));
create policy project_modules_insert_own on public.project_modules
  for insert to authenticated with check (
    exists (select 1 from public.projects p
            where p.id = project_modules.project_id and p.user_id = (select auth.uid())));
create policy project_modules_update_own on public.project_modules
  for update to authenticated
  using (
    exists (select 1 from public.projects p
            where p.id = project_modules.project_id and p.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.projects p
            where p.id = project_modules.project_id and p.user_id = (select auth.uid())));
create policy project_modules_delete_own on public.project_modules
  for delete to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_modules.project_id and p.user_id = (select auth.uid())));

-- ---------------------------------------------------------------- org_price_overrides (own organization only)
create policy org_price_overrides_select_own_org on public.org_price_overrides
  for select to authenticated using (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.organization = org_price_overrides.org_name));
create policy org_price_overrides_insert_own_org on public.org_price_overrides
  for insert to authenticated with check (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.organization = org_price_overrides.org_name));
create policy org_price_overrides_update_own_org on public.org_price_overrides
  for update to authenticated
  using (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.organization = org_price_overrides.org_name))
  with check (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.organization = org_price_overrides.org_name));
