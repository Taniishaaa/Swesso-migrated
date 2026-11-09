import { supabase } from "../supabaseClient";

export type PriceRow = {
  ITEMS: string;
} & Record<string, string>;

// price_items column -> price-book header used throughout the client.
// ("y" is intentionally not listed: brand Y has no prices yet and the override editor only edits these 11.)
const BRAND_COLUMNS: [header: string, column: string][] = [
  ["ABB", "abb"],
  ["MG", "mg"],
  ["GE", "ge"],
  ["CUTLERH", "cutlerh"],
  ["SEIMENS", "seimens"],
  ["LG", "lg"],
  ["L&T", "lt"],
  ["DSMITH", "dsmith"],
  ["NEW", "new_price"],
  ["M.BSHI", "mbshi"],
  ["Z", "z"],
];

/** The central price book, read from the `price_items` table (was client/public/stdPrices.json). */
export const loadBasePrices = async (): Promise<PriceRow[]> => {
  const { data, error } = await supabase
    .from("price_items")
    .select("*")
    .order("code", { ascending: true })
    .order("items", { ascending: true })
    .limit(5000);

  if (error || !data) {
    throw new Error(`Failed to load price book: ${error?.message ?? "no data"}`);
  }

  return data.map((r: any) => {
    const row: PriceRow = { CODE: String(r.code), ITEMS: String(r.items) };
    for (const [header, column] of BRAND_COLUMNS) {
      row[header] = r[column] === null || r[column] === undefined ? "" : String(r[column]);
    }
    return row;
  });
};

export const getMergedPricesForOrg = async (
  orgName: string
): Promise<PriceRow[]> => {
  // 1. Load base prices
  const basePrices = await loadBasePrices();

  // 2. Load overrides
  const { data: overrides, error } = await supabase
    .from("org_price_overrides")
    .select("*")
    .eq("org_name", orgName);

  if (error) {
    console.error("Failed to load overrides:", error);
    return basePrices;
  }

  // 3. Merge
  const merged = basePrices.map((row) => {
    const o = overrides?.find((x) => x.code === row.CODE);
    if (!o) return row;

    return {
      ...row,
      ITEMS: o.items ?? row.ITEMS,
      ABB: o.abb?.toString() ?? row.ABB,
      MG: o.mg?.toString() ?? row.MG,
      GE: o.ge?.toString() ?? row.GE,
      CUTLERH: o.cutlerh?.toString() ?? row.CUTLERH,
      SEIMENS: o.seimens?.toString() ?? row.SEIMENS,
      LG: o.lg?.toString() ?? row.LG,
      "L&T": o.lt?.toString() ?? row["L&T"],
      DSMITH: o.dsmith?.toString() ?? row.DSMITH,
      NEW: o.new_price?.toString() ?? row.NEW,
      "M.BSHI": o.mbshi?.toString() ?? row["M.BSHI"],
      Z: o.z?.toString() ?? row.Z,
    };
  });

  return merged;
};
