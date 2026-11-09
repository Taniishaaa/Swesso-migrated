// Pure DBRow costing engine (no I/O). Ported from DBRowModule.tsx.
// Behaviour is preserved on purpose, including quirks (marked "QUIRK").

import type {
  AccessoriesMap, BreakerResult, ComponentItem, DBRowCalcResult, DBRowInput, DisplayReport, PriceRow,
} from "./types.ts";
import { CON_IDS, ELCB_IDS, ISO_IDS, MAX_ROWS, MCB_IDS, POLE_MODULES, ROW_SIZES } from "./tables.ts";

/** Thrown for business-rule failures the user can act on (e.g. "does not fit"). */
export class CalcError extends Error {}

const norm = (s: string) => s.toString().trim().toUpperCase();

/** Case/space-insensitive price lookup (first match wins). Missing/non-numeric => 0. */
function makePriceLookup(prices: PriceRow[], brand: string) {
  const index = new Map<string, PriceRow>();
  for (const p of prices) {
    const k = norm(String(p.ITEMS));
    if (!index.has(k)) index.set(k, p);
  }
  return (name: string): number => {
    const row = index.get(norm(name));
    const n = parseFloat(row?.[brand] ?? "");
    return Number.isNaN(n) ? 0 : n;
  };
}

type Placed = { id: string; modules: number };

function tryAllocate(breakers: Placed[], rowCapacity: number) {
  const rows: Placed[][] = [[]];
  for (const breaker of breakers) {
    let placed = false;
    for (const row of rows) {
      const used = row.reduce((sum, b) => sum + b.modules, 0);
      if (rowCapacity - used >= breaker.modules) {
        row.push(breaker);
        placed = true;
        break; // QUIRK: first-fit, in input order (no sorting / best-fit)
      }
    }
    if (!placed) {
      if (rows.length < MAX_ROWS) rows.push([breaker]);
      else return null;
    }
  }
  return { dbSize: rowCapacity, rowsUsed: rows.length };
}

const toInt = (s: string | undefined) => parseInt(s || "0", 10) || 0;

export function calculateDBRow(input: DBRowInput, prices: PriceRow[]): DBRowCalcResult {
  const { brand, counts } = input;
  const price = makePriceLookup(prices, brand);
  const c = (k: string) => counts[k] || "";

  // ---------- 1) layout: pack breakers into rows ----------
  const modulesFor = (pole: string) => POLE_MODULES[pole] || 1;
  const breakerIds = [
    ...ISO_IDS.map((n) => `iso${n}`),
    ...ELCB_IDS.map((n) => `elcb${n}`),
    ...MCB_IDS.map((n) => `mcb${n}`),
    ...CON_IDS.map((n) => `con${n}`),
  ];

  const all: Placed[] = [];
  const uvr = { SP: 0, TP: 0 };
  for (const id of breakerIds) {
    const qty = toInt(counts[id]);
    const pole = c(`${id}_pole`) || "SP";
    for (let i = 0; i < qty; i++) {
      all.push({ id, modules: modulesFor(pole) });
      if (id.startsWith("con")) {
        // each contactor drags in a 2-module UVR placed right after it
        if (pole === "2P" || pole === "DP") { all.push({ id: "UVR SP", modules: 2 }); uvr.SP++; }
        else if (pole === "3P" || pole === "TP") { all.push({ id: "UVR TP", modules: 2 }); uvr.TP++; }
        // (a 4P contactor would get no UVR, but the UI only offers DP/TP/3P)
      }
    }
  }
  for (let i = 0; i < toInt(counts["conTimer"]); i++) all.push({ id: "TIMER 24HRS", modules: 2 });
  for (let i = 0; i < toInt(counts["con_strTimer"]); i++) all.push({ id: "STAIRCASE TIMER", modules: 2 });

  let layout = null as ReturnType<typeof tryAllocate>;
  for (const size of ROW_SIZES) {
    layout = tryAllocate(all, size);
    if (layout) break;
  }
  if (!layout) throw new CalcError("Cannot fit into 24 module, 6 row DB!");

  const { dbSize, rowsUsed } = layout;
  const dbName = `DB ${dbSize} module ${rowsUsed} row`;
  // QUIRK: a DB size missing from the price book is priced at 0, silently.
  const dbPrice = price(dbName);
  const uvrSPCost = price("UVR SP") * uvr.SP;
  const uvrTPCost = price("UVR TP") * uvr.TP;
  const uvrTotal = uvr.SP + uvr.TP;

  // ---------- 2) breakers ----------
  const breakers: BreakerResult[] = [];
  const addBreaker = (name: string, qty: number) => {
    const unitPrice = price(name);
    breakers.push({ name, qty, unitPrice, totalPrice: qty * unitPrice });
  };
  ISO_IDS.forEach((amp) => {
    const qty = toInt(counts[`iso${amp}`]);
    if (qty > 0) addBreaker(`ISOLATOR ${c(`iso${amp}_pole`) || "TP"} ${amp}A`, qty);
  });
  ELCB_IDS.forEach((amp) => {
    const qty = toInt(counts[`elcb${amp}`]);
    if (qty > 0) {
      addBreaker(`ELCB ${c(`elcb${amp}_pole`) || "2P"} ${amp}A ${c(`elcb${amp}_elr`) || "300MA"}`, qty);
    }
  });
  MCB_IDS.forEach((amp) => {
    const qty = toInt(counts[`mcb${amp}`]);
    if (qty > 0) addBreaker(`MCB ${c(`mcb${amp}_pole`) || "SP"} ${amp === 10 ? "10-40A" : "50/60A"}`, qty);
  });
  CON_IDS.forEach((amp) => {
    const qty = toInt(counts[`con${amp}`]);
    if (qty > 0) {
      const pole = c(`con${amp}_pole`) || (amp === 63 ? "3P" : "DP");
      addBreaker(`CONT ${pole === "3P" ? "TP" : pole} ${amp}A`, qty);
    }
  });
  for (const { id, name } of [
    { id: "conTimer", name: "TIMER 24HRS" },
    { id: "con_strTimer", name: "STAIRCASE TIMER" },
  ]) {
    const qty = toInt(counts[id]);
    if (qty > 0) addBreaker(name, qty);
  }

  // ---------- 3) accessories ----------
  let totalELCBs = 0;
  let elcb4P = 0;
  ELCB_IDS.forEach((n) => {
    const qty = toInt(counts[`elcb${n}`]);
    totalELCBs += qty;
    if ((c(`elcb${n}_pole`) || "2P") === "4P") elcb4P += qty;
  });
  const totalMCBs = MCB_IDS.reduce((a, n) => a + toInt(counts[`mcb${n}`]), 0);

  const accItems = [
    { name: "Neutral Link", quantity: rowsUsed, unit: "nos" },
    { name: "Earth Bar", quantity: +(0.2 * rowsUsed).toFixed(2), unit: "metres" },
    { name: "WIRE 10MMSQ DB", quantity: +(1.5 * totalELCBs).toFixed(2), unit: "metres" },
    { name: "WIRE 1.5MMSQ DB", quantity: +(0.5 * uvrTotal).toFixed(2), unit: "metres" },
    { name: "Blank Covers", quantity: rowsUsed, unit: "nos" },
    { name: "CBB 3P", quantity: +(totalMCBs * 0.0175).toFixed(3), unit: "nos" },
    { name: "CBB 4P", quantity: +(elcb4P * 0.0715).toFixed(3), unit: "nos" },
  ];
  const accessories: AccessoriesMap = {};
  for (const it of accItems) {
    const unitPrice = price(it.name);
    accessories[it.name] = {
      quantity: it.quantity,
      unit: it.unit,
      unitPrice,
      total: +(unitPrice * it.quantity).toFixed(2),
    };
  }

  // ---------- 4) totals ----------
  const labour = dbSize === 16 ? input.labour16 * rowsUsed : input.labour24 * rowsUsed;
  const others = parseFloat(counts["c_others"] || "0") || 0;

  let total = dbPrice + uvrSPCost + uvrTPCost;
  breakers.forEach((b) => (total += b.totalPrice));
  Object.values(accessories).forEach((a) => (total += a.total));
  total += labour + others;

  const overheadAmt = (input.overheadPercent * total) / 100;
  const profitAmt = (input.profitPercent * (total + overheadAmt)) / 100; // profit on cost+overhead
  const grandTotal = total + overheadAmt + profitAmt;

  const dbEntry = { name: dbName, price: dbPrice, module: dbSize };
  const report = {
    breakerBrand: brand,
    SCC_Rating: input.sccRating,
    Overhead_perc: input.overheadPercent,
    Profit_perc: input.profitPercent,
    Breakers: breakers,
    Db: [
      dbEntry,
      { type: "UVR SP", quantity: uvr.SP, price: uvrSPCost },
      { type: "UVR TP", quantity: uvr.TP, price: uvrTPCost },
    ],
    Accessories: accessories,
    Labour_Cost: labour,
    Others: others,
    Overhead: overheadAmt,
    Profit: profitAmt,
    Total: grandTotal,
  };

  // ---------- 5) flat list + display ----------
  const uvrLine = (type: string, quantity: number, totalCost: number): ComponentItem => ({
    name: type,
    quantity,
    unit: "Nos",
    unitPrice: quantity ? totalCost / quantity : totalCost,
  });
  const items: ComponentItem[] = [
    { name: dbName, quantity: 1, unit: "Nos", unitPrice: dbPrice },
    uvrLine("UVR SP", uvr.SP, uvrSPCost),
    uvrLine("UVR TP", uvr.TP, uvrTPCost),
    ...breakers.map((b) => ({ name: b.name, quantity: b.qty, unit: "Nos", unitPrice: b.unitPrice })),
    ...Object.entries(accessories).map(([name, a]) => ({
      name, quantity: a.quantity, unit: a.unit, unitPrice: a.unitPrice,
    })),
  ];

  const display: DisplayReport = {
    summary: {
      BreakerBrand: brand,
      SCCRating: input.sccRating,
      DBType: dbName,
      RowsUsed: rowsUsed,
      OverheadPerc: input.overheadPercent,
      ProfitPerc: input.profitPercent,
    },
    components: items.map((i) => ({
      name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice,
    })),
    totals: { labour, overhead: overheadAmt, profit: profitAmt, misc: others, grandTotal },
  };

  return { unitPrice: +grandTotal.toFixed(2), items, domain: report, display };
}
