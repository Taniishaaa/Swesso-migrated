// Runs under Deno (`deno test`) and Node 22+ (`node --experimental-strip-types --test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSMDB } from "./calc.ts";
import { parseRequest, ValidationError } from "./validate.ts";
import type { PriceRow, SMDBInput } from "./types.ts";

const P: Record<string, number> = {
  "ENCL 1200X800X300": 600, "ENCL 2000X1000X400": 900,
  "MCCB 35KA TP 400A": 1000, "MCCB 35KA TP 100A": 200, "MCCB 25KA SP 100A": 50,
  "MCCB 35KA TP 630A": 1500,
  AM: 30, VM: 25, "S/S": 10, "SMDB CT": 40, FUSES: 5, "WIRE 1.5MMSQ": 2,
  "CU BB 30X10": 30, "CU BB 25X8": 20, "CU BB 10X5": 10, "CU BB 40X10": 40, "CU BB 20X5": 8,
  INSULATORS: 3, CHANNAL: 20, PADLOCK: 15, BSHEET: 100, BRAKETS: 5,
  // COL SLEEVE SMDB deliberately absent (price 0) so its rounded-length qty can't affect totals
};
const prices: PriceRow[] = Object.entries(P).map(([ITEMS, p]) => ({ ITEMS, ABB: String(p) }));

// full, normalised values map as validate.ts produces it
function vals(patch: Record<string, string> = {}): Record<string, string> {
  const v: Record<string, string> = {};
  for (const s of ["800", "630", "400", "300", "250", "200", "160", "125", "100", "80"]) {
    v[`iso${s}`] = ""; v[`iso${s}_scc`] = "35kA"; v[`mccb${s}`] = ""; v[`mccb${s}_scc`] = "35kA";
  }
  for (const s of ["630", "400", "300", "250", "200", "160", "125", "100", "80", "63", "50", "40", "32", "25", "16", "10", "sp100"]) {
    v[`out_mccb${s}`] = ""; v[`out_mccb${s}_scc`] = s === "sp100" ? "25kA" : "35kA";
  }
  for (const k of ["ryb", "vm_am", "Handle", "PF", "c_bank", "padlock", "copperValue"]) v[k] = "";
  Object.assign(v, {
    labour_800: "250", labour_630: "200", labour_400: "175", labour_300: "150", labour_250: "100",
    labour_160: "90", labour_125: "70", labour_pf: "50", labour_handle: "25",
    overheadExpenses: "3", profitPercentage: "20",
  });
  return { ...v, ...patch };
}
const mk = (patch: Record<string, string>, type: "Isolator" | "MCCB" = "MCCB"): SMDBInput => ({
  brand: "ABB", currentBreakerType: type, values: vals(patch),
});
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("hand-checked: 400A MCCB incomer + 2x100A + SP100 outgoing, VM/AM, padlock", () => {
  const r = calculateSMDB(
    mk({ mccb400: "1", out_mccb100: "2", out_mccbsp100: "1", vm_am: "1", padlock: "1" }),
    prices,
  );
  // a = 50+30+7.5+10+ (2*11+1*4)/2=13 = 110.5 -> ENCL 1200X800X300
  assert.equal(r.domain.Enclosure, "ENCL 1200X800X300");
  // enclosure 600 + breakers 1450 + others 320 + busbars 5604.75 + misc 139.5 = 8114.25
  // + labour 385 = 8499.25 ; overhead 3% ; profit 20% on (cost+overhead)
  near(r.unitPrice, 10505.073);
  near(r.display.totals.labour, 385);
  const bb = r.domain.CU_BB as { name: string; totalPrice: number }[];
  assert.deepEqual(bb.map((b) => b.name), ["CU BB 30X10", "CU BB 25X8", "CU BB 10X5"]);
  near(bb.reduce((s, b) => s + b.totalPrice, 0), 5604.75);
});

test("same breaker from incomer and outgoing merges into one line", () => {
  const r = calculateSMDB(mk({ mccb400: "1", out_mccb400: "2" }), prices);
  const lines = r.domain.Breaker as { name: string; quantity: number }[];
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);
});

test("630A incomer gets no TMN/HEIGHT (quirk preserved)", () => {
  const r = calculateSMDB(mk({ mccb630: "1" }), prices);
  assert.equal(r.domain.TMN, 0);
  assert.equal(r.domain.IncomerHeight, 0);
});

test("oversized panel => no enclosure, silently excluded (quirk preserved)", () => {
  const r = calculateSMDB(mk({ mccb400: "1", out_mccb630: "20" }), prices); // H_L = 210
  assert.equal(r.domain.Enclosure, "N/A");
  assert.equal(r.domain.Enclosure_Price, "Enclosure not found");
  assert.ok(!r.items.some((i) => i.name === "N/A"));
});

test("100A incomer: earth busbar overwrites main length (quirk preserved)", () => {
  const r = calculateSMDB(mk({ mccb100: "1" }), prices);
  const bb = r.domain.CU_BB as { name: string; length: number }[];
  assert.equal(bb.length, 1);
  assert.equal(bb[0].name, "CU BB 10X5");
  // a = 20+12+10 = 42 -> ENCL 700X500X250. Earth length = 0.5*0.75*0.25 = 0.09375 -> 0.09,
  // NOT the main length 1*3.5*0.75*0.7 = 1.8375 that was written first.
  assert.equal(r.domain.Enclosure, "ENCL 700X500X250");
  near(bb[0].length, 0.09);
});

test("labour/overhead/profit/copper of 0 fall back to defaults (quirk preserved)", () => {
  const a = calculateSMDB(mk({ mccb400: "1", copperValue: "0", overheadExpenses: "0", profitPercentage: "0" }), prices);
  assert.equal(a.domain.Copper_Price, 47);
  assert.equal(a.domain.Overhead_Percent, 3);
  assert.equal(a.domain.Profit_Percent, 20);
});

test("validation", () => {
  const ok = { moduleId: "m1", title: "SMDB 1", quantity: 1, input: mk({}) };
  assert.doesNotThrow(() => parseRequest(ok));
  const bad = (patch: Record<string, unknown>, ip: Record<string, unknown> = {}, vp: Record<string, unknown> = {}) =>
    assert.throws(
      () => parseRequest({ ...ok, ...patch, input: { ...ok.input, ...ip, values: { ...ok.input.values, ...vp } } }),
      ValidationError,
    );
  bad({ title: " " });
  bad({ quantity: 0 });
  bad({}, { brand: "FAKE" });
  bad({}, { currentBreakerType: "" });
  bad({}, {}, { mccb400: "2" });                       // incomer max 1
  bad({}, {}, { mccb400: "1", mccb630: "1" });         // only one incomer
  bad({}, {}, { iso400: "1" });                        // isolator while MCCB selected
  bad({}, {}, { out_mccb100: "-1" });
  bad({}, {}, { out_mccb100: "99999" });
  bad({}, {}, { vm_am: "2" });                         // accessories 0/1 only
  bad({}, {}, { mccb400_scc: "99kA" });
  bad({}, {}, { copperValue: "abc" });
  bad({}, {}, { profitPercentage: "500" });
  assert.throws(
    () => parseRequest({ ...ok, input: { ...mk({ Handle: "1" }, "Isolator") } }),
    ValidationError,                                    // handle not allowed with Isolator
  );
});

test("legacy brand Y passes validation", () => {
  assert.doesNotThrow(() => parseRequest({ moduleId: "m1", title: "SMDB 1", quantity: 1, input: { ...mk({}), brand: "Y" } }));
});
