// Pure MDB (Form 2) costing engine (no I/O). Ported from MDBModule.tsx.
// Behaviour is preserved on purpose, including quirks (marked "QUIRK").
//
// The old code mutated refs (totalCostRef, totalWidthRef, groupingsRef) across async
// helpers. Here the data flow is explicit: sizeEnclosures() -> price/busbar steps.

import type {
  BusbarResult, ComponentItem, DisplayReport, EnclosureLine, Grouping, MDBCalcResult, MDBInput,
  OtherItem, PriceRow, SelectedItem, SimpleLine,
} from "./types.ts";
import {
  BUSBAR_MAP, DEFAULT_COPPER, DEFAULT_LABOUR, DEFAULT_OVERHEAD, DEFAULT_PROFIT,
} from "./tables.ts";

const numOr = (v: string | undefined, def: number) => {
  // "" / missing => default. NOTE: "0" is kept (a non-empty string is truthy), so 0 IS allowed here.
  if (v === undefined || v === "") return def;
  const n = parseFloat(v);
  return Number.isNaN(n) ? def : n;
};

export function calculateMDB(input: MDBInput, prices: PriceRow[]): MDBCalcResult {
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
  const totalBusCoupler =
    ACB_SIZES.reduce((s, n) => s + q(`bus_acb${n}`), 0) + MCCB_SIZES.reduce((s, n) => s + q(`bus_mccb${n}`), 0);
  const totalIncomers = totalACB + totalMCCB;
  const ACB_hardware = totalACB * 25;
  const MCCB_hardware = totalMCCB * 15;

  // ---------- 1) panel sizing ----------
  // NOTE on ordering: the old code iterated plain objects keyed by numbers, which JS
  // always walks in ASCENDING numeric order. The sorted lists below reproduce that.
  const finalDepth = (() => {
    let maxDepth = 600;
    if (q("acb4000") > 0 || q("acb3200") > 0 || q("out_acb3200") > 0) {
      maxDepth = 1000;
    } else if (
      q("acb2500") > 0 || q("acb2000") > 0 || q("acb1600") > 0 ||
      q("out_acb2500") > 0 || q("out_acb2000") > 0 || q("out_acb1600") > 0
    ) {
      maxDepth = parseInt(values["depth_choice"] || "800", 10);
    }
    const userDepthMccb = breakerType === "MCCB" ? parseInt(values["depth_choice_mccb"] || "1000", 10) : 0;
    return breakerType === "ACB" ? maxDepth : Math.max(maxDepth, userDepthMccb);
  })();

  const enclosureMap = new Map<string, number>();
  let totalWidth = 0;
  const groupings: Grouping[] = [];
  const addEnclosure = (name: string, count: number) => {
    totalWidth += parseInt(name.split("X")[1], 10) * count;
    enclosureMap.set(name, (enclosureMap.get(name) || 0) + count);
  };
  const enc = (width: number) => `ENCL 2000X${width}X${finalDepth}`;

  const acbWidth = (r: number) => (r >= 3200 ? 1200 : r >= 1600 ? 800 : 600);
  const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

  for (const r of asc([4000, 3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`acb${r}`); if (c > 0) addEnclosure(enc(acbWidth(r)), c);
  }
  for (const r of asc([4000, 3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`bus_acb${r}`); if (c > 0) addEnclosure(enc(acbWidth(r)), c);
  }
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000, 800, 630])) {
    const c = q(`out_acb${r}`); if (c > 0) addEnclosure(enc(acbWidth(r)), c);
  }
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`mccb${r}`); if (c > 0) addEnclosure(enc(600), c);
  }
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000])) {
    const c = q(`bus_mccb${r}`); if (c > 0) addEnclosure(enc(600), c);
  }
  for (const r of asc([3200, 2500, 2000, 1600, 1250, 1000, 800, 630])) {
    const c = q(`out_mccb${r}`); if (c > 0) addEnclosure(enc(r >= 800 ? 500 : 400), c);
  }

  // Combined outgoing MCCBs (< 630A + SP100 as "101"): packed 4 per 800-wide enclosure,
  // walking ratings in ascending numeric order (10,16,...,100,101,125,...,500).
  {
    let count = 0;
    let group: number[] = [];
    const flush = () => {
      const e = enc(800);
      addEnclosure(e, 1);
      groupings.push({ enclosure: e, breakers: [...group] });
      group = [];
      count = 0;
    };
    for (const r of asc([500, 400, 300, 250, 200, 160, 125, 100, 80, 63, 40, 32, 25, 16, 10, 101])) {
      const c = q(r === 101 ? "out_mccbsp100" : `out_mccb${r}`);
      for (let i = 0; i < c; i++) {
        count++;
        group.push(r);
        if (count === 4) flush();
      }
    }
    if (count > 0) flush();
  }
  if (groupings.length > 0) addEnclosure(enc(300), 1); // dropper chamber
  if (totalBusCoupler > 0) addEnclosure(enc(300), totalBusCoupler); // bus coupler chambers

  // ---------- 2) running cost, built piece by piece ----------
  let running = 0;

  // enclosure prices
  // QUIRK: an enclosure missing from the price book (e.g. every 400-wide one) is skipped
  // silently, and is then not counted in `enclosureCount` (which drives the small-parts quantities).
  const enclosures: EnclosureLine[] = [];
  let enclosureCount = 0;
  for (const [name, quantity] of enclosureMap.entries()) {
    const unitPrice = cell(exact(name));
    if (Number.isFinite(unitPrice)) {
      const totalPrice = unitPrice * quantity;
      enclosureCount += quantity;
      running += totalPrice;
      enclosures.push({ name, unitPrice, quantity, totalPrice });
    }
  }

  // small parts scaled by enclosure count
  const totalOutgoing =
    [3200, 2500, 2000, 1600, 1250, 1000, 800, 630].reduce((s, n) => s + q(`out_acb${n}`), 0) +
    OUT_MCCB_KEYS().reduce((s, k) => s + q(k), 0);
  const smallParts = [
    { name: "NUT&BOLTS", quantity: 100 * enclosureCount + 6 * totalOutgoing },
    { name: "BUSBAR SUPPORTS", quantity: 3 * enclosureCount },
    { name: "MUNTING BRAKETS", quantity: enclosureCount },
    { name: "COL SLEEVE", quantity: enclosureCount },
    { name: "KWH METER", quantity: 1 },
    { name: "CT", quantity: 8 },
    { name: "TRUNKING SML", quantity: 1 },
    { name: "WIRE 1.5MMSQ", quantity: 100 },
    { name: "BSHEET", quantity: enclosureCount },
    { name: "INSULATORS BIG", quantity: 9 * enclosureCount },
    { name: "PLY", quantity: 1 },
    { name: "WINDOW GLASS", quantity: 1 },
    { name: "PF METER", quantity: 1 },
  ].map((c): SimpleLine => {
    const unitPrice = cell(exact(c.name)) || 0;
    const totalPrice = unitPrice * c.quantity;
    running += totalPrice;
    return { name: c.name, quantity: c.quantity, unitPrice, totalPrice };
  });
  const Enclosures = [...enclosures, ...smallParts];

  // side cover
  const sideCoverPrice = cell(exact("SIDE COVER")) || 0;
  running += sideCoverPrice;

  // ---------- 3) breakers (incomers / bus couplers / outgoings) ----------
  const selected: SelectedItem[] = [];
  const addSel = (key: string, qty: number) => {
    const price = cell(trimmed(key)) || 0;
    running += qty * price;
    selected.push({ item: key, quantity: qty, price, total: qty * price });
  };
  for (const size of [4000, 3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`acb${size}`);
    if (qty > 0) {
      const type = (values[`acb${size}_type`] || "drawout").toLowerCase();
      const scc = values[`acb${size}_scc`] || "65kA";
      const poles = (values[`acb${size}_pole`] || "three") === "four" ? "4P" : "TP";
      const typeString = type === "fixed" ? "Fixed" : "D/O";
      addSel(`ACB ${poles} ${size}A ${scc} ${typeString}`.trim(), qty);
    }
  }
  for (const size of [4000, 3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`bus_acb${size}`);
    if (qty > 0) addSel(`ACB TP ${size}A`, qty);
  }
  for (const size of [4000, 3200, 2500, 2000, 1600, 1250, 1000, 800, 630]) {
    const qty = q(`out_acb${size}`);
    if (qty > 0) addSel(`ACB TP ${size}A`, qty);
  }
  for (const size of [3200, 2500, 2000, 1600, 1250, 1000]) {
    const qty = q(`mccb${size}`);
    if (qty > 0) {
      // FIX: the old code defaulted a missing SCC to "" (key "MCCB  TP 1000A" => price 0) although
      // the dropdown displays 35kA. We use the displayed default.
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

  // ---------- 4) optional accessories ----------
  const otherNames: [string, string][] = [
    ["earthFault", "EARTH FAULT"], ["uvr", "UVR"], ["shuntTrip", "SHUNT TRIP"], ["motor", "MOTOR"],
    ["ach", "ACH"], ["closingCoil", "CLOSING COIL"], ["castleSafety", "CASTLE SAFETY"],
    ["castleKey", "CASTLE KEY"], ["castleStand", "CASTLE STAND"], ["electIntlk", "ELECT. INTLK"],
    ["rotaryHandle", "ROTARY HANDLE"],
  ];
  const otherItems: OtherItem[] = [];
  for (const [key, name] of otherNames) {
    const quantity = q(key);
    if (quantity === 0) continue;
    const unitPrice = cell(exact(name)) || 0;
    const price = quantity * unitPrice;
    running += price;
    otherItems.push({ name, quantity, unitPrice, price });
  }

  // ---------- 5) metering parts per incomer ----------
  const breakerComponents = [
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

  const incomerRatings = [
    [4000, q("acb4000")],
    [3200, q("acb3200") + q("mccb3200")],
    [2500, q("acb2500") + q("mccb2500")],
    [2000, q("acb2000") + q("mccb2000")],
    [1600, q("acb1600") + q("mccb1600")],
    [1250, q("acb1250") + q("mccb1250")],
    [1000, q("acb1000") + q("mccb1000")],
  ].filter(([, v]) => v > 0).map(([k]) => k);
  // QUIRK: with no incomers at all the main rating defaults to 1000A.
  const mainRating = incomerRatings.length > 0 ? Math.max(...incomerRatings) : 1000;
  const mainCfg = BUSBAR_MAP[mainRating];

  if (mainCfg) {
    for (const bb of mainCfg.main) {
      const dropper = groupings.length > 0 ? 1 : 0;
      const verticalCount = totalIncomers + totalBusCoupler + totalBusCoupler + dropper;
      const totalLength = verticalCount * bb.multiplier * 2 + (totalWidth / 1000) * bb.multiplier;
      const unitPrice = baseOf(bb.type) * copperValue;
      const totalPrice = totalLength * unitPrice;
      running += totalPrice;
      raw.push({ type: bb.type, quantity: totalLength, unitPrice, totalPrice });
    }
  }

  // outgoing busbars (ascending rating order, as the old object iteration did)
  for (const amp of [630, 800, 1000, 1250]) {
    const qty = q(`out_acb${amp}`) + q(`out_mccb${amp}`);
    if (qty <= 0) continue;
    const cfg = BUSBAR_MAP[amp];
    if (!cfg) continue;
    for (const bb of cfg.main) {
      const length = qty * bb.multiplier * 2;
      const unitPrice = baseOf(bb.type) * copperValue;
      const totalPrice = length * unitPrice;
      running += totalPrice;
      raw.push({ type: bb.type, quantity: length, unitPrice, totalPrice });
    }
  }

  // busbar for each mini-MCCB group (+ dropper)
  const ratingKeys = Object.keys(BUSBAR_MAP).map(Number).sort((a, b) => a - b);
  for (const group of groupings) {
    const totalRating = group.breakers.reduce((s, amp) => s + (amp === 101 ? 100 : amp), 0);
    const nearest = ratingKeys.find((r) => r >= totalRating) ?? 100;
    for (const bb of BUSBAR_MAP[nearest]?.main ?? []) {
      const base = baseOf(bb.type);
      const quantity = 2 * bb.multiplier;
      const totalPrice = quantity * base * copperValue;
      running += totalPrice;
      raw.push({ type: bb.type, quantity, unitPrice: base * copperValue, totalPrice });
    }
  }

  // earth busbar
  for (const bb of BUSBAR_MAP[mainRating]?.earth ?? []) {
    const base = baseOf(bb.type);
    const quantity = (totalWidth / 1000) * bb.multiplier;
    const totalPrice = quantity * base * copperValue;
    running += totalPrice;
    raw.push({ type: bb.type, quantity, unitPrice: base * copperValue, totalPrice });
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
    Enclosures,
    ACBs_MCCBs: selected,
    Other_Components: otherItems,
    BreakerComponents: breakerComponents,
    BusBars: busbars,
    LabourCost: labour,
    OverHead_percentage: overheadPct,
    OverheadExpenses: overheadAmt,
    profit_percentage: profitPct,
    Profit: profitAmt,
    Total: totalCost,
  };

  const items: ComponentItem[] = [
    ...Enclosures.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...selected.map((i) => ({ name: i.item, quantity: i.quantity, unit: "Nos", unitPrice: i.price })),
    ...otherItems.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
    ...breakerComponents.map((i) => ({ name: i.name, quantity: i.quantity, unit: "Nos", unitPrice: i.unitPrice })),
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

// all outgoing MCCB keys (incl. SP100) used for the nut & bolt count
function OUT_MCCB_KEYS(): string[] {
  return [
    ...[3200, 2500, 2000, 1600, 1250, 1000, 800, 630, 500, 400, 300, 250, 200, 160, 125, 100, 80, 63, 40, 32, 25, 16, 10]
      .map((n) => `out_mccb${n}`),
    "out_mccbsp100",
  ];
}
