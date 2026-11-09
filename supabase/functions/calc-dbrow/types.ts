// Price book row: { CODE, ITEMS, ABB, MG, ... } with prices as strings.
export type PriceRow = { ITEMS: string } & Record<string, string>;

export interface DBRowInput {
  brand: string; // price-book brand column used for ALL lookups
  sccRating: string; // report only
  /** Normalised form values. Quantities are "" or digit strings, poles/ELR are enum strings. */
  counts: Record<string, string>;
  labour16: number; // per row, for 16-module DBs
  labour24: number; // per row, for 24-module DBs
  overheadPercent: number;
  profitPercent: number;
}

export interface BreakerResult {
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export type AccessoriesMap = Record<
  string,
  { quantity: number; unit: string; unitPrice: number; total: number }
>;

export interface ComponentItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface DisplayReport {
  summary: Record<string, string | number>;
  components: { name: string; quantity: number; unitPrice: number; total: number }[];
  totals: { labour: number; overhead: number; profit: number; misc: number; grandTotal: number };
}

export interface DBRowCalcResult {
  /** Price of ONE module (saved as unit_price). */
  unitPrice: number;
  items: ComponentItem[];
  domain: Record<string, unknown>;
  display: DisplayReport;
}
