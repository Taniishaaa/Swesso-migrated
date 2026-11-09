// Loads the price book for an organization: base prices + that org's overrides.
// ASSUMES step 2 (price book in the DB): a `price_items` table with columns
//   code, items, abb, mg, ge, cutlerh, seimens, lg, lt, dsmith, new_price, mbshi, z, y
// (same column names as org_price_overrides). Adjust BRAND_COLUMNS if yours differ.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { PriceRow } from "./types.ts";

const BRAND_COLUMNS: [brand: string, column: string][] = [
  ["ABB", "abb"], ["MG", "mg"], ["GE", "ge"], ["CUTLERH", "cutlerh"],
  ["SEIMENS", "seimens"], ["LG", "lg"], ["L&T", "lt"], ["DSMITH", "dsmith"],
  ["NEW", "new_price"], ["M.BSHI", "mbshi"], ["Z", "z"], ["Y", "y"],
];

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function toPriceRow(r: Row, base?: PriceRow): PriceRow {
  const out: PriceRow = { ...(base ?? {}), CODE: String(r.code), ITEMS: String(r.items ?? base?.ITEMS ?? "") };
  for (const [brand, col] of BRAND_COLUMNS) {
    // null/undefined override -> keep the base price (same as the old ?? merge)
    if (r[col] !== null && r[col] !== undefined) out[brand] = String(r[col]);
    else if (!base) out[brand] = "";
  }
  return out;
}

export async function loadPrices(supabase: SupabaseClient, orgName: string): Promise<PriceRow[]> {
  const { data: base, error: baseErr } = await supabase.from("price_items").select("*").limit(5000);
  if (baseErr || !base) throw new Error(`Failed to load price book: ${baseErr?.message}`);

  const { data: overrides, error: ovErr } = await supabase
    .from("org_price_overrides").select("*").eq("org_name", orgName);
  if (ovErr) throw new Error(`Failed to load price overrides: ${ovErr.message}`);

  const byCode = new Map<string, Row>((overrides ?? []).map((o: Row) => [String(o.code), o]));

  return base.map((r: Row) => {
    const basePrice = toPriceRow(r);
    const o = byCode.get(String(r.code));
    return o ? toPriceRow({ ...o, items: o.items ?? r.items }, basePrice) : basePrice;
  });
}
