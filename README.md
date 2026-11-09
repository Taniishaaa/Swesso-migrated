# swesso

Quotation / costing tool for switchgear panels (CBank, DB Row, SMDB, MDB, Form 4 MDB, Meter Box).

- **client/** – React + TypeScript + Vite app. Forms only; all pricing is done by the backend.
- **supabase/** – database migrations and Edge Functions (Deno/TypeScript). One self-contained
  function per module:

| Function | Module |
|---|---|
| `calc-cbank800` | Capacitor bank |
| `calc-dbrow` | DB row |
| `calc-smdb` | SMDB |
| `calc-mdb` | MDB (Form 2) |
| `calc-form4` | MDB (Form 4) |
| `calc-meterbox` | Meter box |

Each function folder contains `index.ts` (HTTP handler), `calc.ts` (pure costing engine),
`validate.ts`, `tables.ts`, `types.ts`, `prices.ts` and `calc.test.ts`.

## Run the client

```bash
cd client
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Run the calculation tests

Node 22.6+ (no install needed):

```bash
cd supabase/functions/calc-mdb
node --experimental-strip-types --test calc.test.ts
```

or `deno test` inside the same folder.

## Backend setup (first time)

Needs Node 18+ and a Supabase project. Run everything from the repo root. Use `npx supabase ...`
(or install the Supabase CLI from https://supabase.com/docs/guides/cli).

```bash
npx supabase login                                   # opens the browser
npx supabase init                                    # creates supabase/config.toml (keeps the migrations folder)
npx supabase link --project-ref <your-project-ref>   # Dashboard > Project Settings > General > Reference ID
npx supabase db push --dry-run                       # preview the 4 migrations
npx supabase db push                                 # apply them
```

Then load the price book: open the Supabase **SQL Editor**, paste the contents of `supabase/seed/price_items.sql`
and run it (re-runnable; it never overwrites existing prices).

Deploy the six calculation functions, **one command each** (do not run a bare `supabase functions deploy`: the
`project-report` folder is still an empty placeholder):

```bash
npx supabase functions deploy calc-cbank800
npx supabase functions deploy calc-dbrow
npx supabase functions deploy calc-smdb
npx supabase functions deploy calc-mdb
npx supabase functions deploy calc-form4
npx supabase functions deploy calc-meterbox
```

(If you do not have Docker installed and a deploy complains about it, add `--use-api`.)
No secrets need to be set: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into functions automatically.

### Notes
- `price_items.is_estimated = true` marks the 14 items that the calculation functions look up but the old price file
  did not contain; they were added at the closest existing item's price (see `supabase/seed/added_price_items.json`).
  Review them with `select * from price_items where is_estimated;` and replace with real prices when you have them.
- To change the seed source, edit `supabase/seed/stdPrices.source.json` / `added_price_items.json` and run
  `node supabase/seed/generate-price-items.mjs`.
- Brand "Y" is kept from the old UI. It has no price column, so a Y quote prices everything at 0 (the Meter Box
  reports a clear error instead). Fill the `y` column in `price_items` to give it real prices.
- The calculation functions preserve the old client-side behaviour (including some known quirks, each marked
  `QUIRK` in the code and covered by a test) so quotes stay comparable during the migration.
