import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import type { ProjectModuleRow } from "../types/modules";

/** Calls a calc-* Edge Function and returns the saved module row. */
async function invokeCalc(fn: string, body: unknown): Promise<ProjectModuleRow> {
  const { data, error } = await supabase.functions.invoke(fn, { body });

  if (error) {
    let message = "Failed to generate report.";
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json();
        if (payload?.error) message = payload.error;
      } catch {
        /* keep default message */
      }
    }
    throw new Error(message);
  }

  if (!data?.module) throw new Error("Unexpected response from server.");
  return data.module as ProjectModuleRow;
}

// ---------------------------------------------------------------------------
// CBank800
// ---------------------------------------------------------------------------

/** Raw form values; empty strings are allowed (the server treats "" as 0 / default). */
export interface CBank800FormInput {
  capacitor: string;
  contactorBrand: string;
  fusesBrand: string;
  incomerBrand: string;
  incomerType: string;
  incomer: number | "";
  step5: number | "";
  step10: number | "";
  step20: number | "";
  step25: number | "";
  step50: number | "";
  Rstep10: number | "";
  Rstep20: number | "";
  Rstep25: number | "";
  Rstep50: number | "";
  miscellaneous: number | "";
  labour: number | "";
  overhead: number | "";
}

export interface GenerateCBank800Request {
  moduleId: string;
  title: string;
  quantity: number | "";
  input: CBank800FormInput;
}

export function generateCBank800(req: GenerateCBank800Request): Promise<ProjectModuleRow> {
  return invokeCalc("calc-cbank800", req);
}

// ---------------------------------------------------------------------------
// DBRow
// ---------------------------------------------------------------------------

export interface DBRowFormInput {
  brand: string;
  sccRating: string;
  /** iso , elcb , mcb, con quantities, poles, ELR, timers, c_others (all strings). */
  counts: Record<string, string>;
  labour16: number;
  labour24: number;
  overheadPercent: number;
  profitPercent: number;
}

export interface GenerateDBRowRequest {
  moduleId: string;
  title: string;
  quantity: number | "";
  input: DBRowFormInput;
}

export function generateDBRow(req: GenerateDBRowRequest): Promise<ProjectModuleRow> {
  return invokeCalc("calc-dbrow", req);
}

// ---------------------------------------------------------------------------
// SMDB
// ---------------------------------------------------------------------------

export interface SMDBFormInput {
  brand: string;
  currentBreakerType: string;
  /** iso, mccb, out_mccb, quantities + SCC, accessories, padlock and cost-modal fields (all strings). */
  values: Record<string, string>;
}

export interface GenerateSMDBRequest {
  moduleId: string;
  title: string;
  quantity: number | "";
  input: SMDBFormInput;
}

export function generateSMDB(req: GenerateSMDBRequest): Promise<ProjectModuleRow> {
  return invokeCalc("calc-smdb", req);
}

// ---------------------------------------------------------------------------
// MDB (Form 2)
// ---------------------------------------------------------------------------

export interface MDBFormInput {
  breakerType: string;
  /** brand, quantities, ACB/MCCB attributes, depths, other components and cost-modal fields (all strings). */
  values: Record<string, string>;
}

export interface GenerateMDBRequest {
  moduleId: string;
  title: string;
  quantity: number | "";
  input: MDBFormInput;
}

export function generateMDB(req: GenerateMDBRequest): Promise<ProjectModuleRow> {
  return invokeCalc("calc-mdb", req);
}

// ---------------------------------------------------------------------------
// Form 4 MDB
// ---------------------------------------------------------------------------

export interface Form4FormInput {
  /** breakerType ("ACB" | "MCCB"), brand, quantities, ACB/MCCB attributes, accessories and cost-modal fields (all strings). */
  values: Record<string, string>;
}

export interface GenerateForm4Request {
  moduleId: string;
  title: string;
  quantity: number | "";
  input: Form4FormInput;
}

export function generateForm4(req: GenerateForm4Request): Promise<ProjectModuleRow> {
  return invokeCalc("calc-form4", req);
}

// ---------------------------------------------------------------------------
// Meter Box
// ---------------------------------------------------------------------------

export interface MeterBoxFormInput {
  brand: string;
  incomer: number | "";
  ct: boolean;
  meter: boolean;
  copperValue: number | "";
  labourBase: number | "";
  labourMeter: number | "";
  overheadPercent: number | "";
  profitPercent: number | "";
}

export interface GenerateMeterBoxRequest {
  moduleId: string;
  title: string;
  quantity: number | "";
  input: MeterBoxFormInput;
}

export function generateMeterBox(req: GenerateMeterBoxRequest): Promise<ProjectModuleRow> {
  return invokeCalc("calc-meterbox", req);
}
