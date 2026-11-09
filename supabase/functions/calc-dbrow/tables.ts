// Constants ported 1:1 from DBRowModule.tsx.

// Brand columns of the price book (plus the legacy "Y" option from the old UI).
export const BRANDS = [
  "ABB", "MG", "GE", "CUTLERH", "SEIMENS", "LG", "L&T", "DSMITH", "NEW", "M.BSHI", "Z", "Y",
] as const; // "Y" is kept from the old UI; the price book has no "Y" column, so a Y quote prices everything at 0.

export const SCC_RATINGS = ["3kA", "6kA", "10kA"] as const;

export const ISO_IDS = [125, 100, 80, 63, 40, 32, 20, 16];
export const ELCB_IDS = [100, 63, 40];
export const MCB_IDS = [10, 50];
export const CON_IDS = [20, 40, 63];

export const ISO_POLES = ["DP", "TP", "4P"];
export const ELCB_POLES = ["2P", "4P"];
export const MCB_POLES = ["SP", "TP"];
export const CON_POLES = ["DP", "TP"]; // 63A contactor is fixed 3P (TP also accepted)

export const ELR_VALUES = ["300MA", "100MA", "30MA"];
export const ELR_30MA_ALLOWED_AMPS = [63, 40]; // UI only offers 30MA for these

// Modules (DIN width) occupied per pole type. Unknown pole => 1.
export const POLE_MODULES: Record<string, number> = {
  SP: 1, DP: 2, "2P": 2, "3P": 3, TP: 3, "4P": 4,
};

export const ROW_SIZES = [16, 24];
export const MAX_ROWS = 6;

export const MAX_QTY_PER_FIELD = 200;
