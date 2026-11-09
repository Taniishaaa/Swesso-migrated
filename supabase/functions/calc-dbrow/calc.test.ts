// Runs under Deno (`deno test`) and Node 22+ (`node --experimental-strip-types --test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CalcError, calculateDBRow } from "./calc.ts";
import { parseRequest, ValidationError } from "./validate.ts";
import type { DBRowInput, PriceRow } from "./types.ts";

const P: Record<string, number> = {
  "DB 16 module 2 row": 300, "DB 24 module 5 row": 700,
  "UVR SP": 25,
  "ISOLATOR TP 63A": 100, "ELCB 2P 40A 300MA": 150, "MCB SP 10-40A": 10, "MCB TP 10-40A": 12,
  "CONT DP 20A": 60,
  "Neutral Link": 5, "Earth Bar": 20, "WIRE 10MMSQ DB": 4, "WIRE 1.5MMSQ DB": 2,
  "Blank Covers": 3, "CBB 3P": 200, "CBB 4P": 300,
};
const prices: PriceRow[] = Object.entries(P).map(([ITEMS, p]) => ({ ITEMS, ABB: String(p) }));

const emptyCounts = (): Record<string, string> => {
  const c: Record<string, string> = {};
  for (const n of [125, 100, 80, 63, 40, 32, 20, 16]) { c[`iso${n}`] = ""; c[`iso${n}_pole`] = "TP"; }
  for (const n of [100, 63, 40]) { c[`elcb${n}`] = ""; c[`elcb${n}_pole`] = "2P"; c[`elcb${n}_elr`] = "300MA"; }
  for (const n of [10, 50]) { c[`mcb${n}`] = ""; c[`mcb${n}_pole`] = "SP"; }
  for (const n of [20, 40, 63]) { c[`con${n}`] = ""; c[`con${n}_pole`] = n === 63 ? "3P" : "DP"; }
  c.conTimer = ""; c.con_strTimer = ""; c.c_others = "";
  return c;
};
const mk = (patch: Record<string, string>, extra: Partial<DBRowInput> = {}): DBRowInput => ({
  brand: "ABB", sccRating: "6kA", counts: { ...emptyCounts(), ...patch },
  labour16: 20, labour24: 25, overheadPercent: 3, profitPercent: 20, ...extra,
});
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("hand-checked: 17 modules overflow one 16-module row into 2 rows", () => {
  // iso63 TP(3) + 2x ELCB 2P(4) + 6x MCB SP(6) + CONT DP(2) + its UVR SP(2) = 17 modules
  const r = calculateDBRow(
    mk({ iso63: "1", elcb40: "2", mcb10: "6", con20: "1", c_others: "15" }),
    prices,
  );
  assert.equal(r.display.summary.DBType, "DB 16 module 2 row");
  // DB 300 + UVR 25 + breakers 520 + accessories 58 + labour 2x20 + others 15 = 958
  // overhead 3% = 28.74 ; profit 20% of 986.74 = 197.348 ; grand 1184.088
  near(r.display.totals.grandTotal, 1184.088);
  assert.equal(r.unitPrice, 1184.09);
  near(r.display.totals.labour, 40);
});

test("falls back to a 24-module DB when 16-module needs more than 6 rows", () => {
  // 33 x MCB TP (3 modules): 16-wide holds 5/row => 30 in 6 rows (fail); 24-wide holds 8/row => 5 rows
  const r = calculateDBRow(mk({ mcb10: "33", mcb10_pole: "TP" }), prices);
  assert.equal(r.display.summary.DBType, "DB 24 module 5 row");
  near(r.display.totals.labour, 25 * 5);
});

test("throws CalcError when nothing fits", () => {
  assert.throws(
    () => calculateDBRow(mk({ mcb10: "100", mcb10_pole: "TP" }), prices),
    (e: unknown) => e instanceof CalcError && /Cannot fit/.test((e as Error).message),
  );
});

test("price lookup is case/space-insensitive; missing DB size prices 0 (quirk)", () => {
  const r = calculateDBRow(mk({ mcb10: "1" }), prices); // "DB 16 module 1 row" not in fixture
  assert.equal(r.display.components[0].name, "DB 16 module 1 row");
  assert.equal(r.display.components[0].unitPrice, 0);
  const lower = prices.map((p) => ({ ...p, ITEMS: `  ${p.ITEMS.toLowerCase()} ` }));
  const r2 = calculateDBRow(mk({ iso63: "1" }), lower);
  assert.ok(r2.display.components.some((c) => c.name === "ISOLATOR TP 63A" && c.unitPrice === 100));
});

test("a DP contactor adds one UVR SP", () => {
  const r = calculateDBRow(mk({ con20: "1", con20_pole: "DP" }), prices);
  assert.equal((r.domain.Db as { quantity?: number }[])[1].quantity, 1);
});

test("validation", () => {
  const ok = { moduleId: "m1", title: "DB 1", quantity: 1, input: mk({}) };
  const parsed = parseRequest(ok);
  assert.equal(parsed.input.counts["con63_pole"], "3P");
  const bad = (patch: Record<string, unknown>, ip: Record<string, unknown> = {}, cp: Record<string, unknown> = {}) =>
    assert.throws(
      () => parseRequest({ ...ok, ...patch, input: { ...ok.input, ...ip, counts: { ...ok.input.counts, ...cp } } }),
      ValidationError,
    );
  bad({ title: "" });
  bad({ quantity: 0 });
  bad({}, { brand: "FAKE" });
  bad({}, { sccRating: "99kA" });
  bad({}, { overheadPercent: -1 });
  bad({}, {}, { iso63: "2" });          // isolator max 1
  bad({}, {}, { mcb10: "-3" });
  bad({}, {}, { mcb10: "9999" });
  bad({}, {}, { mcb10_pole: "XX" });    // pole is interpolated into a price lookup name
  bad({}, {}, { elcb100_elr: "30MA" }); // 30MA only for 63A / 40A
  bad({}, {}, { c_others: "abc" });
});

test("legacy brand Y passes validation", () => {
  assert.doesNotThrow(() => parseRequest({ moduleId: "m1", title: "DB 1", quantity: 1, input: mk({}, { brand: "Y" }) }));
});
