import {
  api, qs, escapeHtml, money, localToday, addDays, nights, fmtDate, statusPill, toast,
  formData, clearErrors, showFormError, validateRequired, withBusy, confirmDialog,
} from './common.js';
import { FACILITIES, ACCESS, CATEGORIES, facilityImage, facilityKind } from './facilities-data.js';
import { posterSvg } from './event-art.js';

const LAST_BOOKING_KEY = 'haraya:lastBooking';
const GUEST_EDITABLE = ['Pending', 'Confirmed'];

const state = {
  roomTypes: [],
  search: { checkIn: '', checkOut: '', guests: 2 },
  availability: [],
  booking: null, // { reservation, notifications, email }
};

const $ = (sel) => document.querySelector(sel);
const typeByCode = (code) => state.roomTypes.find((t) => t.code === code);

// ---------- layout behaviour ----------

function initSearchLinks() {
  document.querySelectorAll('[data-focus-search]').forEach((el) =>
    el.addEventListener('click', () => setTimeout(() => $('#searchCheckIn').focus({ preventScroll: true }), 350)));
}

function initHero() {
  const slides = [...document.querySelectorAll('.hero-bg')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let index = 0;
  setInterval(() => {
    index = (index + 1) % slides.length;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === index));
  }, 7000);
}

function wireDialogs() {
  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  });
}

/** Keeps a check-in / check-out pair valid: no past dates, check-out after check-in. */
function linkDates(inEl, outEl, { allowPast = false } = {}) {
  const sync = () => {
    if (!allowPast) inEl.min = localToday();
    if (inEl.value) {
      outEl.min = addDays(inEl.value, 1);
      if (!outEl.value || outEl.value <= inEl.value) outEl.value = addDays(inEl.value, 1);
    }
  };
  inEl.addEventListener('change', sync);
  sync();
  return sync;
}

// ---------- availability & room cards ----------

async function loadAvailability() {
  const { checkIn, checkOut } = state.search;
  try {
    const data = await api(`/availability${qs({ checkIn, checkOut })}`);
    state.availability = data.roomTypes;
    renderSummary();
    renderRooms();
    const summary = $('#staySummary');
    summary.classList.remove('flash');
    void summary.offsetWidth;
    summary.classList.add('flash');
  } catch (err) {
    $('#staySummary').textContent = err.message;
    toast(err.message, { type: 'error' });
  }
}

function renderSummary() {
  const { checkIn, checkOut, guests } = state.search;
  const n = nights(checkIn, checkOut);
  const totalFree = state.availability.reduce((s, t) => s + t.available, 0);
  $('#staySummary').innerHTML = `
    <span>Showing availability for <strong>${fmtDate(checkIn)}</strong> &ndash; <strong>${fmtDate(checkOut)}</strong></span>
    <span><strong>${n}</strong> night${n === 1 ? '' : 's'} &middot; <strong>${guests}</strong> guest${guests == 1 ? '' : 's'}</span>
    <span><strong>${totalFree}</strong> of 20 rooms available</span>`;
  $('#tourLink').href = `/room.html${qs(state.search)}`;
}

function availabilityMarkup(t) {
  const level = t.available === 0 ? 'none' : t.available <= Math.ceil(t.total * 0.3) ? 'low' : 'ok';
  const label = t.available === 0 ? 'Sold out for these dates' : `${t.available} of ${t.total} rooms available`;
  const segments = Array.from({ length: t.total }, (_, i) => `<span class="${i < t.available ? 'on' : ''}"></span>`).join('');
  return `
    <div class="availability availability--${level}">
      <div class="availability__label"><span>${label}</span><span>${t.booked} booked</span></div>
      <div class="availability__bar" style="grid-template-columns:repeat(${t.total},1fr)" aria-hidden="true">${segments}</div>
    </div>`;
}

function renderRooms() {
  const guests = Number(state.search.guests);
  const n = nights(state.search.checkIn, state.search.checkOut);
  $('#roomGrid').innerHTML = state.availability.map((t, i) => {
    const soldOut = t.available === 0;
    const tooMany = guests > t.capacity;
    const badge = soldOut
      ? '<span class="badge badge--none">Sold out</span>'
      : t.available <= Math.ceil(t.total * 0.3)
        ? `<span class="badge badge--low">Only ${t.available} left</span>`
        : '<span class="badge badge--ok">Available</span>';
    const btnLabel = soldOut ? 'Unavailable' : tooMany ? `Max ${t.capacity} guests` : 'Reserve';
    const tourHref = `/room.html${qs({ type: t.code, ...state.search })}`;
    return `
      <article class="room-block${i % 2 ? ' flip' : ''}" aria-labelledby="room-${t.code}">
        <div class="room-media">
          <img src="${t.image}" alt="${escapeHtml(t.name)} interior" loading="lazy">
          ${badge}
          <a class="room-card__tour" href="${tourHref}" aria-label="Explore the ${escapeHtml(t.name)} in 3D">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>
            Explore in 3D
          </a>
        </div>
        <div class="room-body">
          <span class="room-tag">${t.total} ${t.total === 1 ? 'room' : 'rooms'} &middot; ${escapeHtml(t.view)}</span>
          <h3 id="room-${t.code}">${escapeHtml(t.name)}</h3>
          <ul class="room-meta">
            <li>${t.size}</li><li>${t.bed}</li><li>Sleeps ${t.capacity}</li>
          </ul>
          <p class="room-desc">${escapeHtml(t.description)}</p>
          <p class="room-am"><span class="visually-hidden">In-room features: </span>${t.amenities.map((a) => escapeHtml(a)).join('<span class="am-sep" aria-hidden="true"></span>')}</p>
          <div class="room-foot">
            <div class="price">
              <span class="serif">${money(t.rate)}</span>
              <small>per night${n > 0 ? ` &middot; ${money(t.rate * n)} for ${n} night${n === 1 ? '' : 's'}` : ''}</small>
            </div>
            <div class="avail-side">
              ${availabilityMarkup(t)}
              <button class="btn btn--black" type="button" data-book="${t.code}" ${soldOut || tooMany ? 'disabled' : ''}>${btnLabel}</button>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');
  document.querySelectorAll('[data-book]').forEach((b) => b.addEventListener('click', () => openBooking(b.dataset.book)));
}

function renderAmenities() {
  $('#homeAmenities').innerHTML = FACILITIES.map((f) => `
    <article class="amen-card">
      <div class="amen-card__media">
        <img src="${facilityImage(f.id)}" alt="${escapeHtml(f.name)} preview" loading="lazy" onerror="this.hidden=true">
        <span class="amen-card__3d">3D</span>
      </div>
      <div class="amen-card__body">
        <div class="amen-card__cat">${escapeHtml(CATEGORIES[f.category])} &middot; ${escapeHtml(facilityKind(f))}</div>
        <h3>${escapeHtml(f.name)}</h3>
        <p class="amen-card__tagline">${escapeHtml(f.tagline)}</p>
        <p>${escapeHtml(f.description)}</p>
        <div class="amen-card__meta">
          <span class="access-pill access-pill--${ACCESS[f.access].tone}">${escapeHtml(ACCESS[f.access].label)}</span>
          <span class="amen-card__hours">${escapeHtml(f.hours)}</span>
        </div>
        <div class="amen-card__actions">
          <a class="btn btn--sm" href="/amenities.html?id=${f.id}#preview">View Facility</a>
          <a class="btn btn--black btn--sm" href="/facility.html?id=${f.id}">Explore in 3D</a>
        </div>
      </div>
    </article>`).join('');
}

function homeEventCard(e) {
  const [, m, d] = e.date.split('-');
  const month = new Date(2000, Number(m) - 1, 1).toLocaleString('en-GB', { month: 'short' }).toUpperCase();
  const price = e.price ? `${/starting/i.test(e.priceNote ?? '') ? 'From ' : ''}${money(e.price)}` : 'Free';
  const featured = /bakebe/i.test(e.title);
  return `
    <article class="ev-card ev-card--${escapeHtml(e.poster)}${featured ? ' ev-card--featured' : ''}">
      <div class="ev-card__media">
        ${posterSvg(e.poster, { label: escapeHtml(e.title) })}
        <span class="ev-date" aria-hidden="true"><b>${Number(d)}</b>${month}</span>
        <span class="ev-card__status"><span class="status status--${e.phase.toLowerCase()}">${escapeHtml(e.phase)}</span></span>
      </div>
      <div class="ev-card__body event-card__body">
        <div class="ev-card__cat">${escapeHtml(e.category)} &middot; ${escapeHtml(e.venueName)}</div>
        <h3 class="ev-card__title">${escapeHtml(e.title)}</h3>
        <p class="ev-card__when"><time datetime="${e.date}">${fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</time> &middot; ${e.startTime}–${e.endTime}</p>
        <div class="ev-card__meta">
          <span class="ev-price">${price}</span>
          <span class="ev-places">${e.registration === 'open' ? (e.remaining === 0 ? 'Fully booked' : `${e.remaining} places left`) : ''}</span>
        </div>
        <div class="ev-card__actions">
          <a class="btn btn--black btn--sm" href="/events.html?event=${e.id}">View Event</a>
          ${e.canRegister ? `<a class="btn btn--sm" href="/events.html?event=${e.id}&amp;register">Register</a>` : ''}
        </div>
      </div>
    </article>`;
}

async function renderHomeEvents() {
  const box = $('#homeEvents');
  try {
    const { events } = await api('/events');
    const upcoming = events.filter((e) => e.phase === 'Upcoming' || e.phase === 'Ongoing');
    const featured = upcoming.find((e) => /bakebe/i.test(e.title));
    const list = [featured, ...upcoming.filter((e) => e !== featured)].filter(Boolean).slice(0, 3);
    box.innerHTML = list.length
      ? list.map(homeEventCard).join('')
      : '<div class="empty-state">No upcoming events at the moment. <a href="/events.html">Browse the events calendar</a>.</div>';
  } catch (err) {
    box.innerHTML = `<div class="form-alert form-alert--error">Upcoming events could not be loaded (${escapeHtml(err.message)}). <a href="/events.html">Open the events page</a>.</div>`;
  }
}

function initSearch() {
  const form = $('#searchForm');
  const inEl = $('#searchCheckIn');
  const outEl = $('#searchCheckOut');
  inEl.value = localToday();
  outEl.value = addDays(inEl.value, 1);
  linkDates(inEl, outEl);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!inEl.value || !outEl.value) return toast('Please choose check-in and check-out dates.', { type: 'error' });
    if (inEl.value < localToday()) return toast('Check-in date cannot be in the past.', { type: 'error' });
    if (outEl.value <= inEl.value) return toast('Check-out date must be after the check-in date.', { type: 'error' });
    state.search = { checkIn: inEl.value, checkOut: outEl.value, guests: Number($('#searchGuests').value) };
    await loadAvailability();
    $('#rooms').scrollIntoView({ behavior: 'smooth' });
  });
  $('#searchGuests').addEventListener('change', () => {
    state.search.guests = Number($('#searchGuests').value);
    renderSummary();
    renderRooms();
  });
}

// ---------- booking ----------

function fillGuestOptions(select, capacity, selected) {
  select.innerHTML = Array.from({ length: capacity }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${n === Number(selected) ? 'selected' : ''}>${n} guest${n > 1 ? 's' : ''}</option>`).join('');
  if (Number(selected) > capacity) select.value = String(capacity);
}

function fillCategoryOptions(select, availability, selected) {
  select.innerHTML = availability.map((t) =>
    `<option value="${t.code}" ${t.code === selected ? 'selected' : ''}>${escapeHtml(t.name)} - ${money(t.rate)}/night${t.available !== undefined ? ` (${t.available} available)` : ''}</option>`).join('');
}

function renderPriceSummary(el, code, checkIn, checkOut, extra = '') {
  const t = typeByCode(code);
  const n = nights(checkIn, checkOut);
  if (!t || n <= 0) {
    el.innerHTML = '<div class="price-summary__row"><span>Select valid dates to see your total.</span></div>';
    return;
  }
  el.innerHTML = `
    <div class="price-summary__row"><span>${escapeHtml(t.name)} &times; ${n} night${n === 1 ? '' : 's'}</span><span>${money(t.rate)} / night</span></div>
    ${extra}
    <div class="price-summary__row price-summary__total"><span>Estimated total (pay at hotel, simulated)</span><span>${money(t.rate * n)}</span></div>`;
}

async function refreshBookingDialog() {
  const form = $('#bookingForm');
  const { category, checkIn, checkOut } = formData(form);
  const t = typeByCode(category);
  fillGuestOptions($('#bkGuests'), t.capacity, $('#bkGuests').value || state.search.guests);
  $('#selectedRoom').innerHTML = `
    <img src="${t.image}" alt="">
    <div><h3>${escapeHtml(t.name)}</h3><div class="hint">${t.size} &middot; ${t.bed} &middot; ${t.view}</div><div id="bkAvail" class="hint"></div></div>`;
  let availLine = '';
  if (checkIn && checkOut && checkOut > checkIn) {
    try {
      const data = await api(`/availability${qs({ checkIn, checkOut })}`);
      fillCategoryOptions($('#bkCategory'), data.roomTypes, category);
      const a = data.roomTypes.find((x) => x.code === category);
      availLine = a.available
        ? `<strong style="color:var(--success)">${a.available} of ${a.total} available</strong> for these dates`
        : '<strong style="color:var(--danger)">Sold out for these dates</strong>, please change dates or category';
    } catch { /* validation errors are shown on submit */ }
  }
  const slot = $('#bkAvail');
  if (slot) slot.innerHTML = availLine;
  renderPriceSummary($('#bkSummary'), category, checkIn, checkOut);
}

function openBooking(code) {
  const form = $('#bookingForm');
  clearErrors(form);
  fillCategoryOptions($('#bkCategory'), state.availability, code);
  $('#bkCheckIn').value = state.search.checkIn;
  $('#bkCheckOut').value = state.search.checkOut;
  fillGuestOptions($('#bkGuests'), typeByCode(code).capacity, state.search.guests);
  bookingDatesSync();
  refreshBookingDialog();
  $('#bookingDialog').showModal();
}

let bookingDatesSync = () => {};

function initBookingForm() {
  const form = $('#bookingForm');
  bookingDatesSync = linkDates($('#bkCheckIn'), $('#bkCheckOut'));
  ['#bkCategory', '#bkCheckIn', '#bkCheckOut'].forEach((s) => $(s).addEventListener('change', refreshBookingDialog));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (!validateRequired(form)) return;
    const payload = formData(form);
    await withBusy(form.querySelector('[type="submit"]'), async () => {
      try {
        const { reservation, message } = await api('/reservations', { method: 'POST', body: payload });
        $('#bookingDialog').close();
        form.reset();
        localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify({ reference: reservation.reference, email: reservation.guest.email }));
        toast(message, { type: 'success', title: 'Booking confirmed' });
        showConfirmation('booked', reservation);
        await loadAvailability();
        await lookup(reservation.reference, reservation.guest.email, { quiet: true });
      } catch (err) {
        showFormError(form, err);
        if (err.status === 409) { await loadAvailability(); refreshBookingDialog(); }
      }
    });
  });
}

function showConfirmation(kind, r) {
  const titles = { booked: 'Booking confirmed', modified: 'Reservation updated', cancelled: 'Reservation cancelled' };
  const intro = {
    booked: 'Thank you! Your reservation is confirmed. Please keep your booking reference.',
    modified: 'Your changes have been saved. Here are your updated details.',
    cancelled: 'Your reservation has been cancelled and the room has been released. No charges apply.',
  };
  $('#confirmTitle').textContent = titles[kind];
  $('#confirmBody').innerHTML = `
    <div class="confirm-hero">
      <div class="confirm-hero__icon ${kind === 'cancelled' ? 'confirm-hero__icon--cancel' : ''}" aria-hidden="true">${kind === 'cancelled' ? '&#x2715;' : '&#x2713;'}</div>
      <p style="margin:0 0 6px">${intro[kind]}</p>
      <div class="ref">${escapeHtml(r.reference)}</div>
      <div>${statusPill(r.status)}</div>
    </div>
    <dl class="details">
      <div><dt>Guest</dt><dd>${escapeHtml(r.guest.firstName)} ${escapeHtml(r.guest.lastName)}</dd></div>
      <div><dt>Room</dt><dd>${escapeHtml(r.categoryName)} &middot; Room ${escapeHtml(r.roomNumber)}</dd></div>
      <div><dt>Check-in</dt><dd>${fmtDate(r.checkIn)}, from 3:00 PM</dd></div>
      <div><dt>Check-out</dt><dd>${fmtDate(r.checkOut)}, by 12:00 PM</dd></div>
      <div><dt>Stay</dt><dd>${r.nights} night${r.nights === 1 ? '' : 's'} &middot; ${r.guests} guest${r.guests === 1 ? '' : 's'}</dd></div>
      <div><dt>Total (simulated)</dt><dd>${money(r.totalAmount)}</dd></div>
    </dl>
    <p class="form-alert form-alert--info" style="margin:18px 0 0">A simulated ${kind === 'cancelled' ? 'cancellation' : 'confirmation'} email was sent to <strong>${escapeHtml(r.guest.email)}</strong>. You can view it under "Manage Booking".</p>`;
  $('#confirmDialog').showModal();
}

// ---------- manage booking ----------

async function lookup(reference, email, { quiet = false } = {}) {
  const data = await api('/reservations/lookup', { method: 'POST', body: { reference, email } });
  state.booking = { ...data, email };
  $('#lookupRef').value = data.reservation.reference;
  $('#lookupEmail').value = email;
  renderBooking();
  if (!quiet) $('#bookingResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderBooking() {
  const { reservation: r, notifications } = state.booking;
  const editable = GUEST_EDITABLE.includes(r.status);
  $('#bookingResult').innerHTML = `
    <article class="booking-card">
      <div class="booking-card__head">
        <div><div class="kicker" style="margin-bottom:8px">Booking reference</div><div class="booking-card__ref">${escapeHtml(r.reference)}</div></div>
        <div>${statusPill(r.status)}</div>
      </div>
      <dl class="details">
        <div><dt>Guest</dt><dd>${escapeHtml(r.guest.firstName)} ${escapeHtml(r.guest.lastName)}</dd></div>
        <div><dt>Contact</dt><dd>${escapeHtml(r.guest.email)}<br>${escapeHtml(r.guest.phone)}</dd></div>
        <div><dt>Room category</dt><dd>${escapeHtml(r.categoryName)}</dd></div>
        <div><dt>Room number</dt><dd>${escapeHtml(r.roomNumber)}</dd></div>
        <div><dt>Check-in</dt><dd>${fmtDate(r.checkIn, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
        <div><dt>Check-out</dt><dd>${fmtDate(r.checkOut, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
        <div><dt>Guests &middot; Nights</dt><dd>${r.guests} &middot; ${r.nights}</dd></div>
        <div><dt>Total (simulated)</dt><dd>${money(r.totalAmount)}</dd></div>
        ${r.specialRequests ? `<div class="full"><dt>Special requests</dt><dd>${escapeHtml(r.specialRequests)}</dd></div>` : ''}
      </dl>
      ${editable
        ? `<div class="card-actions">
             <button class="btn btn--black" type="button" id="btnModify">Modify booking</button>
             <button class="btn btn--danger" type="button" id="btnCancel">Cancel booking</button>
           </div>`
        : `<p class="form-alert form-alert--info" style="margin:20px 0 0">This reservation is ${escapeHtml(r.status.toLowerCase())} and can no longer be changed online. Please contact the front desk for help.</p>`}
      <div class="inbox">
        <h4>Messages (simulated email)</h4>
        ${notifications.length ? notifications.map((n) => `
          <div class="inbox__item">
            <header><span>${escapeHtml(n.type)}</span><time>${escapeHtml(n.created_at)}</time></header>
            <strong>${escapeHtml(n.subject)}</strong>
            <p>${escapeHtml(n.message)}</p>
          </div>`).join('') : '<p class="hint">No messages yet.</p>'}
      </div>
    </article>`;
  if (editable) {
    $('#btnModify').addEventListener('click', openModify);
    $('#btnCancel').addEventListener('click', cancelBooking);
  }
}

function initLookup() {
  const form = $('#lookupForm');
  const last = JSON.parse(localStorage.getItem(LAST_BOOKING_KEY) || 'null');
  if (last) { $('#lookupRef').value = last.reference; $('#lookupEmail').value = last.email; }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (!validateRequired(form)) return;
    const { reference, email } = formData(form);
    await withBusy(form.querySelector('[type="submit"]'), async () => {
      try {
        await lookup(reference.trim().toUpperCase(), email.trim());
      } catch (err) {
        showFormError(form, err);
        $('#bookingResult').innerHTML = '<div class="empty-state mg-empty"><b>No reservation to show</b><span>Check the reference and email, then try again.</span></div>';
      }
    });
  });
}

let modifyDatesSync = () => {};

async function refreshModifySummary() {
  const form = $('#modifyForm');
  const { category, checkIn, checkOut } = formData(form);
  const current = state.booking.reservation;
  fillGuestOptions($('#mdGuests'), typeByCode(category).capacity, $('#mdGuests').value || current.guests);
  const t = typeByCode(category);
  const n = nights(checkIn, checkOut);
  const diff = n > 0 ? t.rate * n - current.totalAmount : 0;
  const extra = n > 0
    ? `<div class="price-summary__row"><span>Current total</span><span>${money(current.totalAmount)}</span></div>
       <div class="price-summary__row"><span>Difference</span><span>${diff >= 0 ? '+' : '-'}${money(Math.abs(diff))}</span></div>`
    : '';
  renderPriceSummary($('#mdSummary'), category, checkIn, checkOut, extra);
}

function openModify() {
  const r = state.booking.reservation;
  const form = $('#modifyForm');
  clearErrors(form);
  fillCategoryOptions($('#mdCategory'), state.roomTypes, r.category);
  $('#mdCheckIn').value = r.checkIn;
  $('#mdCheckOut').value = r.checkOut;
  $('#mdRequests').value = r.specialRequests;
  fillGuestOptions($('#mdGuests'), typeByCode(r.category).capacity, r.guests);
  modifyDatesSync();
  refreshModifySummary();
  $('#modifyDialog').showModal();
}

function initModifyForm() {
  const form = $('#modifyForm');
  modifyDatesSync = linkDates($('#mdCheckIn'), $('#mdCheckOut'));
  ['#mdCategory', '#mdCheckIn', '#mdCheckOut', '#mdGuests'].forEach((s) => $(s).addEventListener('change', refreshModifySummary));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (!validateRequired(form)) return;
    const { reservation, email } = state.booking;
    await withBusy(form.querySelector('[type="submit"]'), async () => {
      try {
        const data = await api(`/reservations/${encodeURIComponent(reservation.reference)}`, {
          method: 'PUT',
          body: { ...formData(form), email },
        });
        state.booking = { ...data, email };
        $('#modifyDialog').close();
        renderBooking();
        toast(data.message, { type: 'success', title: 'Reservation updated' });
        showConfirmation('modified', data.reservation);
        loadAvailability();
      } catch (err) {
        showFormError(form, err);
      }
    });
  });
}

async function cancelBooking() {
  const { reservation, email } = state.booking;
  const ok = await confirmDialog({
    title: 'Cancel reservation?',
    message: `Reservation ${reservation.reference} (${reservation.categoryName}, ${fmtDate(reservation.checkIn)} to ${fmtDate(reservation.checkOut)}) will be cancelled and the room released. This cannot be undone online.`,
    confirmLabel: 'Yes, cancel booking',
    danger: true,
  });
  if (!ok) return;
  try {
    const data = await api(`/reservations/${encodeURIComponent(reservation.reference)}/cancel`, { method: 'POST', body: { email } });
    state.booking = { ...data, email };
    renderBooking();
    toast(data.message, { type: 'success', title: 'Cancellation confirmed' });
    showConfirmation('cancelled', data.reservation);
    loadAvailability();
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
}

// ---------- boot ----------

async function init() {
  $('#year').textContent = new Date().getFullYear();
  initSearchLinks();
  initHero();
  renderAmenities();
  renderHomeEvents();
  wireDialogs();
  initSearch();
  initBookingForm();
  initModifyForm();
  initLookup();
  try {
    const config = await api('/config');
    state.roomTypes = config.roomTypes;
  } catch (err) {
    $('#staySummary').textContent = err.message;
    return toast(err.message, { type: 'error' });
  }
  const params = new URLSearchParams(location.search);
  applyStayParams(params);
  state.search = { checkIn: $('#searchCheckIn').value, checkOut: $('#searchCheckOut').value, guests: Number($('#searchGuests').value) };
  await loadAvailability();
  if (params.has('book')) openBookingFromLink(params.get('book').toUpperCase());
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
}

/** Pre-fills the search bar from `?checkIn=&checkOut=&guests=` (e.g. links from the 3D tour). */
function applyStayParams(params) {
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const checkIn = params.get('checkIn');
  const checkOut = params.get('checkOut');
  if (isDate(checkIn) && checkIn >= localToday()) {
    $('#searchCheckIn').value = checkIn;
    $('#searchCheckOut').min = addDays(checkIn, 1);
    $('#searchCheckOut').value = isDate(checkOut) && checkOut > checkIn ? checkOut : addDays(checkIn, 1);
  }
  const guests = params.get('guests');
  if (['1', '2', '3', '4'].includes(guests)) $('#searchGuests').value = guests;
}

function openBookingFromLink(code) {
  const t = state.availability.find((a) => a.code === code);
  if (!t) return toast('That room category does not exist.', { type: 'error' });
  if (t.available === 0) {
    return toast(`The ${t.name} is sold out for these dates. Please try different dates or another category.`, { type: 'error', title: 'Not available' });
  }
  openBooking(code);
}

init();
