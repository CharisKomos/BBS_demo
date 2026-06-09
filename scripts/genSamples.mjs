// Generates the bundled, *real* sample files that the app imports:
//   public/sample.dxf  — an ASCII DXF with a real LAYER table and one @BBS-tagged
//                         TEXT entity per bar.
//   public/sample.csv  — the same schedule as a CSV.
// Run with:  node scripts/genSamples.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = resolve(root, "public");
mkdirSync(pub, { recursive: true });

const layers = [
  { name: "BEAMS-MAIN-BARS",   color: 1 },
  { name: "BEAMS-LINKS",       color: 3 },
  { name: "COLUMNS-MAIN-BARS", color: 2 },
  { name: "COLUMNS-TIES",      color: 5 },
  { name: "SLAB-BOT-BARS",     color: 4 },
  { name: "SLAB-TOP-BARS",     color: 6 },
  { name: "FOUNDATIONS",       color: 7 },
  { name: "ANNOTATIONS",       color: 8 },
];

const bars = [
  { mark: "B1", member: "Beam B101", layer: "BEAMS-MAIN-BARS",   section: "Ground Floor", shape: "00", dia: 16, n: 3, each: 4,  A: 5800, B: 0,    C: 0,    D: 0, rem: "Bottom main bars" },
  { mark: "B2", member: "Beam B101", layer: "BEAMS-MAIN-BARS",   section: "Ground Floor", shape: "11", dia: 16, n: 3, each: 2,  A: 4200, B: 350,  C: 0,    D: 0, rem: "Top hook bars" },
  { mark: "B3", member: "Beam B102", layer: "BEAMS-MAIN-BARS",   section: "Ground Floor", shape: "33", dia: 20, n: 2, each: 3,  A: 3200, B: 200,  C: 1800, D: 0, rem: "Cranked bottom bar" },
  { mark: "L1", member: "Beam B101", layer: "BEAMS-LINKS",       section: "Ground Floor", shape: "25", dia: 8,  n: 3, each: 28, A: 250,  B: 500,  C: 0,    D: 0, rem: "Links @200" },
  { mark: "L2", member: "Beam B102", layer: "BEAMS-LINKS",       section: "Ground Floor", shape: "25", dia: 8,  n: 2, each: 22, A: 250,  B: 500,  C: 0,    D: 0, rem: "Links @200" },
  { mark: "C1", member: "Col C1",    layer: "COLUMNS-MAIN-BARS", section: "Ground Floor", shape: "00", dia: 20, n: 8, each: 8,  A: 3450, B: 0,    C: 0,    D: 0, rem: "Main vertical bars" },
  { mark: "C2", member: "Col C2",    layer: "COLUMNS-MAIN-BARS", section: "First Floor",  shape: "00", dia: 20, n: 6, each: 8,  A: 3450, B: 0,    C: 0,    D: 0, rem: "Main vertical bars" },
  { mark: "T1", member: "Col C1",    layer: "COLUMNS-TIES",      section: "Ground Floor", shape: "25", dia: 8,  n: 8, each: 20, A: 300,  B: 300,  C: 0,    D: 0, rem: "Column ties @200" },
  { mark: "T2", member: "Col C2",    layer: "COLUMNS-TIES",      section: "First Floor",  shape: "25", dia: 8,  n: 6, each: 20, A: 300,  B: 300,  C: 0,    D: 0, rem: "Column ties @200" },
  { mark: "S1", member: "Slab S01",  layer: "SLAB-BOT-BARS",     section: "Ground Floor", shape: "00", dia: 12, n: 1, each: 42, A: 6200, B: 0,    C: 0,    D: 0, rem: "Bot bars x-dir" },
  { mark: "S2", member: "Slab S01",  layer: "SLAB-BOT-BARS",     section: "Ground Floor", shape: "00", dia: 12, n: 1, each: 38, A: 5800, B: 0,    C: 0,    D: 0, rem: "Bot bars y-dir" },
  { mark: "S3", member: "Slab S01",  layer: "SLAB-TOP-BARS",     section: "Ground Floor", shape: "11", dia: 10, n: 1, each: 24, A: 1200, B: 150,  C: 0,    D: 0, rem: "Top L-bars edge" },
  { mark: "S4", member: "Slab S02",  layer: "SLAB-TOP-BARS",     section: "First Floor",  shape: "00", dia: 12, n: 1, each: 40, A: 6200, B: 0,    C: 0,    D: 0, rem: "Top bars x-dir" },
  { mark: "F1", member: "Pad FND1",  layer: "FOUNDATIONS",       section: "Foundation",   shape: "00", dia: 16, n: 4, each: 10, A: 2800, B: 0,    C: 0,    D: 0, rem: "Pad base bars" },
  { mark: "F2", member: "Pad FND1",  layer: "FOUNDATIONS",       section: "Foundation",   shape: "32", dia: 16, n: 4, each: 5,  A: 400,  B: 2800, C: 0,    D: 0, rem: "U-bars perimeter" },
];

// ── DXF ──────────────────────────────────────────────────────────────────────
const out = [];
const p = (code, val) => { out.push(String(code)); out.push(String(val)); };

p(0, "SECTION"); p(2, "HEADER"); p(0, "ENDSEC");

p(0, "SECTION"); p(2, "TABLES");
p(0, "TABLE"); p(2, "LAYER"); p(70, layers.length);
for (const l of layers) { p(0, "LAYER"); p(2, l.name); p(70, 0); p(62, l.color); p(6, "CONTINUOUS"); }
p(0, "ENDTAB"); p(0, "ENDSEC");

p(0, "SECTION"); p(2, "ENTITIES");
let y = 0;
for (const b of bars) {
  const tag = `@BBS mark=${b.mark}; member=${b.member}; section=${b.section}; shape=${b.shape}; dia=${b.dia}; A=${b.A}; B=${b.B}; C=${b.C}; D=${b.D}; n=${b.n}; each=${b.each}; rem=${b.rem}`;
  p(0, "TEXT"); p(8, b.layer); p(10, 0); p(20, y); p(30, 0); p(40, 2.5); p(1, tag);
  y += 5;
}
p(0, "ENDSEC"); p(0, "EOF");

writeFileSync(resolve(pub, "sample.dxf"), out.join("\n") + "\n", "utf8");

// ── CSV ──────────────────────────────────────────────────────────────────────
const headers = ["mark", "member", "section", "layer", "shapeCode", "dia", "A", "B", "C", "D", "noOfMembers", "noOfBarsEach", "remarks"];
const csvRows = bars.map((b) =>
  [b.mark, b.member, b.section, b.layer, b.shape, b.dia, b.A, b.B, b.C, b.D, b.n, b.each, b.rem]
    .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
);
writeFileSync(resolve(pub, "sample.csv"), [headers.join(","), ...csvRows].join("\n") + "\n", "utf8");

console.log(`Wrote public/sample.dxf and public/sample.csv (${bars.length} bars, ${layers.length} layers).`);
