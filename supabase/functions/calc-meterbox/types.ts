// Price book row: { CODE, ITEMS, ABB, MG, ... } with prices as strings.
export type PriceRow = { ITEMS: string } & Record<string, string>;

export interface MeterBoxInput {
  brand: string; // price-book brand column (MCCB / enclosure / busbar / meter parts)
  incomer: number; // 100 | 125 | 160 | 200 | 250 | 300 | 400
  ct: boolean; // "put one against CT"  -> adds CT METERBOX
  meter: boolean; // "put one against METER" -> adds earth busbar, KWH meter, fuses, insulators (+ meter labour)
  copperValue: number; // AED per kg-equivalent multiplier applied to the busbar base price
  labourBase: number;
  labourMeter: number; // extra labour when METER is selected
  overheadPercent: number;
  profitPercent: number;
}

export interface LineItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface DisplayReport {
  summary: Record<string, string | number>;
  components: { name: string; quantity: number; unitPrice: number; total: number }[];
  totals: { labour: number; overhead: number; profit: number; grandTotal: number };
}

export interface MeterBoxCalcResult {
  /** Price of ONE meter box (saved as unit_price), rounded to 2dp. */
  unitPrice: number;
  items: LineItem[];
  domain: Record<string, unknown>;
  display: DisplayReport;
}
