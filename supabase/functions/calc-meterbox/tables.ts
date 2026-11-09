// Constants taken from "Meter Box.txt" / "Meter_Box.docx" (the estimate-sheet notes + 3 worked examples).

export const BRANDS = [
  "ABB", "MG", "GE", "CUTLERH", "SEIMENS", "LG", "L&T", "DSMITH", "NEW", "M.BSHI", "Z", "Y",
] as const; // "Y" is kept from the old UI; the price book has no "Y" column, so a Y quote prices everything at 0.

export const SMALL_ENCLOSURE = "ENCL 800X600X200"; // up to and including 160A
export const LARGE_ENCLOSURE = "ENCL 1000X800X250"; // 200A to 400A

// Gland box price depends on the enclosure ("ALL enclosures have a GLAND BOX").
export const GLAND_BOX_PRICE: Record<string, number> = {
  [SMALL_ENCLOSURE]: 175, // gland box 200x600x200
  [LARGE_ENCLOSURE]: 225, // gland box 250x800x250
};

export interface IncomerConfig {
  mccb: string;
  mainBB: string;
  earthBB: string;
  enclosure: string;
}

// ASSUMPTIONS (the notes don't say):
//  * 250A busbars: not listed in the notes; uses the same as 200A and 300A (25X8 / 20X5).
//  * 300A earth busbar is written "CU BB 20X5S" in the notes; the worked example shows "CU BB 20X5",
//    so the trailing "S" is treated as a typo.
export const INCOMERS: Record<number, IncomerConfig> = {
  100: { mccb: "MCCB 35kA TP 100A", mainBB: "CU BB 10X5", earthBB: "CU BB 10X5", enclosure: SMALL_ENCLOSURE },
  125: { mccb: "MCCB 35kA TP 125A", mainBB: "CU BB 15X5", earthBB: "CU BB 10X5", enclosure: SMALL_ENCLOSURE },
  160: { mccb: "MCCB 35kA TP 160A", mainBB: "CU BB 15X5", earthBB: "CU BB 10X5", enclosure: SMALL_ENCLOSURE },
  200: { mccb: "MCCB 35kA TP 200A", mainBB: "CU BB 25X8", earthBB: "CU BB 20X5", enclosure: LARGE_ENCLOSURE },
  250: { mccb: "MCCB 35kA TP 250A", mainBB: "CU BB 25X8", earthBB: "CU BB 20X5", enclosure: LARGE_ENCLOSURE },
  300: { mccb: "MCCB 35kA TP 300A", mainBB: "CU BB 25X8", earthBB: "CU BB 20X5", enclosure: LARGE_ENCLOSURE },
  400: { mccb: "MCCB 35kA TP 400A", mainBB: "CU BB 30X10", earthBB: "CU BB 25X8", enclosure: LARGE_ENCLOSURE },
};
export const INCOMER_RATINGS = Object.keys(INCOMERS).map(Number);

// "Revised prices" from the notes: fixed, not brand dependent, NOT read from the price book.
export const FIXED_ITEMS = {
  windowGlass: { name: "WINDOW GLASS", price: 60, quantity: 1, unit: "Nos" },
  ply: { name: "PLY", price: 30, quantity: 1, unit: "Nos" },
  bsheet: { name: "BSHEET", price: 200, quantity: 0.35, unit: "Sheet" },
  padLock: { name: "PAD LOCK", price: 15, quantity: 1, unit: "Nos" },
  colSleeve: { name: "COL SLEEVE", price: 100, quantity: 0.15, unit: "Nos" },
  ctMeterbox: { name: "CT METERBOX", price: 60, quantity: 3, unit: "Nos" },
  nutBolts: { name: "NUT&BOLTS", price: 1, quantity: 15, unit: "Nos" },
};
export const GLAND_BOX_NAME = "GLAND BOX";

// Quantities read off the worked examples; unit prices come from the price book.
export const MAIN_BB_LENGTH = 2; // metres, always
export const EARTH_BB_LENGTH = 0.5; // metres, only with METER
export const KWH_METER_QTY = 1;
export const FUSES_QTY = 3;
export const INSULATORS_QTY = 8;

// Defaults. Labour (50 / +25 with meter) is inferred from the examples: 200A+CT = 50, 300A+nothing = 50,
// 300A+CT+METER = 75. Overhead/profit default to 0 because the examples show total = material + labour.
export const DEFAULT_COPPER = 47;
export const DEFAULT_LABOUR_BASE = 50;
export const DEFAULT_LABOUR_METER = 25;
export const DEFAULT_OVERHEAD = 0;
export const DEFAULT_PROFIT = 0;
