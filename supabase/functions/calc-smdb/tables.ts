// Constants ported 1:1 from SMDBModule.tsx.

export const BRANDS = [
  "ABB", "MG", "GE", "CUTLERH", "SEIMENS", "LG", "L&T", "DSMITH", "NEW", "M.BSHI", "Z", "Y",
] as const; // "Y" is kept from the old UI; the price book has no "Y" column, so a Y quote prices everything at 0.

export const ISOLATOR_SIZES = ["800", "630", "400", "300", "250", "200", "160", "125", "100", "80"];
export const MCCB_SIZES = ["800", "630", "400", "300", "250", "200", "160", "125", "100", "80"];
export const OUTGOING_SIZES = [
  "630", "400", "300", "250", "200", "160", "125", "100", "80",
  "63", "50", "40", "32", "25", "16", "10", "sp100",
];

export const INCOMER_IDS = [
  ...ISOLATOR_SIZES.map((s) => `iso${s}`),
  ...MCCB_SIZES.map((s) => `mccb${s}`),
];
export const OUTGOING_IDS = OUTGOING_SIZES.map((s) => `out_mccb${s}`);

export const SCC_RATINGS = ["25kA", "35kA", "50kA"];

// QUIRK: keyed by rating label; there is NO "630A" entry (only "600A"), and no "80A".
// So a 630A or 80A incomer gets TMN = HEIGHT = 0 (smaller enclosure than intended).
export const INCOMER_DATA: Record<string, { TMN: number; HEIGHT: number }> = {
  "800A": { TMN: 50, HEIGHT: 35 },
  "600A": { TMN: 50, HEIGHT: 30 },
  "400A": { TMN: 50, HEIGHT: 30 },
  "300A": { TMN: 50, HEIGHT: 30 },
  "250A": { TMN: 35, HEIGHT: 20 },
  "200A": { TMN: 30, HEIGHT: 20 },
  "160A": { TMN: 30, HEIGHT: 17 },
  "125A": { TMN: 20, HEIGHT: 17 },
  "100A": { TMN: 20, HEIGHT: 12 },
};

export const OUTGOING_BREAKER_LENGTH: Record<string, number> = {
  "630A": 21, "400A": 14, "300A": 14, "250A": 11, "200A": 11, "160A": 11, "125A": 11,
  "100A": 11, "80A": 11, "63A": 11, "50A": 11, "40A": 11, "32A": 11, "25A": 11,
  "16A": 11, "10A": 11, "101A": 4, // "101A" = SP 100A
};

// Descending by rating; first row with rating <= breaker rating wins.
export const BB_SELECTION = [
  { rating: 800, main: "CU BB 50X10", earth: "CU BB 30X10" },
  { rating: 630, main: "CU BB 40X10", earth: "CU BB 25X8" },
  { rating: 400, main: "CU BB 30X10", earth: "CU BB 25X8" },
  { rating: 300, main: "CU BB 25X8", earth: "CU BB 20X5" },
  { rating: 250, main: "CU BB 25X8", earth: "CU BB 20X5" },
  { rating: 200, main: "CU BB 25X8", earth: "CU BB 20X5" },
  { rating: 160, main: "CU BB 15X5", earth: "CU BB 10X5" },
  { rating: 125, main: "CU BB 15X5", earth: "CU BB 10X5" },
  { rating: 100, main: "CU BB 10X5", earth: "CU BB 10X5" },
  { rating: 0, main: "CU BB 10X5", earth: "CU BB 10X5" },
];

export const ENCLOSURE_BAKELITE: Record<string, number> = {
  "ENCL 700X500X250": 0.15, "ENCL 800X600X250": 0.15, "ENCL 800X800X250": 0.2,
  "ENCL 1000X800X250": 0.3, "ENCL 1200X800X300": 0.4, "ENCL 1400X800X300": 0.6,
  "ENCL 1600X800X300": 0.8, "ENCL 1800X1000X400": 0.9, "ENCL 2000X1000X400": 1.2,
};

// [upper bound of (TMN+HEIGHT+CT+INSULATORS+H_L), enclosure]
export const ENCLOSURE_STEPS: [number, string][] = [
  [60, "ENCL 700X500X250"], [72, "ENCL 800X600X250"], [82, "ENCL 800X800X250"],
  [102, "ENCL 1000X800X250"], [122, "ENCL 1200X800X300"], [142, "ENCL 1400X800X300"],
  [162, "ENCL 1600X800X300"], [182, "ENCL 1800X1000X400"], [202, "ENCL 2000X1000X400"],
];

// Defaults for the cost-modal fields. QUIRK: 0 / blank / invalid all fall back to these.
export const DEFAULTS = {
  copper: 47,
  labour_800: 250, labour_630: 200, labour_400: 175, labour_300: 150, labour_250: 100,
  labour_160: 90, labour_125: 70, labour_pf: 50, labour_handle: 25,
  overheadExpenses: 3, profitPercentage: 20,
};

export const MAX_QTY = 200;
