// Pure Form 4 MDB costing engine (no I/O). Ported from Form4Module.tsx.
// Behaviour is preserved on purpose, including quirks (marked "QUIRK").
//
// The old code mutated refs (totalCostRef, totalWidthRef, groupingsRef) across async
// helpers. Here the data flow is explicit: sizeEnclosures() -> pricing -> busbars.

import type {
  AccessoryItem, BusbarResult, ComponentItem, DisplayReport, EnclosureLine, Form4CalcResult, Form4Input,
  Grouping, PriceRow, SelectedItem, SimpleLine,
} from "./types.ts";
import {
  BUSBAR_MAP, COMBINED_MCCB_WIDTH, DEFAULT_COPPER, DEFAULT_LABOUR, DEFAULT_OVERHEAD, DEFAULT_PROFIT,
  HARDWARE_MARKUP, USABLE_HEIGHT,
} from "./tables.ts";

const numOr = (v: string | undefined, def: number) => {
  // "" / missing => default. "0" is kept (a non-empty string is truthy), so 0 IS allowed.
  if (v === undefined || v === "") return def;
  const n = parseFloat(v);
  return Number.isNaN(n) ? def : n;
};
const round2 = (n: number) => Number(n.toFixed(2));
const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

export function calculateForm4(input: Form4Input, prices: PriceRow[]): Form4CalcResult {
  const { breakerType, values } = input;
  const brand = values["brand"] || "";
  const q = (k: string): number => parseInt(values[k] || "0", 10) || 0;

  const exact = (name: string) => prices.find((e) => e.ITEMS === name);
  const trimmed = (name: string) => prices.find((e) => String(e.ITEMS).trim() === name.trim());
  const cell = (row: PriceRow | undefined) => parseFloat(row?.[brand] ?? "");

  const copperValue = numOr(values["copperValue"], DEFAULT_COPPER);
  const lab = (id: string) => numOr(values[id], DEFAULT_LABOUR[id]);
  const overheadPct = numOr(values["overheadExpenses"], DEFAULT_OVERHEAD);
  const profitPct = numOr(values["profitPercentage"], DEFAULT_PROFIT);

  // ---------- labour ----------
  const qa = (acb: number) => q(`acb${acb}`) + q(`out_acb${acb}`) + q(`bus_acb${acb}`);
  const qm = (m: number) => q(`mccb${m}`) + q(`out_mccb${m}`) + q(`bus_mccb${m}`);
  const o = (m: number | string) => q(`out_mccb${m}`);
  const labour =
    (qa(4000) + qa(3200)) * lab("labour_acb_4000_3200") +
    (qa(2500) + qa(2000) + qa(1600)) * lab("labour_acb_2500_1600") +
    (qa(1250) + qa(1000) + q("out_acb800") + q("out_acb630")) * lab("labour_acb_1250_1000") +
    qm(3200) * lab("labour_mccb_3200") +
    (qm(2500) + qm(2000) + qm(1600)) * lab("labour_mccb_2500_1600") +
    (qm(1250) + qm(1000) + o(800)) * lab("labour_mccb_1250_800") +
    (o(630) + o(500) + o(400) + o(300)) * lab("labour_mccb_630_300") +
    (o(250) + o(200) + o(160) + o(125) + o(100) + o(80) + o(63) + o(40) + o(32) + o(25) + o(16) + o(10) +
      o("sp100")) * lab("labour_mccb_300_sp100");

  // ---------- totals of incomers / bus couplers ----------
  const ACB_SIZES = [4000, 3200, 2500, 2000, 1600, 1250, 1000];
  const MCCB_SIZES = [3200, 2500, 2000, 1600, 1250, 1000];
  const totalACB = ACB_SIZES.reduce((s, n) => s + q(`acb${n}`), 0);
  const totalMCCB = MCCB_SIZES.reduce((s, n) => s + q(`mccb${n}`), 0);
  const totalACBBus = ACB_SIZES.reduce((s, n) => s + q(`bus_acb${n}`), 0);
  const totalBusCoupler = totalACBBus + MCCB_SIZES.reduce((s, n) => s + q(`bus_mccb${n}`), 0);
  const totalIncomers = totalACB + totalMCCB;
  const ACB_hardware = totalACB * 25;
  const MCCB_hardware = totalMCCB * 15;

  // ---------- 1) panel sizing (Form 4: 2200mm high, separate chambers) ----------
  let finalDepth = 600;
  if (q("acb4000") > 0 || q("acb3200") > 0) {
    finalDepth = 1000;
  } else if (q("acb2500") > 0 || q("acb2000") > 0 || q("acb1600") > 0) {
    finalDepth = parseInt(values["depth_choice"] || "800", 10);
  } else if (breakerType === "MCCB") {
    finalDepth = parseInt(values["depth_choice"] || "800", 10);
  }

  const enclosureMap = new Map<string, number>();
  let totalWidth = 0;
  const groupings: Grouping[] = [];
  const addEnclosure = (width: number, count = 1) => {
    const name = `ENCL 2200X${width}X${finalDepth}`;
    enclosureMap.set(name, (enclosureMap.get(name) || 0) + count);
    totalWidth += width * count;
  };

  // NOTE: the old code iterated plain objects keyed by rating, which JS always walks in
  // ASCENDING numeric order; asc() reproduces that (it decides first-insertion order).
  const acbWidth = (r: number) => (r >= 3200 ? 1200 : r >= 1600 ? 800 : 600);
  for (const r of asc([4000, 3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`acb${r}`); if (c > 0) addEnclosure(acbWidth(r), c);
  }
  for (const r of asc([4000, 3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`bus_acb${r}`); if (c > 0) addEnclosure(acbWidth(r), c);
  }
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000, 800, 630])) {
    const c = q(`out_acb${r}`); if (c > 0) addEnclosure(acbWidth(r), c);
  }
  if (totalBusCoupler > 0) addEnclosure(300, totalBusCoupler); // chamber per bus coupler
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`mccb${r}`); if (c > 0) addEnclosure(600, c);
  }
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000, 800, 630])) {
    const c = q(`out_mccb${r}`); if (c > 0) addEnclosure(500, c);
  }

  // Small outgoing MCCBs (< 630A, SP100 as "101") are stacked vertically in 500-wide
  // enclosures, HIGHEST rating first, until the usable height (1900mm) is full.
  {
    const heightFor = (rating: number) => (rating >= 300 ? 350 : rating >= 200 ? 300 : 250);
    let currentHeight = 0;
    let group: number[] = [];
    const flush = () => {
      if (group.length > 0) {
        addEnclosure(COMBINED_MCCB_WIDTH, 1);
        groupings.push({ enclosure: `ENCL 2200X${COMBINED_MCCB_WIDTH}X${finalDepth}`, breakers: [...group] });
        currentHeight = 0;
        group = [];
      }
    };
    const small = [500, 400, 300, 250, 200, 160, 125, 100, 80, 63, 40, 32, 25, 16, 10, 101];
    for (const r of [...small].sort((a, b) => b - a)) {
      const count = q(r === 101 ? "out_mccbsp100" : `out_mccb${r}`);
      const h = heightFor(r);
      for (let i = 0; i < count; i++) {
        if (currentHeight + h > USABLE_HEIGHT) flush();
        currentHeight += h;
        group.push(r);
      }
    }
    flush();
  }
  if (groupings.length > 0) addEnclosure(300, 1); // dropper chamber (mini MCCB)

  // ---------- 2) running cost ----------
  let running = 0;

  const sideCoverPrice = cell(exact("SIDE COVER")) || 0;
  running += sideCoverPrice;

  // enclosure prices; QUIRK: an enclosure missing from the price book is skipped silently
  const enclosures: EnclosureLine[] = [];
  for (const [name, quantity] of enclosureMap.entries()) {
    const unitPrice = cell(exact(name));
    if (!Number.isFinite(unitPrice)) continue;
    const totalPrice = unitPrice * quantity;
    running += totalPrice;
    enclosures.push({ name, unitPrice, quantity, totalPrice });
  }

  // small parts scaled by the TOTAL enclosure count (priced or not), +20% markup
  const enclosureQty = [...enclosureMap.values()].reduce((a, b) => a + b, 0);
  const totalOutgoing =
    [3200, 2500, 2000, 1600, 1250, 1000, 800, 630].reduce((s, n) => s + q(`out_acb${n}`), 0) +
    [3200, 2500, 2000, 1600, 1250, 1000, 800, 630, 500, 400, 300, 250, 200, 160, 125, 100, 80, 63, 40, 32, 25, 16, 10]
      .reduce((s, n) => s + q(`out_mccb${n}`), 0) +
    q("out_mccbsp100");
  const otherItems = [
    { name: "NUT&BOLTS", quantity: 100 * enclosureQty + 6 * totalOutgoing },
    { name: "BUSBAR SUPPORTS", quantity: 3 * enclosureQty },
    { name: "MUNTING BRAKETS", quantity: enclosureQty },
    { name: "COL SLEEVE", quantity: enclosureQty },
    { name: "KWH METER", quantity: 1 },
    { name: "CT", quantity: 8 },
    { name: "TRUNKING SML", quantity: 1 },
    { name: "WIRE 1.5MMSQ", quantity: 100 },
    { name: "BSHEET", quantity: enclosureQty },
    { name: "INSULATORS BIG", quantity: 9 * enclosureQty },
    { name: "PLY", quantity: 1 },
    { name: "WINDOW GLASS", quantity: 1 },
    { name: "PF METER", quantity: 1 },
  ].map((c): SimpleLine => {
    const unitPrice = (cell(exact(c.name)) || 0) * HARDWARE_MARKUP;
    const totalPrice = unitPrice * c.quantity;
    running += totalPrice;
    return { name: c.name, quantity: c.quantity, unitPrice, totalPrice };
  });

  // ---------- 3) breakers ----------
  const breakers: SelectedItem[] = [];
  const addSel = (key: string, qty: number) => {
    const price = cell(trimmed(key)) || 0;
    running += qty * price;
    breakers.push({ item: key, quantity: qty, price, total: qty * price });
  };
  for (const size of [4000, 3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`acb${size}`);
    if (qty > 0) {
      const type = (values[`acb${size}_type`] || "drawout").toLowerCase();
      const scc = values[`acb${size}_scc`] || "65kA";
      const poles = (values[`acb${size}_pole`] || "three") === "four" ? "4P" : "TP";
      addSel(`ACB ${poles} ${size}A ${scc} ${type === "fixed" ? "Fixed" : "D/O"}`, qty);
    }
  }
  for (const size of [4000, 3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`bus_acb${size}`);
    if (qty > 0) addSel(`ACB TP ${size}A`, qty);
  }
  for (const size of [3200, 2500, 2000, 1600, 1250, 1000, 800, 630]) {
    const qty = q(`out_acb${size}`);
    if (qty > 0) addSel(`ACB TP ${size}A`, qty);
  }
  for (const size of [3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`mccb${size}`);
    if (qty > 0) {
      const scc = values[`mccb${size}_scc`] || "35kA";
      const poles = values[`mccb${size}_poles`] === "4P" ? "4P" : "TP";
      addSel(`MCCB ${scc} ${poles} ${size}A`, qty);
    }
  }
  for (const size of [3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`bus_mccb${size}`);
    if (qty > 0) addSel(`MCCB 35kA TP ${size}A`, qty);
  }
  for (const size of [3200, 2500, 2000, 1600, 1250, 1000, 800, 630, 500, 400, 300, 250, 200, 160, 125, 100, 80, 63, 40, 32, 25, 16, 10]) {
    const qty = q(`out_mccb${size}`);
    if (qty > 0) addSel(`MCCB 35kA TP ${size}A`, qty);
  }
  if (q("out_mccbsp100") > 0) addSel("MCCB 25kA SP 100A", q("out_mccbsp100"));

  // ---------- 4) accessories ----------
  const accessoryNames: [string, string][] = [
    ["mechInterlock", "MECH. INTLK"], ["elecInterlock", "ELECT. INTLK"], ["earthFault", "EARTH FAULT"],
    ["shuntTrip", "SHUNT TRIP"], ["uvr", "UVR"], ["castleKey", "CASTLE KEY"], ["ach", "ACH"],
    ["closingCoil", "CLOSING COIL"], ["rotaryHandle", "ROTARY HANDLE"],
  ];
  const accessories: AccessoryItem[] = [];
  for (const [key, name] of accessoryNames) {
    const quantity = q(key);
    if (quantity === 0) continue;
    const unitPrice = cell(trimmed(name)) || 0;
    const price = quantity * unitPrice;
    running += price;
    accessories.push({ name, quantity, unitPrice, price });
  }

  // ---------- 5) metering parts per incomer ----------
  const additional = [
    { name: "TUBE SMALL", quantity: 9.2 },
    { name: "AM", quantity: totalIncomers * 3 },
    { name: "VM", quantity: totalIncomers },
    { name: "S/S", quantity: totalIncomers },
    { name: "FUSES", quantity: totalIncomers * 3 },
  ].map((c): SimpleLine => {
    const unitPrice = cell(exact(c.name)) || 0;
    const totalPrice = unitPrice * c.quantity;
    running += totalPrice;
    return { name: c.name, quantity: c.quantity, unitPrice, totalPrice };
  });

  // ---------- 6) copper busbars ----------
  const raw: BusbarResult[] = [];
  const baseOf = (type: string) => cell(exact(type)) || 0;
  const push = (type: string, suffix: string, quantity: number) => {
    const unitPrice = baseOf(type) * copperValue;
    const totalPrice = quantity * unitPrice;
    running += totalPrice;
    raw.push({ type: `${type} - ${suffix}`, quantity, unitPrice, totalPrice });
  };

  const incomerRatings = [
    [4000, q("acb4000")], [3200, q("acb3200")], [2500, q("acb2500")], [2000, q("acb2000")],
    [1600, q("acb1600")], [1250, q("acb1250")], [1000, q("acb1000")],
  ].filter(([, v]) => v > 0).map(([k]) => k);
  // QUIRK: MCCB incomers are not considered here, and with no ACB incomer the rating is 1000A.
  const mainRating = incomerRatings.length > 0 ? Math.max(...incomerRatings) : 1000;

  // main (vertical + horizontal)
  // QUIRK: the vertical count is ACB incomers + ACB bus couplers only (MCCB incomers / MCCB bus
  // couplers add nothing), so an MCCB panel only gets the horizontal run.
  for (const bb of BUSBAR_MAP[mainRating]?.main ?? []) {
    const verticalLength = (totalACB + totalACBBus) * bb.multiplier * 2;
    const horizontalLength = (totalWidth / 1000) * bb.multiplier;
    push(bb.type, "MAIN", round2(verticalLength + horizontalLength));
  }

  // each small-MCCB section: individual take-offs + one feeder (dropper) bar
  const ratingKeys = Object.keys(BUSBAR_MAP).map(Number).sort((a, b) => a - b);
  for (const group of groupings) {
    const ratingCount = new Map<number, number>();
    let totalRating = 0;
    for (const amp of group.breakers) {
      const normalized = amp === 101 ? 100 : amp;
      ratingCount.set(normalized, (ratingCount.get(normalized) || 0) + 1);
      totalRating += normalized;
    }
    for (const amp of asc([...ratingCount.keys()])) {
      const count = ratingCount.get(amp)!;
      for (const bb of BUSBAR_MAP[amp]?.main ?? []) {
        push(bb.type, "MINI MCCB", round2(0.8 * count * bb.multiplier));
      }
    }
    // feeder bar never exceeds the incoming busbar
    const selected = totalRating <= mainRating
      ? ratingKeys.find((r) => r >= totalRating) ?? mainRating
      : mainRating;
    for (const bb of BUSBAR_MAP[selected]?.main ?? []) {
      push(bb.type, "DROPPER", round2(2 * bb.multiplier));
    }
  }

  // outgoing (>= 630A), ascending rating order
  const outgoingQty: [number, number][] = [
    [630, q("out_acb630") + q("out_mccb630")], [800, q("out_acb800") + q("out_mccb800")],
    [1000, q("out_acb1000") + q("out_mccb1000")], [1250, q("out_acb1250") + q("out_mccb1250")],
    [1600, q("out_acb1600") + q("out_mccb1600")], [2000, q("out_acb2000") + q("out_mccb2000")],
    [2500, q("out_acb2500") + q("out_mccb2500")], [3200, q("out_acb3200") + q("out_mccb3200")],
  ];
  for (const [amp, qty] of outgoingQty) {
    if (qty <= 0) continue;
    for (const bb of BUSBAR_MAP[amp]?.main ?? []) {
      push(bb.type, "OUTGOING", round2(qty * bb.multiplier * 2));
    }
  }

  // earth
  for (const bb of BUSBAR_MAP[mainRating]?.earth ?? []) {
    push(bb.type, "EARTH", round2((totalWidth / 1000) * bb.multiplier));
  }

  // merge identical type + unit price
  const busbars: BusbarResult[] = [];
  for (const r of raw) {
    const existing = busbars.find((e) => e.type === r.type && e.unitPrice === r.unitPrice);
    if (existing) {
      existing.quantity += r.quantity;
      existing.totalPrice += r.totalPrice;
    } else busbars.push({ ...r });
  }

  // ---------- 7) totals ----------
  let totalCost = running + ACB_hardware + MCCB_hardware + labour;
  const overheadAmt = (overheadPct * totalCost) / 100;
  totalCost += overheadAmt;
  const profitAmt = (profitPct * totalCost) / 100; // profit on cost + overhead
  totalCost += profitAmt;

  const domain = {
    breakerType,
    breakerBrand: brand,
    CopperPrice: copperValue,
    TotalincomingACBs: totalACB,
    TotalincomingMCCBs: totalMCCB,
    ACB_hardware,
    MCCB_hardware,
    SideCover: sideCoverPrice,
    Enclosures: enclosures,
    Breakers: breakers,
    Accessories: accessories,
    Other_Components: otherItems,
    Additional_Components: additional,
    BusBars: busbars,
    LabourCost: labour,
    OverHead_percentage: overheadPct,
    OverheadExpenses: overheadAmt,
    profit_percentage: profitPct,
    Profit: profitAmt,
    Total: totalCost,
  };

  const items: ComponentItem[] = [
    ...enclosures.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...breakers.map((i) => ({ name: i.item, quantity: i.quantity, unit: "Nos", unitPrice: i.price })),
    ...accessories.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...otherItems.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...additional.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...busbars.map((i) => ({ name: i.type, quantity: i.quantity, unit: "m", unitPrice: i.unitPrice })),
    { name: "ACB HARDWARE", quantity: totalACB, unit: "Nos", unitPrice: 25 },
    { name: "MCCB HARDWARE", quantity: totalMCCB, unit: "Nos", unitPrice: 15 },
    { name: "SIDE COVER", quantity: 1, unit: "Nos", unitPrice: sideCoverPrice },
  ];

  const display: DisplayReport = {
    summary: {
      BreakerType: breakerType,
      BreakerBrand: brand,
      CopperPrice: copperValue,
      TotalIncomersACB: totalACB,
      TotalIncomersMCCB: totalMCCB,
      OverheadPerc: overheadPct,
      ProfitPerc: profitPct,
    },
    components: items.map((i) => ({
      name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice,
    })),
    totals: { labour, overhead: overheadAmt, profit: profitAmt, grandTotal: totalCost },
  };

  return {
    unitPrice: totalCost,
    items,
    domain,
    display,
    derived: { totalWidth, outCombinedMccbGroupings: groupings },
  };
}
