-- Server-owned totals.
--  1) project_modules.total_price is always unit_price * quantity. Changing only the quantity (the "Save"
--     button) no longer leaves a stale total, and a client can no longer write an arbitrary total_price.
--  2) projects.total_cost is always the sum of its modules' total_price (one definition instead of three).

create or replace function public.set_module_total_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.unit_price is null then
    new.total_price := null;
  else
    new.total_price := new.unit_price * new.quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists project_modules_set_total_price on public.project_modules;
create trigger project_modules_set_total_price
  before insert or update of unit_price, quantity, total_price on public.project_modules
  for each row execute function public.set_module_total_price();

create or replace function public.recompute_project_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects
  set total_cost = coalesce((select sum(m.total_price) from public.project_modules m where m.project_id = pid), 0)
  where id = pid;

  -- a module moved to another project: refresh the old one too
  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    update public.projects
    set total_cost = coalesce((select sum(m.total_price) from public.project_modules m where m.project_id = old.project_id), 0)
    where id = old.project_id;
  end if;

  return null;
end;
$$;

drop trigger if exists project_modules_recompute_total on public.project_modules;
create trigger project_modules_recompute_total
  after insert or update or delete on public.project_modules
  for each row execute function public.recompute_project_total();

-- one-time backfill: fix any stale module totals, then every project total
update public.project_modules
set total_price = unit_price * quantity
where unit_price is not null
  and total_price is distinct from unit_price * quantity;

update public.projects p
set total_cost = coalesce((select sum(m.total_price) from public.project_modules m where m.project_id = p.id), 0);
