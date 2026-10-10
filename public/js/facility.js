import { api, escapeHtml, fmtDate } from './common.js';
import { FACILITIES, ACCESS, CATEGORIES, facilityById, facilityImage, facilityKind } from './facilities-data.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  id: FACILITIES[0].id,
  viewer: null,
  scenes: null, // facility3d registry module
  scene: null, // currently displayed scene description
  fallback: false,
  hintShown: false,
  hotspots: [],
  selected: null,
  request: 0,
  venue: null, // venue record from /api/venues for venue facilities
  schedule: null,
  layout: null, // active room setup id (ballroom)
};

const current = () => facilityById(state.id);

// ---------- URL, tabs and panel ----------

function readParams() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (facilityById(id)) state.id = id;
  state.layout = params.get('setup') || null;
}

function syncUrl() {
  history.replaceState(null, '', `/facility.html?id=${state.id}${state.layout ? `&setup=${encodeURIComponent(state.layout)}` : ''}`);
}

function accessPill(access, text) {
  const a = ACCESS[access];
  return `<span class="access-pill access-pill--${a.tone}">${escapeHtml(text ?? a.label)}</span>`;
}

function renderTabs() {
  $('#facilityTabs').innerHTML = FACILITIES.map((f) => `
    <button class="facility-tab" type="button" role="tab" data-id="${f.id}"
      aria-selected="${f.id === state.id}" tabindex="${f.id === state.id ? 0 : -1}">
      <span class="facility-tab__cat">${escapeHtml(CATEGORIES[f.category])}</span>
      <span class="facility-tab__name">${escapeHtml(f.name)}</span>
    </button>`).join('');
  const tabs = [...document.querySelectorAll('.facility-tab')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectFacility(tab.dataset.id));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      selectFacility(next.dataset.id);
    });
  });
}

function markTabs() {
  document.querySelectorAll('.facility-tab').forEach((tab) => {
    const active = tab.dataset.id === state.id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) centerTab(tab);
  });
}

function centerTab(tab) {
  const strip = tab.parentElement;
  const offset = tab.getBoundingClientRect().left - strip.getBoundingClientRect().left;
  strip.scrollLeft += offset - (strip.clientWidth - tab.offsetWidth) / 2;
}

function renderPanel() {
  const f = current();
  if (f.venue) return renderVenuePanel(f);
  const zones = f.zones ? `
    <h3 class="tour-panel__label">Zones &amp; access</h3>
    <ul class="zone-list">${f.zones.map((z) => `<li><span>${escapeHtml(z.name)}</span>${accessPill(z.access, ACCESS[z.access].short)}</li>`).join('')}</ul>` : '';
  $('#facilityPanel').innerHTML = `
    <div class="tour-panel__head">
      <div class="eyebrow">${escapeHtml(CATEGORIES[f.category])} &middot; ${escapeHtml(facilityKind(f))}</div>
      <h2>${escapeHtml(f.name)}</h2>
      ${accessPill(f.access)}
    </div>
    <div class="hotspot-card" id="hotspotCard"></div>
    <dl class="tour-facts">
      <div><dt>Hours</dt><dd>${escapeHtml(f.hours)}</dd></div>
      <div><dt>Location</dt><dd>${escapeHtml(f.location)}</dd></div>
      <div><dt>Capacity</dt><dd>${escapeHtml(f.capacity)}</dd></div>
      <div><dt>Access</dt><dd>${escapeHtml(ACCESS[f.access].short)}</dd></div>
    </dl>
    <p class="tour-panel__desc">${escapeHtml(f.description)}</p>
    <h3 class="tour-panel__label">Explore inside</h3>
    <div class="hotspot-list" id="hotspotList"><span class="hint">Loading points of interest…</span></div>
    <h3 class="tour-panel__label">Facility features</h3>
    <ul class="amenities">${f.features.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    ${zones}
    <div class="facility-note">
      <strong>Access &amp; rules <span class="sample-tag">Sample info</span></strong>
      <p>${escapeHtml(f.accessNote)}</p>
      <p class="hint">Shared facilities are separate from your room’s in-room features. Booking a room does not reserve a facility slot in this simulation.</p>
    </div>
    <div class="facility-cta">
      <a class="btn btn--black" href="/#rooms">Book a room</a>
      <a class="btn" href="/amenities.html">Back to Amenities</a>
    </div>`;
  renderHotspotList();
  renderHotspotCard();
}

// ---------- venue facilities (fountain plaza, theater, ballroom) ----------

function renderVenuePanel(f) {
  $('#facilityPanel').innerHTML = `
    <div class="tour-panel__head">
      <div class="eyebrow">${escapeHtml(CATEGORIES[f.category])} &middot; ${escapeHtml(facilityKind(f))}</div>
      <h2>${escapeHtml(f.name)}</h2>
      ${accessPill(f.access)}
    </div>
    <div class="hotspot-card" id="hotspotCard"></div>
    <div id="layoutPicker"></div>
    <dl class="tour-facts">
      <div><dt>Hours</dt><dd>${escapeHtml(f.hours)}</dd></div>
      <div><dt>Location</dt><dd>${escapeHtml(f.location)}</dd></div>
      <div><dt>Capacity</dt><dd id="venueCapacity">${escapeHtml(f.capacity)}</dd></div>
      <div><dt>Access</dt><dd>${escapeHtml(ACCESS[f.access].short)}</dd></div>
    </dl>
    <p class="tour-panel__desc">${escapeHtml(f.description)}</p>
    <h3 class="tour-panel__label">Explore inside</h3>
    <div class="hotspot-list" id="hotspotList"><span class="hint">Loading points of interest…</span></div>
    <h3 class="tour-panel__label">${f.venue === 'THEATER' ? 'Scheduled performances' : 'Upcoming events here'}</h3>
    <div id="venueSchedule" aria-live="polite"><div class="loading-inline"><span class="spinner spinner--sm" aria-hidden="true"></span> Loading schedule…</div></div>
    <h3 class="tour-panel__label">Venue features</h3>
    <ul class="amenities">${f.features.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    <div class="facility-note">
      <strong>Access &amp; booking <span class="sample-tag">Sample info</span></strong>
      <p>${escapeHtml(f.accessNote)}</p>
      <p class="hint">Capacities, layouts and schedules are sample information for this simulation. Venue requests are reviewed by the events team and no payment is taken.</p>
    </div>
    <div class="facility-cta">
      <a class="btn btn--black" id="bookVenue" href="${bookUrl(f)}">Book This Venue</a>
      <a class="btn" href="/events.html?venue=${f.venue}">See all events</a>
      <a class="btn" href="/amenities.html">Back to Amenities</a>
    </div>`;
  renderHotspotList();
  renderHotspotCard();
  renderLayoutPicker();
  loadVenue(f);
}

function bookUrl(f) {
  return `/events.html?book=${f.venue}${state.layout ? `&setup=${encodeURIComponent(state.layout)}` : ''}`;
}

function setupOptions() {
  const fromVenue = state.venue?.setups ?? [];
  if (fromVenue.length) return fromVenue;
  return state.scene?.layouts?.items ?? [];
}

function renderLayoutPicker() {
  const slot = $('#layoutPicker');
  if (!slot) return;
  const options = setupOptions();
  if (!options.length) { slot.innerHTML = ''; return; }
  if (!options.some((o) => o.id === state.layout)) state.layout = state.scene?.layouts?.active ?? options[0].id;
  const active = options.find((o) => o.id === state.layout);
  slot.innerHTML = `
    <h3 class="tour-panel__label">Room setup</h3>
    <div class="setup-picker" role="group" aria-label="Room setup">
      ${options.map((o) => `
        <button type="button" class="setup-opt" data-setup="${escapeHtml(o.id)}" aria-pressed="${o.id === state.layout}">
          <strong>${escapeHtml(o.label)}</strong>
          ${o.capacity ? `<span>Up to ${o.capacity} guests</span>` : ''}
        </button>`).join('')}
    </div>
    ${active?.note ? `<p class="hint setup-note">${escapeHtml(active.note)}</p>` : ''}`;
  slot.querySelectorAll('[data-setup]').forEach((b) => b.addEventListener('click', () => selectLayout(b.dataset.setup)));
  const cap = $('#venueCapacity');
  if (cap && active?.capacity) cap.textContent = `${active.capacity} guests (${active.label.toLowerCase()}) · max ${state.venue?.capacity ?? active.capacity}`;
}

function selectLayout(id) {
  state.layout = id;
  const layouts = state.scene?.layouts;
  if (layouts && layouts.active !== id) {
    layouts.select(id);
    if (state.viewer) state.viewer.renderer.shadowMap.needsUpdate = true;
  }
  syncUrl();
  renderLayoutPicker();
  renderHotspotCard();
  const book = $('#bookVenue');
  if (book) book.href = bookUrl(current());
}

function scheduleHtml(events) {
  if (!events.length) return '<p class="hint">No public events are scheduled here yet. Check back soon or send a booking request.</p>';
  return `<ul class="venue-sched">${events.map((e) => {
    const d = new Date(`${e.date}T00:00:00`);
    const title = e.id ? `<a href="/events.html?event=${e.id}">${escapeHtml(e.title)}</a>` : `<span>${escapeHtml(e.title)}</span>`;
    return `<li>
      <div class="venue-sched__date"><strong>${d.getDate()}</strong><span>${d.toLocaleString('en-PH', { month: 'short' })}</span></div>
      <div class="venue-sched__body">${title}
        <small>${escapeHtml(fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))} · ${escapeHtml(e.startTime)}–${escapeHtml(e.endTime)}${e.setupLabel ? ` · ${escapeHtml(e.setupLabel)}` : ''}</small>
      </div>
      ${e.phase === 'Ongoing' ? '<span class="status status--ongoing">Ongoing</span>' : ''}
    </li>`;
  }).join('')}</ul>`;
}

async function loadVenue(f) {
  const slot = () => (state.id === f.id ? $('#venueSchedule') : null);
  try {
    const [{ venues }, { events }] = await Promise.all([
      state.venue?.code === f.venue ? { venues: [state.venue] } : api('/venues'),
      api(`/venues/${f.venue}/schedule`),
    ]);
    if (!slot()) return;
    state.venue = venues.find((v) => v.code === f.venue) ?? null;
    state.schedule = events;
    slot().innerHTML = scheduleHtml(events);
    renderLayoutPicker();
  } catch (err) {
    if (!slot()) return;
    slot().innerHTML = `<div class="form-alert form-alert--error" role="alert">Could not load the venue schedule (${escapeHtml(err.message)}). <button type="button" class="btn btn--sm" id="retryVenue">Try again</button></div>`;
    $('#retryVenue').addEventListener('click', () => {
      slot().innerHTML = '<div class="loading-inline"><span class="spinner spinner--sm" aria-hidden="true"></span> Loading schedule…</div>';
      loadVenue(f);
    });
  }
}

function renderHotspotList() {
  const list = $('#hotspotList');
  if (!list) return;
  if (state.fallback) { list.innerHTML = '<span class="hint">Points of interest are available in the 3D view.</span>'; return; }
  if (!state.hotspots.length) return;
  list.innerHTML = state.hotspots.map((h, i) => `
    <button type="button" class="hotspot-chip" data-hotspot="${h.id}" aria-pressed="${h.id === state.selected}">
      <span class="hotspot-chip__num">${i + 1}</span>${escapeHtml(h.label)}
    </button>`).join('');
  list.querySelectorAll('[data-hotspot]').forEach((b) => b.addEventListener('click', () => selectHotspot(b.dataset.hotspot, true)));
}

function renderHotspotCard() {
  const card = $('#hotspotCard');
  if (!card) return;
  const h = state.hotspots.find((x) => x.id === state.selected);
  if (!h) {
    card.innerHTML = state.fallback ? '' : '<p class="hotspot-card__prompt">Click a numbered marker or an object in the 3D view to inspect it.</p>';
    card.classList.remove('is-active');
    return;
  }
  card.classList.add('is-active');
  card.innerHTML = `
    <div class="hotspot-card__title"><span class="hotspot-chip__num">${state.hotspots.indexOf(h) + 1}</span>${escapeHtml(h.title)}</div>
    <p>${escapeHtml(h.text)}</p>
    <div class="hotspot-card__actions">
      ${h.action ? `<button type="button" class="btn btn--gold btn--sm" id="hotspotAction">${escapeHtml(h.action.label)}</button>` : ''}
      <button type="button" class="btn btn--sm" id="hotspotClose">Close</button>
    </div>`;
  $('#hotspotAction')?.addEventListener('click', () => {
    h.action.run();
    if (state.scene?.layouts && state.scene.layouts.active !== state.layout) {
      state.layout = state.scene.layouts.active;
      syncUrl();
      renderLayoutPicker();
      const book = $('#bookVenue');
      if (book) book.href = bookUrl(current());
    }
    if (state.viewer) state.viewer.renderer.shadowMap.needsUpdate = true;
    renderHotspotCard();
    $('#hotspotAction')?.focus();
  });
  $('#hotspotClose').addEventListener('click', () => selectHotspot(null));
}

function selectHotspot(id, fly = false) {
  state.selected = id;
  const h = state.hotspots.find((x) => x.id === id);
  state.viewer?.setActiveMarker(id);
  if (h && fly && h.view) {
    state.viewer.stopTour();
    state.viewer.flyTo(h.view, 1300);
    markViewpoint(null);
  }
  document.querySelectorAll('[data-hotspot]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hotspot === id)));
  renderHotspotCard();
}

function selectFacility(id) {
  if (id === state.id || !facilityById(id)) return;
  state.id = id;
  state.hotspots = [];
  state.selected = null;
  state.scene = null;
  state.layout = null;
  state.schedule = null;
  if (state.venue?.code !== facilityById(id).venue) state.venue = null;
  syncUrl();
  markTabs();
  updateTitle();
  renderPanel();
  showFacility();
}

function updateTitle() {
  const f = current();
  $('#facilityTitle').textContent = `${f.name} in 3D`;
  document.title = `${f.name} - 3D Explorer - Haraya Bay By Zaldy Land (Simulation)`;
}

// ---------- 3D viewer ----------

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

function setLoading(on, text = 'Preparing 3D facility…') {
  $('#viewerLoading').hidden = !on;
  $('#viewerLoadingText').textContent = text;
}

function showFallback(message) {
  state.fallback = true;
  const f = current();
  setLoading(false);
  $('#viewerTools').hidden = true;
  $('#viewerHint').hidden = true;
  $('#movePad').hidden = true;
  $('#viewpoints').innerHTML = '';
  if (message) $('#fallbackText').textContent = message;
  $('#fallbackImg').src = facilityImage(f.id);
  $('#fallbackImg').alt = `${f.name} preview image`;
  $('#viewerFallback').hidden = false;
  renderHotspotList();
  renderHotspotCard();
}

function renderViewpoints(viewpoints) {
  $('#viewpoints').innerHTML = viewpoints.map((v, i) =>
    `<button class="vp-chip" type="button" data-vp="${v.id}" aria-pressed="${i === 0}">${escapeHtml(v.label)}</button>`).join('');
  document.querySelectorAll('[data-vp]').forEach((b) => b.addEventListener('click', () => {
    state.viewer.goTo(b.dataset.vp);
    markViewpoint(b.dataset.vp);
  }));
}

function markViewpoint(id) {
  document.querySelectorAll('[data-vp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vp === id)));
}

function showHint() {
  if (state.hintShown) return;
  state.hintShown = true;
  const hint = $('#viewerHint');
  hint.hidden = false;
  setTimeout(() => hint.classList.add('is-fading'), 7000);
}

function setTourButton(on) {
  const btn = $('#btnTour');
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('span').textContent = on ? 'Stop tour' : 'Auto tour';
  btn.querySelector('svg').innerHTML = on
    ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>'
    : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
}

async function showFacility() {
  if (state.fallback) return showFallback();
  if (!state.viewer) return;
  const request = ++state.request;
  const f = current();
  setLoading(true, `Building the ${f.name}…`);
  await nextFrame();
  try {
    const scene = await state.scenes.buildFacilityScene(f.id);
    if (request !== state.request) return;
    if (scene.layouts && state.layout && scene.layouts.items.some((i) => i.id === state.layout)) scene.layouts.select(state.layout);
    const viewpoints = state.viewer.setScene(scene);
    state.scene = scene;
    state.hotspots = scene.hotspots ?? [];
    renderViewpoints(viewpoints);
    renderHotspotList();
    renderHotspotCard();
    renderLayoutPicker();
    setTourButton(false);
    setLoading(false);
    $('#viewerTools').hidden = false;
    $('#movePad').hidden = false;
    showHint();
  } catch (err) {
    console.error(err);
    if (request === state.request) showFallback('Something went wrong while building this 3D facility, so we are showing a preview image instead.');
  }
}

async function initViewer() {
  let viewerMod;
  try {
    [viewerMod, state.scenes] = await Promise.all([import('./room3d/viewer.js'), import('./facility3d/index.js')]);
  } catch (err) {
    console.error(err);
    return showFallback('The 3D viewer could not be loaded. Check your connection and reload the page; a preview image is shown meanwhile.');
  }
  if (!viewerMod.webglAvailable()) return showFallback();
  try {
    state.viewer = new viewerMod.RoomViewer($('#viewer'), {
      onInteract: () => {
        $('#viewerHint').classList.add('is-fading');
        markViewpoint(null);
      },
      onTourStep: (id, running) => {
        setTourButton(running);
        if (id) markViewpoint(id);
      },
      onError: (msg) => showFallback(msg),
      onHotspot: (id, source) => selectHotspot(id, source === 'marker'),
    });
  } catch (err) {
    console.error(err);
    return showFallback('Your device could not start the 3D renderer (WebGL), so we are showing a preview image instead.');
  }
  initTools();
  await showFacility();
}

function initTools() {
  const viewerEl = $('#viewer');
  $('#btnTour').addEventListener('click', () => {
    if (state.viewer.touring) state.viewer.stopTour();
    else state.viewer.startTour();
  });
  $('#btnReset').addEventListener('click', () => {
    state.viewer.reset();
    markViewpoint(state.viewer.room?.viewpoints[0].id);
  });
  $('#btnMarkers').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    state.viewer.setMarkersVisible(on);
  });
  $('#btnFullscreen').addEventListener('click', async () => {
    if (document.fullscreenElement) return document.exitFullscreen();
    if (viewerEl.requestFullscreen) {
      try { await viewerEl.requestFullscreen(); return; } catch { /* fall through to CSS mode */ }
    }
    viewerEl.classList.toggle('is-expanded');
    document.body.classList.toggle('viewer-expanded', viewerEl.classList.contains('is-expanded'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewerEl.classList.contains('is-expanded')) {
      viewerEl.classList.remove('is-expanded');
      document.body.classList.remove('viewer-expanded');
    }
  });

  // On-screen walk pad: hold a button to keep moving.
  document.querySelectorAll('[data-move]').forEach((btn) => {
    const [axis, value] = btn.dataset.move.split(':');
    const source = `pad:${btn.dataset.move}`;
    const stop = () => { state.viewer.release(source); btn.classList.remove('is-held'); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('is-held');
      state.viewer.press(source, axis, Number(value));
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, stop);
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      state.viewer.press(source, axis, Number(value));
    });
    btn.addEventListener('keyup', stop);
    btn.addEventListener('blur', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

// ---------- boot ----------

function init() {
  $('#year').textContent = new Date().getFullYear();
  readParams();
  syncUrl();
  renderTabs();
  markTabs();
  document.fonts?.ready.then(markTabs);
  updateTitle();
  renderPanel();
  initViewer();
}

init();
