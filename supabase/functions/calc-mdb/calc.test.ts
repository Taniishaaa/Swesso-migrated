// Runs under Deno (`deno test`) and Node 22+ (`node --experimental-strip-types --test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMDB } from "./calc.ts";
import { parseRequest, ValidationError } from "./validate.ts";
import type { MDBInput, PriceRow } from "./types.ts";

const P: Record<string, number> = {
  "ENCL 2000X600X600": 1000, "ENCL 2000X800X600": 1300, "ENCL 2000X300X600": 400,
  "NUT&BOLTS": 0.1, "BUSBAR SUPPORTS": 2, "MUNTING BRAKETS": 5, "COL SLEEVE": 3, "KWH METER": 500, CT: 50,
  "TRUNKING SML": 30, "WIRE 1.5MMSQ": 2, BSHEET: 100, "INSULATORS BIG": 4, PLY: 60, "WINDOW GLASS": 80,
  "PF METER": 200, "SIDE COVER": 50,
  "ACB TP 1000A 65kA D/O": 5000, "ACB TP 800A": 3000, "MCCB 35kA TP 100A": 200, "MCCB 35kA TP 63A": 150,
  "MCCB 25kA SP 100A": 50, "MCCB 35kA TP 1000A": 2500, UVR: 100,
  "TUBE SMALL": 10, AM: 30, VM: 25, "S/S": 10, FUSES: 5,
  "CU BB 60X10": 20, "CU BB 50X10": 15, "CU BB 30X10": 12,
};
const prices: PriceRow[] = Object.entries(P).map(([ITEMS, p]) => ({ ITEMS, ABB: String(p) }));

const mk = (patch: Record<string, string>, breakerType: "ACB" | "MCCB" = "ACB"): MDBInput => ({
  breakerType, values: { brand: "ABB", ...patch },
});
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("hand-checked: 1x1000A ACB + 800A ACB outgoing + 4 small MCCBs", () => {
  const r = calculateMDB(
    mk({ acb1000: "1", out_acb800: "1", out_mccb100: "2", out_mccb63: "1", out_mccbsp100: "1", uvr: "1" }),
    prices,
  );
  // enclosures: 2x 600-wide, 1x 800-wide (4 small MCCBs), 1x 300 dropper => width 2300mm
  assert.equal(r.derived.totalWidth, 2300);
  assert.deepEqual(r.derived.outCombinedMccbGroupings[0].breakers, [63, 100, 100, 101]);
  const enc = (r.domain.Enclosures as { name: string; quantity: number }[]).slice(0, 3);
  assert.deepEqual(enc.map((e) => [e.name, e.quantity]), [
    ["ENCL 2000X600X600", 2], ["ENCL 2000X800X600", 1], ["ENCL 2000X300X600", 1],
  ]);
  // running 49932.2 + hardware 25 + labour 1500 = 51457.2 ; +3% overhead ; +20% profit on that
  near(r.display.totals.labour, 1500);
  near(r.unitPrice, 63601.0992);
  // identical CU BB 30X10 lines (mini-MCCB group + earth) merge into one
  const bb = r.domain.BusBars as { type: string; quantity: number }[];
  assert.equal(bb.filter((b) => b.type === "CU BB 30X10").length, 1);
  near(bb.find((b) => b.type === "CU BB 30X10")!.quantity, 10.3);
});

test("small MCCBs pack in ascending rating order, not entry order (quirk preserved)", () => {
  const r = calculateMDB(mk({ out_mccb500: "1", out_mccb10: "1" }, "MCCB"), prices);
  assert.deepEqual(r.derived.outCombinedMccbGroupings[0].breakers, [10, 500]);
});

test("enclosure missing from price book is skipped and not counted (quirk preserved)", () => {
  const r = calculateMDB(mk({ out_mccb630: "1" }, "MCCB"), prices); // 400-wide: never in the price book
  const names = (r.domain.Enclosures as { name: string }[]).map((e) => e.name);
  assert.ok(!names.includes("ENCL 2000X400X1000"));
  assert.equal(r.derived.totalWidth, 400); // width still counted
  const nuts = (r.domain.Enclosures as { name: string; quantity: number }[]).find((e) => e.name === "NUT&BOLTS")!;
  assert.equal(nuts.quantity, 100 * 0 + 6 * 1); // enclosure count is 0, outgoing count is 1
});

test("MCCB incomer with untouched SCC uses the displayed 35kA default (deliberate fix)", () => {
  const r = calculateMDB(mk({ mccb1000: "1" }, "MCCB"), prices);
  const line = (r.domain.ACBs_MCCBs as { item: string; price: number }[])[0];
  assert.equal(line.item, "MCCB 35kA TP 1000A");
  assert.equal(line.price, 2500);
});

test("no incomers => main busbar rating defaults to 1000A (quirk preserved)", () => {
  const r = calculateMDB(mk({ out_mccb100: "1" }, "MCCB"), prices);
  assert.ok((r.domain.BusBars as { type: string }[]).some((b) => b.type === "CU BB 60X10"));
});

test("copper/overhead/profit of '0' are honoured; blank falls back to defaults", () => {
  const zero = calculateMDB(mk({ acb1000: "1", copperValue: "0", overheadExpenses: "0", profitPercentage: "0" }), prices);
  assert.equal(zero.domain.CopperPrice, 0);
  assert.equal(zero.domain.OverHead_percentage, 0);
  assert.equal(zero.domain.profit_percentage, 0);
  const blank = calculateMDB(mk({ acb1000: "1", copperValue: "", overheadExpenses: "", profitPercentage: "" }), prices);
  assert.equal(blank.domain.CopperPrice, 47);
  assert.equal(blank.domain.OverHead_percentage, 3);
  assert.equal(blank.domain.profit_percentage, 20);
});

test("validation", () => {
  const ok = { moduleId: "m1", title: "MDB 1", quantity: 1, input: mk({ acb1000: "1" }) };
  const parsed = parseRequest(ok);
  assert.equal(parsed.input.values["mccb1000_scc"], "35kA");
  assert.equal(parsed.input.values["acb1000_scc"], "65kA");
  const bad = (patch: Record<string, unknown>, ip: Record<string, unknown> = {}, vp: Record<string, unknown> = {}) =>
    assert.throws(
      () => parseRequest({ ...ok, ...patch, input: { ...ok.input, ...ip, values: { ...ok.input.values, ...vp } } }),
      ValidationError,
    );
  bad({ title: "" });
  bad({ quantity: 0 });
  bad({}, { breakerType: "" });
  bad({}, {}, { brand: "FAKE" });
  bad({}, {}, { acb1000: "-1" });
  bad({}, {}, { acb1000: "9999" });
  bad({}, {}, { acb1000_scc: "99kA" });
  bad({}, {}, { acb1000_pole: "five" });
  bad({}, {}, { mccb1000: "1" });                 // MCCB incomer while ACB selected
  bad({}, {}, { depth_choice: "700" });
  bad({}, {}, { copperValue: "abc" });
  bad({}, {}, { profitPercentage: "500" });
  assert.throws(
    () => parseRequest({ ...ok, input: mk({ out_acb800: "1" }, "MCCB") }),   // ACB outgoing with MCCB type
    ValidationError,
  );
});

test("legacy brand Y passes validation", () => {
  assert.doesNotThrow(() => parseRequest({ moduleId: "m1", title: "MDB 1", quantity: 1, input: mk({ acb1000: "1", brand: "Y" }) }));
});
