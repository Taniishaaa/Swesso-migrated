// Server-side validation + normalisation of the SMDB form.

import type { SMDBInput } from "./types.ts";
import {
  BRANDS, INCOMER_IDS, MAX_QTY, OUTGOING_IDS, SCC_RATINGS,
} from "./tables.ts";

export class ValidationError extends Error {}

export interface GenerateRequest {
  moduleId: string;
  title: string;
  quantity: number;
  input: SMDBInput;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "" or a whole number 0..max, as a string. */
function qty(raw: unknown, name: string, max = MAX_QTY): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) throw new ValidationError(`${name} must be a whole number.`);
  const n = parseInt(s, 10);
  if (n > max) throw new ValidationError(`${name} must be at most ${max}.`);
  return String(n);
}

/** "" (=> default) or a finite number between 0 and max, as a string. */
function money(raw: unknown, name: string, max: number): string {
  if (raw === undefined || raw === null || String(raw).trim() === "") return "";
  const s = String(raw).trim();
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ValidationError(`${name} must be a number between 0 and ${max}.`);
  }
  return s;
}

function scc(raw: unknown, def: string, name: string): string {
  const v = raw === undefined || raw === null || raw === "" ? def : String(raw);
  if (!SCC_RATINGS.includes(v)) throw new ValidationError(`Invalid SCC rating for ${name}.`);
  return v;
}

const label = (id: string) =>
  id === "out_mccbsp100"
    ? "Outgoing SP 100A"
    : id.startsWith("out_mccb")
    ? `Outgoing ${id.replace("out_mccb", "")}A`
    : `${id.startsWith("iso") ? "Isolator" : "MCCB"} ${id.replace(/\D/g, "")}A`;

export function parseRequest(raw: unknown): GenerateRequest {
  if (typeof raw !== "object" || raw === null) throw new ValidationError("Invalid request body.");
  const body = raw as Record<string, unknown>;
  const i = (typeof body.input === "object" && body.input !== null ? body.input : {}) as Record<string, unknown>;
  const rv = (typeof i.values === "object" && i.values !== null ? i.values : {}) as Record<string, unknown>;

  const moduleId = str(body.moduleId);
  if (!moduleId) throw new ValidationError("moduleId is required.");

  const title = str(body.title).trim();
  if (!title) throw new ValidationError("Module title cannot be empty.");
  if (title.length > 100) throw new ValidationError("Module title is too long (max 100).");

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new ValidationError("Module quantity must be at least 1.");
  }

  const breakerType = str(i.currentBreakerType);
  if (breakerType !== "Isolator" && breakerType !== "MCCB") {
    throw new ValidationError("Please select an incomer type before generating the report.");
  }
  const brand = str(i.brand);
  if (!(BRANDS as readonly string[]).includes(brand)) {
    throw new ValidationError("Please select a brand before generating the report.");
  }

  const values: Record<string, string> = {};

  // incomers: only "" or "1", at most one in total, and only of the selected type
  let selected = 0;
  for (const id of INCOMER_IDS) {
    values[id] = qty(rv[id], label(id), 1);
    values[`${id}_scc`] = scc(rv[`${id}_scc`], "35kA", label(id));
    if (values[id] === "1") selected++;
    const otherType = breakerType === "Isolator" ? id.startsWith("mccb") : id.startsWith("iso");
    if (otherType && values[id] !== "") {
      throw new ValidationError(`${label(id)} does not match the selected incomer type.`);
    }
  }
  if (selected > 1) throw new ValidationError("Only one incomer can be selected.");

  // outgoing breakers
  for (const id of OUTGOING_IDS) {
    values[id] = qty(rv[id], label(id));
    values[`${id}_scc`] = scc(rv[`${id}_scc`], id === "out_mccbsp100" ? "25kA" : "35kA", label(id));
  }

  // accessories: 0 / 1 only
  for (const [id, name] of [["ryb", "RYB"], ["vm_am", "VM / AM"], ["Handle", "Handle"], ["PF", "PF Meter"], ["c_bank", "C bank"]]) {
    const v = qty(rv[id], name, 1);
    values[id] = v;
  }
  if (breakerType === "Isolator" && values["Handle"] !== "" && values["Handle"] !== "0") {
    throw new ValidationError("Handle cannot be selected for Isolator.");
  }
  values["padlock"] = qty(rv["padlock"], "Padlocks");

  // cost modal fields ("" => the default is applied by the engine)
  values["copperValue"] = money(rv["copperValue"], "Copper value", 100000);
  for (const [id, def] of [
    ["labour_800", "250"], ["labour_630", "200"], ["labour_400", "175"], ["labour_300", "150"],
    ["labour_250", "100"], ["labour_160", "90"], ["labour_125", "70"], ["labour_pf", "50"],
    ["labour_handle", "25"],
  ]) {
    values[id] = money(rv[id], `Labour (${id.replace("labour_", "")})`, 1e6) || def;
  }
  values["overheadExpenses"] = money(rv["overheadExpenses"], "Overhead %", 100) || "3";
  values["profitPercentage"] = money(rv["profitPercentage"], "Profit %", 100) || "20";

  return { moduleId, title, quantity, input: { brand, currentBreakerType: breakerType, values } };
}
