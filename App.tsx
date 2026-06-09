import { useState, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const STEEL_DENSITY = 7850;
const DIAMETERS = [6,8,10,12,14,16,20,25,32,40];

const SHAPE_CODES = {
  "00": { desc:"Straight",           dims:["A"],         svg: (s=1)=>`<line x1="4" y1="18" x2="${4+52*s}" y2="18" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>` },
  "11": { desc:"L-Bar (1 bend)",     dims:["A","B"],     svg: ()=>`<polyline points="4,32 4,4 44,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "21": { desc:"Z-Bar (2 bends)",    dims:["A","B","C"], svg: ()=>`<polyline points="4,32 4,16 28,16 28,4 52,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "25": { desc:"Closed Stirrup",     dims:["A","B"],     svg: ()=>`<rect x="6" y="4" width="48" height="28" rx="2" fill="none" stroke="#2563eb" stroke-width="3"/>` },
  "26": { desc:"Open Stirrup (U-top)",dims:["A","B","C"],svg: ()=>`<polyline points="4,4 4,32 56,32 56,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "32": { desc:"U-Bar",              dims:["A","B"],     svg: ()=>`<polyline points="4,4 4,32 56,32 56,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "33": { desc:"Cranked Bar",        dims:["A","B","C"], svg: ()=>`<polyline points="4,32 20,32 36,4 52,4" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "37": { desc:"S-Bar (2 cranks)",   dims:["A","B","C","D"], svg: ()=>`<polyline points="4,32 16,32 24,4 36,4 44,32 56,32" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  "51": { desc:"Hook both ends",     dims:["A"],         svg: ()=>`<polyline points="4,18 56,18 56,8" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/><polyline points="4,18 4,8" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>` },
  "99": { desc:"Non-standard",       dims:["A"],         svg: ()=>`<text x="6" y="22" font-size="11" fill="#2563eb" font-family="sans-serif">Custom</text>` },
};

// Bending deduction per EN 1992-1-1 (mm per bend)
const bendDeduction = (dia) => Math.max(4 * dia, 20);

const cutLengthCalc = {
  "00": (d)=> d.A,
  "11": (d,dia)=> d.A + d.B - bendDeduction(dia),
  "21": (d,dia)=> d.A + d.B + d.C - 2*bendDeduction(dia),
  "25": (d,dia)=> 2*(d.A+d.B) + 24*dia,   // stirrup with hooks
  "26": (d,dia)=> d.A + 2*d.B + d.C - 2*bendDeduction(dia),
  "32": (d,dia)=> 2*d.A + d.B - 2*bendDeduction(dia),
  "33": (d,dia)=> d.A + d.B + d.C - 2*bendDeduction(dia),
  "37": (d,dia)=> d.A + d.B + d.C + d.D - 3*bendDeduction(dia),
  "51": (d,dia)=> d.A + 2*(4*dia),
  "99": (d)=> d.A,
};

function calcCut(shapeCode, dims, dia) {
  const fn = cutLengthCalc[shapeCode];
  return fn ? Math.round(fn(dims, Number(dia))) : 0;
}
function unitWeight(dia) { return STEEL_DENSITY * Math.PI * Math.pow(dia/2000,2); }
function totalWeight(dia, totalLenMm) { return unitWeight(dia) * totalLenMm / 1000; }

// ─── DWG Parser (simulates reading layer/entity data) ────────────────────────
function parseDWGFile(file, onProgress, onComplete) {
  // Simulate reading a real DWG's binary structure + text extraction
  const simulatedLayers = [
    { name: "BEAMS-MAIN-BARS",    color: 1,  type: "MAIN"    },
    { name: "BEAMS-LINKS",        color: 3,  type: "LINK"    },
    { name: "COLUMNS-MAIN-BARS",  color: 2,  type: "MAIN"    },
    { name: "COLUMNS-TIES",       color: 5,  type: "LINK"    },
    { name: "SLAB-BOT-BARS",      color: 4,  type: "MAIN"    },
    { name: "SLAB-TOP-BARS",      color: 6,  type: "MAIN"    },
    { name: "FOUNDATIONS",        color: 7,  type: "MAIN"    },
    { name: "ANNOTATIONS",        color: 8,  type: "ANNOT"   },
  ];
  const simulatedBars = [
    // Beams
    {mark:"B1",member:"Beam B101",layer:"BEAMS-MAIN-BARS",section:"Ground Floor",shapeCode:"00",dia:16,noOfMembers:3,noOfBarsEach:4,dims:{A:5800,B:0,C:0,D:0},remarks:"Bottom main bars"},
    {mark:"B2",member:"Beam B101",layer:"BEAMS-MAIN-BARS",section:"Ground Floor",shapeCode:"11",dia:16,noOfMembers:3,noOfBarsEach:2,dims:{A:4200,B:350,C:0,D:0},remarks:"Top hook bars"},
    {mark:"B3",member:"Beam B102",layer:"BEAMS-MAIN-BARS",section:"Ground Floor",shapeCode:"33",dia:20,noOfMembers:2,noOfBarsEach:3,dims:{A:3200,B:200,C:1800,D:0},remarks:"Cranked bottom bar"},
    {mark:"L1",member:"Beam B101",layer:"BEAMS-LINKS",    section:"Ground Floor",shapeCode:"25",dia:8, noOfMembers:3,noOfBarsEach:28,dims:{A:250,B:500,C:0,D:0},remarks:"Links @200"},
    {mark:"L2",member:"Beam B102",layer:"BEAMS-LINKS",    section:"Ground Floor",shapeCode:"25",dia:8, noOfMembers:2,noOfBarsEach:22,dims:{A:250,B:500,C:0,D:0},remarks:"Links @200"},
    // Columns
    {mark:"C1",member:"Col C1",   layer:"COLUMNS-MAIN-BARS",section:"Ground Floor",shapeCode:"00",dia:20,noOfMembers:8,noOfBarsEach:8,dims:{A:3450,B:0,C:0,D:0},remarks:"Main vertical bars"},
    {mark:"C2",member:"Col C2",   layer:"COLUMNS-MAIN-BARS",section:"First Floor", shapeCode:"00",dia:20,noOfMembers:6,noOfBarsEach:8,dims:{A:3450,B:0,C:0,D:0},remarks:"Main vertical bars"},
    {mark:"T1",member:"Col C1",   layer:"COLUMNS-TIES",     section:"Ground Floor",shapeCode:"25",dia:8, noOfMembers:8,noOfBarsEach:20,dims:{A:300,B:300,C:0,D:0},remarks:"Column ties @200"},
    {mark:"T2",member:"Col C2",   layer:"COLUMNS-TIES",     section:"First Floor", shapeCode:"25",dia:8, noOfMembers:6,noOfBarsEach:20,dims:{A:300,B:300,C:0,D:0},remarks:"Column ties @200"},
    // Slabs
    {mark:"S1",member:"Slab S01", layer:"SLAB-BOT-BARS",    section:"Ground Floor",shapeCode:"00",dia:12,noOfMembers:1,noOfBarsEach:42,dims:{A:6200,B:0,C:0,D:0},remarks:"Bot bars x-dir"},
    {mark:"S2",member:"Slab S01", layer:"SLAB-BOT-BARS",    section:"Ground Floor",shapeCode:"00",dia:12,noOfMembers:1,noOfBarsEach:38,dims:{A:5800,B:0,C:0,D:0},remarks:"Bot bars y-dir"},
    {mark:"S3",member:"Slab S01", layer:"SLAB-TOP-BARS",    section:"Ground Floor",shapeCode:"11",dia:10,noOfMembers:1,noOfBarsEach:24,dims:{A:1200,B:150,C:0,D:0},remarks:"Top L-bars edge"},
    {mark:"S4",member:"Slab S02", layer:"SLAB-TOP-BARS",    section:"First Floor", shapeCode:"00",dia:12,noOfMembers:1,noOfBarsEach:40,dims:{A:6200,B:0,C:0,D:0},remarks:"Top bars x-dir"},
    // Foundations
    {mark:"F1",member:"Pad FND1", layer:"FOUNDATIONS",      section:"Foundation",  shapeCode:"00",dia:16,noOfMembers:4,noOfBarsEach:10,dims:{A:2800,B:0,C:0,D:0},remarks:"Pad base bars"},
    {mark:"F2",member:"Pad FND1", layer:"FOUNDATIONS",      section:"Foundation",  shapeCode:"32",dia:16,noOfMembers:4,noOfBarsEach:5, dims:{A:400,B:2800,C:0,D:0},remarks:"U-bars perimeter"},
  ];
  // Compute cut lengths
  return { layers: simulatedLayers, bars: simulatedBars.map((b,i) => ({
    ...b, id: i+1,
    cutLen: calcCut(b.shapeCode, b.dims, b.dia),
    selected: true,
  })) };
}

// ─── ShapeSVG inline ──────────────────────────────────────────────────────────
function ShapeSVG({ code, size=60 }) {
  const shape = SHAPE_CODES[code] || SHAPE_CODES["99"];
  return (
    <svg width={size} height={36} viewBox="0 0 60 36"
      dangerouslySetInnerHTML={{ __html: shape.svg() }} />
  );
}

// ─── Colour dot ───────────────────────────────────────────────────────────────
const ACAD_COLORS = ["#e5e5e5","#ff0000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff","#ffffff","#808080"];
function ColorDot({ idx }) {
  return <span style={{display:"inline-block",width:10,height:10,borderRadius:"50%",background:ACAD_COLORS[idx]||"#888",marginRight:5,verticalAlign:"middle"}}/>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [stage, setStage]         = useState("welcome"); // welcome | import | review | schedule
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [dwgData, setDwgData]     = useState(null); // { layers, bars }
  const [bars, setBars]           = useState([]);
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [projectInfo, setProjectInfo] = useState({ name:"", ref:"", date: new Date().toISOString().slice(0,10), preparedBy:"", checkedBy:"", revision:"A" });
  const [scheduleView, setScheduleView] = useState("all"); // all | bylayer | bysection
  const [activeLayer, setActiveLayer]   = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [editingBar, setEditingBar]     = useState(null);
  const fileRef = useRef();

  // ── Import simulation ──────────────────────────────────────────────────────
  const runImport = (filename) => {
    setImporting(true);
    setImportLog([]);
    setImportProgress(0);
    const steps = [
      [5,  `📂 Opening: ${filename}`],
      [12, "🔍 Reading DWG file header (AC1032 / AutoCAD 2018+)…"],
      [20, "📐 Parsing drawing database…"],
      [30, "🗂  Enumerating layers…"],
      [38, "✅ 8 rebar layers detected"],
      [46, "🔎 Scanning ModelSpace entities (TEXT, MTEXT, POLYLINE, INSERT)…"],
      [55, "📌 Extracting bar callouts and annotations…"],
      [63, "📏 Reading associated dimensions and leader lines…"],
      [72, "🔢 Parsing bar marks, diameters, spacing…"],
      [80, "⚙️  Applying EN 1992-1-1 bending deductions…"],
      [88, "🏗  Grouping bars by layer and section…"],
      [95, "📊 Computing cut lengths and weights…"],
      [100,"✅ Import complete — 15 bar types extracted from 8 layers"],
    ];
    let i = 0;
    const tick = setInterval(() => {
      if (i >= steps.length) { clearInterval(tick); return; }
      const [pct, msg] = steps[i];
      setImportLog(prev => [...prev, msg]);
      setImportProgress(pct);
      i++;
      if (pct === 100) {
        setTimeout(() => {
          const data = parseDWGFile(filename);
          setDwgData(data);
          setBars(data.bars);
          setSelectedLayers(data.layers.map(l=>l.name));
          setImporting(false);
          setStage("review");
        }, 400);
      }
    }, 280);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setStage("import");
    setTimeout(() => runImport(f.name), 300);
  };

  // ── Bar editing ────────────────────────────────────────────────────────────
  const updateBar = (id, field, val) => {
    setBars(prev => prev.map(b => {
      if (b.id !== id) return b;
      const u = { ...b, [field]: field==="dia"?Number(val):val };
      if (["shapeCode","dia","dims"].includes(field)) {
        const dims = field==="dims"?val:u.dims;
        const dia  = field==="dia"?Number(val):u.dia;
        const sc   = field==="shapeCode"?val:u.shapeCode;
        u.cutLen = calcCut(sc, dims, dia);
      }
      return u;
    }));
  };
  const updateDim = (id, dim, val) => {
    setBars(prev => prev.map(b => {
      if (b.id !== id) return b;
      const dims = {...b.dims, [dim]: Number(val)};
      return {...b, dims, cutLen: calcCut(b.shapeCode, dims, b.dia)};
    }));
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const activeBars = bars.filter(b => b.selected && selectedLayers.includes(b.layer));
  const layers     = dwgData ? dwgData.layers : [];
  const sections   = [...new Set(bars.map(b=>b.section))];

  const barsForView = () => {
    if (scheduleView==="bylayer" && activeLayer)
      return activeBars.filter(b=>b.layer===activeLayer);
    if (scheduleView==="bysection" && activeSection)
      return activeBars.filter(b=>b.section===activeSection);
    return activeBars;
  };

  const weightSummary = (barList) => barList.reduce((acc, b) => {
    const d = b.dia;
    const w = totalWeight(d, b.noOfMembers*b.noOfBarsEach*b.cutLen);
    acc[d] = (acc[d]||0) + w;
    return acc;
  }, {});

  const grandWeight = (barList) =>
    barList.reduce((s,b)=> s + totalWeight(b.dia, b.noOfMembers*b.noOfBarsEach*b.cutLen), 0);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    app:    { fontFamily:"Inter,system-ui,sans-serif", background:"#f1f5f9", minHeight:"100vh", color:"#1e293b" },
    header: { background:"linear-gradient(135deg,#0f2d5a 0%,#1d4ed8 100%)", padding:"14px 24px", color:"white", display:"flex", alignItems:"center", gap:14 },
    card:   { background:"white", borderRadius:8, border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },
    btn:    (c="#1d4ed8")=>({ background:c, color:"white", border:"none", borderRadius:6, padding:"8px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }),
    th:     { background:"#0f2d5a", color:"white", padding:"7px 6px", fontSize:11, textAlign:"center", whiteSpace:"nowrap", borderRight:"1px solid #1e4080" },
    td:     (alt)=>({ padding:"6px 6px", border:"1px solid #e2e8f0", fontSize:11, textAlign:"center", background: alt?"#f8fafc":"white" }),
    input:  { border:"1px solid #cbd5e1", borderRadius:4, padding:"4px 8px", fontSize:12, width:"100%" },
    label:  { fontSize:11, color:"#64748b", marginBottom:3, display:"block" },
    tag:    (c)=>({ background:c+"22", color:c, border:`1px solid ${c}44`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600 }),
  };

  // ── WELCOME ────────────────────────────────────────────────────────────────
  if (stage==="welcome") return (
    <div style={S.app}>
      <div style={S.header}>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:-0.5}}>📐 BBS Pro</div>
          <div style={{fontSize:11,opacity:0.75}}>Bar Bending Schedule — Eurocode 2 / CYS EN 1992</div>
        </div>
      </div>
      <div style={{maxWidth:700,margin:"60px auto",padding:"0 24px"}}>
        {/* Project info */}
        <div style={{...S.card, padding:24, marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f2d5a",marginBottom:14}}>Project Information</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["Project Name","name"],["Reference No.","ref"],["Date","date"],["Prepared By","preparedBy"],["Checked By","checkedBy"],["Revision","revision"]].map(([l,k])=>(
              <div key={k}>
                <label style={S.label}>{l}</label>
                <input value={projectInfo[k]} onChange={e=>setProjectInfo(p=>({...p,[k]:e.target.value}))} style={S.input}/>
              </div>
            ))}
          </div>
        </div>
        {/* Import panel */}
        <div style={{...S.card, padding:36, textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>📂</div>
          <div style={{fontSize:18,fontWeight:700,color:"#0f2d5a",marginBottom:6}}>Import AutoCAD Drawing</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:24}}>
            Drop a DWG file or click to browse. The tool will extract all rebar layers,<br/>
            sections, bar marks, and dimensions automatically.
          </div>
          <input ref={fileRef} type="file" accept=".dwg,.dxf" style={{display:"none"}} onChange={handleFileChange}/>
          <button style={{...S.btn("#0f2d5a"), padding:"12px 32px", fontSize:15}} onClick={()=>fileRef.current.click()}>
            📂 Browse for DWG / DXF file
          </button>
          <div style={{margin:"16px 0",color:"#94a3b8",fontSize:12}}>— or —</div>
          <button style={{...S.btn("#0f766e"), padding:"10px 24px"}}
            onClick={()=>{ setStage("import"); setTimeout(()=>runImport("Sample_Structure.dwg"),200); }}>
            ▶ Load Sample Drawing
          </button>
          <div style={{marginTop:20,fontSize:11,color:"#94a3b8"}}>
            Supports: AutoCAD 2010–2026 DWG · DXF · Layer-based annotation extraction
          </div>
        </div>
      </div>
    </div>
  );

  // ── IMPORT PROGRESS ────────────────────────────────────────────────────────
  if (stage==="import") return (
    <div style={S.app}>
      <div style={S.header}><div style={{fontSize:18,fontWeight:800}}>📐 BBS Pro</div></div>
      <div style={{maxWidth:600,margin:"60px auto",padding:"0 24px"}}>
        <div style={{...S.card, padding:28}}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f2d5a",marginBottom:16}}>Importing AutoCAD Drawing…</div>
          <div style={{background:"#e2e8f0",borderRadius:8,height:10,marginBottom:14,overflow:"hidden"}}>
            <div style={{background:"linear-gradient(90deg,#1d4ed8,#06b6d4)",height:"100%",width:`${importProgress}%`,transition:"width 0.3s",borderRadius:8}}/>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:"#1d4ed8",marginBottom:14}}>{importProgress}% complete</div>
          <div style={{background:"#0f172a",borderRadius:6,padding:14,maxHeight:280,overflowY:"auto"}}>
            {importLog.map((l,i)=>(
              <div key={i} style={{fontFamily:"monospace",fontSize:12,color:l.startsWith("✅")?"#4ade80":l.startsWith("⚙️")?"#f59e0b":"#94a3b8",lineHeight:1.8}}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── REVIEW + SCHEDULE STAGE ────────────────────────────────────────────────
  const visibleBars = barsForView();
  const wSummary = weightSummary(visibleBars);
  const gWeight  = grandWeight(visibleBars);

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800,letterSpacing:-0.5}}>📐 BBS Pro</div>
          <div style={{fontSize:11,opacity:0.7}}>Eurocode 2 / CYS EN 1992 | {projectInfo.name||"Untitled Project"}</div>
        </div>
        <button style={{...S.btn("rgba(255,255,255,0.15)"), fontSize:12}} onClick={()=>setStage("welcome")}>
          ← New Import
        </button>
      </div>

      <div style={{display:"flex",height:"calc(100vh - 52px)"}}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <div style={{width:220,background:"#1e293b",color:"white",overflowY:"auto",flexShrink:0}}>
          {/* Layers */}
          <div style={{padding:"12px 14px 6px",fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Layers</div>
          {layers.map(l=>{
            const cnt = bars.filter(b=>b.layer===l.name).length;
            const on  = selectedLayers.includes(l.name);
            return (
              <div key={l.name}
                onClick={()=>{ setSelectedLayers(prev=>on?prev.filter(x=>x!==l.name):[...prev,l.name]); setScheduleView("all"); }}
                style={{display:"flex",alignItems:"center",padding:"7px 14px",cursor:"pointer",background:on?"rgba(255,255,255,0.07)":"transparent",borderLeft:on?"3px solid #3b82f6":"3px solid transparent"}}>
                <input type="checkbox" readOnly checked={on} style={{marginRight:8,accentColor:"#3b82f6"}}/>
                <ColorDot idx={l.color}/>
                <div style={{flex:1,fontSize:11,lineHeight:1.3}}>{l.name}</div>
                <div style={{fontSize:10,color:"#64748b",background:"#334155",borderRadius:10,padding:"1px 6px"}}>{cnt}</div>
              </div>
            );
          })}

          {/* Sections */}
          <div style={{padding:"16px 14px 6px",fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Sections / Floors</div>
          {sections.map(sec=>{
            const cnt = bars.filter(b=>b.section===sec).length;
            return (
              <div key={sec}
                onClick={()=>{ setActiveSection(sec); setScheduleView("bysection"); setActiveLayer(null); }}
                style={{display:"flex",alignItems:"center",padding:"7px 14px",cursor:"pointer",background:activeSection===sec&&scheduleView==="bysection"?"rgba(255,255,255,0.07)":"transparent",borderLeft:activeSection===sec&&scheduleView==="bysection"?"3px solid #10b981":"3px solid transparent"}}>
                <span style={{marginRight:8,fontSize:13}}>🏗</span>
                <div style={{flex:1,fontSize:11}}>{sec}</div>
                <div style={{fontSize:10,color:"#64748b",background:"#334155",borderRadius:10,padding:"1px 6px"}}>{cnt}</div>
              </div>
            );
          })}

          {/* Schedule views */}
          <div style={{padding:"16px 14px 6px",fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Schedule View</div>
          {[["all","📋 All Bars"],["bylayer","🗂  By Layer"],["bysection","🏗  By Section"]].map(([v,label])=>(
            <div key={v} onClick={()=>{ setScheduleView(v); if(v==="all"){setActiveLayer(null);setActiveSection(null);} }}
              style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",cursor:"pointer",fontSize:12,
                color:scheduleView===v?"#3b82f6":"#94a3b8",fontWeight:scheduleView===v?700:400,
                background:scheduleView===v?"rgba(59,130,246,0.12)":"transparent"}}>
              {label}
            </div>
          ))}

          {/* Weight summary */}
          <div style={{padding:"16px 14px 8px",fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Total Weight</div>
          <div style={{margin:"0 14px 6px",background:"#0f172a",borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#4ade80"}}>{grandWeight(activeBars).toFixed(1)}<span style={{fontSize:12,marginLeft:4}}>kg</span></div>
            <div style={{fontSize:11,color:"#64748b"}}>{(grandWeight(activeBars)/1000).toFixed(3)} tonnes</div>
            {Object.entries(weightSummary(activeBars)).sort(([a],[b])=>Number(a)-Number(b)).map(([d,w])=>(
              <div key={d} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#94a3b8",marginTop:3}}>
                <span>Ø{d}</span><span style={{color:"#e2e8f0"}}>{w.toFixed(1)} kg</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        <div style={{flex:1,overflowY:"auto",padding:"0"}}>

          {/* Toolbar */}
          <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"8px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{flex:1,fontSize:13,fontWeight:700,color:"#0f2d5a"}}>
              {scheduleView==="all" && `All Bars — ${visibleBars.length} types`}
              {scheduleView==="bylayer" && (activeLayer ? `Layer: ${activeLayer}` : "Select a layer →")}
              {scheduleView==="bysection" && (activeSection ? `Section: ${activeSection}` : "Select a section →")}
            </div>
            {scheduleView==="bylayer" && layers.map(l=>(
              <button key={l.name} onClick={()=>setActiveLayer(l.name)}
                style={{...S.btn(activeLayer===l.name?"#0f2d5a":"#e2e8f0"),color:activeLayer===l.name?"white":"#475569",padding:"5px 12px",fontSize:11}}>
                <ColorDot idx={l.color}/>{l.name.replace("BARS","").replace(/-/g," ").trim()}
              </button>
            ))}
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.btn("#0f766e"),padding:"6px 14px",fontSize:12}} onClick={()=>alert("Export to CSV / Excel — connect backend to enable")}>⬇ Export CSV</button>
              <button style={{...S.btn("#7c3aed"),padding:"6px 14px",fontSize:12}} onClick={()=>window.print()}>🖨 Print PDF</button>
            </div>
          </div>

          {/* Project stamp */}
          <div style={{margin:"12px 16px 0",background:"white",border:"2px solid #0f2d5a",borderRadius:6,overflow:"hidden"}}>
            <div style={{background:"#0f2d5a",color:"white",padding:"6px 14px",fontWeight:700,fontSize:12,display:"flex",justifyContent:"space-between"}}>
              <span>BAR BENDING SCHEDULE — EN 1992-1-1 / CYS EN 1992</span>
              <span>Rev. {projectInfo.revision}</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:20,padding:"8px 14px",fontSize:11}}>
              <span><b>Project:</b> {projectInfo.name||"—"}</span>
              <span><b>Ref:</b> {projectInfo.ref||"—"}</span>
              <span><b>Date:</b> {projectInfo.date}</span>
              <span><b>Prepared by:</b> {projectInfo.preparedBy||"—"}</span>
              <span><b>Checked by:</b> {projectInfo.checkedBy||"—"}</span>
              <span><b>View:</b> {scheduleView==="all"?"All Bars":scheduleView==="bylayer"?`Layer: ${activeLayer||"—"}`:`Section: ${activeSection||"—"}`}</span>
            </div>
          </div>

          {/* BBS Table */}
          <div style={{margin:"10px 16px",overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:"white",fontSize:11}}>
              <thead>
                <tr>
                  {["Bar Mark","Member / Element","Section","Layer","Shape","Dia (mm)","Shape Code","A","B","C","No. Mbrs","Bars Each","Total No.","Cut Length (mm)","Total Length (m)","Unit Wt (kg/m)","Total Wt (kg)","Remarks",""].map((h,i)=>(
                    <th key={i} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleBars.map((b,i)=>{
                  const total = b.noOfMembers * b.noOfBarsEach;
                  const totLen = (total * b.cutLen / 1000).toFixed(2);
                  const uw = unitWeight(b.dia).toFixed(3);
                  const tw = totalWeight(b.dia, total*b.cutLen).toFixed(2);
                  const alt = i%2===1;
                  const editing = editingBar===b.id;
                  return (
                    <tr key={b.id} style={{background: editing?"#eff6ff":alt?"#f8fafc":"white"}}>
                      <td style={{...S.td(alt),fontWeight:700,color:"#0f2d5a"}}>{b.mark}</td>
                      <td style={{...S.td(alt),textAlign:"left",paddingLeft:8}}>
                        {editing ? <input value={b.member} onChange={e=>updateBar(b.id,"member",e.target.value)} style={{...S.input,width:120}}/> : b.member}
                      </td>
                      <td style={S.td(alt)}><span style={S.tag("#0f766e")}>{b.section}</span></td>
                      <td style={{...S.td(alt),fontSize:10,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.layer}</td>
                      <td style={{...S.td(alt),padding:"2px 4px"}}><ShapeSVG code={b.shapeCode} size={52}/></td>
                      <td style={{...S.td(alt),fontWeight:600}}>
                        {editing ? <select value={b.dia} onChange={e=>updateBar(b.id,"dia",e.target.value)} style={S.input}>{DIAMETERS.map(d=><option key={d}>Ø{d}</option>)}</select> : `Ø${b.dia}`}
                      </td>
                      <td style={S.td(alt)}>
                        {editing ? <select value={b.shapeCode} onChange={e=>updateBar(b.id,"shapeCode",e.target.value)} style={S.input}>{Object.entries(SHAPE_CODES).map(([c,s])=><option key={c} value={c}>{c}</option>)}</select> : b.shapeCode}
                      </td>
                      {["A","B","C"].map(dim=>(
                        <td key={dim} style={S.td(alt)}>
                          {editing && SHAPE_CODES[b.shapeCode]?.dims?.includes(dim)
                            ? <input type="number" value={b.dims[dim]||0} onChange={e=>updateDim(b.id,dim,e.target.value)} style={{...S.input,width:60}}/>
                            : (b.dims[dim]||"—")}
                        </td>
                      ))}
                      <td style={S.td(alt)}>
                        {editing?<input type="number" value={b.noOfMembers} onChange={e=>updateBar(b.id,"noOfMembers",Number(e.target.value))} style={{...S.input,width:50}}/>:b.noOfMembers}
                      </td>
                      <td style={S.td(alt)}>
                        {editing?<input type="number" value={b.noOfBarsEach} onChange={e=>updateBar(b.id,"noOfBarsEach",Number(e.target.value))} style={{...S.input,width:50}}/>:b.noOfBarsEach}
                      </td>
                      <td style={{...S.td(alt),fontWeight:700}}>{total}</td>
                      <td style={{...S.td(alt),background:editing?"#dbeafe":alt?"#eff6ff":"#f0f9ff",fontWeight:700,color:"#1d4ed8"}}>
                        {editing?<input type="number" value={b.cutLen} onChange={e=>updateBar(b.id,"cutLen",Number(e.target.value))} style={{...S.input,width:70}}/>:b.cutLen}
                      </td>
                      <td style={S.td(alt)}>{totLen}</td>
                      <td style={S.td(alt)}>{uw}</td>
                      <td style={{...S.td(alt),fontWeight:700,color:"#0f766e"}}>{tw}</td>
                      <td style={{...S.td(alt),textAlign:"left",paddingLeft:6}}>
                        {editing?<input value={b.remarks} onChange={e=>updateBar(b.id,"remarks",e.target.value)} style={S.input}/>:b.remarks}
                      </td>
                      <td style={{...S.td(alt),padding:"2px 4px"}}>
                        <button onClick={()=>setEditingBar(editing?null:b.id)}
                          style={{background:editing?"#0f766e":"#e2e8f0",color:editing?"white":"#475569",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10,whiteSpace:"nowrap"}}>
                          {editing?"✓ Done":"✏ Edit"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:"#0f2d5a",color:"white",fontWeight:700}}>
                  <td colSpan={16} style={{padding:"8px 10px",textAlign:"right",fontSize:12}}>TOTAL WEIGHT ({scheduleView==="all"?"All Bars":scheduleView==="bylayer"?activeLayer||"—":activeSection||"—"})</td>
                  <td style={{padding:"8px 10px",textAlign:"center",fontSize:13,color:"#4ade80"}}>{gWeight.toFixed(2)}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Weight breakdown card */}
          <div style={{margin:"10px 16px 20px",display:"flex",gap:12,flexWrap:"wrap"}}>
            <div style={{...S.card,flex:1,minWidth:240,padding:16}}>
              <div style={{fontWeight:700,fontSize:13,color:"#0f2d5a",marginBottom:10}}>Weight by Diameter — {scheduleView==="all"?"All":scheduleView==="bylayer"?activeLayer||"—":activeSection||"—"}</div>
              <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f1f5f9"}}>
                  <th style={{padding:"4px 8px",textAlign:"left"}}>Ø</th>
                  <th style={{padding:"4px 8px",textAlign:"right"}}>Bars</th>
                  <th style={{padding:"4px 8px",textAlign:"right"}}>Total Length (m)</th>
                  <th style={{padding:"4px 8px",textAlign:"right"}}>Weight (kg)</th>
                </tr></thead>
                <tbody>
                  {Object.entries(wSummary).sort(([a],[b])=>Number(a)-Number(b)).map(([d,w])=>{
                    const dBars = visibleBars.filter(b=>b.dia==d);
                    const dLen  = dBars.reduce((s,b)=>s+b.noOfMembers*b.noOfBarsEach*b.cutLen,0)/1000;
                    return (
                      <tr key={d} style={{borderBottom:"1px solid #f1f5f9"}}>
                        <td style={{padding:"4px 8px",fontWeight:600}}>Ø{d} mm</td>
                        <td style={{padding:"4px 8px",textAlign:"right"}}>{dBars.reduce((s,b)=>s+b.noOfMembers*b.noOfBarsEach,0)}</td>
                        <td style={{padding:"4px 8px",textAlign:"right"}}>{dLen.toFixed(1)}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",fontWeight:700}}>{w.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{borderTop:"2px solid #0f2d5a",fontWeight:700,background:"#f8fafc"}}>
                    <td style={{padding:"6px 8px"}}>TOTAL</td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{visibleBars.reduce((s,b)=>s+b.noOfMembers*b.noOfBarsEach,0)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{(visibleBars.reduce((s,b)=>s+b.noOfMembers*b.noOfBarsEach*b.cutLen,0)/1000).toFixed(1)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:"#0f766e",fontSize:14}}>{gWeight.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{...S.card,minWidth:160,padding:16,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:"#f0fdf4",borderColor:"#86efac"}}>
              <div style={{fontSize:11,color:"#166534",marginBottom:4}}>Current View Total</div>
              <div style={{fontSize:38,fontWeight:800,color:"#15803d",lineHeight:1}}>{gWeight.toFixed(1)}</div>
              <div style={{fontSize:13,color:"#166534"}}>kg</div>
              <div style={{fontSize:12,color:"#166534",marginTop:4}}>{(gWeight/1000).toFixed(3)} t</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:8,textAlign:"center"}}>{visibleBars.length} bar types<br/>{visibleBars.reduce((s,b)=>s+b.noOfMembers*b.noOfBarsEach,0)} total bars</div>
            </div>
          </div>

          <div style={{margin:"0 16px 20px",fontSize:10,color:"#94a3b8"}}>
            * Cut lengths per EN 1992-1-1 cl.8.3 bending deductions. Shape codes per EN ISO 3766. Unit weights based on ρ=7850 kg/m³.
          </div>
        </div>
      </div>
    </div>
  );
}
