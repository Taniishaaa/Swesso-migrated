// Server-side validation + normalisation of the MDB (Form 2) form.

import type { MDBInput } from "./types.ts";
import {
  ACB_INCOMER_SIZES, ACB_POLES, ACB_SCC, ACB_TYPES, BRANDS, BUS_ACB_SIZES, BUS_MCCB_SIZES, DEFAULT_LABOUR,
  DEPTHS, MAX_QTY, MCCB_INCOMER_SIZES, MCCB_POLES, MCCB_SCC, OTHER_COMPONENT_KEYS, OUT_ACB_SIZES, OUT_MCCB_SIZES,
} from "./tables.ts";

export class ValidationError extends Error {}

export interface GenerateRequest {
  moduleId: string;
  title: string;
  quantity: number;
  input: MDBInput;
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

function oneOf(raw: unknown, allowed: string[], def: string, name: string): string {
  const v = raw === undefined || raw === null || raw === "" ? def : String(raw);
  if (!allowed.includes(v)) throw new ValidationError(`Invalid value for ${name}.`);
  return v;
}

/** Cost-modal number: omitted => stays omitted (UI shows its default); "" => default; else 0..max. */
function money(raw: unknown, name: string, max: number): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return "";
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ValidationError(`${name} must be a number between 0 and ${max}.`);
  }
  return s;
}

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
    throw new ValidationError("Quantity must be greater than 0.");
  }

  const breakerType = str(i.breakerType);
  if (breakerType !== "ACB" && breakerType !== "MCCB") {
    throw new ValidationError("Please select an incomer type before generating the report.");
  }
  const brand = str(rv["brand"]);
  if (!(BRANDS as readonly string[]).includes(brand)) {
    throw new ValidationError("Please select a brand before generating the report.");
  }

  const values: Record<string, string> = { brand };

  // Keys that belong to the OTHER incomer type are hidden in the UI (and cleared when the type
  // is switched), so a non-zero value there means a tampered / stale request.
  const own = (key: string, allowedForType: boolean, name: string, max = MAX_QTY): string => {
    const v = qty(rv[key], name, max);
    if (!allowedForType && v !== "" && v !== "0") {
      throw new ValidationError(`${name} is not available for ${breakerType} incomers.`);
    }
    return allowedForType ? v : "";
  };
  const isACB = breakerType === "ACB";

  values["depth_choice"] = oneOf(rv["depth_choice"], ["", ...DEPTHS], "", "ACB enclosure depth");
  values["depth_choice_mccb"] = oneOf(rv["depth_choice_mccb"], ["", ...DEPTHS], "", "MCCB enclosure depth");

  for (const r of ACB_INCOMER_SIZES) {
    values[`acb${r}`] = own(`acb${r}`, isACB, `ACB ${r}A`);
    values[`acb${r}_type`] = oneOf(rv[`acb${r}_type`], ACB_TYPES, "drawout", `ACB ${r}A type`);
    values[`acb${r}_scc`] = oneOf(rv[`acb${r}_scc`], ACB_SCC, "65kA", `ACB ${r}A SCC`);
    values[`acb${r}_pole`] = oneOf(rv[`acb${r}_pole`], ACB_POLES, "three", `ACB ${r}A poles`);
  }
  for (const r of MCCB_INCOMER_SIZES) {
    values[`mccb${r}`] = own(`mccb${r}`, !isACB, `MCCB ${r}A`);
    values[`mccb${r}_scc`] = oneOf(rv[`mccb${r}_scc`], MCCB_SCC, "35kA", `MCCB ${r}A SCC`);
    values[`mccb${r}_poles`] = oneOf(rv[`mccb${r}_poles`], MCCB_POLES, "3P", `MCCB ${r}A poles`);
  }
  for (const r of BUS_ACB_SIZES) values[`bus_acb${r}`] = own(`bus_acb${r}`, isACB, `Bus coupler ACB ${r}A`);
  for (const r of BUS_MCCB_SIZES) values[`bus_mccb${r}`] = own(`bus_mccb${r}`, !isACB, `Bus coupler MCCB ${r}A`);
  for (const r of OUT_ACB_SIZES) values[`out_acb${r}`] = own(`out_acb${r}`, isACB, `Outgoing ACB ${r}A`);
  for (const r of OUT_MCCB_SIZES) values[`out_mccb${r}`] = qty(rv[`out_mccb${r}`], `Outgoing MCCB ${r}A`);
  values["out_mccbsp100"] = qty(rv["out_mccbsp100"], "Outgoing MCCB SP 100A");
  for (const k of OTHER_COMPONENT_KEYS) values[k] = qty(rv[k], k);

  // cost modal fields
  const setMoney = (id: string, name: string, max: number) => {
    const v = money(rv[id], name, max);
    if (v !== undefined) values[id] = v;
  };
  setMoney("copperValue", "Copper value", 100000);
  for (const id of Object.keys(DEFAULT_LABOUR)) setMoney(id, `Labour (${id.replace("labour_", "")})`, 1e6);
  setMoney("overheadExpenses", "Overhead %", 100);
  setMoney("profitPercentage", "Profit %", 100);

  return { moduleId, title, quantity, input: { breakerType, values } };
}
