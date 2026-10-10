import {
  api, qs, escapeHtml, money, localToday, fmtDate, toast, formData, clearErrors, showFormError, validateRequired, withBusy, ApiError,
} from './common.js';
import { posterSvg } from './event-art.js';

const VENUE_FACILITY = { THEATER: 'theater', BALLROOM: 'ballroom', POOLDECK: 'pool', PLAZA: 'fountain' };
const MAX_TICKETS = 6;

const state = {
  events: [],
  venues: [],
  view: 'list',
  month: localToday().slice(0, 7),
};

const $ = (id) => document.getElementById(id);
const els = {
  featured: $('featured'),
  filters: $('filters'),
  list: $('eventList'),
  cal: $('eventCalendar'),
  state: $('eventsState'),
  count: $('resultCount'),
  venueGrid: $('venueGrid'),
  eventDialog: $('eventDialog'),
  evTitle: $('evTitle'),
  evBody: $('evBody'),
  venueDialog: $('venueDialog'),
  venueForm: $('venueForm'),
};

// ---------- formatting ----------

const fmtLong = (d) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeRange = (e) => `${e.startTime}–${e.endTime}`;
const isStartingPrice = (e) => /starting/i.test(e.priceNote ?? '');

function priceLabel(e) {
  if (!e.price) return 'Free';
  return `${isStartingPrice(e) ? 'From ' : ''}${money(e.price)}`;
}

function phasePill(phase) {
  return `<span class="status status--${phase.toLowerCase()}">${escapeHtml(phase)}</span>`;
}

function placesLabel(e) {
  if (e.registration === 'invite') return 'Invitation only';
  if (e.registration === 'none') return 'Open entry, no registration needed';
  if (e.phase === 'Cancelled' || e.phase === 'Completed') return `${e.registered} attended / registered`;
  if (e.remaining === 0) return 'Fully booked';
  return `${e.remaining} of ${e.capacity} places left`;
}

function isFeatured(e) {
  return /bakebe/i.test(e.title);
}

// ---------- filtering ----------

function readFilters() {
  const f = formData(els.filters);
  return { q: f.q.trim().toLowerCase(), category: f.category, venue: f.venue, from: f.from, to: f.to, phase: f.phase };
}

function matches(e, f, { ignoreDates = false } = {}) {
  if (f.q && !`${e.title} ${e.description} ${e.code} ${e.venueName} ${e.category}`.toLowerCase().includes(f.q)) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.venue && e.venue !== f.venue) return false;
  if (!ignoreDates && f.from && e.date < f.from) return false;
  if (!ignoreDates && f.to && e.date > f.to) return false;
  if (f.phase === 'active' && !['Upcoming', 'Ongoing'].includes(e.phase)) return false;
  if (f.phase && f.phase !== 'active' && e.phase !== f.phase) return false;
  return true;
}

// ---------- rendering: cards ----------

function cardHtml(e) {
  const [, m, d] = e.date.split('-');
  const month = new Date(2000, Number(m) - 1, 1).toLocaleString('en-GB', { month: 'short' }).toUpperCase();
  return `
    <article class="ev-card ev-card--${escapeHtml(e.poster)}${isFeatured(e) ? ' ev-card--featured' : ''}">
      <div class="ev-card__media">
        ${posterSvg(e.poster, { label: escapeHtml(e.title) })}
        <span class="ev-date" aria-hidden="true"><b>${Number(d)}</b>${month}</span>
        <span class="ev-card__status">${phasePill(e.phase)}</span>
      </div>
      <div class="ev-card__body event-card__body">
        <div class="ev-card__cat">${escapeHtml(e.category)} &middot; ${escapeHtml(e.venueName)}</div>
        <h3 class="ev-card__title">${escapeHtml(e.title)}</h3>
        <p class="ev-card__when"><time datetime="${e.date}">${fmtLong(e.date)}</time> &middot; ${timeRange(e)}</p>
        <p class="ev-card__desc">${escapeHtml(e.description.split('\n')[0].slice(0, 150))}${e.description.length > 150 ? '…' : ''}</p>
        <div class="ev-card__meta">
          <span class="ev-price">${priceLabel(e)}</span>
          <span class="ev-places${e.remaining === 0 && e.registration === 'open' ? ' is-full' : ''}">${placesLabel(e)}</span>
        </div>
        <div class="ev-card__actions">
          <button type="button" class="btn btn--black btn--sm" data-open="${e.id}">View Event</button>
          ${e.canRegister ? `<button type="button" class="btn btn--sm" data-open="${e.id}" data-register>Register</button>` : ''}
        </div>
      </div>
    </article>`;
}

function renderFeatured() {
  const e = state.events.find((x) => isFeatured(x) && x.phase !== 'Cancelled')
    ?? state.events.find((x) => x.phase === 'Upcoming');
  if (!e) { els.featured.hidden = true; return; }
  els.featured.hidden = false;
  els.featured.className = `featured featured--${e.poster}`;
  const designs = (e.description.match(/designs?:\s*([^\n]+)/i)?.[1] ?? '').replace(/\.$/, '').split(/,\s*|\s+and\s+/).filter(Boolean);
  els.featured.innerHTML = `
    <div class="featured__art">${posterSvg(e.poster, { label: escapeHtml(e.title), fit: 'meet' })}</div>
    <div class="featured__body">
      <div class="eyebrow">Featured ${escapeHtml(e.category.toLowerCase())} ${phasePill(e.phase)}</div>
      <h2 class="featured__title">${escapeHtml(e.title)}</h2>
      <p class="featured__when">${fmtLong(e.date)} &middot; ${timeRange(e)} &middot; ${escapeHtml(e.venueName)}</p>
      <p>${escapeHtml(e.description.split('\n')[0])}</p>
      ${designs.length ? `<ul class="design-chips" aria-label="Cake designs">${designs.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
      <div class="featured__foot">
        <div><span class="ev-price ev-price--lg">${priceLabel(e)}</span>${e.priceNote ? `<small>${escapeHtml(e.priceNote)}</small>` : ''}</div>
        <div class="card-actions">
          <button type="button" class="btn btn--black" data-open="${e.id}">View Event</button>
          ${e.canRegister ? `<button type="button" class="btn" data-open="${e.id}" data-register>Register now</button>` : ''}
        </div>
      </div>
      ${e.sampleNote ? `<p class="hint featured__note">${escapeHtml(e.sampleNote)}</p>` : ''}
    </div>`;
}

function renderList(items) {
  els.list.innerHTML = items.map(cardHtml).join('');
}

// ---------- rendering: calendar ----------

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function renderCalendar(items) {
  const ym = state.month;
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const today = localToday();
  const byDay = new Map();
  for (const e of items) {
    if (!e.date.startsWith(ym)) continue;
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="ev-cal__cell is-blank" aria-hidden="true"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${ym}-${String(d).padStart(2, '0')}`;
    const list = byDay.get(date) ?? [];
    cells.push(`
      <div class="ev-cal__cell${date === today ? ' is-today' : ''}${list.length ? ' has-events' : ''}" role="gridcell" aria-label="${fmtLong(date)}${list.length ? `, ${list.length} event${list.length > 1 ? 's' : ''}` : ''}">
        <span class="ev-cal__day">${d}</span>
        ${list.map((e) => `<button type="button" class="ev-cal__chip ev-cal__chip--${escapeHtml(e.poster)}${e.phase === 'Cancelled' ? ' is-cancelled' : ''}" data-open="${e.id}" title="${escapeHtml(e.title)}">
          <span>${e.startTime}</span> ${escapeHtml(e.title)}</button>`).join('')}
      </div>`);
  }
  const monthItems = items.filter((e) => e.date.startsWith(ym));
  els.cal.innerHTML = `
    <div class="ev-cal__bar">
      <button type="button" class="btn btn--sm" data-month="-1" aria-label="Previous month">&lsaquo; Prev</button>
      <h3 class="ev-cal__title" aria-live="polite">${monthLabel(ym)}</h3>
      <div class="ev-cal__bar-right">
        <button type="button" class="btn btn--sm" data-month="today">Today</button>
        <button type="button" class="btn btn--sm" data-month="1" aria-label="Next month">Next &rsaquo;</button>
      </div>
    </div>
    <div class="ev-cal__grid" role="grid" aria-label="${monthLabel(ym)} events">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => `<div class="ev-cal__wd" role="columnheader">${w}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="ev-agenda">
      <h4>${monthItems.length ? `${monthItems.length} event${monthItems.length > 1 ? 's' : ''} in ${monthLabel(ym)}` : `No matching events in ${monthLabel(ym)}`}</h4>
      ${monthItems.map((e) => `
        <button type="button" class="ev-agenda__item" data-open="${e.id}">
          <span class="ev-agenda__date">${fmtDate(e.date, { day: 'numeric', month: 'short' })}<small>${timeRange(e)}</small></span>
          <span class="ev-agenda__title">${escapeHtml(e.title)}<small>${escapeHtml(e.venueName)} &middot; ${priceLabel(e)}</small></span>
          ${phasePill(e.phase)}
        </button>`).join('')}
    </div>`;
}

// ---------- main render ----------

function render() {
  const f = readFilters();
  const listItems = state.events.filter((e) => matches(e, f));
  const calItems = state.events.filter((e) => matches(e, f, { ignoreDates: true }));
  els.state.innerHTML = '';
  els.list.hidden = state.view !== 'list';
  els.cal.hidden = state.view !== 'calendar';

  if (state.view === 'list') {
    els.count.textContent = `${listItems.length} event${listItems.length === 1 ? '' : 's'} found`;
    if (!listItems.length) {
      els.state.innerHTML = `<div class="empty-state">No events match your filters. <button type="button" class="btn--link btn" data-clear>Clear filters</button>
        ${f.phase === 'active' ? ' or set Status to "All" to include past events.' : ''}</div>`;
    }
    renderList(listItems);
  } else {
    if (f.from && !calItems.some((e) => e.date.startsWith(state.month))) state.month = f.from.slice(0, 7);
    if (!calItems.some((e) => e.date.startsWith(state.month)) && calItems.length && state.monthAuto) {
      state.month = calItems[0].date.slice(0, 7);
    }
    state.monthAuto = false;
    els.count.textContent = `${calItems.length} event${calItems.length === 1 ? '' : 's'} match your filters (date filters are replaced by month navigation)`;
    renderCalendar(calItems);
  }
}

function setView(view) {
  state.view = view;
  state.monthAuto = true;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  const url = new URL(location.href);
  if (view === 'calendar') url.searchParams.set('view', 'calendar'); else url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render();
}

// ---------- details dialog ----------

function descriptionHtml(text) {
  return text.split(/\n\s*\n/).map((para) => {
    const p = para.trim();
    const how = p.match(/^how it works:\s*(.+)$/i);
    if (how) {
      const steps = how[1].split(/\s*\d\)\s*/).map((s) => s.replace(/[,.]\s*$/, '').trim()).filter(Boolean);
      return `<h4>How it works</h4><ol class="ev-steps">${steps.map((s) => `<li>${escapeHtml(s.charAt(0).toUpperCase() + s.slice(1))}</li>`).join('')}</ol>`;
    }
    const designs = p.match(/^(.*designs?):\s*(.+)$/i);
    if (designs) {
      const list = designs[2].replace(/\.$/, '').split(/,\s*|\s+and\s+/).filter(Boolean);
      return `<h4>${escapeHtml(designs[1])}</h4><ul class="design-chips">${list.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`;
    }
    return `<p>${escapeHtml(p)}</p>`;
  }).join('');
}

function detailsHtml(e) {
  const pct = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : 0;
  const facility = VENUE_FACILITY[e.venue];
  const beginner = /no previous|beginner/i.test(e.description);
  return `
    <div class="modal__body ev-detail">
      <div class="ev-detail__art">${posterSvg(e.poster, { label: escapeHtml(e.title) })}</div>
      <div class="ev-detail__badges">${phasePill(e.phase)}<span class="tag">${escapeHtml(e.category)}</span><span class="tag tag--muted">${escapeHtml(e.code)}</span>${beginner ? '<span class="tag tag--ok">Beginner friendly</span>' : ''}</div>
      <h3 class="ev-detail__title">${escapeHtml(e.title)}</h3>
      <dl class="details ev-detail__facts">
        <div><dt>Date</dt><dd>${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
        <div><dt>Time</dt><dd>${timeRange(e)}</dd></div>
        <div><dt>Venue</dt><dd>${escapeHtml(e.venueName)}${e.setupLabel ? ` (${escapeHtml(e.setupLabel)})` : ''} &middot; ${escapeHtml(e.venueFloor)}
          <span class="ev-links">${facility ? `<a href="/facility.html?id=${facility}">Explore in 3D</a>` : ''}<a href="/map.html?find=${encodeURIComponent(e.venue)}">Show on map</a></span></dd></div>
        <div><dt>Price</dt><dd><strong>${priceLabel(e)}</strong>${e.price ? ' per person' : ''}${e.priceNote ? `<br><small>${escapeHtml(e.priceNote)}</small>` : ''}</dd></div>
        <div class="full"><dt>Capacity</dt><dd>
          <div class="cap-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${e.capacity}" aria-valuenow="${e.registered}" aria-label="Places taken"><span style="width:${pct}%"></span></div>
          <small>${e.registered} of ${e.capacity} places taken &middot; ${placesLabel(e)}</small></dd></div>
      </dl>
      <div class="ev-detail__desc">${descriptionHtml(e.description)}</div>
      ${e.includes.length ? `<h4>What's included</h4><ul class="ev-includes">${e.includes.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      ${e.sampleNote ? `<div class="sample-note"><strong>Sample event</strong>${escapeHtml(e.sampleNote)}</div>` : ''}
      <div id="regSlot">${registrationIntro(e)}</div>
    </div>`;
}

function registrationIntro(e) {
  if (e.canRegister) return `<div class="ev-register-cta"><div><strong>${e.remaining} place${e.remaining === 1 ? '' : 's'} left</strong><span>Reserve up to ${Math.min(MAX_TICKETS, e.remaining)} places. Pay on arrival (simulation, nothing is charged).</span></div><button type="button" class="btn btn--black" data-show-register>Register</button></div>`;
  const reason = {
    Cancelled: 'This event has been cancelled.',
    Completed: 'This event has already taken place.',
    Ongoing: 'This event is happening now; online registration has closed.',
  }[e.phase] ?? (e.registration === 'invite' ? 'This is an invitation-only event.'
    : e.registration === 'none' ? 'No registration needed, just come along.'
      : e.remaining === 0 ? 'This event is fully booked.' : 'Registration is not available.');
  return `<div class="form-alert form-alert--info">${reason}</div>`;
}

function registerFormHtml(e) {
  const max = Math.min(MAX_TICKETS, e.remaining);
  return `
    <form class="ev-register" id="registerForm" novalidate>
      <h4>Register for this event</h4>
      <div data-alert-slot></div>
      <div class="form-grid">
        <div class="field"><label for="rgFirst">First name <span class="req">*</span></label><input class="input" id="rgFirst" name="firstName" autocomplete="given-name" maxlength="60" required></div>
        <div class="field"><label for="rgLast">Last name <span class="req">*</span></label><input class="input" id="rgLast" name="lastName" autocomplete="family-name" maxlength="60" required></div>
        <div class="field"><label for="rgEmail">Email <span class="req">*</span></label><input class="input" type="email" id="rgEmail" name="email" autocomplete="email" required></div>
        <div class="field"><label for="rgPhone">Phone <span class="req">*</span></label><input class="input" type="tel" id="rgPhone" name="phone" autocomplete="tel" placeholder="+63 9xx xxx xxxx" required></div>
        <div class="field"><label for="rgTickets">Places <span class="req">*</span></label>
          <select class="select" id="rgTickets" name="tickets">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></div>
        <div class="field"><label for="rgNotes">Notes</label><input class="input" id="rgNotes" name="notes" maxlength="300" placeholder="Optional, e.g. dietary needs"></div>
        <div class="full"><div class="price-summary" id="rgSummary"></div>
          <p class="hint">Simulation only: no payment details are collected and nothing is charged. Use fictional information.</p></div>
      </div>
      <div class="card-actions"><button type="button" class="btn" data-hide-register>Back</button><button type="submit" class="btn btn--black">Confirm registration</button></div>
    </form>`;
}

function updateSummary(e) {
  const n = Number($('rgTickets')?.value ?? 1);
  const s = $('rgSummary');
  if (!s) return;
  s.innerHTML = `
    <div class="price-summary__row"><span>${n} place${n > 1 ? 's' : ''} &times; ${e.price ? money(e.price) : 'Free'}</span><span>${e.price ? money(n * e.price) : money(0)}</span></div>
    <div class="price-summary__row price-summary__total"><span>Due on arrival (simulated)</span><span>${money(n * e.price)}</span></div>`;
}

function successHtml(res) {
  const { registration: r, event: e } = res;
  return `
    <div class="confirm-hero">
      <div class="confirm-hero__icon" aria-hidden="true">&#10003;</div>
      <h4>You're registered!</h4>
      <div class="ref">${escapeHtml(r.reference)}</div>
      <p>${escapeHtml(r.firstName)}, your ${r.tickets} place${r.tickets > 1 ? 's are' : ' is'} reserved for <strong>${escapeHtml(e.title)}</strong> on ${fmtLong(e.date)} at ${timeRange(e)}, ${escapeHtml(e.venueName)}.</p>
      <p class="hint">${r.amount ? `Amount due on arrival: ${money(r.amount)} (simulation, nothing is charged).` : 'Admission is free.'} A simulated confirmation email was logged for ${escapeHtml(r.email)}. Keep your reference to cancel later.</p>
    </div>`;
}

async function openEvent(id, { register = false } = {}) {
  els.evTitle.textContent = 'Event details';
  els.evBody.innerHTML = '<div class="modal__body"><div class="loading-block" role="status"><span class="spinner" aria-hidden="true"></span> Loading event…</div></div>';
  if (!els.eventDialog.open) els.eventDialog.showModal();
  const url = new URL(location.href);
  url.searchParams.set('event', id);
  history.replaceState(null, '', url);
  let e;
  try {
    ({ event: e } = await api(`/events/${id}`));
  } catch (err) {
    els.evBody.innerHTML = `<div class="modal__body"><div class="form-alert form-alert--error" role="alert">${escapeHtml(err.status === 404 ? 'This event could not be found. It may be private or no longer listed.' : err.message)}</div></div>`;
    return;
  }
  els.evTitle.textContent = e.category === 'Workshop' ? 'Workshop details' : 'Event details';
  els.evBody.innerHTML = detailsHtml(e);
  els.eventDialog.scrollTop = 0;
  const slot = $('regSlot');
  const showForm = () => {
    slot.innerHTML = registerFormHtml(e);
    updateSummary(e);
    $('rgTickets').addEventListener('change', () => updateSummary(e));
    $('rgFirst').focus();
    slot.querySelector('[data-hide-register]').addEventListener('click', () => { slot.innerHTML = registrationIntro(e); bindIntro(); });
    $('registerForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      clearErrors(form);
      if (!validateRequired(form)) return;
      await withBusy(form.querySelector('[type="submit"]'), async () => {
        try {
          const res = await api(`/events/${e.id}/register`, { method: 'POST', body: formData(form) });
          slot.innerHTML = successHtml(res);
          toast(`Registration ${res.registration.reference} confirmed.`, { type: 'success' });
          await loadEvents({ quiet: true });
        } catch (err) {
          showFormError(form, err);
        }
      });
    });
  };
  const bindIntro = () => slot.querySelector('[data-show-register]')?.addEventListener('click', showForm);
  bindIntro();
  if (register && e.canRegister) { showForm(); slot.scrollIntoView({ block: 'start' }); }
}

// ---------- venues ----------

function renderVenues() {
  els.venueGrid.innerHTML = state.venues.map((v) => {
    const upcoming = state.events.filter((e) => e.venue === v.code && ['Upcoming', 'Ongoing'].includes(e.phase)).length;
    const facility = VENUE_FACILITY[v.code];
    return `
      <article class="ev-venue">
        <div class="ev-venue__head"><h3>${escapeHtml(v.name)}</h3><span class="tag">${escapeHtml(v.floor)}</span></div>
        <p class="ev-venue__cap"><strong>Up to ${v.capacity}</strong> guests${v.setups.length ? ` &middot; ${v.setups.length} setups` : ''}</p>
        <p>${escapeHtml(v.description)}</p>
        <ul class="ev-venue__features">${v.features.slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
        ${v.setups.length ? `<ul class="ev-venue__setups">${v.setups.map((s) => `<li><strong>${escapeHtml(s.label)}</strong> up to ${s.capacity}</li>`).join('')}</ul>` : ''}
        <div class="ev-venue__actions">
          <button type="button" class="btn btn--black btn--sm" data-book="${v.code}">Book This Venue</button>
          ${facility ? `<a class="btn btn--sm" href="/facility.html?id=${facility}">Explore in 3D</a>` : ''}
          <a class="btn btn--sm" href="/map.html?find=${encodeURIComponent(v.code)}">Show on map</a>
          <button type="button" class="btn btn--link" data-venue-filter="${v.code}">${upcoming} upcoming event${upcoming === 1 ? '' : 's'}</button>
        </div>
      </article>`;
  }).join('');
}

function venueByCode(code) {
  return state.venues.find((v) => v.code === code);
}

function syncVenueForm() {
  const form = els.venueForm;
  const v = venueByCode(form.venue.value);
  if (!v) return;
  const setupField = $('vrSetupField');
  setupField.hidden = !v.setups.length;
  form.setup.required = !!v.setups.length;
  if (v.setups.length) {
    const prev = form.setup.value;
    form.setup.innerHTML = v.setups.map((s) => `<option value="${s.id}">${escapeHtml(s.label)} (up to ${s.capacity})</option>`).join('');
    if (v.setups.some((s) => s.id === prev)) form.setup.value = prev;
  } else {
    form.setup.innerHTML = '';
  }
  const setup = v.setups.find((s) => s.id === form.setup.value);
  const cap = setup?.capacity ?? v.capacity;
  form.capacity.max = cap;
  $('vrCapHint').textContent = `Maximum ${cap} guests${setup ? ` for a ${setup.label.toLowerCase()}` : ` at the ${v.name}`}.`;
  els.venueDialog.querySelector('#vrTitle').textContent = `Book ${v.name}`;
  checkAvailability();
}

let availabilityToken = 0;
async function checkAvailability() {
  const form = els.venueForm;
  const box = $('vrAvailability');
  const { venue, date, startTime, endTime } = form;
  if (!date.value) { box.innerHTML = '<span class="hint">Choose a date to see existing bookings for this venue.</span>'; return; }
  if (date.value < localToday()) { box.innerHTML = '<div class="form-alert form-alert--error">The event date cannot be in the past.</div>'; return; }
  const token = ++availabilityToken;
  box.innerHTML = '<span class="hint">Checking availability…</span>';
  try {
    const { booked } = await api(`/venues/${venue.value}/availability${qs({ date: date.value })}`);
    if (token !== availabilityToken) return;
    const overlap = booked.find((b) => b.startTime < endTime.value && startTime.value < b.endTime);
    const list = booked.length ? `Already booked on ${fmtDate(date.value)}: ${booked.map((b) => `<strong>${b.startTime}–${b.endTime}</strong>`).join(', ')}.` : `No bookings yet on ${fmtDate(date.value)}.`;
    box.innerHTML = endTime.value <= startTime.value
      ? `<div class="form-alert form-alert--error">The end time must be after the start time (same day).</div>`
      : overlap
        ? `<div class="form-alert form-alert--error">${list} Your time overlaps an existing booking; please choose another time.</div>`
        : `<div class="form-alert form-alert--success">${list} ${startTime.value}–${endTime.value} is available.</div>`;
  } catch (err) {
    if (token === availabilityToken) box.innerHTML = `<div class="form-alert form-alert--error">${escapeHtml(err.message)}</div>`;
  }
}

function openVenueDialog(code, setup) {
  const form = els.venueForm;
  form.reset();
  clearErrors(form);
  $('vrBody').querySelectorAll('.vr-done').forEach((n) => n.remove());
  form.querySelector('.form-grid').hidden = false;
  $('vrFoot').innerHTML = '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--black" type="submit">Send request</button>';
  form.date.min = localToday();
  if (venueByCode(code)) form.venue.value = code;
  syncVenueForm();
  if (setup && [...form.setup.options].some((o) => o.value === setup)) { form.setup.value = setup; syncVenueForm(); }
  if (!els.venueDialog.open) els.venueDialog.showModal();
}

async function submitVenueRequest(ev) {
  ev.preventDefault();
  const form = els.venueForm;
  clearErrors(form);
  if (!validateRequired(form)) return;
  const data = formData(form);
  const v = venueByCode(data.venue);
  const cap = Number(form.capacity.max);
  const details = {};
  if (data.date < localToday()) details.date = 'The event date cannot be in the past.';
  if (data.endTime <= data.startTime) details.endTime = 'End time must be after the start time.';
  if (!(Number(data.capacity) >= 1)) details.capacity = 'Enter the expected number of guests.';
  else if (Number(data.capacity) > cap) details.capacity = `This setup holds up to ${cap} guests.`;
  if (Object.keys(details).length) { showFormError(form, new ApiError('Please correct the highlighted details.', 400, details)); return; }
  await withBusy(form.querySelector('[type="submit"]'), async () => {
    try {
      const { event, message } = await api(`/venues/${data.venue}/requests`, { method: 'POST', body: data });
      form.querySelector('.form-grid').hidden = true;
      const done = document.createElement('div');
      done.className = 'confirm-hero vr-done';
      done.innerHTML = `
        <div class="confirm-hero__icon" aria-hidden="true">&#10003;</div>
        <h4>Request sent</h4>
        <div class="ref">${escapeHtml(event.code)}</div>
        <p>${escapeHtml(message)}</p>
        <p class="hint">${escapeHtml(v.name)} &middot; ${fmtLong(event.date)} &middot; ${event.startTime}–${event.endTime} &middot; ${event.capacity} guests${event.setupLabel ? ` &middot; ${escapeHtml(event.setupLabel)}` : ''}.
        Status: Pending review by the events team (simulation, no deposit or payment).</p>`;
      $('vrBody').append(done);
      $('vrFoot').innerHTML = '<button class="btn btn--black" type="button" data-close>Done</button>';
      toast(`Venue request ${event.code} sent.`, { type: 'success' });
    } catch (err) {
      showFormError(form, err);
      if (err.status === 409) checkAvailability();
    }
  });
}

// ---------- data ----------

async function loadEvents({ quiet = false } = {}) {
  if (!quiet) {
    els.state.innerHTML = '<div class="loading-block" role="status"><span class="spinner" aria-hidden="true"></span> Loading events…</div>';
    els.list.innerHTML = '';
  }
  try {
    const { events } = await api('/events');
    state.events = events;
    renderFeatured();
    renderVenues();
    render();
  } catch (err) {
    els.count.textContent = '';
    els.featured.hidden = true;
    els.state.innerHTML = `<div class="form-alert form-alert--error" role="alert">Could not load events. ${escapeHtml(err.message)} <button type="button" class="btn btn--sm" data-retry>Try again</button></div>`;
  }
}

async function init() {
  $('year').textContent = new Date().getFullYear();
  const params = new URLSearchParams(location.search);

  try {
    const { venues, categories } = await api('/venues');
    state.venues = venues;
    $('fCategory').insertAdjacentHTML('beforeend', categories.map((c) => `<option>${escapeHtml(c)}</option>`).join(''));
    $('fVenue').insertAdjacentHTML('beforeend', venues.map((v) => `<option value="${v.code}">${escapeHtml(v.name)}</option>`).join(''));
    $('vrVenue').innerHTML = venues.map((v) => `<option value="${v.code}">${escapeHtml(v.name)} (up to ${v.capacity})</option>`).join('');
  } catch (err) {
    toast(err.message, { type: 'error' });
  }

  if (params.get('venue')) $('fVenue').value = params.get('venue').toUpperCase();
  if (params.get('category')) $('fCategory').value = params.get('category');
  if (params.get('q')) $('fQ').value = params.get('q');
  if (params.get('view') === 'calendar') { state.view = 'calendar'; document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === 'calendar'))); }

  await loadEvents();

  if (params.get('event')) openEvent(params.get('event'), { register: params.has('register') });
  else if (params.get('book')) openVenueDialog(params.get('book').toUpperCase(), params.get('setup'));
}

// ---------- events ----------

let searchTimer;
els.filters.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  state.monthAuto = true;
  searchTimer = setTimeout(render, e.target.name === 'q' ? 180 : 0);
});
els.filters.addEventListener('reset', () => setTimeout(() => { state.monthAuto = true; render(); }, 0));
els.filters.addEventListener('submit', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  if (t.dataset.open) openEvent(t.dataset.open, { register: t.hasAttribute('data-register') });
  else if (t.dataset.view) setView(t.dataset.view);
  else if (t.dataset.book) openVenueDialog(t.dataset.book);
  else if (t.dataset.venueFilter) {
    $('fVenue').value = t.dataset.venueFilter;
    $('fPhase').value = 'active';
    render();
    document.getElementById('eventsHeading').scrollIntoView({ behavior: 'smooth' });
  } else if (t.dataset.month) {
    state.month = t.dataset.month === 'today' ? localToday().slice(0, 7) : shiftMonth(state.month, Number(t.dataset.month));
    render();
  } else if (t.hasAttribute('data-clear')) {
    els.filters.reset();
  } else if (t.hasAttribute('data-retry')) {
    loadEvents();
  } else if (t.hasAttribute('data-close')) {
    t.closest('dialog')?.close();
  }
});

els.eventDialog.addEventListener('close', () => {
  const url = new URL(location.href);
  url.searchParams.delete('event');
  url.searchParams.delete('register');
  history.replaceState(null, '', url);
});
els.venueDialog.addEventListener('close', () => {
  const url = new URL(location.href);
  url.searchParams.delete('book');
  url.searchParams.delete('setup');
  history.replaceState(null, '', url);
});

els.venueForm.venue.addEventListener('change', syncVenueForm);
els.venueForm.setup.addEventListener('change', syncVenueForm);
['date', 'startTime', 'endTime'].forEach((n) => els.venueForm[n].addEventListener('change', checkAvailability));
els.venueForm.addEventListener('submit', submitVenueRequest);

$('cancelRegForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  clearErrors(form);
  if (!validateRequired(form)) return;
  const { reference, email } = formData(form);
  await withBusy(form.querySelector('[type="submit"]'), async () => {
    try {
      const { registration } = await api(`/event-registrations/${encodeURIComponent(reference.trim().toUpperCase())}/cancel`, { method: 'POST', body: { email } });
      form.reset();
      const ok = document.createElement('div');
      ok.className = 'form-alert form-alert--success';
      ok.setAttribute('role', 'status');
      ok.textContent = `Registration ${registration.reference} has been cancelled and the place released. A simulated confirmation email was logged.`;
      form.querySelector('[data-alert-slot]').prepend(ok);
      await loadEvents({ quiet: true });
    } catch (err) {
      showFormError(form, err);
    }
  });
});

init();
