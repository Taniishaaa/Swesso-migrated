// Pure Meter Box costing engine (no I/O). Built from "Meter Box.txt" and the three worked examples
// in "Meter_Box.docx" (the tests reproduce those examples exactly).

import type { DisplayReport, LineItem, MeterBoxCalcResult, MeterBoxInput, PriceRow } from "./types.ts";
import {
  EARTH_BB_LENGTH, FIXED_ITEMS, FUSES_QTY, GLAND_BOX_NAME, GLAND_BOX_PRICE, INCOMERS, INSULATORS_QTY,
  KWH_METER_QTY, MAIN_BB_LENGTH,
} from "./tables.ts";

/** Business-rule failure the user can act on (e.g. an item is missing from the price book). */
export class CalcError extends Error {}

export interface MeterBoxCalcOptions {
  /** Replace the unit price of fixed items by name (used by the tests to reproduce the old sheet). */
  priceOverrides?: Record<string, number>;
}

export function calculateMeterBox(
  input: MeterBoxInput,
  prices: PriceRow[],
  opts: MeterBoxCalcOptions = {},
): MeterBoxCalcResult {
  const cfg = INCOMERS[input.incomer];
  if (!cfg) throw new CalcError("Please select a valid incomer rating.");

  const { brand } = input;
  const override = (name: string, price: number) => opts.priceOverrides?.[name] ?? price;

  // Items that come from the central price book. Unlike the older modules, a missing price is an
  // ERROR here (not a silent 0), so a quote can't go out under-priced without anyone noticing.
  const missing = new Set<string>();
  const book = (name: string): number => {
    const row = prices.find((p) => String(p.ITEMS).trim() === name);
    const n = parseFloat(row?.[brand] ?? "");
    if (!Number.isFinite(n)) {
      missing.add(name);
      return 0;
    }
    return n;
  };

  const fixed = (f: { name: string; price: number; quantity: number; unit: string }): LineItem => ({
    name: f.name, quantity: f.quantity, unit: f.unit, unitPrice: override(f.name, f.price),
  });

  // Same order as the estimate sheet.
  const lines: LineItem[] = [];
  lines.push({ name: cfg.enclosure, quantity: 1, unit: "Nos", unitPrice: book(cfg.enclosure) });
  lines.push({ name: cfg.mccb, quantity: 1, unit: "Nos", unitPrice: book(cfg.mccb) });
  lines.push(fixed(FIXED_ITEMS.windowGlass));
  lines.push(fixed(FIXED_ITEMS.ply));
  lines.push(fixed(FIXED_ITEMS.padLock));
  lines.push({ name: cfg.mainBB, quantity: MAIN_BB_LENGTH, unit: "m", unitPrice: book(cfg.mainBB) * input.copperValue });
  if (input.meter) {
    lines.push({ name: cfg.earthBB, quantity: EARTH_BB_LENGTH, unit: "m", unitPrice: book(cfg.earthBB) * input.copperValue });
  }
  lines.push(fixed(FIXED_ITEMS.bsheet));
  lines.push(fixed(FIXED_ITEMS.colSleeve));
  if (input.meter) lines.push({ name: "KWH METER", quantity: KWH_METER_QTY, unit: "Nos", unitPrice: book("KWH METER") });
  if (input.ct) lines.push(fixed(FIXED_ITEMS.ctMeterbox));
  if (input.meter) {
    lines.push({ name: "FUSES", quantity: FUSES_QTY, unit: "Nos", unitPrice: book("FUSES") });
    lines.push({ name: "INSULATORS", quantity: INSULATORS_QTY, unit: "Nos", unitPrice: book("INSULATORS") });
  }
  lines.push(fixed(FIXED_ITEMS.nutBolts));
  lines.push({
    name: GLAND_BOX_NAME,
    quantity: 1,
    unit: "Nos",
    unitPrice: override(GLAND_BOX_NAME, GLAND_BOX_PRICE[cfg.enclosure]),
  });

  if (missing.size > 0) {
    throw new CalcError(
      `Price not found in the price book for ${[...missing].join(", ")} (brand ${brand}). ` +
        `Add the item(s) or choose another brand.`,
    );
  }

  // ---------- totals ----------
  const material = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const labour = input.labourBase + (input.meter ? input.labourMeter : 0);
  const cost = material + labour;
  const overheadAmt = (input.overheadPercent * cost) / 100;
  const profitAmt = (input.profitPercent * (cost + overheadAmt)) / 100; // profit on cost + overhead
  const grandTotal = cost + overheadAmt + profitAmt;

  const metering = input.ct && input.meter ? "CT + Meter" : input.ct ? "CT" : input.meter ? "Meter" : "None";

  const domain = {
    Brand: brand,
    Incomer: input.incomer,
    Enclosure: cfg.enclosure,
    Mccb: cfg.mccb,
    MainBB: cfg.mainBB,
    EarthBB: input.meter ? cfg.earthBB : null,
    CT: input.ct,
    Meter: input.meter,
    CopperPrice: input.copperValue,
    Components: lines.map((l) => ({ ...l, total: l.quantity * l.unitPrice })),
    MaterialCost: material,
    Labour: labour,
    Overhead: overheadAmt,
    Profit: profitAmt,
    Total: grandTotal,
  };

  const display: DisplayReport = {
    summary: {
      Brand: brand,
      Incomer: `${input.incomer}A`,
      Enclosure: cfg.enclosure,
      Metering: metering,
      CopperPrice: input.copperValue,
      MaterialCost: Number(material.toFixed(2)),
      OverheadPerc: input.overheadPercent,
      ProfitPerc: input.profitPercent,
    },
    components: lines.map((l) => ({
      name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, total: l.quantity * l.unitPrice,
    })),
    totals: { labour, overhead: overheadAmt, profit: profitAmt, grandTotal },
  };

  return { unitPrice: +grandTotal.toFixed(2), items: lines, domain, display };
}
