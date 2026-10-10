import { api, qs, escapeHtml, money, localToday, addDays, nights, fmtDate, toast } from './common.js';

const $ = (sel) => document.querySelector(sel);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const state = {
  roomTypes: [],
  code: 'ECONOMY',
  checkIn: '',
  checkOut: '',
  guests: 2,
  availability: null, // availability entry for state.code, null while loading
  viewer: null,
  fallback: false,
  hintShown: false,
};

const typeByCode = (code) => state.roomTypes.find((t) => t.code === code);

// ---------- URL state ----------

function readParams() {
  const p = new URLSearchParams(location.search);
  const code = (p.get('type') || '').toUpperCase();
  state.code = typeByCode(code) ? code : state.roomTypes[0].code;
  const today = localToday();
  const checkIn = p.get('checkIn');
  state.checkIn = DATE_RE.test(checkIn || '') && checkIn >= today ? checkIn : today;
  const checkOut = p.get('checkOut');
  state.checkOut = DATE_RE.test(checkOut || '') && checkOut > state.checkIn ? checkOut : addDays(state.checkIn, 1);
  const guests = Number(p.get('guests'));
  state.guests = guests >= 1 && guests <= 4 ? guests : 2;
}

function stayQuery(extra = {}) {
  return qs({ ...extra, checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests });
}

function syncUrl() {
  history.replaceState(null, '', `/room.html${stayQuery({ type: state.code })}`);
  $('#backLink').href = `/${stayQuery()}#rooms`;
}

// ---------- category tabs & info panel ----------

function renderTabs() {
  $('#tourTabs').innerHTML = state.roomTypes.map((t) => `
    <button class="tour-tab" type="button" role="tab" data-code="${t.code}"
      aria-selected="${t.code === state.code}" tabindex="${t.code === state.code ? 0 : -1}">
      <span class="tour-tab__name">${escapeHtml(t.name)}</span>
      <span class="tour-tab__rate">${money(t.rate)} / night</span>
    </button>`).join('');
  const tabs = [...document.querySelectorAll('.tour-tab')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectCategory(tab.dataset.code));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      selectCategory(next.dataset.code);
    });
  });
}

function availabilityMarkup(a) {
  if (!a) return '<div class="availability"><div class="availability__label"><span>Checking availability…</span></div></div>';
  const level = a.available === 0 ? 'none' : a.available <= Math.ceil(a.total * 0.3) ? 'low' : 'ok';
  const label = a.available === 0 ? 'Sold out for these dates' : `${a.available} of ${a.total} rooms available`;
  const segments = Array.from({ length: a.total }, (_, i) => `<span class="${i < a.available ? 'on' : ''}"></span>`).join('');
  return `
    <div class="availability availability--${level}">
      <div class="availability__label"><span>${label}</span><span>${a.booked} booked</span></div>
      <div class="availability__bar" style="grid-template-columns:repeat(${a.total},1fr)" aria-hidden="true">${segments}</div>
    </div>`;
}

function bookState(t) {
  const a = state.availability;
  if (!a) return { disabled: true, label: 'Checking availability…' };
  if (a.available === 0) return { disabled: true, label: 'Sold out for these dates' };
  if (state.guests > t.capacity) return { disabled: true, label: `Max ${t.capacity} guests` };
  return { disabled: false, label: 'Book This Room' };
}

function renderPanel() {
  const t = typeByCode(state.code);
  const n = nights(state.checkIn, state.checkOut);
  const book = bookState(t);
  const guestOptions = [1, 2, 3, 4].map((g) =>
    `<option value="${g}" ${g === state.guests ? 'selected' : ''}>${g} guest${g > 1 ? 's' : ''}</option>`).join('');
  $('#tourPanel').innerHTML = `
    <div class="tour-panel__head">
      <div class="eyebrow">Floor ${t.floor} &middot; ${t.roomCount} rooms</div>
      <h2>${escapeHtml(t.name)}</h2>
      <div class="price">
        <small>Nightly rate</small>
        <strong>${money(t.rate)}</strong> <span>/ night</span>
      </div>
    </div>
    <dl class="tour-facts">
      <div><dt>Max occupancy</dt><dd>${t.capacity} guests</dd></div>
      <div><dt>Room size</dt><dd>${escapeHtml(t.size)}</dd></div>
      <div><dt>Bed</dt><dd>${escapeHtml(t.bed)}</dd></div>
      <div><dt>View</dt><dd>${escapeHtml(t.view)}</dd></div>
    </dl>
    <p class="tour-panel__desc">${escapeHtml(t.description)}</p>
    <h3 class="tour-panel__label">In-room features</h3>
    <ul class="amenities">${t.amenities.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    <p class="feature-note">Pool, gym, sauna, dining and recreation are shared by all guests.<a href="/amenities.html">Explore hotel amenities in 3D &rsaquo;</a></p>

    <form class="tour-stay" id="stayForm" novalidate>
      <h3 class="tour-panel__label">Check availability</h3>
      <div class="tour-stay__fields">
        <label>Check-in<input class="input" type="date" id="tsCheckIn" value="${state.checkIn}" min="${localToday()}" required></label>
        <label>Check-out<input class="input" type="date" id="tsCheckOut" value="${state.checkOut}" min="${addDays(state.checkIn, 1)}" required></label>
        <label>Guests<select class="select" id="tsGuests">${guestOptions}</select></label>
      </div>
      <div class="hint">${fmtDate(state.checkIn)} &ndash; ${fmtDate(state.checkOut)} &middot; ${n} night${n === 1 ? '' : 's'}</div>
      ${availabilityMarkup(state.availability)}
      ${n > 0 ? `<div class="tour-total"><span>Estimated total, ${n} night${n === 1 ? '' : 's'} (simulated)</span><strong>${money(t.rate * n)}</strong></div>` : ''}
      <button class="btn btn--black tour-book" type="button" id="btnBook" ${book.disabled ? 'disabled' : ''}>${book.label}</button>
      <p class="hint">Opens the reservation form with the ${escapeHtml(t.name)} preselected. A room is only assigned if it is free for your whole stay.</p>
    </form>`;

  const inEl = $('#tsCheckIn');
  const outEl = $('#tsCheckOut');
  inEl.addEventListener('change', () => {
    if (!DATE_RE.test(inEl.value)) return;
    if (inEl.value < localToday()) { toast('Check-in date cannot be in the past.', { type: 'error' }); inEl.value = state.checkIn; return; }
    state.checkIn = inEl.value;
    if (state.checkOut <= state.checkIn) state.checkOut = addDays(state.checkIn, 1);
    refreshStay();
  });
  outEl.addEventListener('change', () => {
    if (!DATE_RE.test(outEl.value)) return;
    if (outEl.value <= state.checkIn) { toast('Check-out date must be after the check-in date.', { type: 'error' }); outEl.value = state.checkOut; return; }
    state.checkOut = outEl.value;
    refreshStay();
  });
  $('#tsGuests').addEventListener('change', (e) => {
    state.guests = Number(e.target.value);
    syncUrl();
    renderPanel();
  });
  $('#btnBook').addEventListener('click', () => {
    location.href = `/${stayQuery({ book: state.code })}#rooms`;
  });
}

let availabilityRequest = 0;

async function loadAvailability() {
  const request = ++availabilityRequest;
  state.availability = null;
  renderPanel();
  try {
    const data = await api(`/availability${qs({ checkIn: state.checkIn, checkOut: state.checkOut })}`);
    if (request !== availabilityRequest) return;
    state.availabilityAll = data.roomTypes;
    state.availability = data.roomTypes.find((a) => a.code === state.code);
    renderPanel();
  } catch (err) {
    if (request !== availabilityRequest) return;
    toast(err.message, { type: 'error' });
  }
}

function refreshStay() {
  syncUrl();
  loadAvailability();
}

function selectCategory(code) {
  if (code === state.code || !typeByCode(code)) return;
  state.code = code;
  state.availability = state.availabilityAll?.find((a) => a.code === code) ?? null;
  document.querySelectorAll('.tour-tab').forEach((tab) => {
    const active = tab.dataset.code === code;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  syncUrl();
  updateTitle();
  renderPanel();
  showRoom();
}

function updateTitle() {
  const t = typeByCode(state.code);
  $('#tourTitle').textContent = `${t.name} in 3D`;
  document.title = `${t.name} Virtual Tour - Haraya Bay By Zaldy Land (Simulation)`;
}

// ---------- 3D viewer ----------

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

function setLoading(on, text = 'Preparing 3D room…') {
  $('#viewerLoading').hidden = !on;
  $('#viewerLoadingText').textContent = text;
}

function showFallback(message) {
  state.fallback = true;
  const t = typeByCode(state.code);
  setLoading(false);
  $('#viewerTools').hidden = true;
  $('#viewerHint').hidden = true;
  $('#viewpoints').innerHTML = '';
  if (message) $('#fallbackText').textContent = message;
  $('#fallbackImg').src = t.image;
  $('#fallbackImg').alt = `${t.name} photo`;
  $('#viewerFallback').hidden = false;
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
  setTimeout(() => hint.classList.add('is-fading'), 6000);
}

function setTourButton(on) {
  const btn = $('#btnTour');
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('span').textContent = on ? 'Stop tour' : 'Auto tour';
  btn.querySelector('svg').innerHTML = on
    ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>'
    : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
}

async function showRoom() {
  if (state.fallback) return showFallback();
  if (!state.viewer) return;
  const t = typeByCode(state.code);
  setLoading(true, `Building the ${t.name}…`);
  await nextFrame(); // let the spinner paint before the synchronous build
  try {
    const viewpoints = state.viewer.load(state.code);
    renderViewpoints(viewpoints);
    setTourButton(false);
    setLoading(false);
    $('#viewerTools').hidden = false;
    showHint();
  } catch (err) {
    console.error(err);
    showFallback('Something went wrong while building this 3D room, so we are showing a photo instead.');
  }
}

async function initViewer() {
  let mod;
  try {
    mod = await import('./room3d/viewer.js');
  } catch (err) {
    console.error(err);
    return showFallback('The 3D viewer could not be loaded. Check your connection and reload the page; a photo of the room is shown meanwhile.');
  }
  if (!mod.webglAvailable()) return showFallback();
  try {
    state.viewer = new mod.RoomViewer($('#viewer'), {
      onInteract: () => {
        $('#viewerHint').classList.add('is-fading');
        markViewpoint(null);
      },
      onTourStep: (id, running) => {
        setTourButton(running);
        if (id) markViewpoint(id);
      },
      onError: (msg) => showFallback(msg),
    });
  } catch (err) {
    console.error(err);
    return showFallback('Your device could not start the 3D renderer (WebGL), so we are showing a photo instead.');
  }
  initTools();
  await showRoom();
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
}

// ---------- boot ----------

async function init() {
  $('#year').textContent = new Date().getFullYear();
  try {
    const config = await api('/config');
    state.roomTypes = config.roomTypes;
  } catch (err) {
    $('#tourPanel').innerHTML = `<div class="form-alert form-alert--error">${escapeHtml(err.message)}</div>`;
    setLoading(false);
    return toast(err.message, { type: 'error' });
  }
  readParams();
  syncUrl();
  renderTabs();
  updateTitle();
  loadAvailability();
  initViewer();
}

init();
