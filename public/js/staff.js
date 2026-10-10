import {
  api, qs, escapeHtml, money, localToday, addDays, nights, fmtDate, statusPill, toast,
  formData, clearErrors, showFormError, validateRequired, withBusy, confirmDialog,
} from './common.js';
import { initEvents, loadEvents } from './staff-events.js';

const VIEWS = {
  dashboard: { title: 'Dashboard', load: loadDashboard },
  reservations: { title: 'Reservations', load: loadReservations },
  guests: { title: 'Guests', load: loadGuests },
  rooms: { title: 'Rooms & Availability', load: loadRooms },
  events: { title: 'Events & Venues', load: loadEvents },
  outbox: { title: 'Notifications', load: loadOutbox },
};
const EDITABLE = ['Pending', 'Confirmed', 'Checked In'];
const CANCELLABLE = ['Pending', 'Confirmed'];

const state = {
  view: 'dashboard',
  statuses: [],
  roomTypes: [],
  form: { mode: 'create', reservation: null },
  viewing: null,
  guestEditing: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const typeByCode = (code) => state.roomTypes.find((t) => t.code === code);
const fullName = (g) => `${g.firstName} ${g.lastName}`;
const stayText = (r) => `${fmtDate(r.checkIn, { day: 'numeric', month: 'short' })} – ${fmtDate(r.checkOut)}`;

function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function handleError(err) {
  toast(err.message, { type: 'error' });
}

// ---------- navigation ----------

function showView(name) {
  if (!VIEWS[name]) name = 'dashboard';
  state.view = name;
  $$('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== name));
  $$('[data-nav]').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.nav === name);
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#viewTitle').textContent = VIEWS[name].title;
  VIEWS[name].load().catch(handleError);
}

function refreshCurrent() {
  return VIEWS[state.view].load().catch(handleError);
}

function initShell() {
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  $$('dialog').forEach((dlg) => $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close())));
  $$('[data-new-reservation]').forEach((b) => b.addEventListener('click', () => openCreate()));
  $('#todayLabel').textContent = fmtDate(localToday(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- dashboard ----------

async function loadDashboard() {
  const date = $('#dashDate').value || localToday();
  const d = await api(`/staff/dashboard${qs({ date })}`);
  const isToday = date === localToday();
  const when = isToday ? 'tonight' : `on ${fmtDate(date)}`;

  $('#dashStats').innerHTML = `
    <div class="stat"><div class="stat__label">Total rooms</div><div class="stat__value">${d.totalRooms}</div>
      <div class="stat__sub">${d.byCategory.map((c) => `${c.total} ${c.name.split(' ')[0]}`).join(' · ')}</div></div>
    <div class="stat stat--green"><div class="stat__label">Available rooms</div><div class="stat__value">${d.available}</div><div class="stat__sub">Free ${when}</div></div>
    <div class="stat stat--gold"><div class="stat__label">Occupied rooms</div><div class="stat__value">${d.occupied}</div><div class="stat__sub">Reserved or in-house ${when}</div></div>
    <div class="stat stat--blue"><div class="stat__label">Current reservations</div><div class="stat__value">${d.activeReservations}</div><div class="stat__sub">Pending, confirmed &amp; checked in</div></div>`;

  $('#occDate').textContent = fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
  $('#dashOccupancy').innerHTML = d.byCategory.map((c) => `
    <div class="occ-row">
      <strong>${escapeHtml(c.name)}</strong>
      <div class="occ-bar" title="${c.occupied} of ${c.total} occupied"><span style="width:${(c.occupied / c.total) * 100}%"></span></div>
      <div class="occ-row__nums"><strong>${c.available}</strong> free / ${c.total}</div>
    </div>`).join('') + `<p class="muted" style="margin:10px 0 0">Gold = occupied ${when}. Rooms free up on the guest's check-out date.</p>`;

  $('#dashStatus').innerHTML = `<ul class="list">${state.statuses.map((s) => `
    <li><span>${statusPill(s)}</span><a href="#reservations" data-filter-status="${s}"><strong>${d.statusCounts[s] ?? 0}</strong> reservation(s)</a></li>`).join('')}</ul>`;
  $$('[data-filter-status]').forEach((a) => a.addEventListener('click', () => {
    $('#resFilters').reset();
    $('#fStatus').value = a.dataset.filterStatus;
  }));

  const quick = (r, kind) => {
    if (kind === 'arrival' && ['Pending', 'Confirmed'].includes(r.status) && isToday) {
      return `<button class="btn btn--sm btn--black" type="button" data-quick-status="Checked In" data-id="${r.id}">Check in</button>`;
    }
    if (kind === 'departure' && r.status === 'Checked In' && isToday) {
      return `<button class="btn btn--sm" type="button" data-quick-status="Checked Out" data-id="${r.id}">Check out</button>`;
    }
    return '';
  };
  const listItem = (r, kind) => `
    <li>
      <div class="list__main">
        <div class="list__title"><button class="ref-link" type="button" data-open="${r.id}">${escapeHtml(r.reference)}</button> &middot; ${escapeHtml(fullName(r.guest))}</div>
        <div class="list__sub">${escapeHtml(r.categoryName)} · Room ${escapeHtml(r.roomNumber)} · ${stayText(r)}</div>
      </div>
      <div class="row-actions">${statusPill(r.status)} ${quick(r, kind)}</div>
    </li>`;
  $('#arrCount').textContent = `${d.arrivals.length} on ${fmtDate(date, { day: 'numeric', month: 'short' })}`;
  $('#depCount').textContent = `${d.departures.length} on ${fmtDate(date, { day: 'numeric', month: 'short' })}`;
  $('#dashArrivals').innerHTML = d.arrivals.map((r) => listItem(r, 'arrival')).join('') || '<li class="list-empty">No arrivals.</li>';
  $('#dashDepartures').innerHTML = d.departures.map((r) => listItem(r, 'departure')).join('') || '<li class="list-empty">No departures.</li>';
  $('#dashNotifications').innerHTML = d.notifications.map((n) => `
    <li><div class="list__main"><div class="list__title">${escapeHtml(n.subject)}</div>
      <div class="list__sub">To ${escapeHtml(n.recipient)} · ${escapeHtml(n.created_at)}</div></div>
      <span class="badge badge--gold">${escapeHtml(n.type)}</span></li>`).join('') || '<li class="list-empty">No notifications yet.</li>';
  bindRowButtons($('[data-view="dashboard"]'));
}

// ---------- reservations ----------

async function loadReservations() {
  const filters = formData($('#resFilters'));
  const { reservations } = await api(`/staff/reservations${qs(filters)}`);
  $('#resCount').textContent = `${reservations.length} reservation${reservations.length === 1 ? '' : 's'} found`;
  $('#resBody').innerHTML = reservations.map((r) => `
    <tr>
      <td data-label="Reference"><button class="ref-link" type="button" data-open="${r.id}">${escapeHtml(r.reference)}</button><div class="muted">${escapeHtml(r.source)} booking</div></td>
      <td data-label="Guest">${escapeHtml(fullName(r.guest))}<div class="muted">${escapeHtml(r.guest.email)}</div></td>
      <td data-label="Room">${escapeHtml(r.categoryName)}<div class="muted">Room ${escapeHtml(r.roomNumber)}</div></td>
      <td data-label="Stay">${stayText(r)}<div class="muted">${r.nights} night${r.nights === 1 ? '' : 's'}</div></td>
      <td data-label="Guests">${r.guests}</td>
      <td data-label="Total">${money(r.totalAmount)}</td>
      <td data-label="Status">
        <select class="status-select" data-status-id="${r.id}" aria-label="Status for ${escapeHtml(r.reference)}">
          ${state.statuses.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td data-label="Actions"><div class="row-actions">
        <button class="btn btn--sm" type="button" data-open="${r.id}">View</button>
        ${EDITABLE.includes(r.status) ? `<button class="btn btn--sm" type="button" data-edit="${r.id}">Edit</button>` : ''}
        ${CANCELLABLE.includes(r.status) ? `<button class="btn btn--sm btn--danger" type="button" data-cancel="${r.id}">Cancel</button>` : ''}
      </div></td>
    </tr>`).join('') || '<tr><td colspan="8" class="list-empty" style="text-align:center;padding:30px">No reservations match these filters.</td></tr>';
  bindRowButtons($('#resBody'));
  $$('[data-status-id]').forEach((sel) => sel.addEventListener('change', () => changeStatus(sel.dataset.statusId, sel.value)));
}

function initReservationFilters() {
  const form = $('#resFilters');
  form.category.innerHTML += state.roomTypes.map((t) => `<option value="${t.code}">${escapeHtml(t.name)}</option>`).join('');
  form.status.innerHTML += state.statuses.map((s) => `<option>${s}</option>`).join('');
  const reload = debounce(() => loadReservations().catch(handleError));
  form.addEventListener('input', reload);
  form.addEventListener('change', reload);
  form.addEventListener('reset', () => setTimeout(reload));
  form.addEventListener('submit', (e) => e.preventDefault());
}

function bindRowButtons(root) {
  $$('[data-open]', root).forEach((b) => b.addEventListener('click', () => openView(b.dataset.open)));
  $$('[data-edit]', root).forEach((b) => b.addEventListener('click', () => openEditById(b.dataset.edit)));
  $$('[data-cancel]', root).forEach((b) => b.addEventListener('click', () => cancelReservation(b.dataset.cancel)));
  $$('[data-quick-status]', root).forEach((b) => b.addEventListener('click', () => changeStatus(b.dataset.id, b.dataset.quickStatus)));
}

async function changeStatus(id, status) {
  try {
    const { message } = await api(`/staff/reservations/${id}/status`, { method: 'PATCH', body: { status } });
    toast(message, { type: 'success', title: 'Status updated' });
  } catch (err) {
    handleError(err);
  }
  await refreshCurrent();
  if (state.viewing && String(state.viewing) === String(id) && $('#viewDialog').open) openView(id);
}

async function cancelReservation(id) {
  const { reservation: r } = await api(`/staff/reservations/${id}`).catch((e) => (handleError(e), {}));
  if (!r) return;
  const ok = await confirmDialog({
    title: 'Cancel reservation?',
    message: `Cancel ${r.reference} for ${fullName(r.guest)} (${r.categoryName}, room ${r.roomNumber}, ${stayText(r)})? The room will be released immediately.`,
    confirmLabel: 'Cancel reservation',
    danger: true,
  });
  if (!ok) return;
  try {
    const { message } = await api(`/staff/reservations/${id}/cancel`, { method: 'POST' });
    toast(message, { type: 'success', title: 'Reservation cancelled' });
    if ($('#viewDialog').open) openView(id);
  } catch (err) {
    handleError(err);
  }
  refreshCurrent();
}

// ---------- reservation detail ----------

async function openView(id) {
  let data;
  try { data = await api(`/staff/reservations/${id}`); } catch (err) { return handleError(err); }
  const { reservation: r, notifications } = data;
  state.viewing = r.id;
  $('#viewDlgTitle').textContent = r.reference;
  $('#viewBody').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px">
      ${statusPill(r.status)}
      <label class="field" style="flex-direction:row;align-items:center;gap:10px">
        <span class="label">Change status</span>
        <select class="status-select" id="viewStatus">${state.statuses.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </label>
    </div>
    <dl class="details">
      <div><dt>Guest</dt><dd>${escapeHtml(fullName(r.guest))}</dd></div>
      <div><dt>Contact</dt><dd>${escapeHtml(r.guest.email)}<br>${escapeHtml(r.guest.phone)}</dd></div>
      <div><dt>Room</dt><dd>${escapeHtml(r.categoryName)} · Room ${escapeHtml(r.roomNumber)}</dd></div>
      <div><dt>Guests</dt><dd>${r.guests}</dd></div>
      <div><dt>Check-in</dt><dd>${fmtDate(r.checkIn, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
      <div><dt>Check-out</dt><dd>${fmtDate(r.checkOut, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
      <div><dt>Rate × nights</dt><dd>${money(r.nightlyRate)} × ${r.nights}</dd></div>
      <div><dt>Total (simulated)</dt><dd>${money(r.totalAmount)}</dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(r.source)}</dd></div>
      <div><dt>Last updated</dt><dd>${escapeHtml(r.updatedAt)}</dd></div>
      ${r.specialRequests ? `<div class="full"><dt>Special requests</dt><dd>${escapeHtml(r.specialRequests)}</dd></div>` : ''}
    </dl>
    <div class="inbox">
      <h4>Simulated notifications</h4>
      ${notifications.map((n) => `<div class="inbox__item"><header><span>${escapeHtml(n.type)}</span><time>${escapeHtml(n.created_at)}</time></header>
        <strong>${escapeHtml(n.subject)}</strong><p>${escapeHtml(n.message)}</p></div>`).join('') || '<p class="hint">None.</p>'}
    </div>`;
  $('#viewFoot').innerHTML = `
    ${CANCELLABLE.includes(r.status) ? '<button class="btn btn--sm btn--danger" type="button" id="viewCancel">Cancel reservation</button>' : ''}
    ${EDITABLE.includes(r.status) ? '<button class="btn btn--sm btn--black" type="button" id="viewEdit">Edit stay</button>' : ''}
    <button class="btn btn--sm" type="button" data-close-view>Close</button>`;
  $('#viewStatus').addEventListener('change', (e) => changeStatus(r.id, e.target.value));
  $('#viewCancel')?.addEventListener('click', () => cancelReservation(r.id));
  $('#viewEdit')?.addEventListener('click', () => { $('#viewDialog').close(); openEdit(r); });
  $('[data-close-view]').addEventListener('click', () => $('#viewDialog').close());
  if (!$('#viewDialog').open) $('#viewDialog').showModal();
}

// ---------- create / edit form ----------

function setGuestMode(mode) {
  const isNew = mode === 'new';
  $('#newGuestFields').hidden = !isNew;
  $('#existingGuestField').hidden = isNew;
  $$('#newGuestFields input').forEach((i) => { i.disabled = !isNew; i.required = isNew; });
  $('#rGuestId').disabled = isNew;
  $('#rGuestId').required = !isNew;
}

async function loadGuestOptions(selectedId) {
  const { guests } = await api('/staff/guests');
  $('#rGuestId').innerHTML = '<option value="">Select a guest…</option>' + guests.map((g) =>
    `<option value="${g.id}" ${String(g.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(g.lastName)}, ${escapeHtml(g.firstName)} — ${escapeHtml(g.email)}</option>`).join('');
}

function fillGuestCount(capacity, selected) {
  const sel = $('#rGuests');
  sel.innerHTML = Array.from({ length: capacity }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  sel.value = String(Math.min(Number(selected) || 1, capacity));
}

const refreshResForm = debounce(async () => {
  const form = $('#resForm');
  const { category, checkIn, checkOut } = formData(form);
  const type = typeByCode(category);
  fillGuestCount(type.capacity, $('#rGuests').value);
  const roomSel = $('#rRoom');
  const keep = roomSel.value;
  const current = state.form.reservation;
  const n = nights(checkIn, checkOut);
  let availability = '';
  if (n > 0) {
    try {
      const { rooms } = await api(`/staff/free-rooms${qs({ category, checkIn, checkOut, excludeId: current?.id })}`);
      roomSel.innerHTML = `<option value="">Auto-assign${current && current.category === category ? ' (keep current if free)' : ''}</option>` +
        rooms.map((num) => `<option value="${num}">Room ${num}${current?.roomNumber === num ? ' (current)' : ''}</option>`).join('');
      roomSel.value = rooms.includes(keep) ? keep : '';
      availability = rooms.length
        ? `<div class="price-summary__row"><span>Rooms free for these dates</span><strong style="color:var(--success)">${rooms.length} of ${type.roomCount}</strong></div>`
        : `<div class="price-summary__row" style="color:var(--danger)"><strong>No ${escapeHtml(type.name)}s are free for these dates.</strong></div>`;
    } catch (err) {
      roomSel.innerHTML = '<option value="">Auto-assign</option>';
      availability = `<div class="price-summary__row" style="color:var(--danger)">${escapeHtml(err.message)}</div>`;
    }
  } else {
    roomSel.innerHTML = '<option value="">Auto-assign</option>';
  }
  $('#rSummary').innerHTML = n > 0
    ? `${availability}
       <div class="price-summary__row"><span>${escapeHtml(type.name)} · ${money(type.rate)} × ${n} night${n === 1 ? '' : 's'}</span></div>
       <div class="price-summary__row price-summary__total"><span>Total (simulated)</span><span>${money(type.rate * n)}</span></div>`
    : '<div class="price-summary__row" style="color:var(--danger)">Check-out must be after check-in.</div>';
}, 150);

function prepareForm(mode) {
  const form = $('#resForm');
  form.reset();
  clearErrors(form);
  state.form.mode = mode;
  $('#rCategory').innerHTML = state.roomTypes.map((t) => `<option value="${t.code}">${escapeHtml(t.name)} — ${money(t.rate)}/night (max ${t.capacity})</option>`).join('');
  $('#guestModeRow').hidden = mode === 'edit';
  $('#editGuestInfo').hidden = mode !== 'edit';
  $('#statusField').hidden = mode === 'edit';
  $('#rStatus').disabled = mode === 'edit';
}

async function openCreate({ guestId } = {}) {
  prepareForm('create');
  state.form.reservation = null;
  $('#resDialogTitle').textContent = 'New reservation';
  $('#resSubmit').textContent = 'Create reservation';
  $('#rCheckIn').value = localToday();
  $('#rCheckOut').value = addDays(localToday(), 1);
  $('#rCategory').value = 'ECONOMY';
  fillGuestCount(typeByCode('ECONOMY').capacity, 1);
  const mode = guestId ? 'existing' : 'new';
  $(`input[name="guestMode"][value="${mode}"]`).checked = true;
  setGuestMode(mode);
  $('#resDialog').showModal();
  refreshResForm();
  await loadGuestOptions(guestId).catch(handleError);
}

async function openEditById(id) {
  try {
    const { reservation } = await api(`/staff/reservations/${id}`);
    openEdit(reservation);
  } catch (err) { handleError(err); }
}

function openEdit(r) {
  prepareForm('edit');
  state.form.reservation = r;
  $('#resDialogTitle').textContent = `Edit ${r.reference}`;
  $('#resSubmit').textContent = 'Save changes';
  setGuestMode('existing');
  $('#existingGuestField').hidden = true;
  $('#rGuestId').disabled = true;
  $('#editGuestInfo').innerHTML = `<p style="margin:0"><strong>${escapeHtml(fullName(r.guest))}</strong> · ${escapeHtml(r.guest.email)} · ${escapeHtml(r.guest.phone)}</p>
    <p class="hint" style="margin:4px 0 0">Guest contact details are edited from the Guests page. Current status: ${escapeHtml(r.status)}.</p>`;
  $('#rCategory').value = r.category;
  $('#rCheckIn').value = r.checkIn;
  $('#rCheckOut').value = r.checkOut;
  $('#rRequests').value = r.specialRequests;
  fillGuestCount(typeByCode(r.category).capacity, r.guests);
  $('#rRoom').innerHTML = `<option value="${r.roomNumber}">Room ${r.roomNumber} (current)</option>`;
  $('#resDialog').showModal();
  refreshResForm();
}

function initReservationForm() {
  const form = $('#resForm');
  $$('input[name="guestMode"]').forEach((r) => r.addEventListener('change', () => setGuestMode(r.value)));
  ['#rCategory', '#rCheckIn', '#rCheckOut'].forEach((s) => $(s).addEventListener('change', () => {
    const ci = $('#rCheckIn').value;
    if (ci && (!$('#rCheckOut').value || $('#rCheckOut').value <= ci) && s === '#rCheckIn') $('#rCheckOut').value = addDays(ci, 1);
    refreshResForm();
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (!validateRequired(form)) return;
    const data = formData(form);
    if (!data.roomNumber) delete data.roomNumber;
    delete data.guestMode;
    await withBusy($('#resSubmit'), async () => {
      try {
        let result;
        if (state.form.mode === 'create') {
          result = await api('/staff/reservations', { method: 'POST', body: data });
        } else {
          const { category, roomNumber, checkIn, checkOut, guests, specialRequests } = data;
          result = await api(`/staff/reservations/${state.form.reservation.id}`, {
            method: 'PUT',
            body: { category, roomNumber, checkIn, checkOut, guests, specialRequests },
          });
        }
        $('#resDialog').close();
        toast(result.message, { type: 'success', title: state.form.mode === 'create' ? 'Reservation created' : 'Reservation updated' });
        refreshCurrent();
        openView(result.reservation.id);
      } catch (err) {
        showFormError(form, err);
        if (err.status === 409) refreshResForm();
      }
    });
  });
}

// ---------- guests ----------

async function loadGuests() {
  const { guests } = await api(`/staff/guests${qs({ q: $('#gQ').value })}`);
  $('#guestCount').textContent = `${guests.length} guest${guests.length === 1 ? '' : 's'}`;
  $('#guestBody').innerHTML = guests.map((g) => `
    <tr>
      <td data-label="Guest"><strong>${escapeHtml(g.lastName)}, ${escapeHtml(g.firstName)}</strong><div class="muted">Since ${escapeHtml(g.createdAt.slice(0, 10))}</div></td>
      <td data-label="Email">${escapeHtml(g.email)}</td>
      <td data-label="Phone">${escapeHtml(g.phone)}</td>
      <td data-label="Reservations">${g.totalReservations} total<div class="muted">${g.activeReservations} active</div></td>
      <td data-label="Latest check-in">${g.lastCheckIn ? fmtDate(g.lastCheckIn) : '—'}</td>
      <td data-label="Actions"><div class="row-actions">
        <button class="btn btn--sm" type="button" data-guest="${g.id}">View / edit</button>
        <button class="btn btn--sm btn--black" type="button" data-book-guest="${g.id}">Book</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" class="list-empty" style="text-align:center;padding:30px">No guests found.</td></tr>';
  $$('[data-guest]').forEach((b) => b.addEventListener('click', () => openGuest(b.dataset.guest)));
  $$('[data-book-guest]').forEach((b) => b.addEventListener('click', () => openCreate({ guestId: b.dataset.bookGuest })));
}

async function openGuest(id) {
  let guest;
  try { ({ guest } = await api(`/staff/guests/${id}`)); } catch (err) { return handleError(err); }
  state.guestEditing = guest.id;
  const form = $('#guestForm');
  clearErrors(form);
  $('#guestTitle').textContent = fullName(guest);
  form.firstName.value = guest.firstName;
  form.lastName.value = guest.lastName;
  form.email.value = guest.email;
  form.phone.value = guest.phone;
  $('#guestHistory').innerHTML = guest.reservations.length ? `
    <div class="table-wrap"><table class="data"><thead><tr><th>Reference</th><th>Room</th><th>Stay</th><th>Status</th></tr></thead><tbody>
      ${guest.reservations.map((r) => `<tr>
        <td><button class="ref-link" type="button" data-open="${r.id}">${escapeHtml(r.reference)}</button></td>
        <td>${escapeHtml(r.categoryName)} · ${escapeHtml(r.roomNumber)}</td>
        <td>${stayText(r)}</td><td>${statusPill(r.status)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="hint">No reservations.</p>';
  bindRowButtons($('#guestHistory'));
  if (!$('#guestDialog').open) $('#guestDialog').showModal();
}

function initGuests() {
  $('#gQ').addEventListener('input', debounce(() => loadGuests().catch(handleError)));
  const form = $('#guestForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (!validateRequired(form)) return;
    await withBusy(form.querySelector('[type="submit"]'), async () => {
      try {
        const { message } = await api(`/staff/guests/${state.guestEditing}`, { method: 'PUT', body: formData(form) });
        toast(message, { type: 'success', title: 'Guest saved' });
        $('#guestDialog').close();
        refreshCurrent();
      } catch (err) {
        showFormError(form, err);
      }
    });
  });
}

// ---------- rooms & timeline ----------

async function loadRooms() {
  const start = $('#tlStart').value || localToday();
  $('#tlStart').value = start;
  const t = await api(`/staff/rooms${qs({ start, days: 14 })}`);
  const today = localToday();

  $('#inventoryCards').innerHTML = t.groups.map((g) => {
    const counts = { Available: 0, Reserved: 0, Occupied: 0 };
    g.rooms.forEach((r) => counts[r.status]++);
    return `<div class="stat ${g.code === 'VIP' ? 'stat--gold' : g.code === 'DELUXE' ? 'stat--blue' : 'stat--green'}">
      <div class="stat__label">${escapeHtml(g.name)}s · ${money(g.rate)}/night</div>
      <div class="stat__value">${g.rooms.length} <span style="font-size:1rem;font-weight:500">rooms</span></div>
      <div class="stat__sub">Tonight: ${counts.Available} available · ${counts.Reserved} reserved · ${counts.Occupied} in-house</div>
    </div>`;
  }).join('');

  const head = `<tr><th>Room</th>${t.dates.map((d) => `<th class="${d === today ? 'is-today' : ''}">${fmtDate(d, { weekday: 'short' })}<br>${fmtDate(d, { day: 'numeric', month: 'short' })}</th>`).join('')}</tr>`;
  $('#timeline').innerHTML = t.groups.map((g) => `
    <div class="room-group">
      <div class="room-group__head"><h3>${escapeHtml(g.name)}s (${g.rooms.length})</h3><span class="muted">Rooms ${g.rooms[0].number}–${g.rooms.at(-1).number}</span></div>
      <div class="table-wrap"><table class="timeline"><thead>${head}</thead><tbody>
        ${g.rooms.map((room) => `<tr><td><strong>${room.number}</strong><span class="room-chip room-chip--${room.status.toLowerCase()}">${room.status}</span>
          ${room.currentGuest ? `<div class="muted">${escapeHtml(room.currentGuest)}</div>` : ''}</td>${timelineCells(room, t.dates)}</tr>`).join('')}
      </tbody></table></div>
    </div>`).join('');
  bindRowButtons($('#timeline'));
}

function timelineCells(room, dates) {
  let html = '';
  for (let i = 0; i < dates.length;) {
    const day = dates[i];
    const b = room.bookings.find((x) => x.checkIn <= day && day < x.checkOut);
    if (!b) { html += '<td class="free"></td>'; i++; continue; }
    let span = 0;
    while (i + span < dates.length && dates[i + span] < b.checkOut) span++;
    const cls = b.status.toLowerCase().replace(/\s+/g, '-');
    const tip = `${b.reference} · ${b.guestName} · ${b.checkIn} → ${b.checkOut} · ${b.status}`;
    html += `<td colspan="${span}"><button class="tl-booking tl--${cls}" type="button" data-open="${b.id}" title="${escapeHtml(tip)}">${escapeHtml(b.guestName)} · ${escapeHtml(b.reference)}</button></td>`;
    i += span;
  }
  return html;
}

function initRooms() {
  $('#tlStart').addEventListener('change', () => loadRooms().catch(handleError));
  $$('[data-shift]').forEach((b) => b.addEventListener('click', () => {
    const shift = Number(b.dataset.shift);
    $('#tlStart').value = shift === 0 ? localToday() : addDays($('#tlStart').value || localToday(), shift);
    loadRooms().catch(handleError);
  }));
}

// ---------- outbox ----------

async function loadOutbox() {
  const { notifications } = await api('/staff/notifications');
  $('#outboxBody').innerHTML = notifications.map((n) => `
    <tr>
      <td data-label="Sent">${escapeHtml(n.created_at)}</td>
      <td data-label="Reference">${n.reservation_id ? `<button class="ref-link" type="button" data-open="${n.reservation_id}">${escapeHtml(n.reference)}</button>` : escapeHtml(n.reference)}</td>
      <td data-label="Recipient">${escapeHtml(n.recipient)}</td>
      <td data-label="Type"><span class="badge badge--gold">${escapeHtml(n.type)}</span></td>
      <td data-label="Message"><strong>${escapeHtml(n.subject)}</strong><div class="muted">${escapeHtml(n.message)}</div></td>
    </tr>`).join('') || '<tr><td colspan="5" class="list-empty">No notifications yet.</td></tr>';
  bindRowButtons($('#outboxBody'));
}

// ---------- boot ----------

async function init() {
  initShell();
  try {
    const config = await api('/config');
    state.statuses = config.statuses;
    state.roomTypes = config.roomTypes;
  } catch (err) {
    return handleError(err);
  }
  $('#dashDate').value = localToday();
  $('#dashDate').addEventListener('change', () => loadDashboard().catch(handleError));
  $('#dashToday').addEventListener('click', () => { $('#dashDate').value = localToday(); loadDashboard().catch(handleError); });
  initReservationFilters();
  initReservationForm();
  initGuests();
  initRooms();
  initEvents();
  $('#viewDialog').addEventListener('close', () => (state.viewing = null));
  showView(location.hash.slice(1) || 'dashboard');
}

init();
