/* ============================================================
   KOA BUILDER — Plan (drag-to-place editor) + Section views
   v3: sloped-site depth · stacking badges · organic shapes ·
       integrated flow overlay (streamlines + upwelling cues)
   Renders placed block instances {uid, block, x, z, s}.
   Exposes window.ReefViews (OrbitView added by reef-orbit.jsx)
   ============================================================ */
const { useRef: useRefV, useState: useStateV, useMemo: useMemoV } = React;

/* ---- mood grade + palette ------------------------------- */
const MOOD = {
  twilight: { accent: '#6db3e8', washStops: ['rgba(95,200,210,0.20)', 'rgba(70,150,210,0.14)', 'rgba(20,55,110,0.30)'] },
  tropical: { accent: '#37c9bd', washStops: ['rgba(90,225,210,0.28)', 'rgba(55,195,200,0.17)', 'rgba(15,95,110,0.34)'] },
  deep: { accent: '#4f86d6', washStops: ['rgba(60,120,200,0.18)', 'rgba(40,80,160,0.14)', 'rgba(8,30,70,0.46)'] },
};
function paletteFor(style, mood) {
  const m = MOOD[mood] || MOOD.twilight;
  const base = {
    line: '#d3e3f7', dim: '#5f86b8', faint: 'rgba(120,160,210,0.22)',
    accent: m.accent, amber: '#e8a849', banana: '#f2c14e', life: '#74d2a2', polyp: '#e8839e',
    good: '#5fd0a8', warn: '#e8a849', bad: '#e8836b', washStops: m.washStops,
  };
  if (style === 'bathy') return { ...base, fill: 'rgba(120,185,235,0.16)', fillHi: 'rgba(120,185,235,0.26)', wash: 1 };
  if (style === 'illus') return { ...base, fill: 'rgba(120,185,235,0.30)', fillHi: 'rgba(140,205,245,0.46)', wash: 0.6 };
  return { ...base, fill: 'rgba(120,185,235,0.08)', fillHi: 'rgba(120,185,235,0.14)', wash: 0 };
}
function blockStroke(block, pal) { return block.color === 'amber' ? pal.amber : block.color === 'banana' ? pal.banana : block.color === 'life' ? pal.life : pal.line; }

function ReefDefs({ pal }) {
  const w = (pal && pal.washStops) || ['rgba(95,200,210,0.20)', 'rgba(70,150,210,0.14)', 'rgba(20,55,110,0.30)'];
  return (
    <defs>
      <pattern id="sand" width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.9" fill="rgba(150,185,225,0.30)" />
        <circle cx="6.5" cy="6" r="0.9" fill="rgba(150,185,225,0.20)" />
      </pattern>
      <linearGradient id="bathyCol" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={w[0]} /><stop offset="0.5" stopColor={w[1]} /><stop offset="1" stopColor={w[2]} />
      </linearGradient>
      <linearGradient id="depthGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(120,190,225,0.05)" />
        <stop offset="1" stopColor="rgba(10,30,70,0.42)" />
      </linearGradient>
    </defs>
  );
}

/* ---- ambient current (heading-aware, smooth CSS flow) ---- */
function AmbientCurrent({ heading, speed, fld, pal }) {
  const dur = 7 / Math.max(0.35, 0.4 + speed * 1.5);
  const cols = 8, rows = 7, cw = fld.w / cols, rh = fld.h / rows;
  const arrows = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const f = ((c + (r % 2) * 0.5) / cols) % 1;
    const x = fld.x + c * cw, y = fld.y + (r + 0.5) * rh;
    arrows.push(
      <g key={r + '_' + c} transform={`translate(${x},${y}) rotate(${heading})`}>
        <g className="cur cur-x" style={{ '--dx': cw + 'px', animationDuration: dur.toFixed(2) + 's', animationDelay: (-dur * f).toFixed(2) + 's' }}>
          <path d="M-11 0 h20" stroke={pal.accent} strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M9 0 l-6 -3 M9 0 l-6 3" stroke={pal.accent} strokeWidth="2" fill="none" opacity="0.5" />
        </g>
      </g>);
  }
  return <g>{arrows}</g>;
}

/* ---- integrated FLOW overlay (streamlines + upwelling) --- */
function FlowLayer({ field, placed, site, w2s, pal }) {
  const lines = useMemoV(() => (field ? window.ReefFlow.streamlines(field, 30) : []), [field]);
  if (!field) return null;
  const maxSp = field.maxSp || 1;
  const dur = (6 / (0.5 + site.speed * 1.5));
  const els = lines.map((ln, i) => {
    const d = ln.pts.map((p, k) => { const s = w2s(p[0], p[1]); return (k ? 'L' : 'M') + s[0].toFixed(1) + ' ' + s[1].toFixed(1); }).join(' ');
    const mean = ln.speeds.reduce((a, b) => a + b, 0) / ln.speeds.length;
    const frac = Math.min(1, mean / (maxSp * 0.92));
    const col = frac > 0.86 ? pal.amber : pal.accent;
    return <path key={i} d={d} fill="none" stroke={col} strokeWidth={1 + 1.5 * frac} opacity={0.22 + 0.5 * frac}
      strokeDasharray="2 11" strokeLinecap="round" className="flowline"
      style={{ animationDuration: dur.toFixed(2) + 's', animationDelay: (-i * 0.16) + 's' }} />;
  });
  // upwelling cues on the upstream face of tall blocks
  const rad = site.heading * Math.PI / 180, fx = Math.cos(rad), fy = Math.sin(rad);
  const plumes = []; let labelled = false;
  (placed || []).forEach((p) => {
    const blk = window.REEF.BLOCK_BY_ID[p.block]; const s = p.s || 1; if (blk.h * s < 46) return;
    const r = blk.r * s; const sp = w2s(p.x - fx * r * 1.04, p.z - fy * r * 1.04);
    plumes.push(<g key={'up' + p.uid} className="upwell" transform={`translate(${sp[0]},${sp[1]})`}>
      <circle r="11" fill="none" stroke={pal.amber} strokeWidth="1.3" opacity="0.7" />
      <circle r="5.5" fill="none" stroke={pal.amber} strokeWidth="1.1" opacity="0.5" />
      <path d="M0,6 L0,-8 M-3.6,-3.5 L0,-8 L3.6,-3.5" stroke={pal.amber} strokeWidth="1.7" fill="none" />
    </g>);
    if (!labelled) { plumes.push(<text key={'upl' + p.uid} x={sp[0] + 15} y={sp[1] - 8} className="svg-mono" fill={pal.amber} fontSize="10.5" opacity="0.9">upwelling</text>); labelled = true; }
  });
  return <g>{els}<g>{plumes}</g></g>;
}

/* ---- current out of the page (section) ------------------- */
function OutOfPage({ y, x0, x1, count, pal }) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + (i + 0.5) * (x1 - x0) / count;
    dots.push(<g key={i} className="cflow" style={{ animationDelay: (-i * 0.3) + 's' }}>
      <circle cx={x} cy={y} r="8" fill="none" stroke={pal.accent} strokeWidth="1.8" /><circle cx={x} cy={y} r="2.2" fill={pal.accent} /></g>);
  }
  return <g>{dots}</g>;
}

function pukaGrid(cx, cy, w, h, color, key) {
  const dots = [];
  const cols = Math.max(3, Math.round(w / 11)), rows = Math.max(2, Math.round(h / 11));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    dots.push(<circle key={`${key}-${r}-${c}`} cx={cx - w / 2 + (c + 0.5) * (w / cols)} cy={cy - h / 2 + (r + 0.5) * (h / rows)} r="1.9" fill="none" stroke={color} strokeWidth="1.1" />);
  return <g key={key}>{dots}</g>;
}
function hexPts(cx, cy, r) { const p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }

/* ============================================================
   TOP-DOWN block glyph (plan) — centred at 0,0
   ============================================================ */
function blockTop(block, R, pal) {
  const s = blockStroke(block, pal);
  const g = [];
  const sq = (rr, fill) => <rect key={'q' + rr} x={-rr} y={-rr} width={rr * 2} height={rr * 2} rx="3" fill={fill || 'none'} stroke={s} strokeWidth="2" />;
  switch (block.id) {
    case 'table':
      g.push(sq(R * 0.78, pal.fillHi));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p, i) => g.push(<rect key={'l' + i} x={p[0] * R * 0.62 - 4} y={p[1] * R * 0.62 - 4} width="8" height="8" fill={s} />));
      break;
    case 'monolith':
      [1, 0.66, 0.36].forEach((k, i) => g.push(sq(R * 0.82 * k, i === 0 ? pal.fill : 'none')));
      break;
    case 'aframe':
      g.push(<rect key="af" x={-R * 0.78} y={-R * 0.55} width={R * 1.56} height={R * 1.1} rx="2" fill={pal.fill} stroke={s} strokeWidth="2" />);
      g.push(<line key="ridge" x1={-R * 0.78} y1="0" x2={R * 0.78} y2="0" stroke={s} strokeWidth="1.6" strokeDasharray="3 3" />);
      break;
    case 'dome': {                         // layered dome — concentric tiers
      [0.86, 0.6, 0.34].forEach((k, i) => g.push(<circle key={'d' + i} r={R * k} fill={i === 0 ? pal.fillHi : i === 1 ? pal.fill : 'none'} stroke={s} strokeWidth={i === 2 ? 1.4 : 2} />));
      g.push(<circle key="dc" r="2.4" fill={s} />);
      break;
    }
    case 'tree': {                         // branching coral — radiating arms
      g.push(<circle key="tb" r={R * 0.3} fill={pal.fill} stroke={s} strokeWidth="1.6" />);
      for (let k = 0; k < 7; k++) { const a = k * (Math.PI * 2 / 7) + 0.2; const ex = Math.cos(a) * R * 0.92, ey = Math.sin(a) * R * 0.92; const mx = Math.cos(a) * R * 0.5, my = Math.sin(a) * R * 0.5;
        g.push(<line key={'br' + k} x1={mx} y1={my} x2={ex} y2={ey} stroke={s} strokeWidth="2.4" strokeLinecap="round" />);
        g.push(<circle key={'bn' + k} cx={ex} cy={ey} r="3" fill={s} />);
        const a2 = a + 0.34; g.push(<line key={'br2' + k} x1={mx} y1={my} x2={Math.cos(a2) * R * 0.7} y2={Math.sin(a2) * R * 0.7} stroke={s} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />);
      }
      break;
    }
    case 'cathedral': {                    // honeycomb — hex outline + cells
      const hp = hexPts(0, 0, R * 0.92).map((p) => p.join(',')).join(' ');
      g.push(<polygon key="hx" points={hp} fill={pal.fill} stroke={s} strokeWidth="2" />);
      const cells = [[0, 0], [0, -1], [0, 1], [-0.86, -0.5], [-0.86, 0.5], [0.86, -0.5], [0.86, 0.5]];
      cells.forEach((c, i) => { const cp = hexPts(c[0] * R * 0.46, c[1] * R * 0.46, R * 0.2).map((p) => p.join(',')).join(' '); g.push(<polygon key={'hc' + i} points={cp} fill="none" stroke={pal.accent} strokeWidth="1.1" opacity="0.85" />); });
      break;
    }
    case 'reefball':
      g.push(<circle key="r" r={R * 0.8} fill={pal.fillHi} stroke={s} strokeWidth="2" />);
      g.push(<circle key="r2" r={R * 0.46} fill="none" stroke={pal.dim} strokeWidth="1.3" />);
      [[0, -1], [0.86, 0.5], [-0.86, 0.5]].forEach((p, i) => g.push(<circle key={'h' + i} cx={p[0] * R * 0.5} cy={p[1] * R * 0.5} r="2.4" fill="none" stroke={pal.dim} strokeWidth="1.1" />));
      break;
    case 'puka':
      g.push(<rect key="p" x={-R * 0.8} y={-R * 0.62} width={R * 1.6} height={R * 1.24} rx="3" fill={pal.fill} stroke={s} strokeWidth="2" />);
      g.push(pukaGrid(0, 0, R * 1.4, R * 1.0, pal.accent, 'pk'));
      break;
    case 'tube':
      g.push(<circle key="t" r={R * 0.7} fill={pal.fill} stroke={s} strokeWidth="2.2" />);
      g.push(<circle key="t2" r={R * 0.4} fill="none" stroke={pal.dim} strokeWidth="1.4" />);
      break;
    case 'menpachi':
      g.push(<rect key="m" x={-R * 0.92} y={-R * 0.34} width={R * 1.84} height={R * 0.68} rx={R * 0.34} fill={pal.fill} stroke={s} strokeWidth="2" />);
      g.push(<polygon key="mt" points={`${-R * 0.3},0 ${R * 0.3},${-R * 0.22} ${R * 0.3},${R * 0.22}`} fill="none" stroke={pal.dim} strokeWidth="1.2" />);
      break;
    case 'coral':
      g.push(<rect key="c" x={-R * 0.66} y={-R * 0.5} width={R * 1.32} height={R} rx="2" fill="none" stroke={s} strokeWidth="1.8" />);
      g.push(<line key="cl" x1={-R * 0.4} y1={R * 0.3} x2={R * 0.4} y2={-R * 0.3} stroke={s} strokeWidth="3.5" strokeLinecap="round" />);
      break;
    case 'banana':
      g.push(<path key="ba" d={`M${-R * 0.8},${R * 0.5} Q0,${-R * 0.95} ${R * 0.8},${R * 0.5}`} fill="none" stroke={s} strokeWidth={R * 0.4} strokeLinecap="round" />);
      break;
    case 'ledge': {                        // long narrow shelf
      g.push(<rect key="lg" x={-R * 0.98} y={-R * 0.24} width={R * 1.96} height={R * 0.48} rx="4" fill={pal.fillHi} stroke={s} strokeWidth="2" />);
      [-0.8, -0.27, 0.27, 0.8].forEach((o, i) => g.push(<rect key={'lp' + i} x={o * R - 3} y={-3} width="6" height="6" fill={s} />));
      break;
    }
    case 'archway': {                      // portal / swim-through
      g.push(<rect key="aw" x={-R * 0.8} y={-R * 0.5} width={R * 1.6} height={R} rx="3" fill={pal.fill} stroke={s} strokeWidth="2" />);
      g.push(<path key="awo" d={`M${-R * 0.4},${R * 0.5} L${-R * 0.4},${-R * 0.08} Q0,${-R * 0.5} ${R * 0.4},${-R * 0.08} L${R * 0.4},${R * 0.5}`} fill="none" stroke={pal.accent} strokeWidth="1.5" opacity="0.9" />);
      break;
    }
    case 'spire': {                        // twisting helix
      let d = 'M0,' + (R * 0.9).toFixed(1); const turns = 2.4, N = 44;
      for (let k = 1; k <= N; k++) { const tt = k / N; const ang = tt * turns * Math.PI * 2; const rr = R * 0.9 * (1 - tt * 0.82); d += ` L${(Math.cos(ang) * rr).toFixed(1)},${(Math.sin(ang) * rr).toFixed(1)}`; }
      g.push(<path key="sp" d={d} fill="none" stroke={s} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />);
      g.push(<circle key="spc" r="2.6" fill={s} />);
      break;
    }
    case 'organpipes': {                   // tube cluster
      [[-0.62, -0.32, 0.42], [-0.05, 0.05, 0.5], [0.55, -0.2, 0.44], [0.18, 0.58, 0.34], [-0.5, 0.5, 0.36], [0.66, 0.5, 0.3]].forEach((c, i) => {
        g.push(<circle key={'op' + i} cx={c[0] * R} cy={c[1] * R} r={c[2] * R * 0.5} fill={pal.fill} stroke={s} strokeWidth="1.8" />);
        g.push(<circle key={'opi' + i} cx={c[0] * R} cy={c[1] * R} r={c[2] * R * 0.24} fill="none" stroke={pal.dim} strokeWidth="1" />);
      });
      break;
    }
    default: g.push(sq(R * 0.7));
  }
  return g;
}

/* ============================================================
   SIDE block glyph (section) — base at (cx, baseY)
   ============================================================ */
function blockSide(block, cx, baseY, pal, HSC, key, scale) {
  const s = blockStroke(block, pal);
  const sc = scale || 1;
  const g = [];
  const w = block.r * 1.7 * sc;
  const H = block.h * HSC * sc;
  const topY = baseY - H;
  g.push(<polygon key={key + 'wf'} points={`${cx - w / 2},${baseY} ${cx + w / 2},${baseY + 4} ${cx + w / 2},${baseY - 8} ${cx - w / 2},${baseY - 8}`} fill={pal.fill} stroke={pal.dim} strokeWidth="1.2" />);
  for (let i = 0; i < 5; i++) g.push(<circle key={key + 'ap' + i} cx={cx + w / 2 + 4 + i * 7} cy={baseY + 3 + i * 1.2} r="1.4" fill={pal.amber} opacity="0.7" />);
  const base = baseY - 8;
  switch (block.id) {
    case 'table': {
      const slabY = base - H * 0.82;
      [cx - w / 2 + 6, cx - 6, cx + 6, cx + w / 2 - 6].forEach((lx, i) => g.push(<line key={key + 'lg' + i} x1={lx} y1={base} x2={lx} y2={slabY} stroke={s} strokeWidth={i === 0 || i === 3 ? 3 : 2} />));
      g.push(<rect key={key + 'sl'} x={cx - w / 2 - 6} y={slabY - 11} width={w + 12} height="11" rx="2" fill={pal.fillHi} stroke={s} strokeWidth="1.8" />);
      break;
    }
    case 'monolith': {
      const steps = 3;
      for (let i = 0; i < steps; i++) { const bw = w * (1 - i * 0.24), y2 = base - i * (H / steps), y1 = y2 - H / steps; const tw = bw - w * 0.18; g.push(<polygon key={key + 'mo' + i} points={`${cx - bw / 2},${y2} ${cx + bw / 2},${y2} ${cx + tw / 2},${y1} ${cx - tw / 2},${y1}`} fill={pal.fill} stroke={s} strokeWidth="1.8" />); }
      break;
    }
    case 'aframe':
      g.push(<polygon key={key + 'af'} points={`${cx - w / 2},${base} ${cx + w / 2},${base} ${cx},${topY}`} fill={pal.fill} stroke={s} strokeWidth="1.8" />);
      break;
    case 'dome': {                          // stacked arched tiers
      const tiers = 3;
      for (let i = 0; i < tiers; i++) { const tw = w * (1 - i * 0.26); const ty = base - i * (H / tiers); const th = H / tiers + 6;
        g.push(<path key={key + 'dm' + i} d={`M${cx - tw / 2},${ty} a${tw / 2},${th} 0 0 1 ${tw},0 Z`} fill={i === 0 ? pal.fill : pal.fillHi} stroke={s} strokeWidth="1.7" />); }
      break;
    }
    case 'tree': {                          // trunk + branches
      g.push(<line key={key + 'tk'} x1={cx} y1={base} x2={cx} y2={topY + H * 0.1} stroke={s} strokeWidth="3.4" strokeLinecap="round" />);
      const lv = [0.32, 0.56, 0.78];
      lv.forEach((t, i) => { const by = base - H * t; const len = w * (0.5 - i * 0.1);
        g.push(<path key={key + 'bl' + i} d={`M${cx},${by} q${-len * 0.5},${-6} ${-len},${-len * 0.5}`} fill="none" stroke={s} strokeWidth="2.2" strokeLinecap="round" />);
        g.push(<path key={key + 'br' + i} d={`M${cx},${by} q${len * 0.5},${-6} ${len},${-len * 0.5}`} fill="none" stroke={s} strokeWidth="2.2" strokeLinecap="round" />);
        g.push(<circle key={key + 'bnl' + i} cx={cx - len} cy={by - len * 0.5} r="3" fill={s} />);
        g.push(<circle key={key + 'bnr' + i} cx={cx + len} cy={by - len * 0.5} r="3" fill={s} />);
      });
      g.push(<circle key={key + 'top'} cx={cx} cy={topY + H * 0.1} r="3.4" fill={s} />);
      break;
    }
    case 'cathedral': {                     // arched-window block
      g.push(<path key={key + 'ct'} d={`M${cx - w / 2},${base} L${cx - w / 2},${base - H * 0.62} Q${cx},${base - H * 1.06} ${cx + w / 2},${base - H * 0.62} L${cx + w / 2},${base} Z`} fill={pal.fill} stroke={s} strokeWidth="1.9" />);
      [-1, 0, 1].forEach((o, i) => { const ax = cx + o * w * 0.3; g.push(<path key={key + 'ar' + i} d={`M${ax - w * 0.1},${base} L${ax - w * 0.1},${base - H * 0.4} Q${ax},${base - H * 0.6} ${ax + w * 0.1},${base - H * 0.4} L${ax + w * 0.1},${base} Z`} fill="none" stroke={pal.accent} strokeWidth="1.3" opacity="0.85" />); });
      break;
    }
    case 'reefball':
      g.push(<path key={key + 'rb'} d={`M${cx - w * 0.42},${base} a${w * 0.42},${H} 0 0 1 ${w * 0.84},0 Z`} fill={pal.fillHi} stroke={s} strokeWidth="1.8" />);
      g.push(<circle key={key + 'rbh'} cx={cx} cy={base - H * 0.4} r="2.6" fill="none" stroke={pal.dim} strokeWidth="1.1" />);
      break;
    case 'puka':
      g.push(<rect key={key + 'pk'} x={cx - w / 2} y={base - H} width={w} height={H} rx="2" fill={pal.fill} stroke={s} strokeWidth="1.8" />);
      g.push(pukaGrid(cx, base - H / 2, w - 8, H - 8, pal.accent, key + 'pkg'));
      break;
    case 'tube':
      g.push(<ellipse key={key + 'tu'} cx={cx} cy={base - H * 0.5} rx={w * 0.42} ry={H * 0.5} fill={pal.fill} stroke={s} strokeWidth="1.8" />);
      g.push(<ellipse key={key + 'tui'} cx={cx} cy={base - H * 0.5} rx={w * 0.2} ry={H * 0.26} fill="none" stroke={pal.dim} strokeWidth="1.2" />);
      break;
    case 'menpachi':
      g.push(<polygon key={key + 'me'} points={`${cx - w / 2},${base} ${cx + w / 2},${base} ${cx - w * 0.2},${base - H}`} fill={pal.fill} stroke={s} strokeWidth="1.8" />);
      break;
    case 'coral':
      g.push(<line key={key + 'co'} x1={cx - w * 0.4} y1={base - 2} x2={cx + w * 0.4} y2={base - H} stroke={s} strokeWidth="4" strokeLinecap="round" />);
      break;
    case 'banana':
      g.push(<path key={key + 'ba'} d={`M${cx - w * 0.46},${base} A${w * 0.46},${H} 0 0 1 ${cx + w * 0.46},${base}`} fill="none" stroke={s} strokeWidth="6" strokeLinecap="round" />);
      break;
    case 'ledge': {                         // shelf slab on short posts
      const slabY = base - H * 0.72;
      [cx - w / 2 + 8, cx - w * 0.16, cx + w * 0.16, cx + w / 2 - 8].forEach((lx, i) => g.push(<line key={key + 'lp' + i} x1={lx} y1={base} x2={lx} y2={slabY} stroke={s} strokeWidth="2" />));
      g.push(<rect key={key + 'ls'} x={cx - w / 2 - 4} y={slabY - 9} width={w + 8} height="9" rx="2" fill={pal.fillHi} stroke={s} strokeWidth="1.8" />);
      break;
    }
    case 'archway': {                       // open portal
      const legW = w * 0.18;
      g.push(<path key={key + 'aw'} d={`M${cx - w / 2},${base} L${cx - w / 2},${base - H * 0.5} Q${cx},${base - H * 1.04} ${cx + w / 2},${base - H * 0.5} L${cx + w / 2},${base} L${cx + w / 2 - legW},${base} L${cx + w / 2 - legW},${base - H * 0.46} Q${cx},${base - H * 0.78} ${cx - w / 2 + legW},${base - H * 0.46} L${cx - w / 2 + legW},${base} Z`} fill={pal.fill} stroke={s} strokeWidth="1.8" />);
      break;
    }
    case 'spire': {                         // twisting taper
      let d = `M${cx},${base}`; const N = 24;
      for (let k = 1; k <= N; k++) { const tt = k / N; const yy = base - H * tt; const xx = cx + Math.sin(tt * Math.PI * 4) * w * 0.26 * (1 - tt * 0.5); d += ` L${xx.toFixed(1)},${yy.toFixed(1)}`; }
      g.push(<path key={key + 'sp'} d={d} fill="none" stroke={s} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />);
      break;
    }
    case 'organpipes': {                    // pipes of varied height
      const hs = [0.96, 0.62, 0.82, 0.5, 0.7]; const n = hs.length; const pw = w / n;
      for (let i = 0; i < n; i++) { const px = cx - w / 2 + (i + 0.5) * pw; const ph = H * hs[i]; g.push(<rect key={key + 'op' + i} x={px - pw * 0.34} y={base - ph} width={pw * 0.68} height={ph} rx={pw * 0.34} fill={pal.fill} stroke={s} strokeWidth="1.6" />); }
      break;
    }
    default: break;
  }
  return <g key={key}>{g}</g>;
}

function msWave(x0, x1, y, amp) { const a = amp || 6; let d = `M${x0},${y}`; for (let x = x0; x <= x1; x += 24) d += ` q12,${-a} 24,0`; return d; }

/* ============================================================
   PLAN VIEW — drag-to-place layout editor (sloped depth)
   ============================================================ */
const PLAN = { FX: 470, FZ: 280, SC: 1.55, CX: 470, CY: 280 };
function PlanView({ site, placed, style, selectedUid, onMove, onSelect, onRemove, onScale, tweaks, flowOn }) {
  const tw = tweaks || {};
  const pal = paletteFor(style, tw.mood);
  const svgRef = useRefV(null);
  const worldRef = useRefV(null);
  const drag = useRefV(null);
  const resize = useRefV(null);
  const pan = useRefV(null);
  const ptrs = useRefV(new Map());
  const pinch = useRefV(null);
  const RB = window.REEF;
  const FP = RB.FP, MIN_S = RB.MIN_S, MAX_S = RB.MAX_S;
  const [cam, setCam] = useStateV({ x: 0, y: 0, z: 0.82 });
  placed = placed || [];

  const w2s = (x, z) => [PLAN.FX + x * PLAN.SC, PLAN.FZ + z * PLAN.SC];
  // client → world using the live transform of the world group (handles pan/zoom)
  const clientToWorld = (cx, cy) => {
    const g = worldRef.current || svgRef.current; const pt = svgRef.current.createSVGPoint(); pt.x = cx; pt.y = cy;
    const p = pt.matrixTransform(g.getScreenCTM().inverse());
    return [(p.x - PLAN.FX) / PLAN.SC, (p.y - PLAN.FZ) / PLAN.SC];
  };
  const startDrag = (e, p) => {
    e.stopPropagation(); onSelect(p.uid);
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    const [wx, wz] = clientToWorld(e.clientX, e.clientY);
    drag.current = { uid: p.uid, ox: p.x - wx, oz: p.z - wz };
  };
  const startResize = (e, p) => {
    e.stopPropagation(); onSelect(p.uid);
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    const [wx, wz] = clientToWorld(e.clientX, e.clientY);
    resize.current = { uid: p.uid, cx: p.x, cz: p.z, d0: Math.max(6, Math.hypot(wx - p.x, wz - p.z)), s0: p.s || 1 };
  };
  const bgDown = (e) => {
    onSelect(null); try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.z };
      pan.current = null;
    } else {
      pan.current = { sx: e.clientX, sy: e.clientY, x0: cam.x, y0: cam.y };
    }
  };
  const onMoveSvg = (e) => {
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const nz = clampZ(pinch.current.z0 * (d / Math.max(20, pinch.current.d0)));
      setCam((c) => ({ ...c, z: nz }));
      return;
    }
    if (resize.current) {
      const [wx, wz] = clientToWorld(e.clientX, e.clientY);
      const d = Math.hypot(wx - resize.current.cx, wz - resize.current.cz);
      let sc = resize.current.s0 * (d / resize.current.d0);
      sc = Math.max(MIN_S, Math.min(MAX_S, Math.round(sc / 0.05) * 0.05));
      onScale(resize.current.uid, sc); return;
    }
    if (drag.current) {
      const [wx, wz] = clientToWorld(e.clientX, e.clientY);
      const nx = Math.max(-FP, Math.min(FP, wx + drag.current.ox));
      const nz = Math.max(-FP, Math.min(FP, wz + drag.current.oz));
      onMove(drag.current.uid, Math.round(nx), Math.round(nz)); return;
    }
    if (pan.current) { const nx = pan.current.x0 + (e.clientX - pan.current.sx), ny = pan.current.y0 + (e.clientY - pan.current.sy); setCam((c) => ({ ...c, x: nx, y: ny })); }
  };
  const endDrag = (e) => { drag.current = null; resize.current = null; pan.current = null; if (e) ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };
  const ZMIN = 0.45, ZMAX = 3;
  const clampZ = (z) => Math.max(ZMIN, Math.min(ZMAX, z));
  const svgPoint = (cx, cy) => { const pt = svgRef.current.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svgRef.current.getScreenCTM().inverse()); };
  // zoom keeping the point (px,py) — in svg viewBox coords — fixed on screen
  const zoomAt = (px, py, factor) => setCam((c) => {
    const z2 = clampZ(c.z * factor); if (z2 === c.z) return c;
    const u = (px - c.x - PLAN.CX) / c.z + PLAN.CX;
    const v = (py - c.y - PLAN.CY) / c.z + PLAN.CY;
    return { x: px - PLAN.CX - z2 * (u - PLAN.CX), y: py - PLAN.CY - z2 * (v - PLAN.CY), z: z2 };
  });
  const onWheel = (e) => { const p = svgPoint(e.clientX, e.clientY); zoomAt(p.x, p.y, 1 - e.deltaY * 0.0012); };
  const zoomBy = (f) => zoomAt(PLAN.CX, PLAN.CY, f);
  const resetView = () => setCam({ x: 0, y: 0, z: 0.82 });

  const sel = placed.find((p) => p.uid === selectedUid);
  const stack = RB.stackBases(placed);
  const field = useMemoV(() => {
    if (!flowOn) return null;
    const region = window.ReefFlow.regionFor(placed, RB.BLOCK_BY_ID);
    return window.ReefFlow.solve(placed, site.heading, site.speed, region, RB.BLOCK_BY_ID);
  }, [flowOn, placed, site.heading, site.speed]);

  // depth contour ticks — adaptive step for gentle ranges
  const range = site.deep - site.shallow;
  const dstep = range <= 30 ? 5 : range <= 70 ? 10 : 20;
  const ticks = [];
  const lo = Math.ceil(site.shallow / dstep) * dstep, hi = Math.floor(site.deep / dstep) * dstep;
  for (let d = lo; d <= hi; d += dstep) { const z = RB.zForDepth(site, d); ticks.push({ d, y: w2s(0, z)[1] }); }

  // large seabed field extents (well beyond FP so panning/zooming stays filled)
  const F = FP * 2;
  const fld = { x: w2s(-F, -F)[0], y: w2s(-F, -F)[1], w: 2 * F * PLAN.SC, h: 2 * F * PLAN.SC };
  const headingDeg = site.heading;
  const worldT = `translate(${cam.x},${cam.y}) translate(${PLAN.CX},${PLAN.CY}) scale(${cam.z}) translate(${-PLAN.CX},${-PLAN.CY})`;

  return (
    <svg ref={svgRef} viewBox="0 0 940 560" className="stage-svg" preserveAspectRatio="xMidYMid meet"
      style={{ touchAction: 'none', cursor: 'grab' }} onPointerDown={bgDown} onPointerMove={onMoveSvg} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={onWheel}>
      <ReefDefs pal={pal} />

      <g ref={worldRef} transform={worldT}>
        {/* depth gradient + contour lines across the open seabed */}
        <rect x={fld.x} y={fld.y} width={fld.w} height={fld.h} fill="url(#depthGrad)" />
        {ticks.map((t) => <g key={t.d}>
          <line x1={fld.x} y1={t.y} x2={fld.x + fld.w} y2={t.y} stroke={pal.faint} strokeWidth="1" opacity="0.7" />
          <text x={w2s(-FP * 0.96, 0)[0]} y={t.y - 4} className="svg-mono" fill={pal.dim} fontSize="10.5">{t.d} ft</text>
        </g>)}
        {/* faint along-shore reference lines */}
        {[-240, -120, 0, 120, 240].map((g) => <line key={g} x1={w2s(g, -F)[0]} y1={fld.y} x2={w2s(g, F)[0]} y2={fld.y + fld.h} stroke={pal.faint} strokeWidth="1" opacity="0.25" />)}

        {/* current — ambient arrows or computed streamlines */}
        {!flowOn && <AmbientCurrent heading={headingDeg} speed={site.speed} fld={fld} pal={pal} />}
        {flowOn && field && <FlowLayer field={field} placed={placed} site={site} w2s={w2s} pal={pal} />}

        {/* placed blocks */}
        {placed.map((p) => {
          const blk = RB.BLOCK_BY_ID[p.block];
          const [sx, sy] = w2s(p.x, p.z);
          const R = blk.r * PLAN.SC * 0.62 * (p.s || 1);
          const isSel = p.uid === selectedUid;
          const isStacked = stack.base[p.uid] > 0.5;
          const depth = RB.depthAt(site, p.z);
          return (
            <g key={p.uid} transform={`translate(${sx},${sy})`} style={{ cursor: 'grab' }} onPointerDown={(e) => startDrag(e, p)}>
              {isSel && <circle r={R + 12} fill="rgba(109,179,232,0.10)" stroke={pal.accent} strokeWidth="1.6" strokeDasharray="4 3" />}
              {blockTop(blk, R, pal)}
              <text x="0" y={R + 16} textAnchor="middle" className="svg-mono" fill={isSel ? pal.line : pal.dim} fontSize="10.5">{blk.name}{(p.s || 1) !== 1 ? ` ${(p.s || 1).toFixed(1)}×` : ''}</text>
              <text x="0" y={R + 28} textAnchor="middle" className="svg-mono" fill={pal.accent} fontSize="9.5" opacity="0.9">≈{depth} ft</text>
              {isStacked && <g transform={`translate(${-R - 6},${-R - 6})`}><rect x="-20" y="-9" width="40" height="15" rx="7" fill={pal.amber} opacity="0.92" /><text x="0" y="2" textAnchor="middle" className="svg-mono" fill="#0a1f3c" fontSize="8.5" fontWeight="700">STACKED</text></g>}
              {isSel && <g transform={`translate(${R + 12},${-R - 12})`} style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onRemove(p.uid); }}>
                <circle r="9" fill={pal.bad} /><path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" stroke="#0a1f3c" strokeWidth="2" /></g>}
              {isSel && <g transform={`translate(${R + 11},${R + 11})`} style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => startResize(e, p)}>
                <circle r="9" fill={pal.accent} /><path d="M-4,-1 L-4,4 L1,4 M-4.5,4.5 L4,-4" stroke="#0a1f3c" strokeWidth="1.6" fill="none" /></g>}
            </g>
          );
        })}
      </g>

      {/* ---- fixed screen-space overlays ---- */}
      <text x="22" y="30" className="svg-mono" fill={pal.accent} fontSize="11">↑ shallower ≈{site.shallow} ft · drag offshore to go deeper · ≈{site.deep} ft ↓</text>
      {placed.length === 0 && <text x="470" y="280" textAnchor="middle" className="svg-mono" fill={pal.dim} fontSize="14">tap a block on the right to add it →</text>}
      {sel && <text x="22" y="544" className="svg-mono" fill={pal.accent} fontSize="11">selected: {RB.BLOCK_BY_ID[sel.block].name} · ≈{RB.depthAt(site, sel.z)} ft · {(sel.s || 1).toFixed(2)}× · drag ⟲ to resize · overlap another block to stack</text>}

      {/* zoom + pan controls */}
      <g className="planzoom" transform="translate(884,470)">
        <g onPointerDown={(e) => { e.stopPropagation(); zoomBy(1.2); }} style={{ cursor: 'pointer' }}><rect x="-15" y="-46" width="30" height="28" rx="6" fill="rgba(8,22,44,0.8)" stroke={pal.faint} /><text x="0" y="-27" textAnchor="middle" className="svg-mono" fill={pal.line} fontSize="17">+</text></g>
        <g onPointerDown={(e) => { e.stopPropagation(); zoomBy(0.83); }} style={{ cursor: 'pointer' }}><rect x="-15" y="-15" width="30" height="28" rx="6" fill="rgba(8,22,44,0.8)" stroke={pal.faint} /><text x="0" y="5" textAnchor="middle" className="svg-mono" fill={pal.line} fontSize="17">–</text></g>
        <g onPointerDown={(e) => { e.stopPropagation(); resetView(); }} style={{ cursor: 'pointer' }}><rect x="-15" y="18" width="30" height="24" rx="6" fill="rgba(8,22,44,0.8)" stroke={pal.faint} /><text x="0" y="34" textAnchor="middle" className="svg-mono" fill={pal.dim} fontSize="9">FIT</text></g>
      </g>

      {/* compass — rotates with current heading */}
      <g transform="translate(884,128)">
        <circle r="26" fill="rgba(8,22,44,0.6)" stroke={pal.dim} strokeWidth="1.3" />
        <line x1="0" y1="26" x2="0" y2="-26" stroke={pal.faint} strokeWidth="1" />
        <text x="0" y="-30" textAnchor="middle" className="svg-mono" fill={pal.dim} fontSize="10">N</text>
        <g transform={`rotate(${headingDeg})`}><path d="M22,0 l-7,-4 M22,0 l-7,4 M-18,0 H22" stroke={pal.accent} strokeWidth="2" fill="none" /></g>
        <text x="0" y="44" textAnchor="middle" className="svg-mono" fill={pal.accent} fontSize="9">current</text>
      </g>
      <text x="918" y="544" textAnchor="end" className="svg-mono" fill={pal.dim} fontSize="9.5" opacity="0.7">drag empty water to pan · scroll to zoom</text>
    </svg>
  );
}

/* ============================================================
   SECTION VIEW — across-slope cut, depth from site slope
   ============================================================ */
function SectionView({ site, placed, style, tweaks }) {
  const tw = tweaks || {};
  const pal = paletteFor(style, tw.mood);
  const sea = tw.sea || 0;
  const W = 940, H = 560;
  const RB = window.REEF;
  placed = placed || [];
  const maxD = Math.max(110, site.deep + 12);
  const depthToY = (d) => 92 + d * (336 / maxD);
  const cx0 = 80, cx1 = 884;
  // x position from offshore z; seabed slopes down to the right (offshore = deeper)
  const zToX = (z) => cx0 + (z + RB.FP) / (2 * RB.FP) * (cx1 - cx0);
  const seabedY = (z) => depthToY(RB.depthAt(site, z));
  const stack = RB.stackBases(placed);
  const els = [];

  // depth ruler
  const rstep = maxD > 80 ? 20 : 10;
  for (let d = 0; d <= maxD; d += rstep) { const y = depthToY(d); els.push(<line key={'r' + d} x1="54" y1={y} x2="62" y2={y} stroke={pal.dim} strokeWidth="1.4" />); els.push(<text key={'rt' + d} x="48" y={y + 4} textAnchor="end" className="svg-mono" fill={pal.dim} fontSize="12.5">{d} ft</text>); }
  els.push(<line key="rl" x1="58" y1={depthToY(0)} x2="58" y2={depthToY(maxD)} stroke={pal.faint} strokeWidth="1" />);

  // seabed line from shallow (left) to deep (right)
  const sb = []; for (let z = -RB.FP; z <= RB.FP; z += 8) sb.push(`${zToX(z)},${seabedY(z)}`);
  els.push(<polyline key="sb" points={sb.join(' ')} fill="none" stroke={pal.line} strokeWidth="2" />);
  els.push(<path key="sbf" d={`M${zToX(-RB.FP)},${seabedY(-RB.FP)} ${sb.map((p) => 'L' + p).join(' ')} L${zToX(RB.FP)},${H} L${zToX(-RB.FP)},${H} Z`} fill="url(#sand)" opacity="0.7" />);
  els.push(<text key="sbl" x={cx0 + 14} y={seabedY(-RB.FP) + 24} className="svg-mono" fill={pal.dim} fontSize="12">shore side · ≈{site.shallow} ft</text>);
  els.push(<text key="sbr" x={cx1 - 14} y={seabedY(RB.FP) - 12} textAnchor="end" className="svg-mono" fill={pal.dim} fontSize="12">offshore · ≈{site.deep} ft</text>);

  // blocks placed by z (upslope drawn behind), stacking-aware
  const HSC = 0.62;
  const sorted = placed.slice().sort((a, b) => a.z - b.z);
  sorted.forEach((p) => {
    const blk = RB.BLOCK_BY_ID[p.block];
    const sx = zToX(p.z) + p.x * 0.12;
    const by = seabedY(p.z) - stack.base[p.uid] * HSC;
    els.push(blockSide(blk, sx, by, pal, HSC, 'bk' + p.uid, p.s));
  });

  const cDepthY = depthToY((site.shallow + site.deep) / 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg" preserveAspectRatio="xMidYMid meet">
      <ReefDefs pal={pal} />
      <path d={msWave(60, 900, 50, 6 * (1 + sea * 1.8))} fill="none" stroke={pal.accent} strokeWidth="2" opacity="0.8" />
      <text x="66" y="42" className="svg-mono" fill={pal.dim} fontSize="12.5">MEAN SEA LEVEL</text>
      <OutOfPage y={cDepthY - 96} x0={150} x1={740} count={6 + Math.round(sea * 6)} pal={pal} />
      <text x="150" y={cDepthY - 116} className="svg-mono" fill={pal.accent} fontSize="12" opacity="0.9">current {site.heading}° · ≈{site.speed.toFixed(2)} rel · cut runs across the slope</text>
      {els}
      {placed.length === 0 && <text x={W / 2} y={cDepthY - 30} textAnchor="middle" className="svg-mono" fill={pal.dim} fontSize="14">add blocks to see the profile</text>}
      <text x={W / 2} y={H - 14} textAnchor="middle" className="svg-mono" fill={pal.line} fontSize="13">across-slope cut · ≈{site.shallow}–{site.deep} ft · every block wedged level · stacks ride on top</text>
    </svg>
  );
}

window.ReefViews = Object.assign(window.ReefViews || {}, { paletteFor, PlanView, SectionView, blockTop });
