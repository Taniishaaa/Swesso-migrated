// Server-side validation + normalisation of the DBRow form.

import type { DBRowInput } from "./types.ts";
import {
  BRANDS, CON_IDS, CON_POLES, ELCB_IDS, ELCB_POLES, ELR_30MA_ALLOWED_AMPS, ELR_VALUES, ISO_IDS,
  ISO_POLES, MAX_QTY_PER_FIELD, MCB_IDS, MCB_POLES, SCC_RATINGS,
} from "./tables.ts";

export class ValidationError extends Error {}

export interface GenerateRequest {
  moduleId: string;
  title: string;
  quantity: number;
  input: DBRowInput;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function num(raw: unknown, name: string, min: number, max: number, def?: number): number {
  const v = raw === undefined || raw === null || raw === "" ? def : Number(raw);
  if (v === undefined || !Number.isFinite(v)) throw new ValidationError(`${name} must be a number.`);
  if (v < min || v > max) throw new ValidationError(`${name} must be between ${min} and ${max}.`);
  return v;
}

function oneOf(raw: unknown, allowed: string[], def: string, name: string): string {
  const v = raw === undefined || raw === null || raw === "" ? def : String(raw);
  if (!allowed.includes(v)) throw new ValidationError(`Invalid value for ${name}.`);
  return v;
}

/** "" or a whole number 0..MAX, returned as a string (the shape the form stores). */
function qty(raw: unknown, name: string, max = MAX_QTY_PER_FIELD): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) throw new ValidationError(`${name} must be a whole number.`);
  const n = parseInt(s, 10);
  if (n > max) throw new ValidationError(`${name} must be at most ${max}.`);
  return String(n);
}

export function parseRequest(raw: unknown): GenerateRequest {
  if (typeof raw !== "object" || raw === null) throw new ValidationError("Invalid request body.");
  const body = raw as Record<string, unknown>;
  const i = (typeof body.input === "object" && body.input !== null ? body.input : {}) as Record<string, unknown>;
  const rc = (typeof i.counts === "object" && i.counts !== null ? i.counts : {}) as Record<string, unknown>;

  const moduleId = str(body.moduleId);
  if (!moduleId) throw new ValidationError("moduleId is required.");

  const title = str(body.title).trim();
  if (!title) throw new ValidationError("Module title cannot be empty.");
  if (title.length > 100) throw new ValidationError("Module title is too long (max 100).");

  const quantity = num(body.quantity, "Quantity", 1, 100000, NaN);
  if (!Number.isInteger(quantity)) throw new ValidationError("Quantity must be a whole number.");

  const brand = str(i.brand);
  if (!(BRANDS as readonly string[]).includes(brand)) {
    throw new ValidationError("Please select a breaker brand");
  }
  const sccRating = oneOf(i.sccRating, [...SCC_RATINGS], "6kA", "SCC rating");

  const counts: Record<string, string> = {};
  for (const n of ISO_IDS) {
    counts[`iso${n}`] = qty(rc[`iso${n}`], `Isolator ${n}A`, 1); // only 1 isolator per size
    counts[`iso${n}_pole`] = oneOf(rc[`iso${n}_pole`], ISO_POLES, "TP", `Isolator ${n}A pole`);
  }
  for (const n of ELCB_IDS) {
    counts[`elcb${n}`] = qty(rc[`elcb${n}`], `ELCB ${n}A`);
    counts[`elcb${n}_pole`] = oneOf(rc[`elcb${n}_pole`], ELCB_POLES, "2P", `ELCB ${n}A pole`);
    const elrAllowed = ELR_VALUES.filter((v) => v !== "30MA" || ELR_30MA_ALLOWED_AMPS.includes(n));
    counts[`elcb${n}_elr`] = oneOf(rc[`elcb${n}_elr`], elrAllowed, "300MA", `ELCB ${n}A ELR`);
  }
  for (const n of MCB_IDS) {
    counts[`mcb${n}`] = qty(rc[`mcb${n}`], `MCB ${n}A`);
    counts[`mcb${n}_pole`] = oneOf(rc[`mcb${n}_pole`], MCB_POLES, "SP", `MCB ${n}A pole`);
  }
  for (const n of CON_IDS) {
    counts[`con${n}`] = qty(rc[`con${n}`], `Contactor ${n}A`);
    counts[`con${n}_pole`] = n === 63
      ? "3P" // 63A contactor is 3P only
      : oneOf(rc[`con${n}_pole`], CON_POLES, "DP", `Contactor ${n}A pole`);
  }
  counts["conTimer"] = qty(rc["conTimer"], "24hr timers");
  counts["con_strTimer"] = qty(rc["con_strTimer"], "Staircase timers");

  // c_others: money; the UI allows digits and dots only
  const others = rc["c_others"] === undefined || rc["c_others"] === null ? "" : String(rc["c_others"]).trim();
  if (!/^[0-9.]*$/.test(others)) throw new ValidationError("Other misc cost must be a number.");
  if ((parseFloat(others) || 0) > 1e9) throw new ValidationError("Other misc cost is too large.");
  counts["c_others"] = others;

  return {
    moduleId,
    title,
    quantity,
    input: {
      brand,
      sccRating,
      counts,
      labour16: num(i.labour16, "Labour (16 type row)", 0, 1e6, 20),
      labour24: num(i.labour24, "Labour (24 type row)", 0, 1e6, 25),
      overheadPercent: num(i.overheadPercent, "Overhead %", 0, 100, 3),
      profitPercent: num(i.profitPercent, "Profit %", 0, 100, 20),
    },
  };
}
