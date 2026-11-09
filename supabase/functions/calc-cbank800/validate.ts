// Server-side input validation. The old client did this in the component;
// the server must not trust the client, so it is re-done here (and stricter).

import type { CBankInput } from "./types.ts";
import { BRANDS, ISOLATOR_MAP, MCCB_MAP } from "./tables.ts";

export class ValidationError extends Error {}

export interface GenerateRequest {
  moduleId: string;
  title: string;
  quantity: number;
  input: CBankInput;
}

const MAX_STEPS = 500;

function num(raw: unknown, name: string, opts: { min?: number; max?: number; int?: boolean; def?: number } = {}): number {
  const { min = 0, max = Infinity, int = false, def = 0 } = opts;
  const v = raw === undefined || raw === null || raw === "" ? def : Number(raw);
  if (!Number.isFinite(v)) throw new ValidationError(`${name} must be a number.`);
  if (int && !Number.isInteger(v)) throw new ValidationError(`${name} must be a whole number.`);
  if (v < min || v > max) throw new ValidationError(`${name} must be between ${min} and ${max}.`);
  return v;
}

function str(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
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

  const quantity = num(body.quantity, "Module quantity", { min: 1, max: 100000, int: true, def: NaN });

  const capacitor = str(i.capacitor);
  if (!(BRANDS as readonly string[]).includes(capacitor)) {
    throw new ValidationError("Please select a valid brand.");
  }

  const incomerType = str(i.incomerType);
  if (incomerType !== "isolator" && incomerType !== "mccb") {
    throw new ValidationError("Please select an incomer type before generating the report.");
  }

  const incomer = Number(i.incomer);
  const table = incomerType === "isolator" ? ISOLATOR_MAP : MCCB_MAP;
  if (!Object.prototype.hasOwnProperty.call(table, incomer)) {
    throw new ValidationError("Please select a valid incomer rating.");
  }

  const step = (k: string) => num(i[k], k, { min: 0, max: MAX_STEPS, int: true });

  return {
    moduleId,
    title,
    quantity,
    input: {
      capacitor,
      contactorBrand: str(i.contactorBrand),
      fusesBrand: str(i.fusesBrand),
      incomerBrand: str(i.incomerBrand),
      incomerType,
      incomer,
      step5: step("step5"),
      step10: step("step10"),
      step20: step("step20"),
      step25: step("step25"),
      step50: step("step50"),
      Rstep10: step("Rstep10"),
      Rstep20: step("Rstep20"),
      Rstep25: step("Rstep25"),
      Rstep50: step("Rstep50"),
      miscellaneous: num(i.miscellaneous, "miscellaneous", { min: 0, max: 1e9 }),
      labour: num(i.labour, "labour", { min: 0, max: 100, def: 10 }),
      overhead: num(i.overhead, "overhead", { min: 0, max: 100, def: 5 }),
    },
  };
}
