// Runs under Deno (`deno test`) and Node 22+ (`node --experimental-strip-types --test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateForm4 } from "./calc.ts";
import { parseRequest, ValidationError } from "./validate.ts";
import type { Form4Input, PriceRow } from "./types.ts";

const P: Record<string, number> = {
  "ENCL 2200X800X800": 2000, "ENCL 2200X600X800": 1500, "ENCL 2200X500X800": 1200, "ENCL 2200X300X800": 500,
  "NUT&BOLTS": 0.1, "BUSBAR SUPPORTS": 2, "MUNTING BRAKETS": 5, "COL SLEEVE": 3, "KWH METER": 500, CT: 50,
  "TRUNKING SML": 30, "WIRE 1.5MMSQ": 2, BSHEET: 100, "INSULATORS BIG": 4, PLY: 60, "WINDOW GLASS": 80,
  "PF METER": 200, "SIDE COVER": 50,
  "ACB TP 2000A 65kA D/O": 8000, "ACB TP 800A": 3000, "MCCB 35kA TP 250A": 400, "MCCB 35kA TP 100A": 200,
  "MCCB 25kA SP 100A": 50, UVR: 100,
  "TUBE SMALL": 10, AM: 30, VM: 25, "S/S": 10, FUSES: 5,
  "CU BB 80X10": 25, "CU BB 10X5": 10, "CU BB 25X8": 20, "CU BB 40X10": 18, "CU BB 50X10": 15, "CU BB 60X10": 22,
};
const prices: PriceRow[] = Object.entries(P).map(([ITEMS, p]) => ({ ITEMS, ABB: String(p) }));

const mk = (patch: Record<string, string>, breakerType: "ACB" | "MCCB" = "ACB"): Form4Input => ({
  breakerType, values: { breakerType, brand: "ABB", ...patch },
});
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
type Bus = { type: string; quantity: number; totalPrice: number };

test("hand-checked: 2000A ACB + 800A ACB outgoing + 3 small MCCBs + UVR", () => {
  const r = calculateForm4(
    mk({ acb2000: "1", depth_choice: "800", out_acb800: "1", out_mccb250: "1", out_mccb100: "1", out_mccbsp100: "1", uvr: "1" }),
    prices,
  );
  assert.equal(r.derived.totalWidth, 2200);
  assert.deepEqual(r.derived.outCombinedMccbGroupings[0].breakers, [250, 101, 100]); // highest first
  const enc = (r.domain.Enclosures as { name: string; quantity: number }[]).map((e) => e.name);
  assert.deepEqual(enc, ["ENCL 2200X800X800", "ENCL 2200X600X800", "ENCL 2200X500X800", "ENCL 2200X300X800"]);
  // running 80255.88 + ACB hardware 25 + labour 2362.5 = 82643.38 ; +3% overhead ; +20% profit on that
  near(r.display.totals.labour, 2362.5);
  near(r.unitPrice, 102147.21768);
  const bb = r.domain.BusBars as Bus[];
  assert.deepEqual(bb.map((b) => b.type), [
    "CU BB 80X10 - MAIN", "CU BB 10X5 - MINI MCCB", "CU BB 25X8 - MINI MCCB",
    "CU BB 40X10 - DROPPER", "CU BB 50X10 - OUTGOING", "CU BB 80X10 - EARTH",
  ]);
  near(bb.reduce((s, b) => s + b.totalPrice, 0), 60489);
});

test("small MCCBs stack by height (350mm each, 1900 usable): 7x300A => groups of 5 + 2", () => {
  const r = calculateForm4(mk({ out_mccb300: "7" }), prices);
  assert.deepEqual(r.derived.outCombinedMccbGroupings.map((g) => g.breakers.length), [5, 2]);
});

test("small MCCBs are ordered highest rating first (differs from MDB)", () => {
  const r = calculateForm4(mk({ out_mccb10: "1", out_mccb500: "1" }), prices);
  assert.deepEqual(r.derived.outCombinedMccbGroupings[0].breakers, [500, 10]);
});

test("small hardware is priced at +20% (NUT&BOLTS 0.10 -> 0.12)", () => {
  const r = calculateForm4(mk({ acb2000: "1", depth_choice: "800" }), prices);
  const nuts = (r.domain.Other_Components as { name: string; unitPrice: number }[]).find((c) => c.name === "NUT&BOLTS")!;
  near(nuts.unitPrice, 0.12);
});

test("MCCB panel: main busbar has only the horizontal run (quirk preserved)", () => {
  const r = calculateForm4(mk({ mccb1000: "1" }, "MCCB"), prices); // depth defaults to 800
  const main = (r.domain.BusBars as Bus[]).find((b) => b.type === "CU BB 60X10 - MAIN")!;
  assert.equal(r.derived.totalWidth, 600);
  near(main.quantity, 2.4); // 0.6m * multiplier 4, no vertical bars
});

test("missing enclosure is skipped but still counted for small-part quantities (quirk preserved)", () => {
  const r = calculateForm4(mk({ acb1000: "1" }), prices); // depth 600: no ENCL 2200X600X600 in fixture
  assert.equal((r.domain.Enclosures as unknown[]).length, 0);
  const brackets = (r.domain.Other_Components as { name: string; quantity: number }[]).find((c) => c.name === "MUNTING BRAKETS")!;
  assert.equal(brackets.quantity, 1);
});

test("MCCB 3200A labour default is 975 (the modal used to show 925)", () => {
  const r = calculateForm4(mk({ mccb3200: "1" }, "MCCB"), prices);
  near(r.display.totals.labour, 975);
});

test("copper/overhead/profit of '0' are honoured; blank falls back to defaults", () => {
  const zero = calculateForm4(mk({ acb2000: "1", copperValue: "0", overheadExpenses: "0", profitPercentage: "0" }), prices);
  assert.equal(zero.domain.CopperPrice, 0);
  assert.equal(zero.domain.OverHead_percentage, 0);
  assert.equal(zero.domain.profit_percentage, 0);
  const blank = calculateForm4(mk({ acb2000: "1", copperValue: "", overheadExpenses: "", profitPercentage: "" }), prices);
  assert.equal(blank.domain.CopperPrice, 47);
  assert.equal(blank.domain.OverHead_percentage, 3);
  assert.equal(blank.domain.profit_percentage, 20);
});

test("validation", () => {
  const ok = { moduleId: "m1", title: "Form4 1", quantity: 1, input: { values: mk({ acb2000: "1" }).values } };
  const parsed = parseRequest(ok);
  assert.equal(parsed.input.breakerType, "ACB");
  assert.equal(parsed.input.values["mccb1000_poles"], "TP");
  const bad = (patch: Record<string, unknown>, vp: Record<string, unknown> = {}) =>
    assert.throws(
      () => parseRequest({ ...ok, ...patch, input: { values: { ...ok.input.values, ...vp } } }),
      ValidationError,
    );
  bad({ title: "" });
  bad({ quantity: 0 });
  bad({}, { breakerType: "" });
  bad({}, { brand: "FAKE" });
  bad({}, { acb2000: "-1" });
  bad({}, { acb2000: "9999" });
  bad({}, { acb2000_scc: "99kA" });
  bad({}, { acb2000_pole: "five" });
  bad({}, { mccb1000: "1" });            // MCCB incomer while ACB selected
  bad({}, { depth_choice: "700" });
  bad({}, { uvr: "1.5" });
  bad({}, { copperValue: "abc" });
  bad({}, { overheadExpenses: "500" });
  assert.throws(
    () => parseRequest({ ...ok, input: { values: mk({ out_acb800: "1" }, "MCCB").values } }),
    ValidationError,                       // ACB outgoing with MCCB type
  );
});

test("legacy brand Y passes validation", () => {
  assert.doesNotThrow(() => parseRequest({ moduleId: "m1", title: "Form4 1", quantity: 1, input: { values: mk({ acb2000: "1", brand: "Y" }).values } }));
});
