# BBS Pro — User & Deployment Guide

This guide covers three things:

1. [Running the app](#1-running-the-app)
2. [Preparing files it can import](#2-preparing-files-the-app-can-import) — DXF & CSV
3. [Making it available to customers](#3-making-it-available-to-customers) — deployment

---

## 1. Running the app

### What you need
- **[Node.js](https://nodejs.org) 18+** (download the "LTS" installer — it includes `npm`).

### Steps (Windows PowerShell)

```powershell
# Go to the project folder
cd C:\Users\c.komodromos\BBS_demo

# Install dependencies — only needed the first time
npm install

# Start the app
npm run dev
```

The terminal prints a line like `Local: http://localhost:5173/`. Open that
address in your browser. Leave the terminal open while you use the app; press
**Ctrl + C** in it to stop.

### Using it
1. Fill in the **Project Information** (name, reference, prepared/checked by…).
2. Either:
   - Click **📂 Browse for DXF / CSV file** and pick your file, **or**
   - Click **▶ Load Sample Drawing** to try the built-in example.
3. On the schedule screen you can:
   - Toggle **layers** on/off in the left sidebar.
   - Switch the view: **All Bars / By Layer / By Section**.
   - Click **✏ Edit** on any row to correct a value — weights recalculate live.
   - **⬇ Export CSV** to download the schedule, or **🖨 Print PDF** to print/save as PDF.

---

## 2. Preparing files the app can import

### Option A — CSV (easiest, works with Excel)

Make a spreadsheet with one row per bar type and save it as **CSV**
(`File → Save As → CSV` in Excel). The first row must be column headers.

**Recognised columns** (header names are case-insensitive; spaces/underscores ignored):

| Column | Required | Meaning | Example |
| ------ | :------: | ------- | ------- |
| `mark` | ✅ | Bar mark | `B1` |
| `member` | | Member / element | `Beam B101` |
| `section` | | Section or floor (used for grouping) | `Ground Floor` |
| `layer` | | Layer name (used for grouping/colour) | `BEAMS-MAIN-BARS` |
| `shapeCode` | | Shape code (see table below) | `11` |
| `dia` | | Bar diameter in mm | `16` |
| `A`, `B`, `C`, `D` | | Shape dimensions in mm | `4200` |
| `noOfMembers` | | Number of identical members | `3` |
| `noOfBarsEach` | | Bars per member | `2` |
| `remarks` | | Free text | `Top hook bars` |

A ready-made example lives at [`public/sample.csv`](public/sample.csv).

Minimal example:

```csv
mark,member,section,layer,shapeCode,dia,A,B,C,D,noOfMembers,noOfBarsEach,remarks
B1,Beam B101,Ground Floor,BEAMS-MAIN-BARS,00,16,5800,0,0,0,3,4,Bottom main bars
L1,Beam B101,Ground Floor,BEAMS-LINKS,25,8,250,500,0,0,3,28,Links @200
```

### Option B — DXF (from AutoCAD / any CAD)

The app reads the drawing's **real layers** automatically. To carry the schedule
data, add a text label for each bar whose content starts with **`@BBS`**, followed
by `key=value;` pairs. Put each label **on the layer that bar belongs to** — the
layer is picked up automatically.

**Tag format** (use a `TEXT` or `MTEXT` object):

```
@BBS mark=B1; member=Beam B101; section=Ground Floor; shape=11; dia=16; A=4200; B=350; C=0; D=0; n=3; each=2; rem=Top hook bars
```

| Key | Meaning |
| --- | ------- |
| `mark` | Bar mark (**required**) |
| `member` | Member / element |
| `section` | Section / floor |
| `shape` | Shape code (see below) |
| `dia` | Diameter, mm |
| `A` `B` `C` `D` | Shape dimensions, mm |
| `n` | Number of members |
| `each` | Bars per member |
| `rem` | Remarks |

A ready-made example lives at [`public/sample.dxf`](public/sample.dxf). Open it in
a text editor to see the exact structure.

> **Tip:** Keep one `@BBS` label per bar type. The label's text is what the app
> reads — its position on the drawing doesn't matter.

### Converting a DWG to DXF

`.dwg` files can't be read directly. Convert first — both options are free:

- **In AutoCAD:** `File → Save As → AutoCAD DXF (*.dxf)`.
- **No AutoCAD?** Use the free **[ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter)**
  (Open Design Alliance): set input = your DWG folder, output format = **DXF**, convert.

Then import the resulting `.dxf`.

### Supported shape codes

| Code | Shape | Dimensions |
| ---- | ----- | ---------- |
| `00` | Straight | A |
| `11` | L-Bar (1 bend) | A, B |
| `21` | Z-Bar (2 bends) | A, B, C |
| `25` | Closed Stirrup | A, B |
| `26` | Open Stirrup (U-top) | A, B, C |
| `32` | U-Bar | A, B |
| `33` | Cranked Bar | A, B, C |
| `37` | S-Bar (2 cranks) | A, B, C, D |
| `51` | Hook both ends | A |
| `99` | Non-standard / custom | A |

Cut lengths are computed per **EN 1992-1-1** with bending deductions of
`max(4·Ø, 20) mm` per bend.

---

## 3. Making it available to customers

`npm run build` creates a **static website** in the `dist/` folder — just files,
no backend needed. Build once:

```powershell
npm run build
```

Then publish `dist/` using any of the options below.

### Option A — Netlify or Vercel (fastest, free tier)
1. Push this folder to a GitHub repo (already done: `CharisKomos/BBS_demo`).
2. In [Netlify](https://netlify.com) or [Vercel](https://vercel.com), choose **Import from Git**.
3. Build settings: **Build command** `npm run build`, **Publish/Output directory** `dist`.
4. Deploy. You get a public HTTPS URL (and automatic redeploys on every push).

### Option B — GitHub Pages
1. `npm run build`.
2. Publish the `dist/` folder to a `gh-pages` branch (e.g. with the
   [`gh-pages`](https://www.npmjs.com/package/gh-pages) package, or by committing
   `dist/` to that branch).
3. Enable Pages in the repo settings. (The app already uses relative asset paths,
   so it works from a sub-path URL.)

### Option C — Your own server (IIS / Nginx / Apache)
Copy the contents of `dist/` into the web root (e.g. `C:\inetpub\wwwroot\bbs` for
IIS, or `/var/www/bbs` for Nginx). No special configuration is required — it's a
plain single-page static site.

### Option D — Hand over a folder (offline use)
Because the build is fully static and self-contained, you can zip the `dist/`
folder and give it to a customer. To run it they need a tiny static server (a
double-clicked `index.html` is blocked by browsers from `fetch`-ing the sample
file). Simplest:

```powershell
npm install -g serve
serve C:\path\to\dist
```

…or any static file server. For an even simpler hand-off, deploy via Option A and
just send them the URL.

### A note on data privacy
All parsing happens **in the customer's browser** — uploaded drawings and
schedules never leave their machine. Nothing is sent to a server. This is worth
highlighting to clients with confidential drawings.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| *"No bar data found"* after importing a DXF | The drawing has no `@BBS` labels. Add them (see §2 Option B). |
| *"No bar data found"* after importing a CSV | The CSV is missing a `mark` column, or rows are empty. |
| *"DWG … cannot be read"* | Convert the DWG to DXF first (see §2). |
| `npm` not recognised | Install Node.js from <https://nodejs.org> and reopen the terminal. |
| Sample button does nothing | Make sure you're running via `npm run dev`/`preview` or a real web server — opening `index.html` directly from disk blocks file loading. |
