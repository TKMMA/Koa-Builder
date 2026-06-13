/* ============================================================
   KOA BUILDER — app shell (v3)
   Sloped site · current dial · stacking · save library
   ============================================================ */
const { useState, useEffect, useRef } = React;
const { SectionView, PlanView, OrbitView } = window.ReefViews;
const { useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakRadio } = window;
const RB = window.REEF;
const STORE = 'reefBuilder.v3';
const LIB = 'reefBuilder.designs.v1';
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "sea": 35,
  "waterMood": "Twilight"
} /*EDITMODE-END*/;
const MOODCSS = {
  twilight: { accent: '#6db3e8', bg1: '#0b2342', bg2: '#081a33' },
  tropical: { accent: '#37c9bd', bg1: '#0a3a45', bg2: '#06262f' },
  deep: { accent: '#4f86d6', bg1: '#07172e', bg2: '#040d1f' }
};
function spawnPos(n) {if (n === 0) return [0, 0];const a = n * 2.399,rad = Math.min(RB.FP - 30, 40 + n * 28);return [Math.round(Math.cos(a) * rad), Math.round(Math.sin(a) * rad)];}
function clamp(v, lo, hi) {return Math.max(lo, Math.min(hi, v));}

function loadState() {
  try {const s = JSON.parse(localStorage.getItem(STORE));if (s && Array.isArray(s.placed)) return { ...s, site: { ...RB.SITE_DEFAULT, ...(s.site || {}) }, flowOn: true };} catch (e) {}
  return { site: { ...RB.SITE_DEFAULT }, view: 'plan', placed: RB.defaultLayout(), flowOn: true };
}
function loadLib() {try {return JSON.parse(localStorage.getItem(LIB)) || [];} catch (e) {return [];}}

/* ---------- current heading dial ---------- */
function CurrentDial({ heading, onHeading }) {
  const ref = useRef(null);
  const setFrom = (e) => {const r = ref.current.getBoundingClientRect();const cx = r.left + r.width / 2,cy = r.top + r.height / 2;const ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;onHeading((Math.round(ang) % 360 + 360) % 360);};
  const down = (e) => {e.preventDefault();setFrom(e);const mv = (ev) => setFrom(ev);const up = () => {window.removeEventListener('pointermove', mv);window.removeEventListener('pointerup', up);};window.addEventListener('pointermove', mv);window.addEventListener('pointerup', up);};
  const rad = heading * Math.PI / 180;const ex = 50 + 33 * Math.cos(rad),ey = 50 + 33 * Math.sin(rad);
  const ah = rad,a1 = ah + 2.5,a2 = ah - 2.5;
  return (
    <svg ref={ref} className="dial" viewBox="0 0 100 100" onPointerDown={down}>
      <circle cx="50" cy="50" r="38" fill="rgba(8,22,44,0.6)" stroke="var(--edge)" strokeWidth="1.4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {const r = a * Math.PI / 180;return <line key={a} x1={50 + 33 * Math.cos(r)} y1={50 + 33 * Math.sin(r)} x2={50 + 38 * Math.cos(r)} y2={50 + 38 * Math.sin(r)} stroke="var(--dim)" strokeWidth="1" />;})}
      <line x1="50" y1="50" x2={ex} y2={ey} stroke="var(--accent)" strokeWidth="2.6" />
      <path d={`M${ex},${ey} L${50 + 26 * Math.cos(a1)},${50 + 26 * Math.sin(a1)} L${50 + 26 * Math.cos(a2)},${50 + 26 * Math.sin(a2)} Z`} fill="var(--accent)" />
      <circle cx="50" cy="50" r="3.5" fill="var(--accent)" />
      <text x="50" y="14" textAnchor="middle" className="dial-card">shore</text>
      <text x="50" y="97" textAnchor="middle" className="dial-card">off</text>
    </svg>);

}

/* ---------- mini plan thumbnail for saved designs ---------- */
function Thumb({ design }) {
  const FP = RB.FP,W = 132,H = 84;
  const w2s = (x, z) => [W / 2 + x / FP * (W / 2 - 8), H / 2 + z / FP * (H / 2 - 6)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="thumb-svg">
      <rect x="0" y="0" width={W} height={H} rx="4" fill="rgba(8,22,44,0.6)" />
      <rect x="3" y="3" width={W - 6} height={H - 6} rx="3" fill="none" stroke="rgba(120,160,210,0.25)" strokeWidth="0.8" strokeDasharray="2 3" />
      {(design.placed || []).map((p, i) => {const b = RB.BLOCK_BY_ID[p.block];if (!b) return null;const [sx, sy] = w2s(p.x, p.z);const r = Math.max(3, b.r * (p.s || 1) / FP * (W / 2 - 8) * 0.7);const col = b.color === 'amber' ? '#e8a849' : b.color === 'banana' ? '#f2c14e' : b.color === 'life' ? '#74d2a2' : '#6db3e8';return <circle key={i} cx={sx} cy={sy} r={r} fill={col} opacity="0.5" stroke={col} strokeWidth="0.8" />;})}
    </svg>);

}

function App() {
  const init = loadState();
  const [site, setSite] = useState(init.site);
  const [view, setView] = useState(init.view);
  const [placed, setPlaced] = useState(init.placed);
  const [flowOn, setFlowOn] = useState(init.flowOn);
  const [selectedUid, setSelectedUid] = useState(null);
  const [lib, setLib] = useState(loadLib());
  const [name, setName] = useState('');
  const STYLE = 'bathy';
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const tweaks = { sea: (t.sea || 0) / 100, mood: (t.waterMood || 'Twilight').toLowerCase() };
  const mc = MOODCSS[tweaks.mood] || MOODCSS.twilight;
  useEffect(() => {document.documentElement.style.setProperty('--accent', mc.accent);document.body.style.background = `linear-gradient(180deg,${mc.bg1},${mc.bg2})`;}, [tweaks.mood]);
  useEffect(() => {localStorage.setItem(STORE, JSON.stringify({ site, view, placed }));}, [site, view, placed]);

  const counts = {};placed.forEach((p) => {counts[p.block] = (counts[p.block] || 0) + 1;});
  const avgDepth = placed.length ? Math.round(placed.reduce((a, p) => a + RB.depthAt(site, p.z), 0) / placed.length) : Math.round((site.shallow + site.deep) / 2);
  const recommend = RB.recommendFor(avgDepth);

  const pendingSelect = useRef(null);
  const addBlock = (id) => setPlaced((a) => {
    if (a.length >= RB.MAX_BLOCKS) return a;
    if (a.filter((p) => p.block === id).length >= RB.MAX_EACH) return a;
    const pos = spawnPos(a.length);
    const it = RB.inst(id, pos[0], pos[1]);
    pendingSelect.current = it.uid;
    return [...a, it];
  });
  useEffect(() => {if (pendingSelect.current) {setSelectedUid(pendingSelect.current);pendingSelect.current = null;}});
  const removeOne = (id) => {const idx = [...placed].map((p) => p.block).lastIndexOf(id);if (idx < 0) return;const rm = placed[idx];if (rm.uid === selectedUid) setSelectedUid(null);setPlaced((a) => a.filter((p) => p.uid !== rm.uid));};
  const removeUid = (uid) => {setPlaced((a) => a.filter((p) => p.uid !== uid));if (selectedUid === uid) setSelectedUid(null);};
  const moveBlock = (uid, x, z) => setPlaced((a) => a.map((p) => p.uid === uid ? { ...p, x, z } : p));
  const scaleBlock = (uid, s) => setPlaced((a) => a.map((p) => p.uid === uid ? { ...p, s } : p));
  const shiftAll = (dz) => setPlaced((a) => a.map((p) => ({ ...p, z: clamp(p.z + dz, -RB.FP, RB.FP) })));
  const applyRecommended = () => {setPlaced(RB.defaultLayout());setSelectedUid(null);};
  const clearAll = () => {setPlaced([]);setSelectedUid(null);};
  const loadPreset = (p) => {setSite((s) => ({ ...s, ...(p.site || {}) }));setPlaced(RB.fromLayout(p.layout));setSelectedUid(null);};

  const setShallow = (v) => setSite((s) => ({ ...s, shallow: clamp(v, 6, s.deep - 8) }));
  const setDeep = (v) => setSite((s) => ({ ...s, deep: clamp(v, s.shallow + 8, 120) }));
  const setHeading = (h) => setSite((s) => ({ ...s, heading: h }));
  const setSpeed = (v) => setSite((s) => ({ ...s, speed: v }));

  const persistLib = (l) => {localStorage.setItem(LIB, JSON.stringify(l));setLib(l);};
  const saveDesign = () => {const nm = name.trim() || 'Design ' + (lib.length + 1);const d = { id: RB.uid(), name: nm, ts: Date.now(), site: { ...site }, placed: placed.map((p) => ({ block: p.block, x: p.x, z: p.z, s: p.s || 1 })) };persistLib([d, ...lib].slice(0, 30));setName('');};
  const loadDesign = (d) => {setSite((s) => ({ ...s, ...d.site }));setPlaced((d.placed || []).map((p) => RB.inst(p.block, p.x, p.z, p.s)));setSelectedUid(null);};
  const delDesign = (id) => persistLib(lib.filter((x) => x.id !== id));

  const ViewComp = view === 'plan' ? PlanView : view === 'section' ? SectionView : OrbitView;
  const sel = placed.find((p) => p.uid === selectedUid);
  const _depths = placed.map((p) => RB.depthAt(site, p.z));
  const dspan = _depths.length ? [Math.min(..._depths), Math.max(..._depths)] : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">KOA BUILDER</div>
          <div className="brand-sub">Build a cluster from the kit</div>
        </div>
        <div className="tabs">
          {[['plan', 'PLAN · EDIT'], ['section', 'SECTION'], ['iso', '3D MODEL']].map(([v, l]) =>
          <button key={v} className={'tab' + (view === v ? ' on' : '')} onClick={() => setView(v)}>{l}</button>)}
        </div>
        <div className="topright">
          {(view === 'plan' || view === 'iso') && <button className={'flowtog' + (flowOn ? ' on' : '')} onClick={() => setFlowOn((f) => !f)}><span className="ft-dot"></span>FLOW SIM</button>}
          <div className="badge">CONCEPTUAL — NOT FOR CONSTRUCTION</div>
        </div>
      </header>

      <div className="body">
        {/* LEFT: site + current + presets + saved */}
        <aside className="rail left">
          <div className="rail-h">SITE / SLOPE <span>the seabed grade</span></div>
          <div className="sitepanel">
            <div className="selrow"><span className="sl-lbl">Shallow</span><input className="size-slider" type="range" min="6" max="60" step="1" value={site.shallow} onChange={(e) => setShallow(Number(e.target.value))} /><span className="sl-val">{site.shallow}ft</span></div>
            <div className="selrow"><span className="sl-lbl">Deep</span><input className="size-slider" type="range" min="40" max="120" step="1" value={site.deep} onChange={(e) => setDeep(Number(e.target.value))} /><span className="sl-val">{site.deep}ft</span></div>
            <div className="shiftrow">
              <span className="shift-lbl">Move cluster</span>
              <button className="shiftbtn" onClick={() => shiftAll(-16)} title="shallower">⇡ shallower</button>
              <button className="shiftbtn" onClick={() => shiftAll(16)} title="deeper">⇣ deeper</button>
            </div>
          </div>

          <div className="rail-h">CURRENT <span>speed &amp; direction</span></div>
          <div className="currentpanel">
            <CurrentDial heading={site.heading} onHeading={setHeading} />
            <div className="cur-readout">
              <div className="cr-line"><span>heading</span><b>{site.heading}°</b></div>
              <div className="cr-line"><span>speed</span><b>{site.speed.toFixed(2)} <i>rel</i></b></div>
              <input className="size-slider" type="range" min="0.1" max="1.5" step="0.05" value={site.speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              <div className="cr-hint">{flowOn ? 'Flow sim is on — watch it bend around your blocks.' : 'Turn on FLOW SIM (top) to model flow around the cluster.'}</div>
            </div>
          </div>

          <div className="rail-h">PRESETS <span>load a layout</span></div>
          <div className="presets">
            {RB.PRESETS.map((p) => <button key={p.id} className={'preset' + (p.fun ? ' fun' : '')} onClick={() => loadPreset(p)}>{p.name}</button>)}
          </div>

          <div className="rail-h">SAVED DESIGNS <span>{lib.length} saved</span></div>
          <div className="savebar">
            <input className="nameinput" placeholder="name this design…" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') saveDesign();}} />
            <button className="act mini savebtn" onClick={saveDesign} disabled={placed.length === 0}>Save</button>
          </div>
          <div className="savedlist">
            {lib.length === 0 && <div className="bom-empty">No saved designs yet — build one and hit Save.</div>}
            {lib.map((d) => <div key={d.id} className="saved">
              <div className="saved-thumb" onClick={() => loadDesign(d)} title="load"><Thumb design={d} /></div>
              <div className="saved-meta">
                <div className="saved-name" title={d.name}>{d.name}</div>
                <div className="saved-sub">{(d.placed || []).length} blocks · {d.site ? `${d.site.shallow}–${d.site.deep}ft` : ''}</div>
                <div className="saved-act"><button className="linkbtn" onClick={() => loadDesign(d)}>Load</button><button className="linkbtn del" onClick={() => delDesign(d.id)}>Delete</button></div>
              </div>
            </div>)}
          </div>
        </aside>

        {/* CENTER */}
        <main className="stage">
          <div className="stage-head">
            <div className="sh-left"><b>Site ≈{site.shallow}–{site.deep} ft</b> · {placed.length} block{placed.length !== 1 ? 's' : ''}{dspan ? ` · cluster ${dspan[0]}–${dspan[1]} ft` : ''}</div>
            <div className="sh-right">{view === 'plan' ? flowOn ? 'flow sim · streamlines bend around the cluster' : 'top-down · drag blocks · offshore = deeper' : view === 'section' ? 'across-slope cut · seats level on the grade' : flowOn ? 'orbit · flow streamlines along the bed · overlap to stack' : 'orbit · drag block to move · overlap to stack'}</div>
          </div>
          <div className="stage-canvas">
            <ViewComp site={site} placed={placed} style={STYLE} selectedUid={selectedUid} onMove={moveBlock} onSelect={setSelectedUid} onRemove={removeUid} onScale={scaleBlock} tweaks={tweaks} flowOn={flowOn} />
          </div>
          <div className="stage-foot">
            <span className="fk"><i className="dot cur"></i> current {site.heading}° · {site.speed.toFixed(2)} rel</span>
            <span className="fk"><i className="dot amb"></i> scour apron · upwelling cue</span>
            <span className="fk">Drag offshore (down) to place pieces deeper · drag one block over another to stack.</span>
          </div>
        </main>

        {/* RIGHT: kit + read + spec */}
        <aside className="rail right">
          {sel &&
          <div className="selpanel">
              <div className="rail-h">SELECTED <span>{RB.BLOCK_BY_ID[sel.block].name} · ≈{RB.depthAt(site, sel.z)} ft</span></div>
              <div className="selrow">
                <span className="sl-lbl">Size</span>
                <input className="size-slider" type="range" min={RB.MIN_S} max={RB.MAX_S} step="0.05" value={sel.s || 1} onChange={(e) => scaleBlock(sel.uid, Number(e.target.value))} />
                <span className="sl-val">{(sel.s || 1).toFixed(2)}×</span>
              </div>
              <div className="selact">
                <button className="act ghost mini" onClick={() => scaleBlock(sel.uid, 1)}>Reset size</button>
                <button className="act mini" onClick={() => removeUid(sel.uid)}>Remove</button>
              </div>
            </div>
          }
          <div className="rail-h">KIT OF PARTS <span className="limit">{placed.length} block{placed.length !== 1 ? 's' : ''}</span></div>
          <div className="kit">
            {RB.BLOCKS.map((p) => {
              const c = counts[p.id] || 0;const rec = recommend.includes(p.id);const maxed = c >= RB.MAX_EACH;
              return (
                <div key={p.id} className={'kit-row' + (c > 0 ? ' active' : '') + (p.fun ? ' fun' : '') + (p.organic ? ' organic' : '')}>
                  <button className="kit-main" onClick={() => addBlock(p.id)} disabled={maxed}>
                    <span className="kit-name">{p.name}{p.organic && <i className="org" title="organic habitat form">❧</i>}{rec && <i className="rec" title="suits this depth">★</i>}</span>
                    <span className="kit-sub">{p.sub}</span>
                  </button>
                  <div className="kit-ctrl">
                    <button className="step" onClick={() => removeOne(p.id)} disabled={c === 0}>–</button>
                    <span className="cnt">{c}</span>
                    <button className="step" onClick={() => addBlock(p.id)} disabled={maxed}>+</button>
                  </div>
                </div>);
            })}
          </div>
          <div className="kit-actions">
            <button className="act" onClick={applyRecommended}>★ Starter</button>
            <button className="act ghost" onClick={clearAll}>Clear</button>
          </div>

          <SpecPanel site={site} placed={placed} />
        </aside>
      </div>

      <TweaksPanel>
        <TweakSection label="Atmosphere" />
        <TweakSlider label="Sea state" value={t.sea} min={0} max={100} unit="%" onChange={(v) => setTweak('sea', v)} />
        <TweakRadio label="Water mood" value={t.waterMood} options={['Twilight', 'Tropical', 'Deep']} onChange={(v) => setTweak('waterMood', v)} />
      </TweaksPanel>
    </div>);
}

function SpecPanel({ site, placed }) {
  const s = RB.spec(site, placed);
  return (
    <React.Fragment>
      <div className="rail-h">SPEC / BILL OF MATERIALS <span>CAD</span></div>
      <div className="spec">
        <div className="spec-grid">
          <div className="sp"><span className="sp-n">{s.modules}</span><span className="sp-l">blocks{s.stacks ? ` · ${s.stacks} stacked` : ''}</span></div>
          <div className="sp"><span className="sp-n">{s.footprint}<i>ft</i></span><span className="sp-l">footprint</span></div>
          <div className="sp"><span className="sp-n">{s.relief}<i>ft</i></span><span className="sp-l">relief</span></div>
          <div className="sp"><span className="sp-n">{s.mass}<i>t*</i></span><span className="sp-l">rel. mass</span></div>
        </div>
        <div className="bom">
          {s.items.length === 0 && <div className="bom-empty">no blocks placed</div>}
          {s.items.map((it) => <div key={it.id} className="bom-row"><span className="bom-q">{it.qty}×</span><span className="bom-n">{it.name}</span></div>)}
        </div>
        <div className="spec-note">* relative mass index · not engineering values</div>
      </div>
    </React.Fragment>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);