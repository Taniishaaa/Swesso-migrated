// Server-side validation + normalisation of the Meter Box form.

import type { MeterBoxInput } from "./types.ts";
import {
  BRANDS, DEFAULT_COPPER, DEFAULT_LABOUR_BASE, DEFAULT_LABOUR_METER, DEFAULT_OVERHEAD, DEFAULT_PROFIT,
  INCOMER_RATINGS,
} from "./tables.ts";

export class ValidationError extends Error {}

export interface GenerateRequest {
  moduleId: string;
  title: string;
  quantity: number;
  input: MeterBoxInput;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** true / false / 1 / 0 / "1" / "0" / "true" / "false" / "" (=> false). */
function flag(raw: unknown, name: string): boolean {
  if (raw === undefined || raw === null || raw === "" || raw === false || raw === 0 || raw === "0" || raw === "false") {
    return false;
  }
  if (raw === true || raw === 1 || raw === "1" || raw === "true") return true;
  throw new ValidationError(`${name} must be yes or no.`);
}

/** blank => default; otherwise a finite number between 0 and max ("0" is honoured). */
function money(raw: unknown, name: string, def: number, max: number): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ValidationError(`${name} must be a number between 0 and ${max}.`);
  }
  return n;
}

export function parseRequest(raw: unknown): GenerateRequest {
  if (typeof raw !== "object" || raw === null) throw new ValidationError("Invalid request body.");
  const body = raw as Record<string, unknown>;
  const i = (typeof body.input === "object" && body.input !== null ? body.input : {}) as Record<string, unknown>;

  const moduleId = str(body.moduleId);
  if (!moduleId) throw new ValidationError("moduleId is required.");

  const title = str(body.title).trim();
  if (!title) throw new ValidationError("Module title cannot be empty.");
  if (title.length > 100) throw new ValidationError("Module title is too long (max 100).");

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new ValidationError("Quantity must be greater than 0.");
  }

  const brand = str(i.brand);
  if (!(BRANDS as readonly string[]).includes(brand)) {
    throw new ValidationError("Please select a brand before generating the report.");
  }

  const incomer = Number(i.incomer);
  if (i.incomer === "" || i.incomer === undefined || i.incomer === null || !INCOMER_RATINGS.includes(incomer)) {
    throw new ValidationError("Please select an incomer rating (100A to 400A).");
  }

  return {
    moduleId,
    title,
    quantity,
    input: {
      brand,
      incomer,
      ct: flag(i.ct, "CT"),
      meter: flag(i.meter, "Meter"),
      copperValue: money(i.copperValue, "Copper value", DEFAULT_COPPER, 100000),
      labourBase: money(i.labourBase, "Labour", DEFAULT_LABOUR_BASE, 1e6),
      labourMeter: money(i.labourMeter, "Meter labour", DEFAULT_LABOUR_METER, 1e6),
      overheadPercent: money(i.overheadPercent, "Overhead %", DEFAULT_OVERHEAD, 100),
      profitPercent: money(i.profitPercent, "Profit %", DEFAULT_PROFIT, 100),
    },
  };
}
