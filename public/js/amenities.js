import { escapeHtml } from './common.js';
import { FACILITIES, ACCESS, CATEGORIES, facilityById, facilityImage, facilityKind } from './facilities-data.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  id: FACILITIES[0].id,
  filter: 'all',
  viewer: null,
  scenes: null,
  fallback: false,
  request: 0,
};

const accessPill = (access, text) =>
  `<span class="access-pill access-pill--${ACCESS[access].tone}">${escapeHtml(text ?? ACCESS[access].label)}</span>`;

const exploreUrl = (id) => `/facility.html?id=${id}`;

// ---------- cards ----------

function renderChips() {
  const options = [['all', 'All facilities'], ...Object.entries(CATEGORIES)];
  $('#filterChips').innerHTML = options.map(([value, label]) =>
    `<button type="button" class="filter-chip" data-filter="${value}" aria-pressed="${value === state.filter}">${escapeHtml(label)}</button>`).join('');
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    state.filter = b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderCards();
  }));
}

function renderCards() {
  const list = FACILITIES.filter((f) => state.filter === 'all' || f.category === state.filter);
  $('#amenGrid').innerHTML = list.map((f) => `
    <article class="amen-card${f.id === state.id ? ' is-previewing' : ''}" data-id="${f.id}">
      <div class="amen-card__media">
        <img src="${facilityImage(f.id)}" alt="${escapeHtml(f.name)} preview" loading="lazy" onerror="this.hidden=true">
        <span class="amen-card__3d">3D</span>
        <span class="amen-card__previewing">Showing in preview</span>
      </div>
      <div class="amen-card__body">
        <div class="amen-card__cat">${escapeHtml(CATEGORIES[f.category])} &middot; ${escapeHtml(facilityKind(f))}</div>
        <h3>${escapeHtml(f.name)}</h3>
        <p class="amen-card__tagline">${escapeHtml(f.tagline)}</p>
        <p>${escapeHtml(f.description)}</p>
        <ul class="amenities">${f.features.slice(0, 4).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        <div class="amen-card__meta">
          ${accessPill(f.access)}
          <span class="amen-card__hours">${escapeHtml(f.hours)}</span>
        </div>
        <div class="amen-card__actions">
          <button type="button" class="btn btn--sm" data-view="${f.id}">View Facility</button>
          <a class="btn btn--black btn--sm" href="${exploreUrl(f.id)}">Explore in 3D</a>
          ${f.venue ? `<a class="btn btn--sm" href="/events.html?venue=${f.venue}">See events</a>` : ''}
        </div>
      </div>
    </article>`).join('');
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    previewFacility(b.dataset.view);
    $('#preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function renderStageInfo() {
  const f = facilityById(state.id);
  const zones = f.zones ? `<ul class="zone-list">${f.zones.map((z) => `<li><span>${escapeHtml(z.name)}</span>${accessPill(z.access, ACCESS[z.access].short)}</li>`).join('')}</ul>` : '';
  $('#stageInfo').innerHTML = `
    <div class="eyebrow">${escapeHtml(CATEGORIES[f.category])} &middot; ${escapeHtml(facilityKind(f))}</div>
    <h2>${escapeHtml(f.name)}</h2>
    <p class="amen-stage__tagline">${escapeHtml(f.tagline)}</p>
    ${accessPill(f.access)}
    <dl class="tour-facts">
      <div><dt>Hours</dt><dd>${escapeHtml(f.hours)}</dd></div>
      <div><dt>Location</dt><dd>${escapeHtml(f.location)}</dd></div>
    </dl>
    <p>${escapeHtml(f.accessNote)} <span class="sample-tag">Sample info</span></p>
    ${zones}
    <div class="amen-stage__actions">
      <a class="btn btn--black" href="${exploreUrl(f.id)}">Explore in 3D</a>
      ${f.venue ? `<a class="btn" href="/events.html?venue=${f.venue}">See events</a>` : '<a class="btn" href="/#rooms">Book a room</a>'}
    </div>
    <div class="amen-stage__picker" role="group" aria-label="Preview another facility">
      ${FACILITIES.map((x) => `<button type="button" class="stage-dot" data-preview="${x.id}" aria-pressed="${x.id === state.id}" title="${escapeHtml(x.name)}"><span class="visually-hidden">${escapeHtml(x.name)}</span></button>`).join('')}
    </div>`;
  document.querySelectorAll('[data-preview]').forEach((b) => b.addEventListener('click', () => previewFacility(b.dataset.preview)));
}

// ---------- preview viewer ----------

function setLoading(on, text) {
  $('#viewerLoading').hidden = !on;
  if (text) $('#viewerLoadingText').textContent = text;
}

function showFallback(message) {
  state.fallback = true;
  const f = facilityById(state.id);
  setLoading(false);
  $('#viewerBadge').hidden = true;
  if (message) $('#fallbackText').textContent = message;
  $('#fallbackImg').src = facilityImage(f.id);
  $('#fallbackImg').alt = `${f.name} preview image`;
  $('#viewerFallback').hidden = false;
}

async function loadPreview() {
  if (state.fallback) return showFallback();
  if (!state.viewer) return;
  const request = ++state.request;
  const f = facilityById(state.id);
  setLoading(true, `Building the ${f.name}…`);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const scene = await state.scenes.buildFacilityScene(f.id);
    if (request !== state.request) return;
    state.viewer.setScene(scene);
    state.viewer.startTour(4800);
    setLoading(false);
    $('#viewerBadge').hidden = false;
  } catch (err) {
    console.error(err);
    if (request === state.request) showFallback('Something went wrong while building this 3D preview, so we are showing an image instead.');
  }
}

function previewFacility(id) {
  if (!facilityById(id)) return;
  const changed = id !== state.id;
  state.id = id;
  renderStageInfo();
  document.querySelectorAll('.amen-card').forEach((c) => c.classList.toggle('is-previewing', c.dataset.id === id));
  history.replaceState(null, '', `/amenities.html?id=${id}`);
  if (changed || !state.viewer?.room) loadPreview();
}

async function initViewer() {
  let viewerMod;
  try {
    [viewerMod, state.scenes] = await Promise.all([import('./room3d/viewer.js'), import('./facility3d/index.js')]);
  } catch (err) {
    console.error(err);
    return showFallback('The 3D viewer could not be loaded, so a preview image is shown instead.');
  }
  if (!viewerMod.webglAvailable()) return showFallback();
  try {
    state.viewer = new viewerMod.RoomViewer($('#viewer'), {
      onInteract: () => $('#viewerBadge').classList.add('is-fading'),
      onError: (msg) => showFallback(msg),
    });
    state.viewer.setMarkersVisible(false);
  } catch (err) {
    console.error(err);
    return showFallback('Your device could not start the 3D renderer (WebGL), so a preview image is shown instead.');
  }
  loadPreview();
}

function init() {
  $('#year').textContent = new Date().getFullYear();
  const id = new URLSearchParams(location.search).get('id');
  if (facilityById(id)) state.id = id;
  renderChips();
  renderCards();
  renderStageInfo();
  initViewer();
}

init();
