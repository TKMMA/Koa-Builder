/* ============================================================
   KOA BUILDER — Orbit 3-D model (CAD-style) over placed blocks
   v3: stacking (blocks ride on blocks) · heading-aware current ·
       organic forms (dome / tree / cathedral)
   Drag empty space = orbit · drag a block = move it on the bed
   scroll/pinch = zoom · view presets · wireframe · gizmo · dims
   Exposes window.ReefViews.OrbitView
   ============================================================ */
const { useState: useStateO, useRef: useRefO, useMemo: useMemoO, useEffect: useEffectO } = React;

/* ---------- primitive face builders ---------- */
function tintSet(base, fun, amber, life) {
  if (fun) return { top: '#f3cf63', x: '#d9a93f', z: '#b98a2e', bot: '#8f6a1f' };
  if (life) return { top: 'rgba(116,210,162,0.5)', x: 'rgba(86,178,130,0.46)', z: 'rgba(56,140,100,0.5)', bot: 'rgba(40,104,72,0.55)' };
  if (amber) return { top: 'rgba(232,168,73,0.55)', x: 'rgba(200,140,55,0.5)', z: 'rgba(170,115,40,0.55)', bot: 'rgba(140,95,30,0.6)' };
  return { top: base.fillHi, x: 'rgba(96,150,205,0.40)', z: 'rgba(40,86,150,0.46)', bot: 'rgba(20,50,96,0.55)' };
}
function pushBox(F, cx, yBase, cz, w, h, d, t, edge) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = yBase, y1 = yBase + h, z0 = cz - d / 2, z1 = cz + d / 2;
  F.push({ pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], fill: t.top, edge });
  F.push({ pts: [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], fill: t.bot, edge });
  F.push({ pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], fill: t.x, edge });
  F.push({ pts: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], fill: t.x, edge });
  F.push({ pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill: t.z, edge });
  F.push({ pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], fill: t.z, edge });
}
function pushPrismX(F, cx, cy, cz, len, r, seg, t, edge) {
  const L = [], R = [];
  for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; const y = cy + r * Math.cos(a), z = cz + r * Math.sin(a); L.push([cx - len / 2, y, z]); R.push([cx + len / 2, y, z]); }
  for (let k = 0; k < seg; k++) { const n = (k + 1) % seg; F.push({ pts: [L[k], R[k], R[n], L[n]], fill: t.z, edge }); }
  F.push({ pts: L.slice().reverse(), fill: t.x, edge }); F.push({ pts: R.slice(), fill: t.x, edge });
}
function pushPrismY(F, cx, yBase, cz, h, r, seg, t, edge) {     // vertical prism (branches/trunk)
  const lo = [], hi = [];
  for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; lo.push([cx + r * Math.cos(a), yBase, cz + r * Math.sin(a)]); hi.push([cx + r * Math.cos(a), yBase + h, cz + r * Math.sin(a)]); }
  for (let k = 0; k < seg; k++) { const n = (k + 1) % seg; F.push({ pts: [lo[k], lo[n], hi[n], hi[k]], fill: t.z, edge }); }
  F.push({ pts: hi.slice(), fill: t.top, edge });
}
function pushFrustum(F, cx, yBase, cz, r1, r2, h, seg, t, edge) {
  const lo = [], hi = [];
  for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2 + Math.PI / seg; lo.push([cx + r1 * Math.cos(a), yBase, cz + r1 * Math.sin(a)]); hi.push([cx + r2 * Math.cos(a), yBase + h, cz + r2 * Math.sin(a)]); }
  for (let k = 0; k < seg; k++) { const n = (k + 1) % seg; F.push({ pts: [lo[k], lo[n], hi[n], hi[k]], fill: t.z, edge }); }
  F.push({ pts: hi.slice(), fill: t.top, edge });
}
function pushTent(F, cx, cz, len, baseW, h, t, edge, y0) {
  y0 = y0 || 0;
  const xa = cx - len / 2, xb = cx + len / 2, z0 = cz - baseW / 2, z1 = cz + baseW / 2;
  const apexA = [xa, y0 + h, cz], apexB = [xb, y0 + h, cz];
  F.push({ pts: [[xa, y0, z1], [xb, y0, z1], apexB, apexA], fill: t.z, edge });
  F.push({ pts: [[xb, y0, z0], [xa, y0, z0], apexA, apexB], fill: t.x, edge });
  F.push({ pts: [apexA, [xa, y0, z0], [xa, y0, z1]], fill: t.bot, edge });
  F.push({ pts: [apexB, [xb, y0, z1], [xb, y0, z0]], fill: t.bot, edge });
}
function pushBanana(F, cx, cy, cz, t, edge) {
  const R1 = 26, R2 = 40, w = 22, S = 9, t0 = 0.25, t1 = Math.PI - 0.25;
  const zF = cz + w / 2, zB = cz - w / 2; const outF = [], inF = [], outB = [], inB = [];
  for (let k = 0; k <= S; k++) { const a = t0 + (t1 - t0) * (k / S); const ox = cx + R2 * Math.cos(a), oy = cy + R2 * Math.sin(a), ix = cx + R1 * Math.cos(a), iy = cy + R1 * Math.sin(a); outF.push([ox, oy, zF]); inF.push([ix, iy, zF]); outB.push([ox, oy, zB]); inB.push([ix, iy, zB]); }
  F.push({ pts: outF.concat(inF.slice().reverse()), fill: t.top, edge }); F.push({ pts: outB.concat(inB.slice().reverse()), fill: t.top, edge });
  for (let k = 0; k < S; k++) { F.push({ pts: [outF[k], outF[k + 1], outB[k + 1], outB[k]], fill: t.x, edge }); F.push({ pts: [inB[k], inB[k + 1], inF[k + 1], inF[k]], fill: t.z, edge }); }
  F.push({ pts: [outF[0], inF[0], inB[0], outB[0]], fill: t.bot, edge }); F.push({ pts: [outF[S], outB[S], inB[S], inF[S]], fill: t.bot, edge });
}

/* ---------- one block at (x,z) on top of startY ---------- */
function buildBlock(F, apron, blk, x, z, sc, pal, startY) {
  startY = startY || 0;
  const edge = blk.color === 'amber' ? pal.amber : blk.color === 'banana' ? pal.banana : blk.color === 'life' ? pal.life : pal.line;
  const T = tintSet(pal, blk.color === 'banana', blk.color === 'amber', blk.color === 'life');
  const Tb = tintSet(pal, false, false);
  const padBlocks = ['table', 'monolith', 'aframe', 'reefball', 'puka', 'dome', 'cathedral', 'ledge', 'archway', 'organpipes'];
  const L = [];
  let baseY = 0;
  if (padBlocks.includes(blk.id)) { pushBox(L, 0, 0, 0, blk.r * 1.9, 10, blk.r * 1.9, Tb, edge); baseY = 10; }
  switch (blk.id) {
    case 'table': {
      const lh = 60; const W = 64;
      [[-W / 2 + 6, -W / 2 + 6], [W / 2 - 6, -W / 2 + 6], [-W / 2 + 6, W / 2 - 6], [W / 2 - 6, W / 2 - 6]].forEach((p) => pushBox(L, p[0], baseY, p[1], 12, lh, 12, T, edge));
      pushBox(L, 0, baseY + lh, 0, W + 22, 13, W + 22, T, edge); break;
    }
    case 'monolith': for (let i = 0; i < 3; i++) { const sk = i * 18; pushBox(L, 0, baseY + i * 22, 0, 62 - sk, 22, 62 - sk, T, edge); } break;
    case 'aframe': pushTent(L, 0, 0, 44, 44, 46, T, edge, baseY); break;
    case 'dome':                                   // layered wedding-cake dome
      pushFrustum(L, 0, baseY, 0, 30, 25, 18, 16, T, edge);
      pushFrustum(L, 0, baseY + 18, 0, 25, 18, 16, 16, T, edge);
      pushFrustum(L, 0, baseY + 34, 0, 18, 6, 16, 16, T, edge);
      break;
    case 'tree': {                                 // trunk + branches
      pushPrismY(L, 0, 0, 0, 70, 5, 7, T, edge);
      for (let i = 0; i < 3; i++) { const y = 22 + i * 17, o = 20 - i * 4;
        pushBox(L, o * 0.7, y, o * 0.7, 22, 6, 6, T, edge); pushBox(L, -o * 0.7, y + 4, -o * 0.7, 22, 6, 6, T, edge);
        pushBox(L, o * 0.7, y + 8, -o * 0.7, 6, 6, 22, T, edge); pushBox(L, -o * 0.7, y, o * 0.7, 6, 6, 22, T, edge);
      }
      pushFrustum(L, 0, 64, 0, 8, 2, 8, 8, T, edge);
      break;
    }
    case 'cathedral':                              // hex tower + tapered cap
      pushFrustum(L, 0, baseY, 0, 32, 29, 44, 6, T, edge);
      pushFrustum(L, 0, baseY + 44, 0, 29, 5, 14, 6, T, edge);
      break;
    case 'ledge': {                                // long flat shelf on posts
      [-30, -10, 10, 30].forEach((px) => pushBox(L, px, baseY, 0, 7, 14, 7, T, edge));
      pushBox(L, 0, baseY + 14, 0, 80, 9, 28, T, edge);
      break;
    }
    case 'archway':                                // portal: two legs + lintel
      pushBox(L, -20, baseY, 0, 11, 40, 20, T, edge);
      pushBox(L, 20, baseY, 0, 11, 40, 20, T, edge);
      pushBox(L, 0, baseY + 40, 0, 51, 12, 20, T, edge);
      break;
    case 'spire': {                                // twisting tapering column
      const N = 9;
      for (let i = 0; i < N; i++) { const tt = i / N; const a = tt * Math.PI * 2 * 1.6; const off = 8 * (1 - tt); const ww = 20 * (1 - tt * 0.66); pushBox(L, Math.cos(a) * off, i * 9, Math.sin(a) * off, ww, 10, ww, T, edge); }
      break;
    }
    case 'organpipes': {                           // cluster of vertical pipes
      [[-20, -8, 62], [2, 6, 46], [20, -6, 56], [8, 20, 40], [-14, 18, 50]].forEach((c) => pushPrismY(L, c[0], baseY, c[1], c[2], 6, 10, T, edge));
      break;
    }
    case 'reefball': pushFrustum(L, 0, baseY, 0, 22, 8, 28, 12, T, edge); break;
    case 'puka': pushBox(L, 0, baseY, 0, 46, 26, 30, T, edge); break;
    case 'tube': pushPrismX(L, 0, 11, 0, 42, 11, 14, T, edge); break;
    case 'menpachi': pushPrismX(L, 0, 9, 0, 84, 9, 3, T, edge); break;
    case 'coral': L.push({ pts: [[-22, 2, -16], [22, 10, -8], [22, 10, 16], [-22, 2, 8]], fill: pal.amber, edge: pal.amber, op: 0.6 }); break;
    case 'banana': pushBanana(L, 0, 2, 0, T, edge); break;
    default: break;
  }
  L.forEach((f) => F.push({ ...f, pts: f.pts.map((q) => [q[0] * sc + x, q[1] * sc + startY, q[2] * sc + z]) }));
  if (startY < 1) { const rr = blk.r * sc + 6; for (let a = 0; a < Math.PI * 2; a += 0.5) apron.push({ pt: [x + Math.cos(a) * rr, 0, z + Math.sin(a) * rr], fill: pal.amber }); }
}

function buildModel(placed, pal) {
  const F = [], apron = [];
  const stack = window.REEF.stackBases(placed || []);
  (placed || []).forEach((p) => { const blk = window.REEF.BLOCK_BY_ID[p.block]; if (blk) buildBlock(F, apron, blk, p.x, p.z, p.s || 1, pal, stack.base[p.uid]); });
  let H = 0; F.forEach((f) => f.pts.forEach((q) => { if (q[1] > H) H = q[1]; }));
  return { faces: F, apron, height: H };
}

/* ---------- math ---------- */
function rotP(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw); const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y1 = p[1];
  const cp = Math.cos(pitch), sp = Math.sin(pitch); return [x1, y1 * cp - z1 * sp, y1 * sp + z1 * cp];
}

function OrbitView({ site, placed, style, selectedUid, onMove, onSelect, tweaks, flowOn }) {
  const tw = tweaks || {};
  const pal = window.ReefViews.paletteFor(style, tw.mood);
  const [cam, setCam] = useStateO({ yaw: -0.62, pitch: 0.52, zoom: 1.7 });
  const [mode, setMode] = useStateO('solid');
  const svgRef = useRefO(null);
  const drag = useRefO(null);
  const ptrs = useRefO(new Map());
  const flowRef = useRefO(null);
  const O = { x: 470, y: 372 };
  placed = placed || [];

  const model = useMemoO(() => buildModel(placed, pal), [placed, style, tw.mood]);
  const stackB = useMemoO(() => window.REEF.stackBases(placed).base, [placed]);
  const proj = (p) => [O.x + p[0] * cam.zoom, O.y - p[1] * cam.zoom];
  const rp = (p) => rotP(p, cam.yaw, cam.pitch);

  const clientToVB = (cx, cy) => { const svg = svgRef.current; const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  const unground = (vx, vy) => {
    const X = (vx - O.x) / cam.zoom, Y = (O.y - vy) / cam.zoom;
    const sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const x = X * cy + (Y / sp) * sy, z = X * sy - (Y / sp) * cy; return [x, z];
  };
  const hitBlock = (vx, vy) => {
    let best = null, bd = Infinity;
    placed.forEach((p) => { const blk = window.REEF.BLOCK_BY_ID[p.block]; const s = proj(rp([p.x, (stackB[p.uid] || 0) + (blk.h || 20) * (p.s || 1) * 0.35, p.z])); const dd = Math.hypot(s[0] - vx, s[1] - vy); const thr = Math.max(30, blk.r * (p.s || 1) * cam.zoom * 0.95); if (dd < thr && dd < bd) { bd = dd; best = p; } });
    return best;
  };

  const onDown = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      const [vx, vy] = clientToVB(e.clientX, e.clientY);
      const hit = hitBlock(vx, vy);
      const canMove = hit && Math.abs(Math.sin(cam.pitch)) > 0.18;
      if (hit) onSelect(hit.uid);
      if (canMove) { const [wx, wz] = unground(vx, vy); drag.current = { mode: 'move', uid: hit.uid, ox: hit.x - wx, oz: hit.z - wz }; }
      else drag.current = { mode: 'orbit', x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
    }
  };
  const onMoveP = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.current && drag.current.pinch) { const z0 = drag.current.z0, p0 = drag.current.pinch; setCam((c) => ({ ...c, zoom: Math.max(0.8, Math.min(5, z0 * (dist / p0))) })); }
      else drag.current = { pinch: dist, z0: cam.zoom };
      return;
    }
    if (!drag.current) return;
    if (drag.current.mode === 'move') {
      const [vx, vy] = clientToVB(e.clientX, e.clientY); const [wx, wz] = unground(vx, vy);
      const FP = window.REEF.FP; const nx = Math.max(-FP, Math.min(FP, wx + drag.current.ox)), nz = Math.max(-FP, Math.min(FP, wz + drag.current.oz));
      onMove(drag.current.uid, Math.round(nx), Math.round(nz));
    } else if (drag.current.mode === 'orbit') {
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; const by = drag.current.yaw, bp = drag.current.pitch;
      setCam((c) => ({ ...c, yaw: by + dx * 0.01, pitch: Math.max(-0.2, Math.min(1.45, bp + dy * 0.008)) }));
    }
  };
  const onUp = (e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size === 0) drag.current = null; };
  const onWheel = (e) => { setCam((c) => { const z = c.zoom * (1 - e.deltaY * 0.0012); return { ...c, zoom: Math.max(0.8, Math.min(5, z)) }; }); };

  /* current drift — along the chosen heading */
  const rad = site.heading * Math.PI / 180;
  const flowDir = [Math.cos(rad), 0, Math.sin(rad)];
  useEffectO(() => {
    const rxw = rotP(flowDir, cam.yaw, cam.pitch); let dx = rxw[0] * cam.zoom, dy = -rxw[1] * cam.zoom; const Ln = Math.hypot(dx, dy) || 1; dx /= Ln; dy /= Ln;
    const S = 72; let ph = 0, raf; const sp = 0.5 * (0.4 + site.speed * 1.4);
    const step = () => { ph = (ph + sp) % S; if (flowRef.current) flowRef.current.setAttribute('transform', `translate(${dx * ph},${dy * ph})`); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [cam.yaw, cam.pitch, cam.zoom, site.speed, site.heading]);

  const rotated = model.faces.map((f) => { const r = f.pts.map(rp); const depth = r.reduce((a, p) => a + p[2], 0) / r.length; return { f, r, depth }; });
  rotated.sort((a, b) => a.depth - b.depth);
  const wire = mode === 'wire';
  const faceEls = rotated.map((it, i) => {
    const pts = it.r.map(proj).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    if (wire) return <polygon key={i} points={pts} fill="none" stroke={it.f.edge} strokeWidth="1" opacity="0.55" />;
    return <polygon key={i} points={pts} fill={it.f.fill} stroke={it.f.edge} strokeWidth="1.1" strokeLinejoin="round" opacity={it.f.op || 1} />;
  });

  const grid = []; const G = 240;
  for (let i = -G; i <= G; i += 40) {
    const a = proj(rp([i, 0, -G])), b = proj(rp([i, 0, G])), c = proj(rp([-G, 0, i])), d = proj(rp([G, 0, i]));
    grid.push(<line key={'gx' + i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={pal.faint} strokeWidth="1" />);
    grid.push(<line key={'gz' + i} x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} stroke={pal.faint} strokeWidth="1" />);
  }
  const apronEls = model.apron.map((a, i) => { const p = proj(rp(a.pt)); return <circle key={'ap' + i} cx={p[0]} cy={p[1]} r="1.8" fill={a.fill} opacity="0.6" />; });

  let selEls = null;
  const selP = placed.find((p) => p.uid === selectedUid);
  if (selP) { const blk = window.REEF.BLOCK_BY_ID[selP.block]; const rr = blk.r * (selP.s || 1) + 10; const ring = []; for (let a = 0; a < Math.PI * 2; a += 0.35) { const rp2 = proj(rp([selP.x + Math.cos(a) * rr, 0, selP.z + Math.sin(a) * rr])); ring.push(rp2.join(',')); } selEls = <polygon points={ring.join(' ')} fill="rgba(109,179,232,0.10)" stroke={pal.accent} strokeWidth="1.6" strokeDasharray="4 3" />; }

  let dimEls = null;
  if (model.height > 4) {
    const spec = window.REEF.spec(site, placed);
    const b0 = proj(rp([150, 0, 150])), b1 = proj(rp([150, model.height, 150]));
    dimEls = <g><line x1={b0[0]} y1={b0[1]} x2={b1[0]} y2={b1[1]} stroke={pal.dim} strokeWidth="1.2" /><line x1={b0[0] - 5} y1={b0[1]} x2={b0[0] + 5} y2={b0[1]} stroke={pal.dim} strokeWidth="1.2" /><line x1={b1[0] - 5} y1={b1[1]} x2={b1[0] + 5} y2={b1[1]} stroke={pal.dim} strokeWidth="1.2" /><text x={(b0[0] + b1[0]) / 2 + 8} y={(b0[1] + b1[1]) / 2} className="svg-mono" fill={pal.dim} fontSize="12.5">≈{spec.relief} ft</text></g>;
  }

  const rxv = rotP(flowDir, cam.yaw, cam.pitch); const inPlane = Math.hypot(rxv[0], rxv[1]);
  const cang = Math.atan2(-rxv[1], rxv[0]) * 180 / Math.PI; const my = proj(rp([0, model.height / 2 + 14, 0])); const chev = [];
  if (inPlane > 0.32) for (let k = -5; k <= 5; k++) { const cxp = my[0] + Math.cos(cang * Math.PI / 180) * k * 72, cyp = my[1] + Math.sin(cang * Math.PI / 180) * k * 72; chev.push(<g key={k} transform={`translate(${cxp},${cyp}) rotate(${cang})`}><path d="M-6,-5 L6,0 L-6,5" fill="none" stroke={pal.accent} strokeWidth="2" opacity="0.8" /></g>); }

  const empty = model.faces.length === 0;
  const canMoveNow = Math.abs(Math.sin(cam.pitch)) > 0.18;

  /* flow sim — same solver as plan, streamlines drawn on the bed */
  const flowField = useMemoO(() => {
    if (!flowOn) return null;
    const region = window.ReefFlow.regionFor(placed, window.REEF.BLOCK_BY_ID);
    return window.ReefFlow.solve(placed, site.heading, site.speed, region, window.REEF.BLOCK_BY_ID);
  }, [flowOn, placed, site.heading, site.speed]);
  const flowLines = useMemoO(() => (flowField ? window.ReefFlow.streamlines(flowField, 26) : []), [flowField]);
  let flowEls = null, upEls = null;
  if (flowOn && flowField) {
    const maxSp = flowField.maxSp || 1;
    const fdur = 6 / (0.5 + site.speed * 1.5);
    flowEls = <g>{flowLines.map((ln, i) => {
      const d = ln.pts.map((q, k) => { const s2 = proj(rp([q[0], 3, q[1]])); return (k ? 'L' : 'M') + s2[0].toFixed(1) + ' ' + s2[1].toFixed(1); }).join(' ');
      const mean = ln.speeds.reduce((a2, b2) => a2 + b2, 0) / ln.speeds.length;
      const frac = Math.min(1, mean / (maxSp * 0.92));
      const col = frac > 0.86 ? pal.amber : pal.accent;
      return <path key={i} d={d} fill="none" stroke={col} strokeWidth={1.3 + 1.4 * frac} opacity={0.34 + 0.42 * frac} strokeDasharray="2 11" strokeLinecap="round" className="flowline" style={{ animationDuration: fdur.toFixed(2) + 's', animationDelay: (-i * 0.16) + 's' }} />;
    })}</g>;
    const fxd = Math.cos(rad), fzd = Math.sin(rad);
    upEls = <g>{placed.map((p) => {
      const blk = window.REEF.BLOCK_BY_ID[p.block]; const s2 = p.s || 1; if (blk.h * s2 < 46) return null;
      const r2 = blk.r * s2; const bx = p.x - fxd * r2 * 1.08, bz = p.z - fzd * r2 * 1.08;
      const topH = (stackB[p.uid] || 0) + blk.h * s2 * 0.9;
      const p0 = proj(rp([bx, 0, bz])), p1 = proj(rp([bx, topH, bz]));
      const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
      return <g key={'up' + p.uid} className="upwell">
        <line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={pal.amber} strokeWidth="1.6" strokeDasharray="3 5" />
        <g transform={`translate(${p1[0]},${p1[1]}) rotate(${ang})`}><path d="M0,0 l-7,-4 M0,0 l-7,4" stroke={pal.amber} strokeWidth="1.8" fill="none" /></g>
      </g>;
    })}</g>;
  }

  return (
    <div className="orbit-wrap">
      <svg ref={svgRef} viewBox="0 0 940 560" className="stage-svg" preserveAspectRatio="xMidYMid meet"
        style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <g>{grid}</g>
        {apronEls}
        {selEls}
        {flowEls}
        {!flowOn && <g ref={flowRef}>{chev}</g>}
        {faceEls}
        {upEls}
        {dimEls}
        <GizmoG cam={cam} pal={pal} />
        {empty && <text x="470" y="300" textAnchor="middle" className="svg-mono" fill={pal.dim} fontSize="15">add blocks to assemble the model →</text>}
        <text x="470" y="544" textAnchor="middle" className="svg-mono" fill={pal.line} fontSize="13">3-D model · {canMoveNow ? 'drag a block to move it · overlap another to stack' : 'tilt the view to drag blocks'} · current along heading</text>
      </svg>
      <div className="orbit-bar">
        <button className={'ob' + (mode === 'solid' ? ' on' : '')} onClick={() => setMode('solid')}>SOLID</button>
        <button className={'ob' + (mode === 'wire' ? ' on' : '')} onClick={() => setMode('wire')}>WIRE</button>
        <div className="ob-div"></div>
        <button className="ob" onClick={() => setCam({ yaw: -0.62, pitch: 0.52, zoom: 1.7 })}>ISO</button>
        <button className="ob" onClick={() => setCam((c) => ({ ...c, pitch: 1.4 }))}>TOP</button>
        <button className="ob" onClick={() => setCam((c) => ({ ...c, pitch: 0.05, yaw: 0 }))}>SIDE</button>
      </div>
      <div className="orbit-hint">drag space to orbit · drag a block to place · overlap to stack · scroll / pinch to zoom</div>
    </div>
  );
}

function GizmoG({ cam, pal }) {
  const base = [62, 500];
  const ax = (v) => { const r = rotP(v, cam.yaw, cam.pitch); return [base[0] + r[0] * 24, base[1] - r[1] * 24]; };
  const X = ax([1, 0, 0]), Y = ax([0, 1, 0]), Z = ax([0, 0, 1]);
  return (
    <g>
      <line x1={base[0]} y1={base[1]} x2={X[0]} y2={X[1]} stroke={pal.accent} strokeWidth="2" /><text x={X[0]} y={X[1] - 3} className="svg-mono" fill={pal.accent} fontSize="11">N→</text>
      <line x1={base[0]} y1={base[1]} x2={Y[0]} y2={Y[1]} stroke={pal.line} strokeWidth="2" /><text x={Y[0] + 3} y={Y[1]} className="svg-mono" fill={pal.line} fontSize="11">up</text>
      <line x1={base[0]} y1={base[1]} x2={Z[0]} y2={Z[1]} stroke={pal.dim} strokeWidth="2" /><text x={Z[0] + 3} y={Z[1] + 3} className="svg-mono" fill={pal.dim} fontSize="11">off</text>
    </g>
  );
}

window.ReefViews = Object.assign(window.ReefViews || {}, { OrbitView });
