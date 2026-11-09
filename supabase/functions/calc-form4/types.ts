// Price book row: { CODE, ITEMS, ABB, MG, ... } with prices as strings.
export type PriceRow = { ITEMS: string } & Record<string, string>;

export interface Form4Input {
  breakerType: "ACB" | "MCCB";
  /**
   * Normalised form values (all strings), same shape the form stores:
   * breakerType, brand, depth_choice, acb{r}(+_type/_scc/_pole), mccb{r}(+_scc/_poles),
   * bus_acb{r}, bus_mccb{r}, out_acb{r}, out_mccb{r}, out_mccbsp100, accessories,
   * copperValue, labour_*, overheadExpenses, profitPercentage.
   */
  values: Record<string, string>;
}

export interface Grouping { enclosure: string; breakers: number[] }

export interface EnclosureLine { name: string; unitPrice: number; quantity: number; totalPrice: number }
export interface SelectedItem { item: string; quantity: number; price: number; total: number }
export interface AccessoryItem { name: string; quantity: number; unitPrice: number; price: number }
export interface SimpleLine { name: string; quantity: number; unitPrice: number; totalPrice: number }
export interface BusbarResult { type: string; quantity: number; unitPrice: number; totalPrice: number }

export interface ComponentItem { name: string; quantity: number; unit: string; unitPrice: number }

export interface DisplayReport {
  summary: Record<string, string | number>;
  components: { name: string; quantity: number; unitPrice: number; total: number }[];
  totals: { labour: number; overhead: number; profit: number; grandTotal: number };
}

export interface Form4CalcResult {
  /** Price of ONE module (saved as unit_price; NOT rounded, same as the old client). */
  unitPrice: number;
  items: ComponentItem[];
  domain: Record<string, unknown>;
  display: DisplayReport;
  /** Derived while sizing the panel; the old client saved these inside input_json. */
  derived: { totalWidth: number; outCombinedMccbGroupings: Grouping[] };
}
