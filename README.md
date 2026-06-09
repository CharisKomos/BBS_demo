# 📐 BBS Pro — Bar Bending Schedule Generator

A web app that turns a reinforcement drawing or schedule into a fully-costed
**Bar Bending Schedule** (BBS) to **Eurocode 2 / EN 1992-1-1** (and CYS EN 1992),
with cut lengths, bar weights, shape diagrams and CSV/PDF export.

It imports **real files**:

| Format | Support | Notes |
| ------ | ------- | ----- |
| **`.dxf`** | ✅ Full | AutoCAD interchange format. Reads the real layer table and every `@BBS`-tagged annotation. |
| **`.csv`** | ✅ Full | Export from Excel or any schedule. Headers matched case-insensitively. |
| **`.dwg`** | ⚠️ Convert first | AutoCAD's proprietary binary format **cannot** be read in a browser. Convert to DXF first (see below). |

> **Why no direct DWG?** `.dwg` is a closed binary format owned by Autodesk; there
> is no reliable way to parse it client-side. Converting DWG → DXF is free and takes
> seconds — see [GUIDE.md](GUIDE.md).

---

## Quick start (Windows / macOS / Linux)

You need **[Node.js](https://nodejs.org) 18 or newer** (this project was built on Node 24).

```powershell
# 1. Install dependencies (first time only)
npm install

# 2. Start the app in development mode
npm run dev
```

Then open the URL it prints (default **http://localhost:5173**) in your browser.

Click **▶ Load Sample Drawing** to see it parse the bundled `public/sample.dxf`,
or **📂 Browse** to import your own `.dxf` / `.csv`.

---

## Project layout

```
BBS_demo/
├─ index.html              App entry HTML
├─ package.json            Scripts & dependencies
├─ vite.config.ts          Build config
├─ src/
│  ├─ main.tsx             React bootstrap
│  ├─ App.tsx              UI (welcome → import → schedule)
│  └─ lib/
│     ├─ bbs.ts            Rebar engineering: shape codes, cut lengths, weights
│     └─ importParsers.ts  Real DXF + CSV parsing, and CSV export
├─ public/
│  ├─ sample.dxf           Bundled real sample drawing (15 bars, 8 layers)
│  └─ sample.csv           Same schedule as CSV
└─ scripts/
   └─ genSamples.mjs       Regenerates the two sample files
```

## npm scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the live-reloading dev server. |
| `npm run build` | Produce an optimised static site in `dist/`. |
| `npm run preview` | Serve the built `dist/` locally to check the production build. |
| `npm run typecheck` | Type-check the TypeScript without building. |
| `node scripts/genSamples.mjs` | Regenerate `public/sample.dxf` and `public/sample.csv`. |

---

## How importing works

- **DXF** — parsed with [`dxf-parser`](https://www.npmjs.com/package/dxf-parser).
  Layers come from the drawing's real layer table; bars come from `TEXT`/`MTEXT`
  entities whose content begins with `@BBS`. Each tag carries the bar's mark,
  member, section, shape code, diameter, dimensions and counts. The entity's CAD
  layer becomes the bar's layer.
- **CSV** — parsed with [`papaparse`](https://www.npmjs.com/package/papaparse).
  Column headers are normalised (case- and punctuation-insensitive).

The full annotation/column conventions are documented in **[GUIDE.md](GUIDE.md)**.

All engineering calculations (cut lengths with EN 1992-1-1 bending deductions,
unit weights at ρ = 7850 kg/m³) live in [`src/lib/bbs.ts`](src/lib/bbs.ts) — a
single source of truth shared by the UI and the importers.

---

## Deploying / making it available to customers

`npm run build` outputs a **static site** (`dist/`) — plain HTML/JS/CSS, no server
required. Host it anywhere static files can live. See **[GUIDE.md](GUIDE.md)** for
step-by-step instructions for Netlify, Vercel, GitHub Pages, an internal IIS/Nginx
server, or simply handing over the folder.

---

## License & standards

Cut lengths follow **EN 1992-1-1 cl. 8.3** bending deductions; shape codes follow
**EN ISO 3766**. Always have schedules checked by a qualified engineer before
fabrication — this tool is an aid, not a substitute for design responsibility.
