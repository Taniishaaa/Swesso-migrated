// Pure SMDB costing engine (no I/O). Ported from SMDBModule.tsx.
// Behaviour is preserved on purpose, including quirks (marked "QUIRK").

import type {
  BreakerLine, BusbarLine, ComponentItem, DisplayReport, MiscLine, OtherLine, PriceRow, SMDBCalcResult, SMDBInput,
} from "./types.ts";
import {
  BB_SELECTION, DEFAULTS, ENCLOSURE_BAKELITE, ENCLOSURE_STEPS, INCOMER_DATA, INCOMER_IDS,
  ISOLATOR_SIZES, MCCB_SIZES, OUTGOING_BREAKER_LENGTH, OUTGOING_IDS, OUTGOING_SIZES,
} from "./tables.ts";

const upTrim = (s: unknown) => String(s ?? "").toUpperCase().trim();

export function calculateSMDB(input: SMDBInput, prices: PriceRow[]): SMDBCalcResult {
  const { brand, currentBreakerType: breakerType, values } = input;

  // first row whose ITEMS (upper+trim) equals `name` (name must already be upper-case)
  const find = (name: string) => prices.find((e) => upTrim(e.ITEMS) === name);
  const unitOf = (name: string) => parseFloat(find(name)?.[brand] ?? "") || 0;
  const q = (id: string) => parseInt(values[id] || "0", 10) || 0;

  // QUIRK: 0 / blank / invalid fall back to the default, so 0 can't be chosen deliberately.
  const numOr = (id: string, def: number) => parseFloat(values[id] || "") || def;
  const copperRate = numOr("copperValue", DEFAULTS.copper);
  const overheadPct = numOr("overheadExpenses", DEFAULTS.overheadExpenses);
  const profitPct = numOr("profitPercentage", DEFAULTS.profitPercentage);

  // ---------- labour (computed from quantities) ----------
  const L = {
    800: numOr("labour_800", DEFAULTS.labour_800), 630: numOr("labour_630", DEFAULTS.labour_630),
    400: numOr("labour_400", DEFAULTS.labour_400), 300: numOr("labour_300", DEFAULTS.labour_300),
    250: numOr("labour_250", DEFAULTS.labour_250), 160: numOr("labour_160", DEFAULTS.labour_160),
    125: numOr("labour_125", DEFAULTS.labour_125), pf: numOr("labour_pf", DEFAULTS.labour_pf),
    handle: numOr("labour_handle", DEFAULTS.labour_handle),
  };
  const inc = (s: string) => q(`iso${s}`) + q(`mccb${s}`); // incomer qty of a size, either type
  const out = (s: string) => q(`out_mccb${s}`);
  const labour =
    q("PF") * L.pf +
    q("Handle") * L.handle +
    inc("800") * L[800] +
    (inc("630") + out("630")) * L[630] +
    (inc("400") + out("400")) * L[400] +
    (inc("300") + out("300")) * L[300] +
    (inc("250") + out("250")) * L[250] +
    (inc("200") + out("200")) * L[250] + // QUIRK: 200A uses the 250A rate
    (inc("160") + out("160")) * L[160] +
    (inc("125") + out("125")) * L[125] +
    (inc("100") + out("100")) * L[125] + // QUIRK: 100A/80A and all small outgoings use the 125A rate
    (inc("80") + out("80")) * L[125] +
    (out("63") + out("50") + out("40") + out("32") + out("25") + out("16") + out("10") + out("sp100")) * L[125];

  // ---------- incomer specs / enclosure ----------
  let TMN = 0;
  let HEIGHT = 0;
  for (const id of INCOMER_IDS) {
    if ((values[id] || "").trim() === "1") {
      const data = INCOMER_DATA[`${id.match(/\d+/)?.[0]}A`];
      if (data) { TMN = data.TMN; HEIGHT = data.HEIGHT; }
      break;
    }
  }
  const CT_SPACE = values["vm_am"] === "1" ? 7.5 : 0;
  const INSULATORS = 10;

  let totalLength = 0;
  for (const s of OUTGOING_SIZES) {
    totalLength += q(`out_mccb${s}`) * (OUTGOING_BREAKER_LENGTH[s === "sp100" ? "101A" : `${s}A`] || 0);
  }
  const H_L = totalLength > 0 ? totalLength / 2 : 0;

  const a = TMN + HEIGHT + CT_SPACE + INSULATORS + H_L;
  // QUIRK: above 202 there is no enclosure ("N/A"): it is silently left out of the cost.
  const enclosure = ENCLOSURE_STEPS.find(([max]) => a <= max)?.[1] ?? "N/A";

  // ---------- enclosure price (whitespace-insensitive match) ----------
  const encKey = enclosure.replace(/\s+/g, "").toUpperCase();
  const encRow = prices.find((e) => String(e.ITEMS ?? "").replace(/\s+/g, "").toUpperCase() === encKey);
  let enclosurePriceValue: number | string;
  if (!encRow) enclosurePriceValue = "Enclosure not found";
  else {
    const n = parseFloat(encRow[brand]);
    enclosurePriceValue = !isNaN(n) && isFinite(n) ? n : "Price not available for selected brand";
  }

  // ---------- breakers (same type+SCC+pole+amp lines are merged) ----------
  const breakerMap = new Map<string, BreakerLine>();
  const groups: { type: string; ids: string[] }[] = [
    { type: "ISOLATOR", ids: ISOLATOR_SIZES.map((s) => `iso${s}`) },
    { type: "MCCB", ids: MCCB_SIZES.map((s) => `mccb${s}`) },
    { type: "MCCB", ids: OUTGOING_IDS },
  ];
  for (const g of groups) {
    for (const id of g.ids) {
      const qty = q(id);
      if (!qty) continue;
      const scc = values[`${id}_scc`] || "35kA";
      const amp = `${id.match(/\d+/)?.[0] ?? ""}A`;
      const pole = id === "out_mccbsp100" ? "SP" : "TP";
      const key = `${g.type} ${scc} ${pole} ${amp}`.toUpperCase().trim();
      const entry = find(key);
      const unitPrice = entry?.[brand] ? parseFloat(entry[brand]) || 0 : 0;
      const line = breakerMap.get(key) ?? { name: key, quantity: 0, unitPrice, totalPrice: 0 };
      line.quantity += qty;
      line.totalPrice = line.quantity * line.unitPrice;
      breakerMap.set(key, line);
    }
  }
  const breakers = [...breakerMap.values()];

  // ---------- other components ----------
  const computed: [string, number][] = [
    ["RYB LAMPS & WIRE", 3 * q("ryb")],
    ["AM", 3 * q("vm_am")],
    ["VM", q("vm_am")],
    ["S/S", 2 * q("vm_am")],
    ["SMDB CT", 3 * q("vm_am") + q("PF") + q("c_bank")],
    ["HANDLE", q("Handle")],
    ["PF METER", q("PF")],
    ["FUSES", 3 * q("vm_am")],
    ["WIRE 1.5MMSQ", 25 * q("vm_am")],
  ];
  const others: OtherLine[] = [];
  for (const [name, qty] of computed) {
    if (!qty) continue;
    const unitPrice = unitOf(name);
    others.push({ name, quantity: qty, unitPrice, totalPrice: qty * unitPrice });
  }

  // ---------- copper busbars ----------
  const dims = enclosure.match(/ENCL\s*(\d+)x(\d+)x(\d+)/i);
  const length = dims ? +dims[1] / 1000 : 0; // (first number of the enclosure name)
  const height = dims ? +dims[3] / 1000 : 0; // (third number)
  const bbMap = new Map<string, number>();
  let earthAdded = false;
  for (const id of [...INCOMER_IDS, ...OUTGOING_IDS]) {
    const qty = q(id);
    if (!qty) continue;
    const rating = id === "out_mccbsp100" ? 100 : parseInt(id.match(/\d+/)?.[0] || "0", 10);
    const bb = BB_SELECTION.find((b) => rating >= b.rating) ?? BB_SELECTION[BB_SELECTION.length - 1];
    if (id.startsWith("out_")) {
      bbMap.set(bb.main, (bbMap.get(bb.main) || 0) + qty * 0.75);
    } else {
      bbMap.set(bb.main, (bbMap.get(bb.main) || 0) + qty * 3.5 * 0.75 * length);
      if (!earthAdded) {
        // QUIRK: set() (not add). For 100A/80A incomers main == earth, so this OVERWRITES the main length.
        bbMap.set(bb.earth, 0.5 * 0.75 * height);
        earthAdded = true;
      }
    }
  }
  const busbars: BusbarLine[] = [];
  for (const [name, len] of bbMap.entries()) {
    const price = +(unitOf(name) * copperRate).toFixed(2);
    const total = +(price * len).toFixed(2);
    busbars.push({ name, length: +len.toFixed(2), unitPrice: price, totalPrice: total });
  }

  // ---------- misc components ----------
  const totalBB = busbars.reduce((s, b) => s + (b.length || 0), 0);
  let incoming = 0;
  let outgoing = 0;
  for (const id of [...INCOMER_IDS, ...OUTGOING_IDS]) {
    const n = q(id);
    if (!n) continue;
    if (id.startsWith("out_")) outgoing += n; else incoming += n;
  }
  const totalBreakers = incoming + outgoing;
  const misc: MiscLine[] = [];
  const pushMisc = (name: string, qty: number) => {
    const unit = unitOf(name);
    misc.push({ name, quantity: qty, unitPrice: unit, totalPrice: +(qty * unit).toFixed(2) });
  };
  pushMisc("INSULATORS", 8);
  pushMisc("COL SLEEVE SMDB", totalBB);
  pushMisc("CHANNAL", 1.5);
  pushMisc("PADLOCK", q("padlock"));
  pushMisc("BSHEET", ENCLOSURE_BAKELITE[enclosure] || 0);
  const nutBolt = incoming * 6 + outgoing * 1.5;
  misc.push({ name: "NUTS & BOLTS", quantity: totalBreakers, unitPrice: "-", totalPrice: +nutBolt.toFixed(2) });
  pushMisc("BRAKETS", totalBreakers);

  // ---------- totals ----------
  const sum = (xs: { totalPrice: number }[]) => xs.reduce((s, x) => s + x.totalPrice, 0);
  // NUTS & BOLTS is shown rounded but was added to the total unrounded in the old code.
  const miscCost = sum(misc.filter((m) => m.name !== "NUTS & BOLTS")) + nutBolt;
  const base =
    (typeof enclosurePriceValue === "number" ? enclosurePriceValue : 0) +
    sum(breakers) + sum(others) + sum(busbars) + miscCost;

  let totalCost = base + labour;
  const overheadAmt = (overheadPct * totalCost) / 100;
  totalCost += overheadAmt;
  const profitAmt = (profitPct * totalCost) / 100; // profit on cost + overhead
  totalCost += profitAmt;

  // ---------- report objects ----------
  const domain = {
    BreakerType: breakerType,
    Brand: brand,
    Copper_Price: copperRate,
    Overhead_Percent: overheadPct,
    Profit_Percent: profitPct,
    TMN, IncomerHeight: HEIGHT, CT_space: CT_SPACE, Insulators: INSULATORS, H_L,
    Enclosure: enclosure,
    Enclosure_Price: enclosurePriceValue,
    Breaker: breakers,
    Other: others,
    CU_BB: busbars,
    Miscellaneous: misc,
    Labour: labour,
    Overhead_Expenses: overheadAmt,
    Profit: profitAmt,
    Total: totalCost,
  };

  const items: ComponentItem[] = [
    ...breakers.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...others.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...busbars.map((i) => ({ name: i.name, quantity: i.length, unit: "m", unitPrice: i.unitPrice })),
    ...misc.map((i) => ({
      name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: typeof i.unitPrice === "number" ? i.unitPrice : 0,
    })),
    ...(typeof enclosurePriceValue === "number"
      ? [{ name: enclosure, quantity: 1, unit: "Nos", unitPrice: enclosurePriceValue }]
      : []),
  ];

  const display: DisplayReport = {
    summary: {
      BreakerType: breakerType,
      BreakerBrand: brand,
      CopperPrice: copperRate,
      OverheadPerc: overheadPct,
      ProfitPerc: profitPct,
      Enclosure: enclosure,
    },
    components: items.map((i) => ({
      name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice,
    })),
    totals: { labour, overhead: overheadAmt, profit: profitAmt, grandTotal: totalCost },
  };

  return { unitPrice: totalCost, items, domain, display };
}
