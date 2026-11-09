// Runs under Deno (`deno test`) and Node 22+ (`node --experimental-strip-types --test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCBank800, fuseSetFor, pickEnclosure } from "./calc.ts";
import { parseRequest, ValidationError } from "./validate.ts";
import type { CBankInput, PriceRow } from "./types.ts";

// Round-number ABB-only price fixture so expected totals can be checked by hand.
const ABB_PRICES: Record<string, number> = {
  "ENCL 2000X600X600": 1000, "ENCL 2X2000X1000X800": 2000,
  "SIDE COVER": 50, "ISOLATOR TP 400A": 800,
  "50KVAR": 500, "20KVAR": 160,
  "CONTACTOR TP 50KVAR": 300, "CONTACTOR TP 20KVAR": 120,
  "FAN+LOUVER": 100, "THERMOSTAT": 20, "DIN RAIL": 10, "TRUNKING 75": 15,
  "TRUNKING 45": 10, "FUSES": 5, "PF REGULATOR 12STEP": 400,
  "FUSE SET 100A": 90, "FUSE SET 32A": 40,
  "CU BB 15X5": 2, "CU BB 30X10": 30, "CU BB 25X8": 20,
  "WIRE 10MMSQ": 2, "WIRE 16MMSQ": 4, "WIRE 25MMSQ": 6, "WIRE 1.5MMSQ": 1,
  "BSHEET": 100, "INSULATORS": 3,
};
const prices: PriceRow[] = Object.entries(ABB_PRICES).map(([ITEMS, p]) => ({ ITEMS, ABB: String(p) }));

const base: CBankInput = {
  capacitor: "ABB", contactorBrand: "ABB", fusesBrand: "ABB", incomerBrand: "ABB",
  incomerType: "isolator", incomer: 400,
  step5: 0, step10: 0, step20: 0, step25: 0, step50: 0,
  Rstep10: 0, Rstep20: 0, Rstep25: 0, Rstep50: 0,
  miscellaneous: 0, labour: 10, overhead: 5,
};

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("hand-checked scenario: 2x50 + 1x20 kVAR, 400A isolator", () => {
  const r = calculateCBank800({ ...base, step50: 2, step20: 1 }, prices);
  assert.equal(r.domain.Enclosure, "ENCL 2000X600X600");
  assert.equal(r.domain.Total_KVAR, 120);
  // parts: 50+800 + 1160 + 720 + 625 + 220 + 180 + 2474.55 + 470 + 59.25 + 75 + 45 + 20 = 6898.8
  // + enclosure 1000 = 7898.8 ; +10% labour +5% overhead = 9083.62
  near(r.domain.Total as number, 7898.8);
  near(r.unitPrice, 9083.62);
});

test("fuse set selection", () => {
  assert.equal(fuseSetFor(5), "FUSE SET 10A");
  assert.equal(fuseSetFor(20), "FUSE SET 32A");
  assert.equal(fuseSetFor(50), "FUSE SET 100A");
});

test("100A fuse present: link busbar counts only that step (quirk preserved)", () => {
  const r = calculateCBank800({ ...base, step20: 3, step50: 2 }, prices);
  const link = (r.domain.LinkBB as { linkBB: string; quantity: number }[])[0];
  assert.equal(link.linkBB, "CU BB 15X5");
  assert.equal(link.quantity, 2 * 45);
});

test("enclosure gaps (quirk preserved): <=70 and >1600 kVAR are Not Available", () => {
  assert.equal(pickEnclosure(40), "Not Available");
  assert.equal(pickEnclosure(70), "Not Available");
  assert.equal(pickEnclosure(1700), "Not Available");
  assert.equal(pickEnclosure(1600), "ENCL 2X2000X1000X800");
});

test("double-width enclosure gets 8 insulators (quirk preserved)", () => {
  const r = calculateCBank800({ ...base, step50: 25 }, prices); // 1250 kVAR
  assert.equal(r.domain.Enclosure, "ENCL 2X2000X1000X800");
  assert.equal((r.domain.Insulators as { quantity: number }[])[0].quantity, 8);
});

test("labour 0% falls back to 10% (quirk preserved)", () => {
  const r = calculateCBank800({ ...base, step50: 2, step20: 1, labour: 0 }, prices);
  near(r.domain.LabourCost as number, 0.1 * (r.domain.Total as number));
});

test("missing brand prices resolve to 0, not NaN", () => {
  const r = calculateCBank800({ ...base, capacitor: "MG", step50: 2 }, prices);
  assert.ok(Number.isFinite(r.unitPrice));
});

test("validation rejects bad input", () => {
  const ok = { moduleId: "m1", title: "CBank 1", quantity: 1, input: { ...base } };
  assert.doesNotThrow(() => parseRequest(ok));
  const bad = (patch: Record<string, unknown>, inputPatch: Record<string, unknown> = {}) =>
    assert.throws(() => parseRequest({ ...ok, ...patch, input: { ...base, ...inputPatch } }), ValidationError);
  bad({ title: "  " });
  bad({ quantity: 0 });
  bad({ quantity: 1.5 });
  bad({}, { capacitor: "__proto__" });
  bad({}, { incomerType: "fuse" });
  bad({}, { incomer: 999 });
  bad({}, { step10: -1 });
  bad({}, { step10: 1e9 });
  bad({}, { labour: 150 });
});

test("MCCB incomer is priced although the book spells it 35kA and the code asks for 35KA (case-insensitive)", () => {
  const book: PriceRow[] = [{ ITEMS: "MCCB 35kA TP 400A", ABB: "1120" }];
  const r = calculateCBank800({ ...base, incomerType: "mccb", incomer: 400 }, book);
  assert.equal(r.domain.IncomerPrice, 1120);
});

test("legacy brand Y passes validation (it has no price column, so its quote prices at 0)", () => {
  const ok = { moduleId: "m1", title: "CBank 1", quantity: 1, input: { ...base, capacitor: "Y" } };
  assert.doesNotThrow(() => parseRequest(ok));
  const r = calculateCBank800({ ...base, capacitor: "Y", step50: 2 }, prices);
  assert.equal(r.domain.StepCosts && (r.domain.StepCosts as { unitPrice: number }[])[0].unitPrice, 0);
});
