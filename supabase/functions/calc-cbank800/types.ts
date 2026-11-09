// Row shape of the price book: { CODE, ITEMS, ABB, MG, ... } (prices as strings,
// same shape the old client-side priceService produced).
export type PriceRow = { ITEMS: string } & Record<string, string>;

export interface CBankInput {
  /** Brand column that drives ALL price lookups (this is what the old UI called "capacitor"). */
  capacitor: string;
  /** Stored and echoed in the report only; the old code never used them for pricing. */
  contactorBrand: string;
  fusesBrand: string;
  incomerBrand: string;

  incomerType: "isolator" | "mccb";
  incomer: number;

  step5: number;
  step10: number;
  step20: number;
  step25: number;
  step50: number;

  Rstep10: number;
  Rstep20: number;
  Rstep25: number;
  Rstep50: number;

  miscellaneous: number;
  labour: number; // percent
  overhead: number; // percent
}

export interface ComponentItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface DisplayReport {
  summary: Record<string, string | number>;
  components: { name: string; quantity: number; unitPrice: number; total: number }[];
  totals: { labour: number; overhead: number; misc: number; grandTotal: number };
}

export interface CBankCalcResult {
  /** Price of ONE module (what the client used to save as unit_price). */
  unitPrice: number;
  items: ComponentItem[];
  domain: Record<string, unknown>;
  display: DisplayReport;
}
