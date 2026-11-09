// Runs under Deno (`deno test`) and Node 22+ (`node --experimental-strip-types --test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CalcError, calculateMeterBox } from "./calc.ts";
import { parseRequest, ValidationError } from "./validate.ts";
import type { MeterBoxInput, PriceRow } from "./types.ts";

const mkPrices = (p: Record<string, number>): PriceRow[] =>
  Object.entries(p).map(([ITEMS, v]) => ({ ITEMS, ABB: String(v) }));

// Prices as they were on the ESTIMATE SHEET in the three screenshots (old sheet era).
const SHEET_BOOK = mkPrices({
  "ENCL 1000X800X250": 341, "MCCB 35kA TP 200A": 762, "MCCB 35kA TP 300A": 1065,
  "CU BB 25X8": 2.25, "CU BB 20X5": 0.9, "KWH METER": 650, FUSES: 6, INSULATORS: 6,
});
// Fixed items as priced on that old sheet (the notes later REVISE these).
const SHEET_FIXED = {
  "WINDOW GLASS": 15, PLY: 20, "PAD LOCK": 15, BSHEET: 150, "COL SLEEVE": 100,
  "CT METERBOX": 40, "NUT&BOLTS": 1, "GLAND BOX": 75,
};
const SHEET_COPPER = 43; // 96.75 = 2.25 x 43 on the sheet

const base: MeterBoxInput = {
  brand: "ABB", incomer: 200, ct: false, meter: false,
  copperValue: 47, labourBase: 50, labourMeter: 25, overheadPercent: 0, profitPercent: 0,
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const sheet = (patch: Partial<MeterBoxInput>) =>
  calculateMeterBox({ ...base, copperValue: SHEET_COPPER, ...patch }, SHEET_BOOK, { priceOverrides: SHEET_FIXED });

test("sheet example 1: 200A, CT only => material 1,624 + labour 50 = 1,674", () => {
  const r = sheet({ incomer: 200, ct: true });
  assert.deepEqual(r.items.map((i) => i.name), [
    "ENCL 1000X800X250", "MCCB 35kA TP 200A", "WINDOW GLASS", "PLY", "PAD LOCK", "CU BB 25X8",
    "BSHEET", "COL SLEEVE", "CT METERBOX", "NUT&BOLTS", "GLAND BOX",
  ]);
  const bb = r.items.find((i) => i.name === "CU BB 25X8")!;
  near(bb.unitPrice, 96.75);
  assert.equal(bb.quantity, 2);
  near(r.display.summary.MaterialCost as number, 1624);
  near(r.display.totals.labour, 50);
  near(r.unitPrice, 1674);
});

test("sheet example 2: 300A, CT + METER => material 2,662.35 + labour 75 = 2,737.35", () => {
  const r = sheet({ incomer: 300, ct: true, meter: true });
  assert.deepEqual(r.items.map((i) => i.name), [
    "ENCL 1000X800X250", "MCCB 35kA TP 300A", "WINDOW GLASS", "PLY", "PAD LOCK", "CU BB 25X8", "CU BB 20X5",
    "BSHEET", "COL SLEEVE", "KWH METER", "CT METERBOX", "FUSES", "INSULATORS", "NUT&BOLTS", "GLAND BOX",
  ]);
  const earth = r.items.find((i) => i.name === "CU BB 20X5")!;
  near(earth.unitPrice, 38.7);
  assert.equal(earth.quantity, 0.5);
  near(r.display.summary.MaterialCost as number, 2662.35);
  near(r.display.totals.labour, 75);
  near(r.unitPrice, 2737.35);
});

test("sheet example 3: 300A, neither CT nor METER => 1,807 + 50 = 1,857", () => {
  const r = sheet({ incomer: 300 });
  assert.deepEqual(r.items.map((i) => i.name), [
    "ENCL 1000X800X250", "MCCB 35kA TP 300A", "WINDOW GLASS", "PLY", "PAD LOCK", "CU BB 25X8",
    "BSHEET", "COL SLEEVE", "NUT&BOLTS", "GLAND BOX",
  ]);
  near(r.display.summary.MaterialCost as number, 1807);
  near(r.unitPrice, 1857);
});

test("revised prices from the notes (hand-checked): 200A + CT", () => {
  const book = mkPrices({ "ENCL 1000X800X250": 388, "MCCB 35kA TP 200A": 800, "CU BB 25X8": 2.25 });
  const r = calculateMeterBox({ ...base, incomer: 200, ct: true }, book);
  // 388 + 800 + glass 60 + ply 30 + padlock 15 + BB 2x(2.25x47) 211.5 + bsheet 0.35x200 70
  // + col sleeve 0.15x100 15 + CT meterbox 3x60 180 + nuts 15 + gland box 225 = 2009.5 ; labour 50
  near(r.display.summary.MaterialCost as number, 2009.5);
  near(r.unitPrice, 2059.5);
});

test("incomers up to 160A use the 800x600x200 enclosure and the 175 gland box", () => {
  const book = mkPrices({
    "ENCL 800X600X200": 300, "MCCB 35kA TP 125A": 463, "CU BB 15X5": 0.675, "CU BB 10X5": 0.45,
    "KWH METER": 650, FUSES: 6, INSULATORS: 2,
  });
  const r = calculateMeterBox({ ...base, incomer: 125, meter: true }, book);
  assert.equal(r.items[0].name, "ENCL 800X600X200");
  assert.equal(r.items.find((i) => i.name === "GLAND BOX")!.unitPrice, 175);
  assert.ok(r.items.some((i) => i.name === "CU BB 15X5" && i.quantity === 2));
  assert.ok(r.items.some((i) => i.name === "CU BB 10X5" && i.quantity === 0.5));
});

test("200A-400A use 1000x800x250 + 225 gland box; 400A busbars are 30X10 / 25X8", () => {
  const book = mkPrices({
    "ENCL 1000X800X250": 388, "MCCB 35kA TP 400A": 1120, "CU BB 30X10": 2.7, "CU BB 25X8": 2.25,
    "KWH METER": 650, FUSES: 6, INSULATORS: 2,
  });
  const r = calculateMeterBox({ ...base, incomer: 400, meter: true }, book);
  assert.equal(r.items[0].name, "ENCL 1000X800X250");
  assert.equal(r.items.find((i) => i.name === "GLAND BOX")!.unitPrice, 225);
  assert.ok(r.items.some((i) => i.name === "CU BB 30X10"));
  assert.ok(r.items.some((i) => i.name === "CU BB 25X8" && i.quantity === 0.5));
});

test("overhead and profit apply as in the other modules (profit on cost + overhead)", () => {
  const r = sheet({ incomer: 300, overheadPercent: 3, profitPercent: 20 });
  // cost 1807 + 50 = 1857 ; overhead 55.71 ; profit 20% of 1912.71 = 382.542 ; total 2295.252
  near(r.display.totals.overhead, 55.71);
  near(r.display.totals.profit, 382.542);
  assert.equal(r.unitPrice, 2295.25);
});

test("a missing price-book item is an error, not a silent 0", () => {
  const book = mkPrices({ "MCCB 35kA TP 100A": 435, "CU BB 10X5": 0.45 }); // no ENCL 800X600X200
  assert.throws(
    () => calculateMeterBox({ ...base, incomer: 100 }, book),
    (e: unknown) => e instanceof CalcError && /ENCL 800X600X200/.test((e as Error).message),
  );
  // brand with no prices at all lists everything that is missing
  assert.throws(
    () => calculateMeterBox({ ...base, brand: "MG", incomer: 200 }, SHEET_BOOK),
    (e: unknown) => e instanceof CalcError && /MCCB 35kA TP 200A/.test((e as Error).message),
  );
});

test("validation", () => {
  const ok = { moduleId: "m1", title: "Meter Box 1", quantity: 1, input: { ...base } };
  const parsed = parseRequest(ok);
  assert.equal(parsed.input.labourBase, 50);
  assert.equal(parseRequest({ ...ok, input: { brand: "ABB", incomer: "200", ct: "1", meter: true } }).input.ct, true);
  const blank = parseRequest({ ...ok, input: { brand: "ABB", incomer: 200, copperValue: "", labourBase: "" } }).input;
  assert.equal(blank.copperValue, 47);
  assert.equal(blank.labourBase, 50);
  assert.equal(parseRequest({ ...ok, input: { ...base, overheadPercent: "0", labourBase: "0" } }).input.labourBase, 0);
  const bad = (patch: Record<string, unknown>, ip: Record<string, unknown> = {}) =>
    assert.throws(() => parseRequest({ ...ok, ...patch, input: { ...ok.input, ...ip } }), ValidationError);
  bad({ title: " " });
  bad({ quantity: 0 });
  bad({}, { brand: "FAKE" });
  bad({}, { incomer: "" });
  bad({}, { incomer: 500 });
  bad({}, { incomer: 90 });
  bad({}, { ct: "maybe" });
  bad({}, { copperValue: "abc" });
  bad({}, { labourBase: -5 });
  bad({}, { profitPercent: 500 });
});

test("legacy brand Y passes validation but cannot be priced (no price column) => clear error", () => {
  assert.doesNotThrow(() => parseRequest({ moduleId: "m1", title: "MB 1", quantity: 1, input: { ...base, brand: "Y" } }));
  assert.throws(() => calculateMeterBox({ ...base, brand: "Y", incomer: 200 }, SHEET_BOOK), CalcError);
});
