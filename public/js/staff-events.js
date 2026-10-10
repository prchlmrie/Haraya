import {
  api, qs, escapeHtml, money, localToday, addDays, fmtDate, toast,
  formData, clearErrors, showFormError, validateRequired, withBusy, confirmDialog, ApiError,
} from './common.js';

const LOCKED = ['Cancelled', 'Completed'];
const state = { venues: [], categories: [], statuses: [], editing: null, viewing: null, ready: false };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const venueByCode = (code) => state.venues.find((v) => v.code === code);
const handleError = (err) => toast(err.message, { type: 'error' });
const when = (e) => `${fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<div class="muted">${e.startTime}–${e.endTime}</div>`;

function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function eventPill(e) {
  const label = e.status === 'Scheduled' ? e.phase : e.status;
  const cls = label.toLowerCase();
  return `<span class="status status--${cls}">${escapeHtml(label)}</span>`;
}

function capacityCell(e) {
  const pct = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : 0;
  const reg = e.registration === 'open' ? `${e.registered} / ${e.capacity}` : `${e.capacity} cap.`;
  return `<strong>${reg}</strong>
    ${e.registration === 'open' ? `<div class="cap-bar" title="${pct}% full"><span style="width:${pct}%"></span></div><div class="muted">${e.remaining} left</div>` : `<div class="muted">${e.registration === 'invite' ? 'Invitation only' : 'No registration'}</div>`}`;
}

// ---------- list ----------

export async function loadEvents() {
  await ensureConfig();
  const filters = formData($('#evFilters'));
  const [{ events }, { events: all }] = await Promise.all([
    api(`/staff/events${qs(filters)}`),
    api('/staff/events'),
  ]);
  renderStats(all);
  renderRequests(all.filter((e) => e.status === 'Pending'));
  $('#evCount').textContent = `${events.length} event${events.length === 1 ? '' : 's'} found`;
  $('#evBody').innerHTML = events.map((e) => `
    <tr>
      <td data-label="Event">
        <button class="ref-link ev-title-link" type="button" data-ev-open="${e.id}">${escapeHtml(e.title)}</button>
        <div class="muted">${escapeHtml(e.code)} · ${escapeHtml(e.category)}${e.visibility === 'private' ? ' · <span class="badge badge--none">Private</span>' : ''}</div>
      </td>
      <td data-label="Venue">${escapeHtml(e.venueName)}<div class="muted">${escapeHtml(e.setupLabel || e.venueFloor)}</div></td>
      <td data-label="When">${when(e)}</td>
      <td data-label="Capacity">${capacityCell(e)}</td>
      <td data-label="Price">${e.price ? money(e.price) : 'Free'}</td>
      <td data-label="Status">${statusControl(e)}</td>
      <td data-label="Actions"><div class="row-actions">
        <button class="btn btn--sm" type="button" data-ev-open="${e.id}">View</button>
        ${LOCKED.includes(e.status) ? '' : `<button class="btn btn--sm" type="button" data-ev-edit="${e.id}">Edit</button>
        <button class="btn btn--sm btn--danger" type="button" data-ev-cancel="${e.id}">Cancel</button>`}
      </div></td>
    </tr>`).join('') || '<tr><td colspan="7" class="list-empty" style="text-align:center;padding:30px">No events match these filters.</td></tr>';
  await renderSchedule(all);
}

function statusControl(e) {
  if (e.status === 'Pending') return `${eventPill(e)} <button class="btn btn--sm btn--black" type="button" data-ev-status="Scheduled" data-id="${e.id}">Approve</button>`;
  if (LOCKED.includes(e.status)) return eventPill(e);
  return `<select class="status-select" data-ev-status-select="${e.id}" aria-label="Status for ${escapeHtml(e.code)}">
    ${['Scheduled', 'Ongoing', 'Completed'].map((s) => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}
  </select>${e.status === 'Scheduled' ? `<div class="muted">${escapeHtml(e.phase)}</div>` : ''}`;
}

function renderStats(all) {
  const today = localToday();
  const upcoming = all.filter((e) => e.status === 'Scheduled' && e.phase === 'Upcoming');
  const pending = all.filter((e) => e.status === 'Pending');
  const live = all.filter((e) => e.phase === 'Ongoing');
  const next = upcoming[0];
  const seats = upcoming.reduce((n, e) => n + (e.registration === 'open' ? e.registered : 0), 0);
  $('#evStats').innerHTML = `
    <div class="stat stat--blue"><div class="stat__label">Upcoming events</div><div class="stat__value">${upcoming.length}</div>
      <div class="stat__sub">${upcoming.filter((e) => e.date <= addDays(today, 7)).length} in the next 7 days</div></div>
    <div class="stat stat--green"><div class="stat__label">Happening now</div><div class="stat__value">${live.length}</div>
      <div class="stat__sub">${live.map((e) => escapeHtml(e.title)).join(', ') || 'No events in progress'}</div></div>
    <div class="stat stat--gold"><div class="stat__label">Pending venue requests</div><div class="stat__value">${pending.length}</div><div class="stat__sub">Slots held until reviewed</div></div>
    <div class="stat"><div class="stat__label">Registered places</div><div class="stat__value">${seats}</div>
      <div class="stat__sub">${next ? `Next: ${escapeHtml(next.title)} (${fmtDate(next.date, { day: 'numeric', month: 'short' })})` : 'No upcoming events'}</div></div>`;
}

function renderRequests(pending) {
  $('#evRequestsCard').hidden = !pending.length;
  $('#evRequestsCount').textContent = `${pending.length} pending`;
  $('#evRequests').innerHTML = pending.map((e) => `
    <li>
      <div class="list__main">
        <div class="list__title"><button class="ref-link" type="button" data-ev-open="${e.id}">${escapeHtml(e.code)}</button> · ${escapeHtml(e.title)}</div>
        <div class="list__sub">${escapeHtml(e.venueName)}${e.setupLabel ? ` (${escapeHtml(e.setupLabel)})` : ''} · ${fmtDate(e.date)} ${e.startTime}–${e.endTime} · ${e.capacity} guests · ${escapeHtml(e.organizer || 'Unknown organiser')} &lt;${escapeHtml(e.contactEmail || '—')}&gt;</div>
      </div>
      <div class="row-actions">
        <button class="btn btn--sm btn--black" type="button" data-ev-status="Scheduled" data-id="${e.id}">Approve</button>
        <button class="btn btn--sm btn--danger" type="button" data-ev-cancel="${e.id}">Decline</button>
      </div>
    </li>`).join('');
}

// ---------- venue schedule ----------

async function renderSchedule(all) {
  const start = $('#vsStart').value || localToday();
  $('#vsStart').value = start;
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const today = localToday();
  const visible = all.filter((e) => e.status !== 'Cancelled' && e.date >= days[0] && e.date <= days.at(-1));
  const head = `<tr><th>Venue</th>${days.map((d) => `<th class="${d === today ? 'is-today' : ''}">${fmtDate(d, { weekday: 'short' })}<br>${fmtDate(d, { day: 'numeric', month: 'short' })}</th>`).join('')}</tr>`;
  const rows = state.venues.map((v) => `<tr><td><strong>${escapeHtml(v.name)}</strong><div class="muted">Up to ${v.capacity}</div></td>
    ${days.map((d) => {
      const list = visible.filter((e) => e.venue === v.code && e.date === d);
      return `<td class="vs-cell">${list.map((e) => {
        const cls = e.status === 'Pending' ? 'pending' : e.phase === 'Ongoing' ? 'checked-in' : e.phase === 'Completed' ? 'completed' : 'confirmed';
        return `<button class="tl-booking tl--${cls}" type="button" data-ev-open="${e.id}" title="${escapeHtml(`${e.code} · ${e.title} · ${e.startTime}–${e.endTime} · ${e.status}`)}">${e.startTime} ${escapeHtml(e.title)}</button>`;
      }).join('')}</td>`;
    }).join('')}</tr>`).join('');
  $('#venueSchedule').innerHTML = `<div class="table-wrap"><table class="timeline venue-timeline"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- status / cancel ----------

async function changeStatus(id, status) {
  try {
    const { message } = await api(`/staff/events/${id}/status`, { method: 'PATCH', body: { status } });
    toast(message, { type: 'success', title: 'Event updated' });
  } catch (err) {
    handleError(err);
  }
  await loadEvents().catch(handleError);
  if ($('#eventViewDialog').open && String(state.viewing) === String(id)) openEvent(id);
}

async function cancelEvent(id) {
  let e;
  try { ({ event: e } = await api(`/staff/events/${id}`)); } catch (err) { return handleError(err); }
  const active = e.registrations.filter((r) => r.status === 'Registered');
  const ok = await confirmDialog({
    title: e.status === 'Pending' ? 'Decline venue request?' : 'Cancel event?',
    message: `${e.status === 'Pending' ? 'Decline' : 'Cancel'} ${e.code} "${e.title}" at ${e.venueName} on ${fmtDate(e.date)} (${e.startTime}–${e.endTime})? ${active.length ? `${active.length} registration(s) will be voided and notified. ` : ''}The venue slot is released immediately.`,
    confirmLabel: e.status === 'Pending' ? 'Decline request' : 'Cancel event',
    danger: true,
  });
  if (!ok) return;
  try {
    const { message } = await api(`/staff/events/${id}/cancel`, { method: 'POST' });
    toast(message, { type: 'success', title: e.status === 'Pending' ? 'Request declined' : 'Event cancelled' });
  } catch (err) {
    handleError(err);
  }
  await loadEvents().catch(handleError);
  if ($('#eventViewDialog').open) openEvent(id);
}

async function cancelRegistration(regId, eventId) {
  const ok = await confirmDialog({ title: 'Cancel registration?', message: 'The attendee is notified and the place returns to the event capacity.', confirmLabel: 'Cancel registration', danger: true });
  if (!ok) return;
  try {
    const { message } = await api(`/staff/event-registrations/${regId}/cancel`, { method: 'POST' });
    toast(message, { type: 'success' });
  } catch (err) {
    handleError(err);
  }
  openEvent(eventId);
  loadEvents().catch(handleError);
}

// ---------- detail ----------

async function openEvent(id) {
  let e;
  try { ({ event: e } = await api(`/staff/events/${id}`)); } catch (err) { return handleError(err); }
  state.viewing = e.id;
  const active = e.registrations.filter((r) => r.status === 'Registered');
  $('#evViewTitle').textContent = e.code;
  $('#evViewBody').innerHTML = `
    <div class="ev-view-head">
      <div><h3>${escapeHtml(e.title)}</h3><div class="muted">${escapeHtml(e.category)} · ${e.visibility === 'private' ? 'Private' : 'Public'} · ${escapeHtml(e.registration === 'open' ? 'Open registration' : e.registration === 'invite' ? 'Invitation only' : 'No registration')}</div></div>
      <div class="row-actions">${statusControl(e)}</div>
    </div>
    <dl class="details">
      <div><dt>Venue</dt><dd>${escapeHtml(e.venueName)}${e.setupLabel ? ` · ${escapeHtml(e.setupLabel)}` : ''}<div class="muted">${escapeHtml(e.venueFloor)}</div></dd></div>
      <div><dt>When</dt><dd>${when(e)}</dd></div>
      <div><dt>Capacity</dt><dd>${e.registered} registered of ${e.capacity}<div class="cap-bar"><span style="width:${e.capacity ? Math.min(100, (e.registered / e.capacity) * 100) : 0}%"></span></div><div class="muted">${e.remaining} place(s) remaining</div></dd></div>
      <div><dt>Price</dt><dd>${e.price ? money(e.price) : 'Free'}${e.priceNote ? `<div class="muted">${escapeHtml(e.priceNote)}</div>` : ''}</dd></div>
      ${e.organizer || e.contactEmail ? `<div><dt>Organiser</dt><dd>${escapeHtml(e.organizer || '—')}<div class="muted">${escapeHtml(e.contactEmail || '')} ${escapeHtml(e.contactPhone || '')}</div></dd></div>` : ''}
      <div><dt>Last updated</dt><dd>${escapeHtml(e.updatedAt)}</dd></div>
      ${e.description ? `<div class="full"><dt>Description</dt><dd class="pre">${escapeHtml(e.description)}</dd></div>` : ''}
      ${e.sampleNote ? `<div class="full"><dt>Sample note</dt><dd>${escapeHtml(e.sampleNote)}</dd></div>` : ''}
    </dl>
    <h4 class="eyebrow" style="margin:24px 0 10px">Attendees (${active.length} active registration${active.length === 1 ? '' : 's'}, ${e.registered} place${e.registered === 1 ? '' : 's'})</h4>
    ${e.registrations.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Reference</th><th>Attendee</th><th>Places</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${e.registrations.map((r) => `<tr>
        <td><strong>${escapeHtml(r.reference)}</strong><div class="muted">${escapeHtml(r.createdAt)}</div></td>
        <td>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}<div class="muted">${escapeHtml(r.email)} · ${escapeHtml(r.phone)}</div>${r.notes ? `<div class="muted">“${escapeHtml(r.notes)}”</div>` : ''}</td>
        <td>${r.tickets}</td><td>${r.amount ? money(r.amount) : 'Free'}</td>
        <td><span class="status status--${r.status === 'Registered' ? 'confirmed' : 'cancelled'}">${escapeHtml(r.status)}</span></td>
        <td>${r.status === 'Registered' ? `<button class="btn btn--sm btn--danger" type="button" data-reg-cancel="${r.id}">Cancel</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : `<p class="hint">${e.registration === 'open' ? 'No registrations yet.' : 'This event does not take online registrations.'}</p>`}`;
  $('#evViewFoot').innerHTML = `
    ${LOCKED.includes(e.status) ? '' : `<button class="btn btn--sm btn--danger" type="button" data-ev-cancel="${e.id}">${e.status === 'Pending' ? 'Decline request' : 'Cancel event'}</button>
      <button class="btn btn--sm btn--black" type="button" data-ev-edit="${e.id}">Edit event</button>`}
    ${e.visibility === 'public' && e.status !== 'Pending' ? `<a class="btn btn--sm" href="/events.html?event=${e.id}" target="_blank" rel="noopener">Guest view</a>` : ''}
    <button class="btn btn--sm" type="button" data-close-ev-view>Close</button>`;
  if (!$('#eventViewDialog').open) $('#eventViewDialog').showModal();
}

// ---------- form ----------

function syncVenue() {
  const form = $('#eventForm');
  const v = venueByCode(form.venue.value);
  if (!v) return;
  $('#eSetupField').hidden = !v.setups.length;
  form.setup.required = !!v.setups.length;
  const prev = form.setup.value;
  form.setup.innerHTML = v.setups.map((s) => `<option value="${s.id}">${escapeHtml(s.label)} (up to ${s.capacity})</option>`).join('');
  if (v.setups.some((s) => s.id === prev)) form.setup.value = prev;
  const setup = v.setups.find((s) => s.id === form.setup.value);
  const cap = setup?.capacity ?? v.capacity;
  form.capacity.max = cap;
  const reg = state.editing?.registered ?? 0;
  $('#eCapHint').textContent = `Max ${cap} for ${setup ? setup.label.toLowerCase() : v.name}${reg ? `; at least ${reg} (already registered)` : ''}.`;
  checkConflicts();
}

let conflictToken = 0;
const checkConflicts = debounce(async () => {
  const form = $('#eventForm');
  const box = $('#eConflicts');
  const { venue, date, startTime, endTime } = formData(form);
  if (!venue || !date || !startTime || !endTime) { box.innerHTML = ''; return; }
  if (endTime <= startTime) { box.innerHTML = '<div class="form-alert form-alert--error">End time must be after the start time (events end on the same day).</div>'; return; }
  const token = ++conflictToken;
  try {
    const { conflicts } = await api(`/staff/events/conflicts${qs({ venue, date, startTime, endTime, excludeId: state.editing?.id })}`);
    if (token !== conflictToken) return;
    box.innerHTML = conflicts.length
      ? `<div class="form-alert form-alert--error"><strong>Venue conflict:</strong> ${conflicts.map((c) => `${escapeHtml(c.code)} "${escapeHtml(c.title)}" ${c.startTime}–${c.endTime} (${escapeHtml(c.status)})`).join('; ')}. Choose another time or venue.</div>`
      : `<div class="form-alert form-alert--success">${escapeHtml(venueByCode(venue)?.name ?? venue)} is free on ${fmtDate(date)} from ${startTime} to ${endTime}.</div>`;
  } catch (err) {
    if (token === conflictToken) box.innerHTML = `<div class="form-alert form-alert--error">${escapeHtml(err.message)}</div>`;
  }
}, 200);

function openForm(e = null) {
  const form = $('#eventForm');
  form.reset();
  clearErrors(form);
  state.editing = e;
  $('#evFormTitle').textContent = e ? `Edit ${e.code}` : 'New event';
  $('#eventSubmit').textContent = e ? 'Save changes' : 'Schedule event';
  form.date.min = e && e.date < localToday() ? e.date : localToday();
  if (e) {
    for (const k of ['title', 'category', 'poster', 'description', 'sampleNote', 'venue', 'date', 'startTime', 'endTime', 'capacity', 'price', 'priceNote', 'registration', 'visibility', 'organizer', 'contactEmail', 'contactPhone']) {
      if (form[k]) form[k].value = e[k] ?? '';
    }
    form.includes.value = e.includes.join('\n');
  } else {
    form.date.value = addDays(localToday(), 7);
    form.startTime.value = '18:00';
    form.endTime.value = '21:00';
    form.capacity.value = 50;
    form.venue.value = 'THEATER';
  }
  syncVenue();
  if (e?.setup) { form.setup.value = e.setup; syncVenue(); }
  $('#eConflicts').innerHTML = '';
  checkConflicts();
  $('#eventFormDialog').showModal();
}

async function submitForm(ev) {
  ev.preventDefault();
  const form = $('#eventForm');
  clearErrors(form);
  if (!validateRequired(form)) return;
  const data = formData(form);
  const details = {};
  if (data.endTime <= data.startTime) details.endTime = 'End time must be after the start time.';
  const max = Number(form.capacity.max);
  if (Number(data.capacity) > max) details.capacity = `This venue/setup holds up to ${max}.`;
  if (Object.keys(details).length) return showFormError(form, new ApiError('Please correct the highlighted event details.', 400, details));
  if (!form.setup.required) data.setup = '';
  await withBusy($('#eventSubmit'), async () => {
    try {
      const editing = state.editing;
      const res = editing
        ? await api(`/staff/events/${editing.id}`, { method: 'PUT', body: data })
        : await api('/staff/events', { method: 'POST', body: data });
      $('#eventFormDialog').close();
      toast(res.message, { type: 'success', title: editing ? 'Event updated' : 'Event scheduled' });
      await loadEvents().catch(handleError);
      openEvent(res.event.id);
    } catch (err) {
      showFormError(form, err);
      if (err.status === 409) checkConflicts();
    }
  });
}

// ---------- setup ----------

async function ensureConfig() {
  if (state.ready) return;
  const { venues, categories, statuses } = await api('/venues');
  Object.assign(state, { venues, categories, statuses, ready: true });
  const f = $('#evFilters');
  f.venue.innerHTML += venues.map((v) => `<option value="${v.code}">${escapeHtml(v.name)}</option>`).join('');
  f.category.innerHTML += categories.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
  f.status.innerHTML += statuses.map((s) => `<option>${s}</option>`).join('');
  const form = $('#eventForm');
  form.category.innerHTML = categories.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
  form.venue.innerHTML = venues.map((v) => `<option value="${v.code}">${escapeHtml(v.name)} (up to ${v.capacity}, ${escapeHtml(v.floor)})</option>`).join('');
}

export function initEvents() {
  const filters = $('#evFilters');
  const reload = debounce(() => loadEvents().catch(handleError));
  filters.addEventListener('input', reload);
  filters.addEventListener('change', reload);
  filters.addEventListener('reset', () => setTimeout(reload));
  filters.addEventListener('submit', (e) => e.preventDefault());

  const form = $('#eventForm');
  form.venue.addEventListener('change', syncVenue);
  form.setup.addEventListener('change', syncVenue);
  ['date', 'startTime', 'endTime'].forEach((n) => form[n].addEventListener('change', checkConflicts));
  form.addEventListener('submit', submitForm);

  $('#vsStart').addEventListener('change', () => loadEvents().catch(handleError));
  $$('[data-vs-shift]').forEach((b) => b.addEventListener('click', () => {
    const shift = Number(b.dataset.vsShift);
    $('#vsStart').value = shift === 0 ? localToday() : addDays($('#vsStart').value || localToday(), shift);
    loadEvents().catch(handleError);
  }));

  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-ev-open], [data-ev-edit], [data-ev-cancel], [data-ev-status], [data-reg-cancel], [data-close-ev-view], [data-new-event]');
    if (!t) return;
    if (t.dataset.evOpen) openEvent(t.dataset.evOpen);
    else if (t.dataset.evEdit) {
      try {
        const { event } = await api(`/staff/events/${t.dataset.evEdit}`);
        $('#eventViewDialog').close();
        await ensureConfig();
        openForm(event);
      } catch (err) { handleError(err); }
    } else if (t.dataset.evCancel) cancelEvent(t.dataset.evCancel);
    else if (t.dataset.evStatus) changeStatus(t.dataset.id, t.dataset.evStatus);
    else if (t.dataset.regCancel) cancelRegistration(t.dataset.regCancel, state.viewing);
    else if (t.hasAttribute('data-close-ev-view')) $('#eventViewDialog').close();
    else if (t.hasAttribute('data-new-event')) { await ensureConfig().catch(handleError); openForm(); }
  });
  document.addEventListener('change', (ev) => {
    const sel = ev.target.closest('[data-ev-status-select]');
    if (sel) changeStatus(sel.dataset.evStatusSelect, sel.value);
  });
  $('#eventViewDialog').addEventListener('close', () => (state.viewing = null));
}
