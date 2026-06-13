/* ============================================================
   KOA BUILDER — flow field solver (reef-flow.js)
   A lightweight, qualitative current model: uniform inflow that is
   made (nearly) divergence-free around the placed block footprints
   via iterative pressure projection — so flow bends around the
   cluster, speeds up between modules, and stalls on the upstream
   face. NOT engineering CFD — indicative only.
   The solve runs on a LOCAL region around the cluster (cx,cz,half)
   so streamlines hug the structures instead of tiling open water.
   Exposes window.ReefFlow = { solve, streamlines, sampleAt }.
   ============================================================ */
window.ReefFlow = (function () {
  const GW = 88, GH = 88;          // square grid over the local region

  function idx(i, j) { return j * GW + i; }

  // region: {cx, cz, half} in world units. Maps to [0,GW]x[0,GH].
  function w2g(region, x, y) {
    const x0 = region.cx - region.half, y0 = region.cz - region.half, span = region.half * 2;
    return [(x - x0) / span * GW, (y - y0) / span * GH];
  }

  function buildObstacle(placed, region, byId) {
    const obs = new Uint8Array(GW * GH);
    const span = region.half * 2;
    (placed || []).forEach((p) => {
      const b = byId[p.block]; if (!b) return; const s = p.s || 1;
      const [cx, cy] = w2g(region, p.x, p.z);
      const rr = (b.r * s) / span * GW;
      const i0 = Math.max(0, Math.floor(cx - rr - 1)), i1 = Math.min(GW - 1, Math.ceil(cx + rr + 1));
      const j0 = Math.max(0, Math.floor(cy - rr - 1)), j1 = Math.min(GH - 1, Math.ceil(cy + rr + 1));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5 - cx), dy = (j + 0.5 - cy);
        if (dx * dx + dy * dy <= rr * rr) obs[idx(i, j)] = 1;
      }
    });
    return obs;
  }

  function solve(placed, heading, speed, region, byId) {
    const obs = buildObstacle(placed, region, byId);
    const n = GW * GH;
    const ux = new Float32Array(n), uy = new Float32Array(n);
    const rad = heading * Math.PI / 180;
    const fx = Math.cos(rad), fy = Math.sin(rad);
    for (let k = 0; k < n; k++) { if (!obs[k]) { ux[k] = fx; uy[k] = fy; } }

    const solid = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH) ? false : obs[idx(i, j)] === 1;
    const p = new Float32Array(n);
    const div = new Float32Array(n);

    for (let outer = 0; outer < 26; outer++) {
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const c = idx(i, j); if (obs[c]) { div[c] = 0; continue; }
        const uR = solid(i + 1, j) ? 0 : (i + 1 < GW ? ux[idx(i + 1, j)] : fx);
        const uL = solid(i - 1, j) ? 0 : (i - 1 >= 0 ? ux[idx(i - 1, j)] : fx);
        const vT = solid(i, j + 1) ? 0 : (j + 1 < GH ? uy[idx(i, j + 1)] : fy);
        const vB = solid(i, j - 1) ? 0 : (j - 1 >= 0 ? uy[idx(i, j - 1)] : fy);
        div[c] = 0.5 * ((uR - uL) + (vT - vB));
      }
      for (let pit = 0; pit < 3; pit++) {
        for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
          const c = idx(i, j); if (obs[c]) { p[c] = 0; continue; }
          const pR = (solid(i + 1, j) || i + 1 >= GW) ? p[c] : p[idx(i + 1, j)];
          const pL = (solid(i - 1, j) || i - 1 < 0) ? p[c] : p[idx(i - 1, j)];
          const pT = (solid(i, j + 1) || j + 1 >= GH) ? p[c] : p[idx(i, j + 1)];
          const pB = (solid(i, j - 1) || j - 1 < 0) ? p[c] : p[idx(i, j - 1)];
          p[c] = (pR + pL + pT + pB - div[c]) * 0.25;
        }
      }
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const c = idx(i, j); if (obs[c]) { ux[c] = 0; uy[c] = 0; continue; }
        const pR = (solid(i + 1, j) || i + 1 >= GW) ? p[c] : p[idx(i + 1, j)];
        const pL = (solid(i - 1, j) || i - 1 < 0) ? p[c] : p[idx(i - 1, j)];
        const pT = (solid(i, j + 1) || j + 1 >= GH) ? p[c] : p[idx(i, j + 1)];
        const pB = (solid(i, j - 1) || j - 1 < 0) ? p[c] : p[idx(i, j - 1)];
        ux[c] -= 0.5 * (pR - pL);
        uy[c] -= 0.5 * (pT - pB);
      }
    }
    let maxSp = 0.001;
    for (let k = 0; k < n; k++) { const m = Math.hypot(ux[k], uy[k]); if (!obs[k] && m > maxSp) maxSp = m; }
    return { GW, GH, ux, uy, obs, fx, fy, speed, maxSp, region };
  }

  function sampleAt(field, x, y) {
    const [gx0, gy0] = w2g(field.region, x, y);
    const gx = gx0 - 0.5, gy = gy0 - 0.5;
    const i = Math.floor(gx), j = Math.floor(gy);
    const fxp = gx - i, fyp = gy - j;
    const cl = (a, b) => [Math.max(0, Math.min(field.GW - 1, a)), Math.max(0, Math.min(field.GH - 1, b))];
    const g = (ii, jj, arr) => { const [a, b] = cl(ii, jj); return arr[b * field.GW + a]; };
    const lerp = (a, b, t) => a + (b - a) * t;
    const ux = lerp(lerp(g(i, j, field.ux), g(i + 1, j, field.ux), fxp), lerp(g(i, j + 1, field.ux), g(i + 1, j + 1, field.ux), fxp), fyp);
    const uy = lerp(lerp(g(i, j, field.uy), g(i + 1, j, field.uy), fxp), lerp(g(i, j + 1, field.uy), g(i + 1, j + 1, field.uy), fxp), fyp);
    return [ux, uy, Math.hypot(ux, uy)];
  }

  function inObstacle(field, x, y) {
    const [gx, gy] = w2g(field.region, x, y);
    const i = Math.floor(gx), j = Math.floor(gy);
    if (i < 0 || j < 0 || i >= field.GW || j >= field.GH) return false;
    return field.obs[j * field.GW + i] === 1;
  }

  // Streamlines seeded just upstream of the region, traced through the field.
  function streamlines(field, nSeeds) {
    const R = field.region; const H = R.half;
    const lines = [];
    const fx = field.fx, fy = field.fy;
    const px = -fy, py = fx;                       // perpendicular to flow
    const ax = R.cx - fx * H * 1.15, ay = R.cz - fy * H * 1.15;   // upstream anchor
    const step = H * 0.03;
    const maxSteps = 240;
    nSeeds = nSeeds || 30;
    for (let s = 0; s < nSeeds; s++) {
      const tt = (s / (nSeeds - 1) - 0.5) * 2;     // -1..1
      let x = ax + px * tt * H * 1.15;
      let y = ay + py * tt * H * 1.15;
      const pts = [], speeds = [];
      for (let k = 0; k < maxSteps; k++) {
        const dx = x - R.cx, dy = y - R.cz;
        if (Math.hypot(dx, dy) > H * 1.65) break;
        if (!inObstacle(field, x, y)) pts.push([x, y]);
        const [vx, vy, m] = sampleAt(field, x, y);
        speeds.push(m);
        const L = Math.hypot(vx, vy) || 1;
        const mx = x + (vx / L) * step * 0.5, my = y + (vy / L) * step * 0.5;
        const [vx2, vy2] = sampleAt(field, mx, my);
        const L2 = Math.hypot(vx2, vy2) || 1;
        x += (vx2 / L2) * step; y += (vy2 / L2) * step;
      }
      if (pts.length > 6) lines.push({ pts, speeds });
    }
    return lines;
  }

  // bounding region around the cluster (with margin), for solve()
  function regionFor(placed, byId, fallbackHalf) {
    if (!placed || placed.length === 0) return { cx: 0, cz: 0, half: fallbackHalf || 120 };
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    placed.forEach((p) => { const b = byId[p.block]; const r = (b.r || 24) * (p.s || 1); minx = Math.min(minx, p.x - r); maxx = Math.max(maxx, p.x + r); minz = Math.min(minz, p.z - r); maxz = Math.max(maxz, p.z + r); });
    const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
    const half = Math.max(90, Math.max(maxx - minx, maxz - minz) / 2 + 70);
    return { cx, cz, half };
  }

  return { solve, streamlines, sampleAt, inObstacle, regionFor, GW, GH };
})();
