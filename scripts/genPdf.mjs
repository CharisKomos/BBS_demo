// Generates BBS-Import-Guide.pdf in the repo root.
// Run with:  node scripts/genPdf.mjs   (requires pdfkit: npm i pdfkit --no-save)
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = resolve(root, "BBS-Import-Guide.pdf");

const NAVY = "#0f2d5a";
const BLUE = "#1d4ed8";
const TEAL = "#0f766e";
const GREY = "#64748b";
const LIGHT = "#f1f5f9";
const RULE = "#cbd5e1";

const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 56, right: 56 } });
doc.pipe(createWriteStream(outPath));

const M = doc.page.margins;
const CW = doc.page.width - M.left - M.right; // content width
const bottom = () => doc.page.height - M.bottom;

function ensure(h) {
  if (doc.y + h > bottom()) doc.addPage();
}
function gap(h = 8) { doc.y += h; }

function h1(text) {
  ensure(40);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(17).text(text, M.left, doc.y);
  doc.moveTo(M.left, doc.y + 2).lineTo(M.left + CW, doc.y + 2).lineWidth(1.5).strokeColor(BLUE).stroke();
  gap(12);
}
function h2(text) {
  ensure(30);
  gap(4);
  doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(12.5).text(text, M.left, doc.y);
  gap(5);
}
function para(text, opts = {}) {
  doc.fillColor(opts.color || "#1e293b").font(opts.font || "Helvetica").fontSize(opts.size || 10.5);
  const h = doc.heightOfString(text, { width: CW, align: opts.align || "left", lineGap: 2 });
  ensure(h);
  doc.text(text, M.left, doc.y, { width: CW, align: opts.align || "left", lineGap: 2 });
  gap(6);
}
function bullets(items) {
  doc.font("Helvetica").fontSize(10.5).fillColor("#1e293b");
  for (const it of items) {
    const h = doc.heightOfString(it, { width: CW - 16, lineGap: 2 });
    ensure(h + 2);
    const y = doc.y;
    doc.circle(M.left + 4, y + 6, 1.6).fill(BLUE);
    doc.fillColor("#1e293b").text(it, M.left + 14, y, { width: CW - 14, lineGap: 2 });
    gap(4);
  }
  gap(2);
}
function codeBlock(lines) {
  const padX = 10, padY = 8, lh = 13;
  doc.font("Courier").fontSize(9);
  // wrap each logical line to width
  const wrapped = [];
  const innerW = CW - padX * 2;
  for (const ln of lines) {
    if (ln === "") { wrapped.push(""); continue; }
    let cur = ln;
    while (doc.widthOfString(cur) > innerW) {
      // break at last space that fits
      let cut = cur.length;
      while (cut > 0 && doc.widthOfString(cur.slice(0, cut)) > innerW) cut--;
      let brk = cur.lastIndexOf(" ", cut);
      if (brk <= 0) brk = cut;
      wrapped.push(cur.slice(0, brk));
      cur = "    " + cur.slice(brk).trimStart();
    }
    wrapped.push(cur);
  }
  const boxH = padY * 2 + wrapped.length * lh;
  ensure(boxH + 6);
  const y0 = doc.y;
  doc.save().roundedRect(M.left, y0, CW, boxH, 4).fill("#0f172a").restore();
  let y = y0 + padY;
  for (const ln of wrapped) {
    doc.fillColor("#93c5fd").font("Courier").fontSize(9).text(ln, M.left + padX, y, { width: innerW, lineBreak: false });
    y += lh;
  }
  doc.y = y0 + boxH;
  gap(8);
}
// Two-column reference table with header. cols = [{label,width,key}], rows = [{...}]
function table(cols, rows) {
  const padX = 6, padY = 5, lh = 12.5;
  const drawHeader = () => {
    const y0 = doc.y;
    doc.save().rect(M.left, y0, CW, 20).fill(NAVY).restore();
    let x = M.left;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("white");
    for (const c of cols) {
      doc.text(c.label, x + padX, y0 + 6, { width: c.width - padX * 2, lineBreak: false });
      x += c.width;
    }
    doc.y = y0 + 20;
  };
  ensure(40);
  drawHeader();
  let alt = false;
  for (const r of rows) {
    // compute row height from tallest cell
    doc.font("Helvetica").fontSize(9.5);
    let rowH = lh;
    for (const c of cols) {
      const txt = String(r[c.key] ?? "");
      const hh = doc.heightOfString(txt, { width: c.width - padX * 2, lineGap: 1 });
      rowH = Math.max(rowH, hh);
    }
    rowH += padY * 2;
    if (doc.y + rowH > bottom()) { doc.addPage(); drawHeader(); alt = false; }
    const y0 = doc.y;
    if (alt) doc.save().rect(M.left, y0, CW, rowH).fill(LIGHT).restore();
    let x = M.left;
    for (const c of cols) {
      const txt = String(r[c.key] ?? "");
      doc.font(c.mono ? "Courier" : "Helvetica").fontSize(9.5).fillColor(c.color || "#1e293b");
      doc.text(txt, x + padX, y0 + padY, { width: c.width - padX * 2, lineGap: 1 });
      x += c.width;
    }
    // row border
    doc.moveTo(M.left, y0 + rowH).lineTo(M.left + CW, y0 + rowH).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y0 + rowH;
    alt = !alt;
  }
  gap(10);
}

// ──────────────────────────────────────────────────────────────────────────────
// COVER / TITLE
// ──────────────────────────────────────────────────────────────────────────────
doc.save().rect(0, 0, doc.page.width, 150).fill(NAVY).restore();
doc.fillColor("white").font("Helvetica-Bold").fontSize(26).text("BBS Pro", M.left, 48);
doc.fillColor("#cbd5e1").font("Helvetica").fontSize(13).text("Importing Real Data into the Bar Bending Schedule", M.left, 84);
doc.fillColor("#93c5fd").font("Helvetica").fontSize(11).text("The @BBS drawing annotation and the CSV file — what they are, why they exist, and how to use them.", M.left, 106, { width: CW });
doc.y = 175;
doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(9.5)
  .text("Eurocode 2 / EN 1992-1-1  ·  EN ISO 3766 shape codes  ·  Generated for BBS Pro", M.left, doc.y);
gap(16);

// ──────────────────────────────────────────────────────────────────────────────
h1("1.  Why this is needed — the problem");
para(
  "A CAD drawing (DXF or DWG) does not actually \"know\" anything about reinforcement. " +
  "Internally it only stores geometry: lines, arcs, circles and pieces of text, each sitting on a named layer. " +
  "When a structural engineer draws rebar, the engineer knows that a particular red polyline means " +
  "\"3 no. 16 mm bottom bars, 5800 mm long, mark B1\" — but the file never records that meaning. " +
  "It only stores a polyline and, perhaps, a text label that a human reads and interprets."
);
para(
  "Because of this, no software can look at arbitrary CAD geometry and reliably work out the bar mark, diameter, " +
  "shape and quantities. Two engineers will draw the same beam in two completely different ways. " +
  "This is exactly why the original demo version of BBS Pro ignored the uploaded file and simply showed fixed, hard-coded data."
);
para(
  "To make the tool work with real data, the bar information has to be written down in a structured form that the " +
  "software can read. There are two honest ways to do that — and that is precisely what the @BBS annotation and the " +
  "CSV file are. Both feed the same calculation engine (cut lengths, bending deductions, weights) and produce the same schedule."
);

h1("2.  The two ways to get real data in");
table(
  [
    { label: "Method", width: CW * 0.22, key: "m", color: NAVY },
    { label: "Best for", width: CW * 0.38, key: "f" },
    { label: "What the user does", width: CW * 0.40, key: "d" },
  ],
  [
    { m: "@BBS in a DXF", f: "Designers working inside AutoCAD who want the schedule data to live with the drawing.", d: "Add one @BBS text label per bar, then save the drawing as DXF." },
    { m: "CSV file", f: "Anyone whose bar data is (or can be) in a spreadsheet — no CAD needed.", d: "Fill in a spreadsheet with one row per bar and save it as CSV." },
  ]
);
para("DWG note: AutoCAD's .dwg is a proprietary binary format that cannot be read in a web browser. Convert it to DXF first — see section 5.", { color: GREY, size: 9.5, font: "Helvetica-Oblique" });

// ──────────────────────────────────────────────────────────────────────────────
h1("3.  The @BBS annotation convention (DXF)");
para(
  "The @BBS convention is a small, fixed agreement on how to label bars inside the drawing so the software can read them. " +
  "The app already reads the drawing's real layers automatically; the @BBS labels add the bar data on top of that."
);
h2("What the designer does, step by step (in AutoCAD)");
bullets([
  "1.  Use the TEXT or MTEXT command to place a text label.",
  "2.  Make sure that label is on the correct layer (for example BEAMS-MAIN-BARS). The layer is read automatically and is used for grouping and colour.",
  "3.  Type the bar's data into the label using the @BBS format shown below.",
  "4.  Repeat for each bar type, then save the drawing as DXF (Save As -> AutoCAD DXF).",
]);
para(
  "The position of the label on the sheet does not matter — the app only reads the label's text, not where it sits. " +
  "Keep one @BBS label per bar type.",
  { color: GREY, size: 9.5, font: "Helvetica-Oblique" }
);
h2("The format");
codeBlock([
  "@BBS mark=B1; member=Beam B101; section=Ground Floor; shape=11;",
  "     dia=16; A=4200; B=350; C=0; D=0; n=3; each=2; rem=Top hook bars",
]);
para("The label must begin with @BBS, followed by key=value pairs separated by semicolons. Keys:");
table(
  [
    { label: "Key", width: CW * 0.16, key: "k", mono: true, color: BLUE },
    { label: "Meaning", width: CW * 0.84, key: "v" },
  ],
  [
    { k: "mark", v: "Bar mark  (required — a label with no mark is ignored)" },
    { k: "member", v: "Member or element the bar belongs to, e.g. Beam B101" },
    { k: "section", v: "Section or floor, used for grouping, e.g. Ground Floor" },
    { k: "shape", v: "Shape code (see section 6)" },
    { k: "dia", v: "Bar diameter in millimetres" },
    { k: "A  B  C  D", v: "Shape dimensions in millimetres (use only those the shape needs)" },
    { k: "n", v: "Number of identical members" },
    { k: "each", v: "Number of bars in each member" },
    { k: "rem", v: "Remarks (free text)" },
  ]
);
para(
  "A ready-made example drawing is bundled with the app at public/sample.dxf — open it in a text editor to see the exact structure. " +
  "Total bars = n x each; the app then computes cut length, unit weight and total weight for you."
);

// ──────────────────────────────────────────────────────────────────────────────
h1("4.  The CSV file");
para(
  "The CSV is the alternative input for people who do not want to touch the CAD drawing at all, or whose bar data already " +
  "lives in a spreadsheet. A bar bending schedule is, at heart, just a table: one row per bar type. Many engineers and steel " +
  "fixers already keep exactly that in Excel."
);
h2("What the user does");
bullets([
  "Open Excel (or export from estimating / scheduling software).",
  "Create one row per bar type, with the column headers listed below in the first row.",
  "Save As -> CSV (Comma delimited).",
  "Import the CSV — the app does all the engineering (cut lengths, deductions, weights, totals).",
]);
h2("Recognised columns");
para("Header names are matched case-insensitively, and spaces or underscores are ignored (so \"Bar Mark\", \"bar_mark\" and \"MARK\" all work).", { size: 9.5, color: GREY, font: "Helvetica-Oblique" });
table(
  [
    { label: "Column", width: CW * 0.22, key: "c", mono: true, color: BLUE },
    { label: "Req.", width: CW * 0.12, key: "r", color: TEAL },
    { label: "Meaning", width: CW * 0.66, key: "m" },
  ],
  [
    { c: "mark", r: "Yes", m: "Bar mark" },
    { c: "member", r: "-", m: "Member / element" },
    { c: "section", r: "-", m: "Section or floor (used for grouping)" },
    { c: "layer", r: "-", m: "Layer name (used for grouping and colour)" },
    { c: "shapeCode", r: "-", m: "Shape code (see section 6)" },
    { c: "dia", r: "-", m: "Bar diameter in mm" },
    { c: "A B C D", r: "-", m: "Shape dimensions in mm" },
    { c: "noOfMembers", r: "-", m: "Number of identical members" },
    { c: "noOfBarsEach", r: "-", m: "Bars per member" },
    { c: "remarks", r: "-", m: "Free text" },
  ]
);
h2("Minimal example");
codeBlock([
  "mark,member,section,layer,shapeCode,dia,A,B,C,D,noOfMembers,noOfBarsEach,remarks",
  "B1,Beam B101,Ground Floor,BEAMS-MAIN-BARS,00,16,5800,0,0,0,3,4,Bottom main bars",
  "L1,Beam B101,Ground Floor,BEAMS-LINKS,25,8,250,500,0,0,3,28,Links @200",
]);
para("A ready-made example is bundled at public/sample.csv.");

// ──────────────────────────────────────────────────────────────────────────────
h1("5.  Converting a DWG to DXF");
para("A .dwg file cannot be imported directly. Convert it to DXF first — both options are free:");
bullets([
  "In AutoCAD:  File -> Save As -> AutoCAD DXF (*.dxf).",
  "Without AutoCAD: use the free ODA File Converter (Open Design Alliance). Set the input to your DWG folder, output format to DXF, and convert.",
]);
para("Then import the resulting .dxf. Remember it still needs @BBS labels to carry the bar data (section 3).");

h1("6.  Supported shape codes");
table(
  [
    { label: "Code", width: CW * 0.14, key: "c", mono: true, color: BLUE },
    { label: "Shape", width: CW * 0.56, key: "s" },
    { label: "Dimensions", width: CW * 0.30, key: "d" },
  ],
  [
    { c: "00", s: "Straight", d: "A" },
    { c: "11", s: "L-Bar (1 bend)", d: "A, B" },
    { c: "21", s: "Z-Bar (2 bends)", d: "A, B, C" },
    { c: "25", s: "Closed Stirrup", d: "A, B" },
    { c: "26", s: "Open Stirrup (U-top)", d: "A, B, C" },
    { c: "32", s: "U-Bar", d: "A, B" },
    { c: "33", s: "Cranked Bar", d: "A, B, C" },
    { c: "37", s: "S-Bar (2 cranks)", d: "A, B, C, D" },
    { c: "51", s: "Hook both ends", d: "A" },
    { c: "99", s: "Non-standard / custom", d: "A" },
  ]
);
para(
  "Cut lengths are computed per EN 1992-1-1 with a bending deduction of max(4 x dia, 20) mm per bend. " +
  "Unit weights use a steel density of 7850 kg/m3. Shape codes follow EN ISO 3766."
);

// ──────────────────────────────────────────────────────────────────────────────
h1("7.  The honest limitation");
para(
  "Tagging every bar with @BBS, or typing rows into a CSV, is manual work. That is the genuine limit of what is possible " +
  "purely inside a web browser: the data has to come from somewhere structured. If you want the tool to read bars from " +
  "drawings without manual tagging, that is a real feature, but it needs one of the following:"
);
bullets([
  "An agreed drawing standard your firm already follows (for example, bars always on specific layers with callouts in a fixed text format). A parser can then be written for that exact format.",
  "A heavier backend that performs geometric interpretation, or an integration with a CAD / Revit API where rebar objects already carry their properties as real data.",
]);
para(
  "Until then, @BBS and CSV are the two reliable, transparent ways to get real schedules out of BBS Pro — and because all " +
  "parsing happens in the user's own browser, uploaded drawings and schedules never leave their machine.",
  { color: GREY, size: 9.5, font: "Helvetica-Oblique" }
);

// Footer page numbers
const range = doc.bufferedPageRange?.() ?? { start: 0, count: 0 };
doc.end();
console.log("Wrote " + outPath);
