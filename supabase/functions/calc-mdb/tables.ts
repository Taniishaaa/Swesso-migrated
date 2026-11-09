// Constants ported 1:1 from MDBModule.tsx.

export const BRANDS = [
  "ABB", "MG", "GE", "CUTLERH", "SEIMENS", "LG", "L&T", "DSMITH", "NEW", "M.BSHI", "Z", "Y",
] as const; // "Y" is kept from the old UI; the price book has no "Y" column, so a Y quote prices everything at 0.

export type BusbarEntry = { type: string; multiplier: number };
export type BusbarConfig = { main: BusbarEntry[]; earth: BusbarEntry[] };

// --- Busbar map (key = rating; 101 = SP up to 100A) ---
export const BUSBAR_MAP: Record<number, BusbarConfig> = {
  4000: {
    main: [{ type: "CU BB 120X10", multiplier: 12 }],
    earth: [{ type: "CU BB 100X10", multiplier: 2 }],
  },
  3200: {
    main: [{ type: "CU BB 100X10", multiplier: 12 }],
    earth: [{ type: "CU BB 60X10", multiplier: 8 }],
  },
  2500: {
    main: [{ type: "CU BB 100X10", multiplier: 8 }],
    earth: [{ type: "CU BB 100X10", multiplier: 1 }],
  },
  2000: {
    main: [{ type: "CU BB 80X10", multiplier: 8 }],
    earth: [{ type: "CU BB 80X10", multiplier: 1 }],
  },
  1600: {
    main: [{ type: "CU BB 60X10", multiplier: 8 }],
    earth: [{ type: "CU BB 60X10", multiplier: 1 }],
  },
  1250: {
    main: [{ type: "CU BB 50X10", multiplier: 8 }],
    earth: [{ type: "CU BB 40X10", multiplier: 1 }],
  },
  1000: {
    main: [{ type: "CU BB 60X10", multiplier: 4 }],
    earth: [{ type: "CU BB 30X10", multiplier: 1 }],
  },
  800: {
    main: [{ type: "CU BB 50X10", multiplier: 4 }],
    earth: [{ type: "CU BB 30X10", multiplier: 1 }],
  },
  630: {
    main: [{ type: "CU BB 40X10", multiplier: 4 }],
    earth: [{ type: "CU BB 25X8", multiplier: 1 }],
  },
  500: {
    main: [{ type: "CU BB 40X10", multiplier: 4 }],
    earth: [{ type: "CU BB 25X8", multiplier: 1 }],
  },
  400: {
    main: [{ type: "CU BB 30X10", multiplier: 4 }],
    earth: [{ type: "CU BB 25X8", multiplier: 1 }],
  },
  300: {
    main: [{ type: "CU BB 25X8", multiplier: 4 }],
    earth: [{ type: "CU BB 20X5", multiplier: 1 }],
  },
  250: {
    main: [{ type: "CU BB 25X8", multiplier: 4 }],
    earth: [{ type: "CU BB 20X5", multiplier: 1 }],
  },
  200: {
    main: [{ type: "CU BB 25X8", multiplier: 4 }],
    earth: [{ type: "CU BB 20X5", multiplier: 1 }],
  },
  160: {
    main: [{ type: "CU BB 15X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  125: {
    main: [{ type: "CU BB 15X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  100: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  80: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  63: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  40: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  32: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  25: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  16: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  10: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
  101: {
    main: [{ type: "CU BB 10X5", multiplier: 4 }],
    earth: [{ type: "CU BB 10X5", multiplier: 1 }],
  },
};

// Form key lists (used by validation; the engine reads the keys directly).
export const ACB_INCOMER_SIZES = [4000, 3200, 2500, 2000, 1600, 1250, 1000];
export const MCCB_INCOMER_SIZES = [3200, 2500, 2000, 1600, 1250, 1000];
export const BUS_ACB_SIZES = [4000, 3200, 2500, 2000, 1600, 1250, 1000];
export const BUS_MCCB_SIZES = [3200, 2500, 2000, 1600, 1250, 1000];
export const OUT_ACB_SIZES = [3200, 2500, 2000, 1600, 1250, 1000, 800, 630];
export const OUT_MCCB_SIZES = [
  3200, 2500, 2000, 1600, 1250, 1000, 800, 630, 500, 400, 300, 250,
  200, 160, 125, 100, 80, 63, 40, 32, 25, 16, 10,
];
export const OTHER_COMPONENT_KEYS = [
  "earthFault", "uvr", "shuntTrip", "motor", "ach", "closingCoil",
  "castleSafety", "castleKey", "castleStand", "electIntlk", "rotaryHandle",
];

export const ACB_TYPES = ["drawout", "fixed"];
export const ACB_SCC = ["65kA", "50kA", "40kA"];
export const ACB_POLES = ["three", "four"];
export const MCCB_SCC = ["65kA", "50kA", "35kA", "25kA", "16kA"];
export const MCCB_POLES = ["3P", "4P"];
export const DEPTHS = ["800", "1000"];

export const MAX_QTY = 200;

export const DEFAULT_LABOUR: Record<string, number> = {
  labour_acb_4000_3200: 900,
  labour_acb_2500_1600: 750,
  labour_acb_1250_1000: 600,
  labour_mccb_3200: 650,
  labour_mccb_2500_1600: 600,
  labour_mccb_1250_800: 500,
  labour_mccb_630_300: 250,
  labour_mccb_300_sp100: 75,
};
export const DEFAULT_COPPER = 47;
export const DEFAULT_OVERHEAD = 3;
export const DEFAULT_PROFIT = 20;
