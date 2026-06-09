// ─── Real file importers ──────────────────────────────────────────────────────
// Turns an actual DXF drawing or CSV schedule into the { layers, bars } shape the
// app renders. No simulation — these read the bytes the user supplies.
//
//  • .dxf  → parsed with dxf-parser. Real layer table is read, and every TEXT /
//            MTEXT entity carrying an "@BBS …" tag becomes a bar (see GUIDE.md).
//  • .csv  → parsed with papaparse. Column headers are matched case-insensitively.
//  • .dwg  → proprietary binary; cannot be read in-browser. We throw a clear
//            message telling the user to convert it to DXF first.

import DxfParser from "dxf-parser";
import Papa from "papaparse";
import {
  Bar,
  Dims,
  ImportResult,
  Layer,
  calcCut,
  layerType,
  totalWeight,
  unitWeight,
} from "./bbs";

type RawBar = Omit<Bar, "id" | "cutLen" | "selected">;

const num = (v: unknown, fallback = 0): number => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

// Attach ids + cut lengths, and make sure every layer referenced by a bar exists
// in the layer list (so the sidebar can always toggle it).
function finalize(layers: Layer[], rawBars: RawBar[]): ImportResult {
  const known = new Set(layers.map((l) => l.name));
  for (const b of rawBars) {
    if (b.layer && !known.has(b.layer)) {
      layers.push({ name: b.layer, color: (layers.length % 8) + 1, type: layerType(b.layer) });
      known.add(b.layer);
    }
  }
  const bars: Bar[] = rawBars.map((b, i) => ({
    ...b,
    id: i + 1,
    cutLen: calcCut(b.shapeCode, b.dims, b.dia),
    selected: true,
  }));
  return { layers, bars };
}

// ─── DXF ───────────────────────────────────────────────────────────────────────
// A bar is described by a single TEXT/MTEXT entity whose content starts with
// "@BBS" followed by "key=value;" pairs, e.g.:
//
//   @BBS mark=B1; member=Beam B101; section=Ground Floor; shape=11; dia=16;
//        A=4200; B=350; C=0; D=0; n=3; each=2; rem=Top hook bars
//
// The entity's CAD layer becomes the bar's layer (so colours/grouping are real).
function parseTag(text: string, layer: string): RawBar | null {
  const t = (text || "").trim();
  if (!/^@BBS\b/i.test(t)) return null;

  const kv: Record<string, string> = {};
  t.replace(/^@BBS/i, "")
    .split(";")
    .forEach((pair) => {
      const eq = pair.indexOf("=");
      if (eq > -1) kv[pair.slice(0, eq).trim().toLowerCase()] = pair.slice(eq + 1).trim();
    });

  if (!kv.mark) return null;
  const dims: Dims = { A: num(kv.a), B: num(kv.b), C: num(kv.c), D: num(kv.d) };
  return {
    mark: kv.mark,
    member: kv.member || "",
    layer: layer || kv.layer || "UNASSIGNED",
    section: kv.section || "Unassigned",
    shapeCode: kv.shape || "00",
    dia: num(kv.dia),
    noOfMembers: num(kv.n, 1),
    noOfBarsEach: num(kv.each, 1),
    dims,
    remarks: kv.rem || "",
  };
}

export function parseDxf(text: string): ImportResult {
  const parser = new DxfParser();
  const dxf: any = parser.parseSync(text);

  // Real layer table from the drawing.
  const table = dxf?.tables?.layer?.layers ?? {};
  const layers: Layer[] = Object.values<any>(table).map((l, i) => ({
    name: l.name,
    color: typeof l.colorIndex === "number" && l.colorIndex > 0 ? l.colorIndex : (i % 8) + 1,
    type: layerType(l.name),
  }));

  // Real entities → bars (only the @BBS-tagged ones).
  const entities: any[] = dxf?.entities ?? [];
  const rawBars: RawBar[] = [];
  for (const e of entities) {
    if ((e.type === "TEXT" || e.type === "MTEXT") && typeof e.text === "string") {
      const bar = parseTag(e.text, e.layer);
      if (bar) rawBars.push(bar);
    }
  }
  return finalize(layers, rawBars);
}

// ─── CSV ─────────────────────────────────────────────────────────────────────
// Headers are matched case-insensitively and punctuation is ignored, so
// "Bar Mark", "bar_mark" and "MARK" all map to the same field.
function mapRow(row: Record<string, string>): RawBar | null {
  const r: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    r[k.trim().toLowerCase().replace(/[^a-z0-9]/g, "")] = String(row[k] ?? "").trim();
  }
  const mark = r.mark || r.barmark;
  if (!mark) return null;

  return {
    mark,
    member: r.member || r.element || "",
    layer: r.layer || "UNASSIGNED",
    section: r.section || r.floor || "Unassigned",
    shapeCode: r.shapecode || r.shape || "00",
    dia: num(r.dia || r.diameter),
    noOfMembers: num(r.noofmembers || r.members || r.nmembers || r.n, 1),
    noOfBarsEach: num(r.noofbarseach || r.barseach || r.each, 1),
    dims: { A: num(r.a), B: num(r.b), C: num(r.c), D: num(r.d) },
    remarks: r.remarks || r.remark || "",
  };
}

export function parseCsv(text: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const rawBars = (parsed.data || []).map(mapRow).filter((b): b is RawBar => b !== null);

  const layerMap = new Map<string, Layer>();
  for (const b of rawBars) {
    if (!layerMap.has(b.layer)) {
      layerMap.set(b.layer, { name: b.layer, color: (layerMap.size % 8) + 1, type: layerType(b.layer) });
    }
  }
  return finalize([...layerMap.values()], rawBars);
}

// ─── Dispatch by file extension ────────────────────────────────────────────────
export async function importFile(file: File): Promise<{ data: ImportResult; kind: string }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".dwg")) {
    throw new Error(
      "DWG is a proprietary binary format and cannot be read directly in the browser. " +
        'Convert it to DXF first (in AutoCAD: "Save As → AutoCAD DXF", or use the free ODA File Converter), then import the .dxf.'
    );
  }
  const text = await file.text();
  if (name.endsWith(".dxf")) return { data: parseDxf(text), kind: "DXF" };
  if (name.endsWith(".csv")) return { data: parseCsv(text), kind: "CSV" };
  throw new Error("Unsupported file type. Please import a .dxf or .csv file.");
}

// ─── CSV export ────────────────────────────────────────────────────────────────
export function exportBarsToCsv(bars: Bar[], projectName: string): void {
  const headers = [
    "Bar Mark", "Member", "Section", "Layer", "Shape Code", "Dia (mm)",
    "A", "B", "C", "D", "No. Members", "Bars Each", "Total No.",
    "Cut Length (mm)", "Total Length (m)", "Unit Wt (kg/m)", "Total Wt (kg)", "Remarks",
  ];
  const rows = bars.map((b) => {
    const total = b.noOfMembers * b.noOfBarsEach;
    return [
      b.mark, b.member, b.section, b.layer, b.shapeCode, b.dia,
      b.dims.A, b.dims.B, b.dims.C, b.dims.D, b.noOfMembers, b.noOfBarsEach, total,
      b.cutLen, (total * b.cutLen / 1000).toFixed(2),
      unitWeight(b.dia).toFixed(3), totalWeight(b.dia, total * b.cutLen).toFixed(2), b.remarks,
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BBS_${(projectName || "schedule").replace(/[^a-z0-9_-]+/gi, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
