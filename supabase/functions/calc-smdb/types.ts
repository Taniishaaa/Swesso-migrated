// Price book row: { CODE, ITEMS, ABB, MG, ... } with prices as strings.
export type PriceRow = { ITEMS: string } & Record<string, string>;

export interface SMDBInput {
  brand: string; // price-book brand column used for ALL lookups
  currentBreakerType: "Isolator" | "MCCB";
  /**
   * Normalised form values (all strings), exactly the shape the form stores:
   *  iso{size}, mccb{size} (+ _scc), out_mccb{size} (+ _scc), ryb, vm_am, Handle, PF,
   *  c_bank, padlock, copperValue, labour_*, overheadExpenses, profitPercentage.
   */
  values: Record<string, string>;
}

export interface BreakerLine { name: string; quantity: number; unitPrice: number; totalPrice: number }
export interface OtherLine { name: string; quantity: number; unitPrice: number; totalPrice: number }
export interface BusbarLine { name: string; length: number; unitPrice: number; totalPrice: number }
export interface MiscLine { name: string; quantity: number; unitPrice: number | string; totalPrice: number }

export interface ComponentItem { name: string; quantity: number; unit: string; unitPrice: number }

export interface DisplayReport {
  summary: Record<string, string | number>;
  components: { name: string; quantity: number; unitPrice: number; total: number }[];
  totals: { labour: number; overhead: number; profit: number; grandTotal: number };
}

export interface SMDBCalcResult {
  /** Price of ONE module (saved as unit_price; NOT rounded, same as the old client). */
  unitPrice: number;
  items: ComponentItem[];
  domain: Record<string, unknown>;
  display: DisplayReport;
}
