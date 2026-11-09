-- Central price book (replaces client/public/stdPrices.json, which anyone could download without logging in).
-- Read-only for signed-in users; prices are changed by an admin in the SQL editor / table editor.
-- Columns mirror org_price_overrides, plus `y` (brand "Y" has no prices yet) and `is_estimated`
-- (true for rows that were added with the closest existing item's price - review/replace them).

create table if not exists public.price_items (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,          -- NOT unique: code 0303 is shared by "MCCB 35kA TP 40A" and "...50A"
  items        text not null unique,   -- the name the calculation functions look up
  abb          numeric,
  mg           numeric,
  ge           numeric,
  cutlerh      numeric,
  seimens      numeric,
  lg           numeric,
  lt           numeric,
  dsmith       numeric,
  new_price    numeric,
  mbshi        numeric,
  z            numeric,
  y            numeric,
  is_estimated boolean not null default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists price_items_code_idx on public.price_items (code);

alter table public.price_items enable row level security;

drop policy if exists price_items_read on public.price_items;
create policy price_items_read on public.price_items
  for select to authenticated using (true);

-- belt and braces: no direct writes from the app, whatever the policies say
revoke all on public.price_items from anon;
revoke insert, update, delete, truncate on public.price_items from authenticated;
grant select on public.price_items to authenticated;
