// Pure CBank800 costing engine. No I/O, no Deno/Supabase imports, so it is
// unit-testable and portable. Ported from CBank800Module.tsx (handleGenerate).
//
// Behaviour is preserved on purpose, INCLUDING known quirks (marked "QUIRK").
// Fix those deliberately later, with a test change, not silently during migration.

import type {
  CBankCalcResult, CBankInput, ComponentItem, DisplayReport, PriceRow,
} from "./types.ts";
import {
  BAKELITE_QTY, COPPER_PRICE, CU_BB, DEFAULT_COMPONENTS, EARTH_BB_LENGTH, ENCLOSURES,
  FUSE_SET_RATINGS, ISOLATOR_MAP, MCCB_MAP, SYSTEM_VOLTAGE,
} from "./tables.ts";

const NA = "Not Available";

// Case/space-insensitive row lookup. (The old client matched case-exactly, so "MCCB 35KA TP 400A" never matched
// the price book's "MCCB 35kA TP 400A" and every MCCB incomer was silently priced at 0.)
const norm = (s: string) => String(s).trim().toUpperCase();
const findRow = (prices: PriceRow[], item: string) => {
  const key = norm(item);
  return prices.find((p) => norm(p.ITEMS) === key);
};

/** Price of `item` for `brand`; 0 when the row/column is missing or not numeric. */
function priceOf(prices: PriceRow[], item: string, brand: string): number {
  const row = findRow(prices, item);
  const n = parseFloat(row?.[brand] ?? "");
  return Number.isNaN(n) ? 0 : n;
}

/**
 * QUIRK: the loop starts at 1 and stops before the last entry, so totals
 * <= 70 kVAR or > 1600 kVAR return "Not Available" and the enclosure is
 * silently left out of the cost. Preserved from the client.
 */
export function pickEnclosure(totalKvar: number): string {
  for (let i = 1; i < ENCLOSURES.length - 1; i++) {
    if (totalKvar <= ENCLOSURES[i - 1].kvar && totalKvar > ENCLOSURES[i].kvar) {
      return ENCLOSURES[i - 1].size;
    }
  }
  return NA;
}

export function fuseSetFor(kvar: number): string {
  const amps = (kvar * 1000) / (Math.sqrt(3) * SYSTEM_VOLTAGE);
  const rating = FUSE_SET_RATINGS.find((r) => r >= amps) ??
    FUSE_SET_RATINGS[FUSE_SET_RATINGS.length - 1];
  return `FUSE SET ${rating}A`;
}

/**
 * QUIRK: the regex captures the FIRST number after "ENCL ", so double-width
 * enclosures ("ENCL 2X2000X...") read as length 2 and get 8 insulators.
 */
function insulatorCount(enclosure: string): number | null {
  const m = enclosure.match(/ENCL (\d+)X/);
  if (!m) return null;
  const len = parseInt(m[1], 10);
  if (len <= 1200) return 8;
  if (len < 1800) return 11;
  if (len <= 2000) return 15;
  return 0;
}

export function calculateCBank800(
  input: CBankInput,
  prices: PriceRow[],
  copperPrice: number = COPPER_PRICE,
): CBankCalcResult {
  const b = input.capacitor;
  const price = (item: string) => priceOf(prices, item, b);

  const steps = [
    { kvar: 5, n: input.step5 },
    { kvar: 10, n: input.step10 },
    { kvar: 20, n: input.step20 },
    { kvar: 25, n: input.step25 },
    { kvar: 50, n: input.step50 },
  ];
  const rsteps = [
    { kvar: 10, n: input.Rstep10 },
    { kvar: 20, n: input.Rstep20 },
    { kvar: 25, n: input.Rstep25 },
    { kvar: 50, n: input.Rstep50 },
  ];
  const sum = (xs: number[]) => xs.reduce((a, c) => a + c, 0);

  const totalKvar = sum(steps.map((s) => s.kvar * s.n)) + sum(rsteps.map((s) => s.kvar * s.n));
  const totalSteps = sum(steps.map((s) => s.n)) + sum(rsteps.map((s) => s.n));
  const capacitorSteps = sum(steps.map((s) => s.n)); // reactors excluded (used for busbar length)

  // ---- enclosure ----
  const enclosureSize = pickEnclosure(totalKvar);
  const encRow = findRow(prices, enclosureSize);
  const encParsed = encRow && encRow[b] ? parseFloat(encRow[b]) : NaN;
  const enclosurePrice: number | string = Number.isNaN(encParsed) ? NA : encParsed;

  // ---- busbar selection from incomer rating ----
  const bb = CU_BB.find((r) => r.rating === input.incomer);
  const mainBB = bb?.mainBB ?? NA;
  const earthBB = bb?.earthB ?? NA;

  // ---- simple priced parts ----
  const sideCoverPrice = price("SIDE COVER");
  const incomerItem = input.incomerType === "isolator"
    ? ISOLATOR_MAP[input.incomer]
    : MCCB_MAP[input.incomer];
  const incomerPrice = incomerItem ? price(incomerItem) : 0;

  // ---- capacitor steps ----
  const allStepCosts = steps.map((s) => {
    const unitPrice = price(`${s.kvar}KVAR`);
    return { kvar: s.kvar, quantity: s.n, unitPrice, totalPrice: s.n * unitPrice };
  });
  const stepCosts = allStepCosts.filter((s) => s.quantity > 0);
  const stepTotal = allStepCosts.reduce((a, s) => a + s.totalPrice, 0);
  // QUIRK: counts DISTINCT step sizes used (not units) and charges 10 each.
  // Included in the total but never shown as a component line.
  const capacitorQuantity = steps.filter((s) => s.n > 0).length;

  // ---- filter reactors ----
  const reactorCosts = rsteps
    .map((s) => {
      const unitPrice = price(`FILTER REACTOR TRANSF. ${s.kvar}KVAR`);
      return { kvar: s.kvar, quantity: s.n, unitPrice, totalPrice: s.n * unitPrice };
    })
    .filter((r) => r.quantity > 0);

  // ---- contactors (one per capacitor step) ----
  const contactorCosts = steps
    .map((s) => {
      const unitPrice = price(`CONTACTOR TP ${s.kvar}KVAR`);
      return { kvar: s.kvar, quantity: s.n, unitPrice, totalPrice: s.n * unitPrice };
    })
    .filter((c) => c.quantity > 0);

  // ---- default components ----
  const defaultCosts = DEFAULT_COMPONENTS.map((c) => {
    const unitPrice = price(c.item);
    return { item: c.item, quantity: c.quantity, unitPrice, totalPrice: c.quantity * unitPrice };
  });
  const defaultTotal = defaultCosts.reduce((a, c) => a + c.totalPrice, 0);

  // ---- fuse sets ----
  const fuseCosts = steps
    .filter((s) => s.n > 0)
    .map((s) => {
      const fuseSet = fuseSetFor(s.kvar);
      const unitPrice = price(fuseSet);
      return { kvar: s.kvar, fuseSet, quantity: s.n, unitPrice, totalPrice: s.n * unitPrice };
    });

  // ---- link busbar ----
  // QUIRK: if a 100A fuse set is present, only THAT step's quantity is counted
  // (earlier steps are discarded). Also emits a line with quantity 0 when no fuses.
  let highestFuse = 0;
  let linkSteps = 0;
  for (const f of fuseCosts) {
    const rating = parseInt(f.fuseSet.split(" ")[2].replace("A", ""), 10);
    if (rating === 100) {
      highestFuse = 100;
      linkSteps = f.quantity;
      break;
    }
    if (rating <= 50) {
      highestFuse = Math.max(highestFuse, rating);
      linkSteps += f.quantity;
    }
  }
  const linkType = highestFuse <= 50 ? "CU BB 10X5" : "CU BB 15X5";
  const linkLength = linkSteps * 45; // both link types use 45
  const linkUnit = price(linkType);
  const linkBBCosts = [
    { linkBB: linkType, quantity: linkLength, unitPrice: linkUnit, totalPrice: linkLength * linkUnit },
  ];

  // ---- main busbar (length-based, copper-indexed) ----
  const mainRow = mainBB === NA ? undefined : findRow(prices, mainBB);
  const cubbCost = mainRow
    ? (() => {
      const size = (capacitorSteps * 0.08 + 0.15) * 4.5;
      const unit = price(mainBB) * copperPrice;
      return [{ cubb: mainBB, size, unitPrice: unit, totalPrice: size * unit }];
    })()
    : [];

  // ---- earth busbar ----
  const earthRow = earthBB === NA ? undefined : findRow(prices, earthBB);
  const cuEarthBB = earthRow
    ? (() => {
      const size = EARTH_BB_LENGTH[enclosureSize] || 0;
      const unit = price(earthBB) * copperPrice;
      return [{ earthBB, size, unitPrice: unit, totalPrice: size * unit }];
    })()
    : [];

  // ---- wires ----
  const [s5, s10, s20, s25, s50] = steps.map((s) => s.n);
  const [r10, r20, r25, r50] = rsteps.map((s) => s.n);
  const wireDefs = [
    { size: "10MMSQ", qty: 2.5 * s5 },
    { size: "16MMSQ", qty: 3 * (s10 + s20 + s25 + r10 + r20 + r25) },
    { size: "25MMSQ", qty: 3 * (s50 + r50) },
    { size: "1.5MMSQ", qty: 1.25 * (2.5 * s5 + 3 * (s10 + s20 + s25 + s50 + r10 + r20 + r25 + r50)) },
  ];
  const wireCosts = wireDefs.map((w) => {
    const unitPrice = price(`WIRE ${w.size}`);
    return { size: w.size, quantity: w.qty, unitPrice, totalPrice: w.qty * unitPrice };
  });

  // ---- bakelite sheet & insulators ----
  const bakeQty = BAKELITE_QTY[enclosureSize] || 0;
  const bakeUnit = price("BSHEET");
  const bakeliteSheetCost = { quantity: bakeQty, unitPrice: bakeUnit, totalPrice: bakeQty * bakeUnit };

  const insQty = insulatorCount(enclosureSize);
  const insUnit = price("INSULATORS");
  const insulators = insQty === null
    ? []
    : [{ item: "INSULATORS", quantity: insQty, unitPrice: insUnit, totalPrice: insQty * insUnit }];

  // ---- totals ----
  const tp = (xs: { totalPrice: number }[]) => xs.reduce((a, x) => a + (x.totalPrice || 0), 0);
  const partsCost = sideCoverPrice + incomerPrice + tp(allStepCosts) + tp(reactorCosts) +
    tp(contactorCosts) + defaultTotal + tp(fuseCosts) + tp(linkBBCosts) + tp(cubbCost) +
    tp(cuEarthBB) + tp(wireCosts) + bakeliteSheetCost.totalPrice + tp(insulators) +
    capacitorQuantity * 10;

  const finalCost = partsCost + (typeof enclosurePrice === "number" ? enclosurePrice : 0);

  // QUIRK: 0% cannot be chosen; 0 falls back to the default (10% labour, 5% overhead).
  const labourCost = input.labour === 0 ? 0.1 * finalCost : (input.labour / 100) * finalCost;
  const overheadCost = input.overhead === 0 ? 0.05 * finalCost : (input.overhead / 100) * finalCost;
  const finalPrice = finalCost + labourCost + overheadCost + input.miscellaneous;

  // ---- flat component list (project-level aggregation / Excel) ----
  const items: ComponentItem[] = [
    ...stepCosts.map((i) => ({ name: `${i.kvar} KVAR CAPACITOR`, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...reactorCosts.map((i) => ({ name: `REACTOR ${i.kvar} KVAR`, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...contactorCosts.map((i) => ({ name: `CONTACTOR ${i.kvar} KVAR`, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...defaultCosts.map((i) => ({ name: i.item, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...fuseCosts.map((i) => ({ name: i.fuseSet, quantity: i.quantity, unit: "Set", unitPrice: i.unitPrice })),
    ...linkBBCosts.map((i) => ({ name: i.linkBB, quantity: i.quantity, unit: "mm", unitPrice: i.unitPrice })),
    ...cubbCost.map((i) => ({ name: i.cubb, quantity: i.size, unit: "m", unitPrice: i.unitPrice })),
    ...cuEarthBB.map((i) => ({ name: i.earthBB, quantity: i.size, unit: "m", unitPrice: i.unitPrice })),
    ...wireCosts.map((i) => ({ name: `WIRE ${i.size}`, quantity: i.quantity, unit: "m", unitPrice: i.unitPrice })),
    ...insulators.map((i) => ({ name: "INSULATORS", quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...(bakeliteSheetCost.totalPrice
      ? [{ name: "BAKELITE SHEET", quantity: bakeliteSheetCost.quantity, unit: "Sheet", unitPrice: bakeliteSheetCost.unitPrice }]
      : []),
  ];

  const display: DisplayReport = {
    summary: {
      Capacitor: b,
      Incomer: input.incomer,
      IncomerType: input.incomerType,
      TotalKVAR: totalKvar,
      TotalSteps: totalSteps,
      Enclosure: enclosureSize,
      LabourPerc: input.labour,
      OverheadPerc: input.overhead,
    },
    components: [
      ...(typeof enclosurePrice === "number"
        ? [{ name: "ENCLOSURE", quantity: 1, unitPrice: enclosurePrice, total: enclosurePrice }]
        : []),
      ...(sideCoverPrice ? [{ name: "SIDE COVER", quantity: 1, unitPrice: sideCoverPrice, total: sideCoverPrice }] : []),
      ...(incomerPrice ? [{ name: "INCOMER", quantity: 1, unitPrice: incomerPrice, total: incomerPrice }] : []),
      ...items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice })),
    ],
    totals: { labour: labourCost, overhead: overheadCost, misc: input.miscellaneous, grandTotal: finalPrice },
  };

  const domain = {
    Capacitor: b,
    Contactor: input.contactorBrand,
    Fuses: input.fusesBrand,
    IncomerBrand: input.incomerBrand,
    IncomerType: input.incomerType,
    Incomer: input.incomer,
    Total_KVAR: totalKvar,
    Total_Steps: totalSteps,
    Enclosure: enclosureSize,
    MainBB: mainBB,
    EarthBB: earthBB,
    Enclosure_Price: enclosurePrice,
    Steps: { step5: s5, step10: s10, step20: s20, step25: s25, step50: s50 },
    ReactorSteps: { Rstep10: r10, Rstep20: r20, Rstep25: r25, Rstep50: r50 },
    SideCoverPrice: sideCoverPrice,
    IncomerPrice: incomerPrice,
    StepCosts: stepCosts,
    FilterSteps: reactorCosts,
    ContactorCosts: contactorCosts,
    DefaultComponentCosts: { defaultCosts, total: defaultTotal },
    FuseSetCosts: fuseCosts,
    LinkBB: linkBBCosts,
    CubbCost: cubbCost,
    EarthBBCost: cuEarthBB,
    WireCosts: wireCosts,
    BakeliteSheetCost: bakeliteSheetCost,
    Insulators: insulators,
    CapacitorPrice: capacitorQuantity * 10,
    Total: finalCost,
    Miscellaneous: input.miscellaneous,
    LabourCost: labourCost,
    OverheadCost: overheadCost,
    FinalCost: finalPrice,
  };

  return { unitPrice: finalPrice, items, domain, display };
}
