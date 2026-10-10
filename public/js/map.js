import { escapeHtml } from './common.js';
import { facilityById } from './facilities-data.js';
import { FLOORS, BUILDINGS, TYPES, ZONES, NODES, EDGES, SAFETY, METRES_PER_UNIT, PLAN } from './map-data.js';

const $ = (id) => document.getElementById(id);
const svg = $('mapSvg');
const SVGNS = 'http://www.w3.org/2000/svg';
const HERE_KEY = 'haraya:mapHere';
const DEFAULT_HERE = 'lobby';

const floorById = Object.fromEntries(FLOORS.map((f) => [f.id, f]));
const zoneById = new Map(ZONES.map((z) => [z.id, z]));
const LEVEL = { G: 1, 2: 2, 3: 3, 4: 4, R: 9 };
const VERT_LABEL = { elevator: 'the elevator', stairs: 'the stairs', escalator: 'the escalator' };
const VIEW_BOX = { all: [0, -14, PLAN.w, PLAN.h + 14], hotel: [20, -4, 640, 760], mall: [680, -4, 500, 720] };

const state = {
  floor: 'G',
  view: 'all',
  selected: null,
  here: DEFAULT_HERE,
  route: null,
  safety: false,
  highlightType: null,
  query: '',
  vb: null,
};

// ---------- graph & routing ----------

const adj = new Map(Object.keys(NODES).map((id) => [id, []]));
for (const e of EDGES) {
  const a = NODES[e.a], b = NODES[e.b];
  if (!a || !b) { console.warn('Map: edge references a missing node', e); continue; }
  const w = e.cost ?? Math.hypot(a.x - b.x, a.y - b.y);
  adj.get(e.a).push({ to: e.b, w, kind: e.kind });
  adj.get(e.b).push({ to: e.a, w, kind: e.kind });
}
const verticalNodes = new Set(EDGES.filter((e) => e.kind !== 'walk').flatMap((e) => [e.a, e.b]));

function dijkstra(sources, { allow = () => true, target } = {}) {
  const dist = new Map(sources.map((s) => [s, 0]));
  const prev = new Map();
  const done = new Set();
  for (;;) {
    let u = null, best = Infinity;
    for (const [k, d] of dist) if (!done.has(k) && d < best) { best = d; u = k; }
    if (u === null || u === target) break;
    done.add(u);
    for (const e of adj.get(u)) {
      if (!allow(e)) continue;
      const nd = best + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, kind: e.kind }); }
    }
  }
  return { dist, prev };
}

function findRoute(from, to, accessible) {
  const s = from.node, t = to.node;
  const allow = (e) => !accessible || (e.kind !== 'stairs' && e.kind !== 'escalator');
  const { dist, prev } = dijkstra([s], { target: t, allow });
  if (!dist.has(t)) return null;
  const path = [t], kinds = [];
  for (let cur = t; cur !== s;) {
    const p = prev.get(cur);
    kinds.unshift(p.kind);
    path.unshift(p.from);
    cur = p.from;
  }
  return { path, kinds, from, to, accessible };
}

function routeStats(r) {
  let metres = 0, secs = 0;
  for (let i = 1; i < r.path.length; i++) {
    const a = NODES[r.path[i - 1]], b = NODES[r.path[i]], kind = r.kinds[i - 1];
    if (a.floor === b.floor) {
      const m = Math.hypot(a.x - b.x, a.y - b.y) * METRES_PER_UNIT;
      metres += m;
      secs += m / 1.2;
    } else {
      const floors = Math.abs(LEVEL[a.floor] - LEVEL[b.floor]);
      secs += kind === 'elevator' ? 30 + 6 * floors : kind === 'escalator' ? 35 : 22 * floors;
    }
  }
  return { metres: Math.max(1, Math.round(metres)), mins: Math.max(1, Math.round(secs / 60)) };
}

function routeSteps(r) {
  const steps = [];
  const start = NODES[r.path[0]];
  steps.push({ floor: start.floor, kind: 'start', html: `Start at <strong>${escapeHtml(r.from.name)}</strong> (${floorById[start.floor].name})` });
  const said = new Set();
  for (let k = 1; k < r.path.length; k++) {
    const a = NODES[r.path[k - 1]], b = NODES[r.path[k]], kind = r.kinds[k - 1];
    if (a.floor !== b.floor) {
      let j = k;
      while (j < r.path.length - 1 && NODES[r.path[j]].floor !== NODES[r.path[j + 1]].floor && r.kinds[j] === kind) j++;
      const dest = NODES[r.path[j]];
      const up = LEVEL[dest.floor] > LEVEL[a.floor];
      steps.push({ floor: a.floor, kind, html: `Take <strong>${escapeHtml(a.say ?? VERT_LABEL[kind])}</strong> ${up ? 'up' : 'down'} to <strong>${floorById[dest.floor].name}</strong>` });
      k = j;
      continue;
    }
    if (b.say && !verticalNodes.has(b.id) && k < r.path.length - 1 && !said.has(b.id)) {
      said.add(b.id);
      steps.push({ floor: b.floor, kind: 'walk', html: `Continue through ${escapeHtml(b.say)}` });
    }
  }
  const end = NODES[r.path.at(-1)];
  steps.push({ floor: end.floor, kind: 'end', html: `Arrive at <strong>${escapeHtml(r.to.name)}</strong> (${floorById[end.floor].name})` });
  return steps;
}

// Evacuation paths: nearest exit on the same floor, walking only (never lifts or escalators).
function evacuationSegments(floor) {
  const exits = Object.values(NODES).filter((n) => n.floor === floor && n.exit).map((n) => n.id);
  if (!exits.length) return [];
  const { prev } = dijkstra(exits, { allow: (e) => e.kind === 'walk' });
  const segs = new Map();
  for (const z of ZONES) {
    if (z.floor !== floor || !z.node || z.vertical) continue;
    for (let cur = z.node; prev.has(cur);) {
      const p = prev.get(cur);
      const key = `${cur}>${p.from}`;
      if (segs.has(key)) break;
      segs.set(key, [NODES[cur], NODES[p.from]]);
      cur = p.from;
    }
  }
  return [...segs.values()];
}

// ---------- rendering ----------

const zoneFloorLabel = (z) => `${z.building === 'mall' ? 'Galleria' : 'Hotel'} · ${floorById[z.floor].name}`;

function fitLabel(name, w, h) {
  for (const size of [12, 10.5, 9]) {
    const maxChars = Math.max(3, Math.floor((w - 8) / (size * 0.56)));
    const lines = [];
    for (const word of name.split(' ')) {
      const last = lines.at(-1);
      if (last && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = last + ' ' + word;
      else lines.push(word);
    }
    const fits = lines.every((l) => l.length <= maxChars + 1) && lines.length * size * 1.18 <= h - 4;
    if (fits) return { size, lines };
  }
  return null;
}

function zoneMarkup(z) {
  const [x, y, w, h] = z.rect;
  const cls = ['mz', `mz--${z.type}`];
  if (state.selected === z.id) cls.push('is-selected');
  if (state.view !== 'all' && z.building !== state.view) cls.push('is-muted');
  if (state.highlightType && z.type !== state.highlightType) cls.push('is-dim');
  if (state.query && matches(z, state.query)) cls.push('is-match');
  if (state.route && (state.route.from.id === z.id || state.route.to.id === z.id)) cls.push('is-endpoint');
  const fit = fitLabel(z.name, w, h);
  const cx = x + w / 2, cy = y + h / 2 + (z.labelDy ?? 0);
  const text = fit
    ? `<text class="mz__label" x="${cx}" y="${cy - ((fit.lines.length - 1) * fit.size * 1.18) / 2}" font-size="${fit.size}">${fit.lines
      .map((l, i) => `<tspan x="${cx}" dy="${i ? fit.size * 1.18 : 0}">${escapeHtml(l)}</tspan>`).join('')}</text>`
    : '';
  const label = `${z.name}, ${TYPES[z.type]}`;
  return `<g class="${cls.join(' ')}" data-zone="${z.id}" tabindex="0" role="button" aria-label="${escapeHtml(label)}">
    <title>${escapeHtml(z.name)}</title>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/>${text}</g>`;
}

function platesMarkup(floor) {
  const f = floorById[floor];
  const out = [];
  if (floor === 'G') {
    out.push(`<rect class="mp-ground" x="60" y="566" width="560" height="190" rx="18"/>`,
      `<rect class="mp-road" x="130" y="568" width="420" height="36" rx="18"/>`);
  }
  const [hx, hy, hw, hh] = BUILDINGS.hotel.rect;
  out.push(`<rect class="mp-building${state.view === 'mall' ? ' is-muted' : ''}" x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="10"/>`,
    `<text class="mp-title" x="${hx + 4}" y="${hy - 12}">HARAYA BAY BY ZALDY LAND</text>`);
  const [mx, my, mw, mh] = BUILDINGS.mall.rect;
  if (f.mall) {
    out.push(`<rect class="mp-building mp-building--mall${state.view === 'hotel' ? ' is-muted' : ''}" x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="10"/>`,
      `<text class="mp-title" x="${mx + 4}" y="${my - 12}">HARAYA BAY GALLERIA</text>`);
  } else {
    out.push(`<rect class="mp-building mp-building--ghost" x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="10"/>`,
      `<text class="mp-caption" x="${mx + mw / 2}" y="${my + mh / 2 - 8}">Haraya Bay Galleria</text>`,
      `<text class="mp-caption mp-caption--sm" x="${mx + mw / 2}" y="${my + mh / 2 + 12}">The mall has floors G, 2 and 3 only</text>`);
  }
  return out.join('');
}

function routeMarkup(floor) {
  const r = state.route;
  if (!r) return '';
  const out = [];
  let seg = [];
  const flush = () => {
    if (seg.length > 1) {
      const pts = seg.map((n) => `${n.x},${n.y}`).join(' ');
      out.push(`<polyline class="mr-casing" points="${pts}"/><polyline class="mr-line${r.accessible ? ' mr-line--access' : ''}" points="${pts}"/>`);
    }
    seg = [];
  };
  r.path.forEach((id, i) => {
    const n = NODES[id];
    if (n.floor !== floor) { flush(); return; }
    seg.push(n);
    const next = NODES[r.path[i + 1]];
    const prev = NODES[r.path[i - 1]];
    if (next && next.floor !== floor) {
      flush();
      let j = i + 1;
      while (j < r.path.length - 1 && NODES[r.path[j]].floor !== NODES[r.path[j + 1]].floor && r.kinds[j] === r.kinds[i]) j++;
      const dest = NODES[r.path[j]];
      const up = LEVEL[dest.floor] > LEVEL[floor];
      out.push(badge(n, `${up ? '▲' : '▼'} ${r.kinds[i]} to ${floorById[dest.floor].label}`, dest.floor));
    } else if (prev && prev.floor !== floor && seg.length === 1) {
      let j = i - 1;
      while (j > 0 && NODES[r.path[j - 1]].floor !== NODES[r.path[j]].floor && r.kinds[j - 1] === r.kinds[i - 1]) j--;
      out.push(badge(n, `from ${floorById[NODES[r.path[j]].floor].label}`, null, true));
    }
  });
  flush();
  const s = NODES[r.path[0]], e = NODES[r.path.at(-1)];
  if (s.floor === floor) out.push(`<g class="mr-pin mr-pin--start"><circle cx="${s.x}" cy="${s.y}" r="10"/><text x="${s.x}" y="${s.y + 4}">A</text></g>`);
  if (e.floor === floor) out.push(`<g class="mr-pin mr-pin--end"><circle cx="${e.x}" cy="${e.y}" r="10"/><text x="${e.x}" y="${e.y + 4}">B</text></g>`);
  return out.join('');
}

function badge(n, text, goFloor, muted = false) {
  const w = text.length * 6.4 + 16;
  const attrs = goFloor ? ` data-goto-floor="${goFloor}" role="button" tabindex="0" aria-label="Go to ${escapeHtml(floorById[goFloor].name)}"` : '';
  return `<g class="mr-badge${muted ? ' mr-badge--muted' : ''}"${attrs}><rect x="${n.x - w / 2}" y="${n.y - 50}" width="${w}" height="20" rx="10"/><text x="${n.x}" y="${n.y - 36}">${escapeHtml(text)}</text></g>`;
}

function safetyMarkup(floor) {
  if (!state.safety) return '';
  const out = ['<g class="ms">'];
  for (const [a, b] of evacuationSegments(floor)) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    out.push(`<path class="ms-evac" d="M${a.x} ${a.y} L${mx} ${my} L${b.x} ${b.y}" marker-mid="url(#evacArrow)"/>`);
  }
  for (const n of Object.values(NODES)) {
    if (n.floor !== floor) continue;
    if (n.exit) {
      const label = verticalNodes.has(n.id) ? 'EXIT STAIR' : 'EXIT';
      const w = label.length * 7 + 12;
      out.push(`<g class="ms-exit"><rect x="${n.x - w / 2}" y="${n.y - 9}" width="${w}" height="18" rx="3"/><text x="${n.x}" y="${n.y + 4}">${label}</text></g>`);
    }
    if (n.assembly) {
      const ax = n.x - 150, ay = n.y + 52;
      out.push(`<g class="ms-assembly"><circle cx="${ax}" cy="${ay}" r="16"/><text x="${ax}" y="${ay + 5}">AP</text>
        <text class="ms-assembly__label" x="${ax}" y="${ay + 34}">Assembly point (illustrative)</text></g>`);
    }
  }
  for (const [x, y] of SAFETY.extinguishers[floor] ?? []) out.push(`<g class="ms-icon ms-icon--fe"><rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="3"/><text x="${x}" y="${y + 3.5}">FE</text></g>`);
  for (const [x, y] of SAFETY.callPoints[floor] ?? []) out.push(`<g class="ms-icon ms-icon--cp"><rect x="${x - 7}" y="${y - 7}" width="14" height="14"/><circle cx="${x}" cy="${y}" r="3.5"/></g>`);
  for (const [x, y] of SAFETY.firstAid[floor] ?? []) out.push(`<g class="ms-icon ms-icon--fa"><rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="3"/><path d="M${x - 2.5} ${y - 6}h5v3.5h3.5v5h-3.5v3.5h-5v-3.5h-3.5v-5h3.5z"/></g>`);
  for (const [x, y] of SAFETY.aed[floor] ?? []) out.push(`<g class="ms-icon ms-icon--aed"><rect x="${x - 14}" y="${y - 9}" width="28" height="18" rx="3"/><text x="${x}" y="${y + 3.5}">AED</text></g>`);
  out.push(`<g class="ms-stamp"><rect x="370" y="-10" width="460" height="24" rx="4"/><text x="600" y="6">ILLUSTRATIVE ONLY · NOT A CERTIFIED EVACUATION PLAN</text></g>`);
  out.push('</g>');
  return out.join('');
}

function hereMarkup(floor) {
  const z = zoneById.get(state.here);
  if (!z || z.floor !== floor) return '';
  const n = NODES[z.node];
  return `<g class="mh" aria-hidden="true"><circle class="mh__pulse" cx="${n.x}" cy="${n.y}" r="14"/><circle class="mh__dot" cx="${n.x}" cy="${n.y}" r="7"/>
    <g class="mh__tag"><rect x="${n.x - 46}" y="${n.y + 12}" width="92" height="20" rx="10"/><text x="${n.x}" y="${n.y + 26}">You are here</text></g></g>`;
}

const DEFS = `<defs>
  <marker id="evacArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="ms-arrow"/></marker>
  <pattern id="staffHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="mz-hatch"/></pattern>
</defs>`;

function render() {
  const floor = state.floor;
  const zones = ZONES.filter((z) => z.floor === floor);
  svg.innerHTML = `<title id="mapSvgTitle">${escapeHtml(floorById[floor].name)} floor plan</title>${DEFS}
    <g class="mp">${platesMarkup(floor)}</g>
    <g class="mzs">${zones.map(zoneMarkup).join('')}</g>
    ${floor === 'G' ? `<g class="mp-decor" aria-hidden="true"><circle class="mp-fountain" cx="470" cy="676" r="30"/><circle class="mp-fountain mp-fountain--inner" cx="470" cy="676" r="12"/>
      <text class="mp-caption mp-caption--sm" x="470" y="725">Grand Entrance Fountain</text></g>` : ''}
    <g class="mrs">${routeMarkup(floor)}</g>
    ${safetyMarkup(floor)}
    ${hereMarkup(floor)}`;
  $('floorName').textContent = `${floorById[floor].name}${floorById[floor].mall ? '' : ' · hotel only'}`;
  renderFloorTabs();
  applyViewBox();
}

function renderFloorTabs() {
  const routeFloors = new Set(state.route ? state.route.path.map((id) => NODES[id].floor) : []);
  const hereFloor = zoneById.get(state.here)?.floor;
  $('floorTabs').innerHTML = FLOORS.map((f) => `<button type="button" role="tab" class="map-floor${f.id === state.floor ? ' is-active' : ''}" data-floor="${f.id}"
      aria-selected="${f.id === state.floor}" title="${escapeHtml(f.name)}">${f.label}${routeFloors.has(f.id) ? '<span class="map-floor__dot" aria-label="(on route)"></span>' : ''}${hereFloor === f.id ? '<span class="map-floor__here" aria-label="(you are here)"></span>' : ''}</button>`).join('')
    + '<span class="map-floors__note">Guest floors 5–8 are private</span>';
}

function renderLegend() {
  const types = Object.entries(TYPES).map(([k, label]) => `<button type="button" class="map-legend__item" data-type="${k}" aria-pressed="${state.highlightType === k}">
      <span class="map-swatch mz--${k}"></span>${escapeHtml(label)}</button>`).join('');
  const extra = `<span class="map-legend__item map-legend__static"><span class="map-key map-key--here"></span>You are here</span>
    <span class="map-legend__item map-legend__static"><span class="map-key map-key--route"></span>Route</span>
    <span class="map-legend__item map-legend__static"><span class="map-key map-key--access"></span>Step-free route</span>`;
  const safety = state.safety ? `<div class="map-legend__safety"><strong>Safety layer (illustrative, not validated):</strong>
      <span><span class="map-key map-key--exit">EXIT</span> Exit / protected stair</span>
      <span><span class="map-key map-key--evac"></span> Evacuation path (walking, no lifts)</span>
      <span><span class="map-key map-key--fe">FE</span> Fire extinguisher</span>
      <span><span class="map-key map-key--cp"></span> Fire alarm call point</span>
      <span><span class="map-key map-key--fa">+</span> First aid</span>
      <span><span class="map-key map-key--aed">AED</span> Defibrillator</span>
      <span><span class="map-key map-key--ap">AP</span> Assembly point</span></div>` : '';
  $('legend').innerHTML = `<div class="map-legend__row">${types}${extra}</div>${safety}`;
}

// ---------- view box: zoom & pan ----------

function fitBox(name) {
  const narrow = name === 'all' && svg.clientWidth > 0 && svg.clientWidth < 600;
  const [x, y, w, h] = VIEW_BOX[narrow ? 'hotel' : name];
  return { x, y, w, h };
}

function clampVB(vb) {
  const base = fitBox(state.view);
  const minW = 160;
  const maxW = Math.max(base.w, PLAN.w);
  const ratio = vb.h / vb.w;
  const w = Math.min(maxW, Math.max(minW, vb.w));
  const h = w * ratio;
  const x = Math.min(PLAN.w - w * 0.3, Math.max(-w * 0.7, vb.x));
  const y = Math.min(PLAN.h - h * 0.3, Math.max(-h * 0.7, vb.y));
  return { x, y, w, h };
}

function applyViewBox() {
  if (!state.vb) state.vb = fitBox(state.view);
  const { x, y, w, h } = state.vb;
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
}

let anim = 0;
function animateTo(target, ms = 320) {
  cancelAnimationFrame(anim);
  const from = { ...state.vb };
  const to = clampVB(target);
  const t0 = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = (now) => {
    const t = reduce ? 1 : Math.min(1, (now - t0) / ms);
    const k = 1 - (1 - t) ** 3;
    state.vb = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, w: from.w + (to.w - from.w) * k, h: from.h + (to.h - from.h) * k };
    applyViewBox();
    if (t < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

function zoomAt(factor, cx, cy) {
  const vb = state.vb;
  const next = clampVB({ ...vb, w: vb.w / factor, h: vb.h / factor });
  const f = next.w / vb.w;
  state.vb = clampVB({ x: cx - (cx - vb.x) * f, y: cy - (cy - vb.y) * f, w: next.w, h: next.h });
  applyViewBox();
}

function toSvgPoint(clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function centreOn(x, y, w = 420) {
  const ratio = state.vb.h / state.vb.w;
  animateTo({ x: x - w / 2, y: y - (w * ratio) / 2, w, h: w * ratio });
}

function focusZone(z) {
  const [x, y, w, h] = z.rect;
  centreOn(x + w / 2, y + h / 2, Math.max(360, Math.max(w, h) * 2.4));
}

const pointers = new Map();
let panStart = null, pinchStart = null, suppressClick = false;

function initPanZoom() {
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toSvgPoint(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    suppressClick = false;
    if (pointers.size === 1) panStart = { x: e.clientX, y: e.clientY, vb: { ...state.vb }, moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...state.vb } };
      panStart = null;
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toSvgPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      const factor = (d / pinchStart.d) * (pinchStart.vb.w / state.vb.w);
      zoomAt(factor, mid.x, mid.y);
      suppressClick = true;
      return;
    }
    if (!panStart) return;
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if (!panStart.moved && Math.hypot(dx, dy) < 5) return;
    if (!panStart.moved) { panStart.moved = true; svg.setPointerCapture(e.pointerId); svg.classList.add('is-panning'); }
    const scale = 1 / svg.getScreenCTM().a;
    state.vb = clampVB({ ...panStart.vb, x: panStart.vb.x - dx * scale, y: panStart.vb.y - dy * scale });
    applyViewBox();
    suppressClick = true;
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) { panStart = null; svg.classList.remove('is-panning'); }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  document.querySelectorAll('[data-zoom]').forEach((btn) => btn.addEventListener('click', () => {
    const { x, y, w, h } = state.vb;
    const action = btn.dataset.zoom;
    if (action === 'in' || action === 'out') {
      const f = action === 'in' ? 1.4 : 1 / 1.4;
      const next = clampVB({ ...state.vb, w: w / f, h: h / f });
      animateTo({ x: x + (w - next.w) / 2, y: y + (h - next.h) / 2, w: next.w, h: next.h }, 200);
    } else if (action === 'reset') {
      animateTo(fitBox(state.view));
    } else if (action === 'here') {
      const z = zoneById.get(state.here);
      if (!z) return;
      if (z.floor !== state.floor) setFloor(z.floor);
      const n = NODES[z.node];
      centreOn(n.x, n.y, 380);
    }
  }));
}

// ---------- search ----------

const hayCache = new Map();
function haystack(z) {
  if (!hayCache.has(z.id)) {
    const text = [z.name, z.type === 'service' ? '' : TYPES[z.type], z.tags, z.venue, z.facility, BUILDINGS[z.building].name, floorById[z.floor].name, `level ${z.floor}`]
      .filter(Boolean).join(' ').toLowerCase();
    hayCache.set(z.id, text.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  }
  return hayCache.get(z.id);
}
function matches(z, q) {
  if (z.type === 'staff') return false;
  const words = haystack(z);
  return q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).every((t) => words.some((w) => w.startsWith(t)));
}

function renderResults() {
  const list = $('searchResults');
  const q = state.query;
  if (!q) { list.hidden = true; list.innerHTML = ''; return; }
  const found = ZONES.filter((z) => matches(z, q))
    .sort((a, b) => Number(!a.name.toLowerCase().includes(q.toLowerCase())) - Number(!b.name.toLowerCase().includes(q.toLowerCase())) || a.name.localeCompare(b.name));
  list.hidden = false;
  list.innerHTML = found.length
    ? found.slice(0, 14).map((z, i) => `<li role="option" id="res-${z.id}" aria-selected="${i === 0}"><button type="button" data-result="${z.id}">
        <span class="map-swatch mz--${z.type}"></span><span><strong>${escapeHtml(z.name)}</strong><small>${escapeHtml(TYPES[z.type])} · ${escapeHtml(zoneFloorLabel(z))}</small></span></button></li>`).join('')
      + (found.length > 14 ? `<li class="map-results__more">${found.length - 14} more, refine your search</li>` : '')
    : `<li class="map-results__empty">No places match “${escapeHtml(q)}”. Try “restroom”, “coffee” or “ballroom”.</li>`;
}

// ---------- selection & details ----------

function selectZone(id, { focus = true } = {}) {
  const z = zoneById.get(id);
  if (!z) return;
  state.selected = id;
  if (z.floor !== state.floor) state.floor = z.floor;
  if (state.view !== 'all' && z.building !== state.view) setView('all', false);
  render();
  renderZoneCard();
  if (focus) focusZone(z);
  syncUrl();
}

function renderZoneCard() {
  const card = $('zoneCard');
  const z = zoneById.get(state.selected);
  if (!z) { card.hidden = true; card.innerHTML = ''; return; }
  const fac = z.facility ? facilityById(z.facility) : null;
  const isHere = state.here === z.id;
  const staff = z.type === 'staff';
  const actions = staff ? '' : `
    <div class="map-zone__actions">
      <button class="btn btn--black btn--sm" type="button" data-act="to">Directions here</button>
      <button class="btn btn--sm" type="button" data-act="here" ${isHere ? 'disabled' : ''}>${isHere ? 'You are here' : 'I’m here'}</button>
      ${fac ? `<a class="btn btn--sm" href="/facility.html?id=${encodeURIComponent(fac.id)}">Explore in 3D</a>` : ''}
      ${z.venue ? `<a class="btn btn--sm" href="/events.html?venue=${encodeURIComponent(z.venue)}">See events</a>` : ''}
    </div>`;
  card.hidden = false;
  card.innerHTML = `
    <div class="map-zone__head">
      <span class="map-swatch mz--${z.type}"></span>
      <div>
        <div class="map-zone__eyebrow">${escapeHtml(TYPES[z.type])}</div>
        <h2 class="map-card__title">${escapeHtml(z.name)}</h2>
      </div>
      <button class="icon-btn map-zone__close" type="button" data-act="close" aria-label="Close details">&times;</button>
    </div>
    <p class="map-zone__where">${escapeHtml(zoneFloorLabel(z))}${z.venue ? ` · Venue code ${escapeHtml(z.venue)}` : ''}</p>
    ${z.desc ? `<p class="map-zone__desc">${escapeHtml(z.desc)}</p>` : ''}
    ${z.hours ? `<p class="map-zone__hours"><strong>Hours:</strong> ${escapeHtml(z.hours)}</p>` : ''}
    ${staff ? '<p class="map-zone__desc"><strong>No guest access.</strong></p>' : ''}
    ${z.building === 'mall' && z.type !== 'service' ? '<p class="hint">Fictional shop for this simulation. Hours are sample information.</p>' : ''}
    ${actions}`;
}

function setHere(id) {
  if (!zoneById.has(id)) return;
  state.here = id;
  try { localStorage.setItem(HERE_KEY, id); } catch { /* storage unavailable */ }
  $('routeFrom').value = id;
  render();
  renderZoneCard();
}

// ---------- directions ----------

function fillSelects() {
  const groups = FLOORS.map((f) => {
    const opts = ZONES.filter((z) => z.floor === f.id && z.type !== 'staff')
      .sort((a, b) => a.building.localeCompare(b.building) || a.name.localeCompare(b.name))
      .map((z) => `<option value="${z.id}">${escapeHtml(z.name)}${z.building === 'mall' ? ' (Galleria)' : ''}</option>`).join('');
    return `<optgroup label="${escapeHtml(f.name)}">${opts}</optgroup>`;
  }).join('');
  $('routeFrom').innerHTML = groups;
  $('routeTo').innerHTML = `<option value="">Choose a destination</option>${groups}`;
  $('routeFrom').value = state.here;
}

function showRoute(fromId, toId, accessible) {
  const out = $('routeResult');
  const from = zoneById.get(fromId), to = zoneById.get(toId);
  if (!from || !to) { out.innerHTML = '<p class="form-alert form-alert--error">Choose both a start and a destination.</p>'; return; }
  if (from.id === to.id) { out.innerHTML = '<p class="form-alert form-alert--error">Start and destination are the same place.</p>'; return; }
  const r = findRoute(from, to, accessible);
  if (!r) {
    state.route = null;
    out.innerHTML = `<p class="form-alert form-alert--error">No ${accessible ? 'step-free ' : ''}route found between these places.</p>`;
    render();
    return;
  }
  state.route = r;
  const { metres, mins } = routeStats(r);
  const steps = routeSteps(r);
  out.innerHTML = `
    <div class="map-route-sum">
      <div><strong>${mins} min</strong><span>approx. walk</span></div>
      <div><strong>${metres} m</strong><span>walking distance</span></div>
      <div><strong>${new Set(r.path.map((id) => NODES[id].floor)).size}</strong><span>floor${new Set(r.path.map((id) => NODES[id].floor)).size > 1 ? 's' : ''}</span></div>
    </div>
    ${accessible ? '<p class="map-route-note">Step-free: uses lifts and level walkways only.</p>' : ''}
    <ol class="map-steps">${steps.map((s) => `<li class="map-step map-step--${s.kind}"><button type="button" data-step-floor="${s.floor}">
      <span class="map-step__floor">${floorById[s.floor].label}</span><span>${s.html}</span></button></li>`).join('')}</ol>
    <p class="hint">Simulated directions on an illustrative plan. Times are estimates.</p>`;
  state.floor = NODES[r.path[0]].floor;
  state.selected = to.id;
  render();
  renderZoneCard();
  animateTo(fitBox(state.view));
  syncUrl();
}

function clearRoute() {
  state.route = null;
  $('routeResult').innerHTML = '';
  $('routeTo').value = '';
  render();
  syncUrl();
}

// ---------- floors, views, safety ----------

function setFloor(id) {
  if (!floorById[id] || id === state.floor) return;
  state.floor = id;
  if (state.view === 'mall' && !floorById[id].mall) setView('all', false);
  render();
  syncUrl();
}

function setView(view, rerender = true) {
  state.view = view;
  document.querySelectorAll('#viewToggle [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  if (view === 'mall' && !floorById[state.floor].mall) state.floor = 'G';
  if (rerender) { render(); animateTo(fitBox(view)); syncUrl(); }
}

function setSafety(on) {
  state.safety = on;
  $('safetyToggle').checked = on;
  $('safetyWarning').hidden = !on;
  render();
  renderLegend();
  syncUrl();
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.floor !== 'G') p.set('floor', state.floor);
  if (state.view !== 'all') p.set('view', state.view);
  if (state.route) {
    p.set('from', state.route.from.id);
    p.set('to', state.route.to.id);
    if (state.route.accessible) p.set('accessible', '1');
  } else if (state.selected) p.set('find', state.selected);
  if (state.safety) p.set('safety', '1');
  const qsText = p.toString();
  history.replaceState(null, '', qsText ? `?${qsText}` : location.pathname);
}

function resolveZone(key) {
  if (!key) return null;
  const k = key.trim();
  return zoneById.get(k) ?? ZONES.find((z) => z.venue && z.venue.toLowerCase() === k.toLowerCase())
    ?? ZONES.find((z) => z.facility === k.toLowerCase()) ?? null;
}

// ---------- events ----------

function bind() {
  svg.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const go = e.target.closest('[data-goto-floor]');
    if (go) { setFloor(go.dataset.gotoFloor); return; }
    const g = e.target.closest('[data-zone]');
    if (g && !g.classList.contains('is-muted')) selectZone(g.dataset.zone, { focus: false });
  });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const go = e.target.closest('[data-goto-floor]');
    if (go) { e.preventDefault(); setFloor(go.dataset.gotoFloor); return; }
    const g = e.target.closest('[data-zone]');
    if (g) { e.preventDefault(); selectZone(g.dataset.zone); setTimeout(() => svg.querySelector(`[data-zone="${g.dataset.zone}"]`)?.focus(), 0); }
  });

  $('floorTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-floor]');
    if (b) setFloor(b.dataset.floor);
  });
  $('floorTabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = FLOORS.findIndex((f) => f.id === state.floor);
    const next = FLOORS[(i + (e.key === 'ArrowRight' ? 1 : FLOORS.length - 1)) % FLOORS.length];
    setFloor(next.id);
    $('floorTabs').querySelector(`[data-floor="${next.id}"]`)?.focus();
  });

  $('viewToggle').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) setView(b.dataset.view);
  });
  $('safetyToggle').addEventListener('change', (e) => setSafety(e.target.checked));

  $('legend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    state.highlightType = state.highlightType === b.dataset.type ? null : b.dataset.type;
    render();
    renderLegend();
  });

  const q = $('mapQ');
  q.addEventListener('input', () => { state.query = q.value.trim(); renderResults(); render(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { q.value = ''; state.query = ''; renderResults(); render(); }
  });
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = $('searchResults').querySelector('[data-result]');
    if (first) selectZone(first.dataset.result);
  });
  $('searchResults').addEventListener('click', (e) => {
    const b = e.target.closest('[data-result]');
    if (b) selectZone(b.dataset.result);
  });

  $('routeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showRoute($('routeFrom').value, $('routeTo').value, $('routeAccessible').checked);
  });
  $('routeAccessible').addEventListener('change', () => {
    if (state.route) showRoute(state.route.from.id, state.route.to.id, $('routeAccessible').checked);
  });
  $('swapRoute').addEventListener('click', () => {
    const a = $('routeFrom').value, b = $('routeTo').value;
    if (!b) return;
    $('routeFrom').value = b;
    $('routeTo').value = a;
    if (state.route) showRoute(b, a, $('routeAccessible').checked);
  });
  $('clearRoute').addEventListener('click', clearRoute);
  $('routeResult').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step-floor]');
    if (b) setFloor(b.dataset.stepFloor);
  });

  $('zoneCard').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const z = zoneById.get(state.selected);
    if (b.dataset.act === 'close') { state.selected = null; renderZoneCard(); render(); syncUrl(); }
    if (b.dataset.act === 'here') setHere(z.id);
    if (b.dataset.act === 'to') {
      const from = state.here === z.id ? null : state.here;
      $('routeTo').value = z.id;
      if (!from) { $('routeResult').innerHTML = '<p class="form-alert form-alert--info">You are already here. Choose a different starting point.</p>'; $('routeFrom').focus(); return; }
      $('routeFrom').value = from;
      showRoute(from, z.id, $('routeAccessible').checked);
      $('routeCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// ---------- init ----------

function init() {
  try {
    const saved = localStorage.getItem(HERE_KEY);
    if (saved && zoneById.has(saved)) state.here = saved;
  } catch { /* storage unavailable */ }

  const p = new URLSearchParams(location.search);
  if (['hotel', 'mall', 'all'].includes(p.get('view'))) state.view = p.get('view');
  document.querySelectorAll('#viewToggle [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  if (floorById[p.get('floor')?.toUpperCase()]) state.floor = p.get('floor').toUpperCase();
  state.vb = fitBox(state.view);
  state.safety = p.get('safety') === '1';
  $('safetyToggle').checked = state.safety;
  $('safetyWarning').hidden = !state.safety;

  fillSelects();
  bind();
  initPanZoom();
  renderLegend();
  render();

  const from = resolveZone(p.get('from')), to = resolveZone(p.get('to'));
  const find = resolveZone(p.get('find'));
  if (to) {
    $('routeAccessible').checked = p.get('accessible') === '1';
    $('routeFrom').value = (from ?? zoneById.get(state.here)).id;
    $('routeTo').value = to.id;
    showRoute($('routeFrom').value, to.id, $('routeAccessible').checked);
  } else if (find) {
    selectZone(find.id);
  } else if (p.get('find')) {
    $('mapQ').value = p.get('find');
    state.query = p.get('find');
    renderResults();
    render();
  }
}

const year = $('year');
if (year) year.textContent = new Date().getFullYear();

try {
  init();
} catch (err) {
  console.error(err);
  $('mapStage').innerHTML = `<div class="map-error" role="alert"><strong>The map could not be loaded.</strong><p>${escapeHtml(err.message)}</p>
    <button class="btn" type="button" onclick="location.reload()">Try again</button></div>`;
}
