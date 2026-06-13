/* ============================================================
   KOA BUILDER — data model  (v3 · sloped site + stacking)
   A "design" = up to MAX_BLOCKS placed instances {uid, block, x, z, s}.
   x = along-shore, z = offshore (also drives DEPTH via the site slope).
   No more discrete depth bands: depth is continuous, read off the slope.
   Stacking is derived from footprint overlap (drag one over another).
   ============================================================ */
(function () {
  const MAX_BLOCKS = 18;   // overall safety cap
  const MAX_EACH = 5;      // up to 5 of each block type
  const FP = 440;          // footprint half-extent (world units) — large, pannable canvas
  const MIN_S = 0.5, MAX_S = 2.4;
  const FT_PER_UNIT = 0.1875;   // world-height → feet (monolith h64 ≈ 12 ft)

  // ---- Site: a sloping patch of seabed -------------------
  // depth(z): -FP (shore side, top of pad) = shallow, +FP (offshore) = deep.
  // heading: degrees. 0 = flow toward +x (along-shore). Clockwise.
  const SITE_DEFAULT = { shallow: 36, deep: 50, heading: 8, speed: 0.7 };

  function depthAt(site, z) {
    const t = Math.max(0, Math.min(1, (z + FP) / (2 * FP)));
    return Math.round(site.shallow + t * (site.deep - site.shallow));
  }
  function zForDepth(site, d) {
    const t = (d - site.shallow) / Math.max(1, site.deep - site.shallow);
    return Math.round(-FP + t * 2 * FP);
  }

  // ---- Placeable building blocks --------------------------
  // h = 3-D height (units) · r = footprint radius (units) · reliefFt for spec
  // round:true → smoother/curved silhouettes · organic:true → new habitat forms
  const BLOCKS = [
    { id: 'table',     name: 'Table on legs',      sub: 'level cover slab · classic', cover: 3, mass: 3, h: 76, r: 32, reliefFt: 11, color: 'line' },
    { id: 'ledge',     name: 'Ledge slab',         sub: 'long narrow shelf · stack for ledges', cover: 2, mass: 2, h: 24, r: 40, reliefFt: 4, color: 'line', long: true },
    { id: 'monolith',  name: 'Monolith stack',     sub: 'heavy · bottom fish',        cover: 2, mass: 5, h: 64, r: 30, reliefFt: 12, color: 'line' },
    { id: 'aframe',    name: 'A-frame',            sub: 'tent ledge · shade',         cover: 2, mass: 2, h: 46, r: 28, reliefFt: 8,  color: 'line' },
    { id: 'dome',      name: 'Layered dome',       sub: 'tiered overhangs · ledges',  cover: 3, mass: 3, h: 58, r: 32, reliefFt: 9,  color: 'line', round: true, organic: true },
    { id: 'tree',      name: 'Coral tree',         sub: 'branching · open structure', cover: 3, mass: 1, h: 78, r: 28, reliefFt: 12, color: 'life', round: true, organic: true },
    { id: 'cathedral', name: 'Honeycomb cathedral',sub: 'many swim-throughs',         cover: 3, mass: 2, h: 56, r: 32, reliefFt: 9,  color: 'line', organic: true },
    { id: 'archway',   name: 'Arch tunnel',        sub: 'swim-through portal',        cover: 3, mass: 2, h: 50, r: 32, reliefFt: 8,  color: 'line', organic: true },
    { id: 'spire',     name: 'Helix spire',        sub: 'twisting column · vertical relief', cover: 2, mass: 2, h: 86, r: 22, reliefFt: 13, color: 'line', round: true, organic: true },
    { id: 'organpipes',name: 'Organ pipes',        sub: 'tube cluster · varied height', cover: 3, mass: 2, h: 66, r: 32, reliefFt: 10, color: 'line', organic: true },
    { id: 'reefball',  name: 'Reef ball',          sub: 'perforated dome',            cover: 3, mass: 2, h: 30, r: 22, reliefFt: 4,  color: 'line', round: true },
    { id: 'puka',      name: 'Puka panel',         sub: 'lobster cover · no snag',    cover: 2, mass: 1, h: 26, r: 24, reliefFt: 3,  color: 'line' },
    { id: 'tube',      name: 'Tube',               sub: 'Ø 2.5–3 ft round',           cover: 2, mass: 1, h: 22, r: 22, reliefFt: 3,  color: 'line', round: true },
    { id: 'menpachi',  name: 'Menpachi tube',      sub: 'long triangular',            cover: 2, mass: 1, h: 20, r: 30, reliefFt: 3,  color: 'line' },
    { id: 'coral',     name: 'Coral plate',        sub: 'flat / canted hybrid',       cover: 1, mass: 1, h: 12, r: 22, reliefFt: 2,  color: 'amber' },
    { id: 'banana',    name: 'Banana',             sub: 'curved run · the fun one',   cover: 1, mass: 1, h: 50, r: 30, reliefFt: 4,  color: 'banana', round: true, fun: true },
  ];
  const BLOCK_BY_ID = {};
  BLOCKS.forEach((b) => { BLOCK_BY_ID[b.id] = b; });

  function uid() { return 'b' + Math.random().toString(36).slice(2, 8); }
  function inst(block, x, z, s) { return { uid: uid(), block, x, z, s: s == null ? 1 : s }; }

  // ---- Stacking — derived from footprint overlap ----------
  // process in placement order: a block rests on the highest top
  // among EARLIER-placed blocks whose footprint it overlaps.
  function stackBases(placed) {
    const base = {};
    const top = {};
    (placed || []).forEach((p, i) => {
      const bp = BLOCK_BY_ID[p.block]; const sp = p.s || 1;
      let b = 0;
      for (let j = 0; j < i; j++) {
        const q = placed[j]; const bq = BLOCK_BY_ID[q.block]; const sq = q.s || 1;
        const rr = (bp.r * sp + bq.r * sq) * 0.5;
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < rr && top[q.uid] > b) b = top[q.uid];
      }
      base[p.uid] = b;
      top[p.uid] = b + bp.h * sp;
    });
    return { base, top };
  }
  // ---- Starter + preset layouts (arrays of instances) -----
  function fromLayout(arr) { return arr.slice(0, MAX_BLOCKS).map((a) => inst(a[0], a[1], a[2], a[3])); }

  function defaultLayout() {
    return fromLayout([['table', 0, -10], ['ledge', 4, 64], ['dome', -84, 34], ['tree', 86, -40], ['archway', -8, -78]]);
  }

  const PRESETS = [
    { id: 'gardencity', name: 'Garden City',   site: { shallow: 34, deep: 56 }, layout: [['tree', -88, -34], ['tree', 84, -46], ['cathedral', 0, 14], ['dome', -16, 92], ['archway', 96, 70], ['coral', 92, 74]] },
    { id: 'tabletop',   name: 'Table Top',     site: { shallow: 38, deep: 54 }, layout: [['table', 0, -10], ['ledge', 0, 70], ['tube', -108, 78], ['tube', 108, 78], ['coral', 0, -100]] },
    { id: 'ledgewall',  name: 'Ledge Wall',    site: { shallow: 30, deep: 50 }, layout: [['ledge', -10, -40], ['ledge', 6, 6], ['ledge', -4, 52], ['organpipes', -110, 10], ['puka', 104, 30]] },
    { id: 'surfstack',  name: 'Surf Stack',    site: { shallow: 16, deep: 34 }, layout: [['monolith', -74, -20], ['monolith', 74, 20], ['puka', 0, 92], ['reefball', -100, 84]] },
    { id: 'uluatower',  name: 'Ulua Tower',    site: { shallow: 58, deep: 84 }, layout: [['monolith', -58, -18, 1.3], ['spire', 64, 20, 1.1], ['tree', 0, -92], ['menpachi', 108, 78]] },
    { id: 'cathedral',  name: 'Cathedral Row', site: { shallow: 40, deep: 60 }, layout: [['cathedral', -88, 0], ['cathedral', 88, 0], ['dome', 0, -84], ['archway', 0, 90]] },
    { id: 'condo',      name: 'Lobster Condo', site: { shallow: 18, deep: 38 }, layout: [['reefball', -96, -40], ['reefball', 8, -66], ['reefball', 98, -36], ['puka', -44, 78], ['tube', 64, 86]] },
    { id: 'banana',     name: 'Banana Split',  site: { shallow: 35, deep: 56 }, fun: true, layout: [['banana', -74, 30, 1.2], ['banana', 84, 30, 1.2], ['dome', 0, -78], ['coral', 0, 94]] },
  ];

  function recommendFor(depth) {
    if (depth < 35) return ['monolith', 'reefball', 'puka', 'dome', 'ledge'];
    if (depth < 65) return ['table', 'cathedral', 'tree', 'archway', 'organpipes'];
    return ['monolith', 'tree', 'spire', 'tube', 'menpachi'];
  }

  // ---- Spec / bill-of-materials (stacking-aware) ----------
  function spec(site, placed) {
    placed = placed || [];
    const counts = {};
    placed.forEach((p) => { counts[p.block] = (counts[p.block] || 0) + 1; });
    const items = BLOCKS.filter((b) => counts[b.id]).map((b) => ({ id: b.id, name: b.name, qty: counts[b.id] }));
    const { base, top } = stackBases(placed);
    let mass = 0, cover = 0, ext = 0, topH = 0;
    placed.forEach((p) => {
      const b = BLOCK_BY_ID[p.block]; const s = p.s || 1;
      mass += b.mass * s; cover += b.cover;
      ext = Math.max(ext, Math.abs(p.x) + b.r * s, Math.abs(p.z) + b.r * s);
      topH = Math.max(topH, top[p.uid]);
    });
    const relief = Math.round(topH * FT_PER_UNIT);
    const footprint = placed.length ? Math.max(14, Math.round(ext * 2 / 3)) : 0;
    const depthSpan = placed.length ? [Math.min(...placed.map((p) => depthAt(site, p.z))), Math.max(...placed.map((p) => depthAt(site, p.z)))] : [0, 0];
    const stacks = placed.filter((p) => base[p.uid] > 0.5).length;
    return { items, modules: placed.length, max: MAX_EACH, mass: Math.round(mass), cover, relief, footprint, depthSpan, stacks };
  }

  window.REEF = {
    BLOCKS, BLOCK_BY_ID, PRESETS, MAX_BLOCKS, MAX_EACH, MIN_S, MAX_S, FP, FT_PER_UNIT,
    SITE_DEFAULT,
    uid, inst, fromLayout, defaultLayout, recommendFor,
    depthAt, zForDepth, stackBases, spec,
  };
})();
