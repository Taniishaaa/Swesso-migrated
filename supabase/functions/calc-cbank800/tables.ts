// Lookup tables ported 1:1 from CBank800Module.tsx.

export const BRANDS = [
  "ABB", "MG", "GE", "CUTLERH", "SEIMENS", "LG", "L&T", "DSMITH", "NEW", "M.BSHI", "Z", "Y",
] as const; // "Y" is kept from the old UI; the price book has no "Y" column, so a Y quote prices everything at 0.

// Ordered high -> low. Order matters for pickEnclosure().
export const ENCLOSURES = [
  { kvar: 1600, size: "ENCL 2X2000X1000X800" },
  { kvar: 1200, size: "ENCL 2X2000X1000X600" },
  { kvar: 1000, size: "ENCL 2X2000X800X600" },
  { kvar: 800, size: "ENCL 2000X1200X800" },
  { kvar: 600, size: "ENCL 2000X1200X600" },
  { kvar: 440, size: "ENCL 2000X1000X600" },
  { kvar: 290, size: "ENCL 2000X800X600" },
  { kvar: 210, size: "ENCL 2000X600X600" },
  { kvar: 119, size: "ENCL 1800X800X400" },
  { kvar: 90, size: "ENCL 1400X800X400" },
  { kvar: 70, size: "ENCL 1200X800X300" },
  { kvar: 60, size: "ENCL 1000X800X300" },
];

export const CU_BB: { rating: number; mainBB: string; earthB: string }[] = [
  { rating: 1600, mainBB: "CU BB 2X50X10", earthB: "CU BB 50X10" },
  { rating: 1250, mainBB: "CU BB 2X40X10", earthB: "CU BB 40X10" },
  { rating: 1000, mainBB: "CU BB 60X10", earthB: "CU BB 30X10" },
  { rating: 800, mainBB: "CU BB 50X10", earthB: "CU BB 30X10" },
  { rating: 600, mainBB: "CU BB 40X10", earthB: "CU BB 25X8" },
  { rating: 400, mainBB: "CU BB 30X10", earthB: "CU BB 25X8" },
  { rating: 300, mainBB: "CU BB 25X8", earthB: "CU BB 20X5" },
  { rating: 200, mainBB: "CU BB 25X8", earthB: "CU BB 20X5" },
  { rating: 160, mainBB: "CU BB 15X5", earthB: "CU BB 10X5" },
  { rating: 125, mainBB: "CU BB 15X5", earthB: "CU BB 10X5" },
  { rating: 100, mainBB: "CU BB 10X5", earthB: "CU BB 10X5" },
];

export const ISOLATOR_MAP: Record<number, string> = {
  100: "ISOLATOR TP 100A", 125: "ISOLATOR TP 125A", 160: "ISOLATOR TP 160A",
  200: "ISOLATOR TP 200A", 300: "ISOLATOR TP 300A", 400: "ISOLATOR TP 400A",
  600: "ISOLATOR TP 600A", 800: "ISOLATOR TP 800A", 1000: "ISOLATOR TP 1000A",
  1250: "ISOLATOR TP 1250A", 1600: "ISOLATOR TP 1600A",
};

export const MCCB_MAP: Record<number, string> = {
  100: "MCCB 35KA TP 100A", 125: "MCCB 35KA TP 125A", 160: "MCCB 35KA TP 160A",
  200: "MCCB 35KA TP 200A", 300: "MCCB 35KA TP 300A", 400: "MCCB 35KA TP 400A",
  600: "MCCB 35KA TP 600A", 800: "MCCB 35KA TP 800A", 1000: "MCCB 50KA TP 1000A",
  1250: "MCCB 50KA TP 1250A", 1600: "MCCB 50KA TP 1600A",
};

export const EARTH_BB_LENGTH: Record<string, number> = {
  "ENCL 2X2000X1000X800": 1, "ENCL 2X2000X1000X600": 1, "ENCL 2X2000X800X600": 1,
  "ENCL 2000X1200X800": 0.75, "ENCL 2000X1200X600": 0.75,
  "ENCL 2000X1000X600": 0.5, "ENCL 2000X800X600": 0.5, "ENCL 2000X600X600": 0.5,
  "ENCL 1800X800X400": 0.5, "ENCL 1400X800X400": 0.5,
  "ENCL 1200X800X300": 0.3, "ENCL 1000X800X300": 0.3,
};

export const BAKELITE_QTY: Record<string, number> = {
  "ENCL 2X2000X1000X800": 1.5, "ENCL 2X2000X1000X600": 1.5, "ENCL 2X2000X800X600": 1.5,
  "ENCL 2000X1200X800": 1.25, "ENCL 2000X1200X600": 1.25,
  "ENCL 2000X1000X600": 1, "ENCL 2000X800X600": 1, "ENCL 2000X600X600": 0.75,
  "ENCL 1800X800X400": 0.5, "ENCL 1400X800X400": 0.5, "ENCL 1200X800X300": 0.5,
  "ENCL 1000X800X300": 0.25,
};

export const DEFAULT_COMPONENTS = [
  { item: "FAN+LOUVER", quantity: 1 },
  { item: "THERMOSTAT", quantity: 1 },
  { item: "DIN RAIL", quantity: 1 },
  { item: "TRUNKING 75", quantity: 3 },
  { item: "TRUNKING 45", quantity: 1 },
  { item: "FUSES", quantity: 8 },
  { item: "PF REGULATOR 12STEP", quantity: 1 },
];

// Ascending, amps.
export const FUSE_SET_RATINGS = [5, 10, 25, 32, 50, 100];

export const COPPER_PRICE = 47; // was hardcoded in the client
export const SYSTEM_VOLTAGE = 415;
