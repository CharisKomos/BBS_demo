// ─── Rebar engineering core ───────────────────────────────────────────────────
// Shape codes, cut-length formulas and steel weights per EN 1992-1-1 / EN ISO 3766.
// Shared by the UI (App.tsx) and the file importers (importParsers.ts) so there is
// a single source of truth for every calculation.

export const STEEL_DENSITY = 7850; // kg/m³
export const DIAMETERS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];

// AutoCAD Color Index (ACI) → swatch, used for the little coloured layer dots.
export const ACAD_COLORS = [
  "#e5e5e5", "#ff0000", "#ffff00", "#00ff00",
  "#00ffff", "#0000ff", "#ff00ff", "#ffffff", "#808080",
];

export type Dims = { A: number; B: number; C: number; D: number };

export interface Bar {
  id: number;
  mark: string;
  member: string;
  layer: string;
  section: string;
  shapeCode: string;
  dia: number;
  noOfMembers: number;
  noOfBarsEach: number;
  dims: Dims;
  remarks: string;
  cutLen: number;
  selected: boolean;
}

export interface Layer {
  name: string;
  color: number; // ACI index into ACAD_COLORS
  type: "MAIN" | "LINK" | "ANNOT";
}

export interface ImportResult {
  layers: Layer[];
  bars: Bar[];
}

export const SHAPE_CODES: Record<
  string,
  { desc: string; dims: string[]; svg: (s?: number) => string }
> = {
  "00": { desc: "Straight",            dims: ["A"],               svg: (s = 1) => `<line x1="4" y1="18" x2="${4 + 52 * s}" y2="18" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>` },
  "11": { desc: "L-Bar (1 bend)",      dims: ["A", "B"],          svg: () => `<polyline points="4,32 4,4 44,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "21": { desc: "Z-Bar (2 bends)",     dims: ["A", "B", "C"],     svg: () => `<polyline points="4,32 4,16 28,16 28,4 52,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "25": { desc: "Closed Stirrup",      dims: ["A", "B"],          svg: () => `<rect x="6" y="4" width="48" height="28" rx="2" fill="none" stroke="#2563eb" stroke-width="3"/>` },
  "26": { desc: "Open Stirrup (U-top)",dims: ["A", "B", "C"],     svg: () => `<polyline points="4,4 4,32 56,32 56,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "32": { desc: "U-Bar",               dims: ["A", "B"],          svg: () => `<polyline points="4,4 4,32 56,32 56,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "33": { desc: "Cranked Bar",         dims: ["A", "B", "C"],     svg: () => `<polyline points="4,32 20,32 36,4 52,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "37": { desc: "S-Bar (2 cranks)",    dims: ["A", "B", "C", "D"],svg: () => `<polyline points="4,32 16,32 24,4 36,4 44,32 56,32" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "51": { desc: "Hook both ends",      dims: ["A"],               svg: () => `<polyline points="4,18 56,18 56,8" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/><polyline points="4,18 4,8" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>` },
  "99": { desc: "Non-standard",        dims: ["A"],               svg: () => `<text x="6" y="22" font-size="11" fill="#2563eb" font-family="sans-serif">Custom</text>` },
};

// Bending deduction per EN 1992-1-1 (mm per bend).
export const bendDeduction = (dia: number) => Math.max(4 * dia, 20);

export const cutLengthCalc: Record<string, (d: Dims, dia: number) => number> = {
  "00": (d) => d.A,
  "11": (d, dia) => d.A + d.B - bendDeduction(dia),
  "21": (d, dia) => d.A + d.B + d.C - 2 * bendDeduction(dia),
  "25": (d, dia) => 2 * (d.A + d.B) + 24 * dia, // stirrup with hooks
  "26": (d, dia) => d.A + 2 * d.B + d.C - 2 * bendDeduction(dia),
  "32": (d, dia) => 2 * d.A + d.B - 2 * bendDeduction(dia),
  "33": (d, dia) => d.A + d.B + d.C - 2 * bendDeduction(dia),
  "37": (d, dia) => d.A + d.B + d.C + d.D - 3 * bendDeduction(dia),
  "51": (d, dia) => d.A + 2 * (4 * dia),
  "99": (d) => d.A,
};

export function calcCut(shapeCode: string, dims: Dims, dia: number): number {
  const fn = cutLengthCalc[shapeCode];
  return fn ? Math.round(fn(dims, Number(dia))) : 0;
}

// Unit weight (kg/m) from bar diameter (mm): ρ · π · (d/2)².
export function unitWeight(dia: number): number {
  return STEEL_DENSITY * Math.PI * Math.pow(dia / 2000, 2);
}

export function totalWeight(dia: number, totalLenMm: number): number {
  return (unitWeight(dia) * totalLenMm) / 1000;
}

// Classify a layer by its name so the UI can group main bars vs links/stirrups.
export function layerType(name: string): Layer["type"] {
  const n = (name || "").toUpperCase();
  if (/LINK|TIE|STIRRUP/.test(n)) return "LINK";
  if (/ANNOT|TEXT|DIM|LABEL/.test(n)) return "ANNOT";
  return "MAIN";
}
