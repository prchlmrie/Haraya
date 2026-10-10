// Shared helpers for the guest site and the staff dashboard.

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the reservation server. Make sure it is running.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data.details);
  return data;
}

export function qs(params) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
export const money = (n) => peso.format(n);

export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000);
}

export function fmtDate(date, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}

export function statusPill(status) {
  const cls = status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status status--${cls}">${escapeHtml(status)}</span>`;
}

// ---------- toasts ----------

export function toast(message, { type = 'info', title } = {}) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const heading = title ?? { success: 'Success', error: 'Something went wrong', info: 'Notice' }[type];
  el.innerHTML = `<div class="toast__body"><div class="toast__title">${escapeHtml(heading)}</div>${escapeHtml(message)}</div>
    <button type="button" aria-label="Dismiss">&times;</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  host.append(el);
  setTimeout(() => el.remove(), type === 'error' ? 8000 : 5000);
}

// ---------- form helpers ----------

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function clearErrors(form) {
  form.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
  const alert = form.querySelector('.form-alert');
  if (alert) alert.remove();
}

/** Shows an API error on a form: a summary banner plus per-field messages. */
export function showFormError(form, err) {
  clearErrors(form);
  const alert = document.createElement('div');
  alert.className = 'form-alert form-alert--error';
  alert.setAttribute('role', 'alert');
  alert.textContent = err.message;
  (form.querySelector('[data-alert-slot]') ?? form).prepend(alert);
  if (err.details) {
    for (const [name, msg] of Object.entries(err.details)) {
      const input = form.querySelector(`[name="${name}"]`);
      const field = input?.closest('.field');
      if (!field) continue;
      field.classList.add('has-error');
      let slot = field.querySelector('.field-error');
      if (!slot) {
        slot = document.createElement('span');
        slot.className = 'field-error';
        field.append(slot);
      }
      slot.textContent = msg;
    }
  }
  alert.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Client-side check for required fields and date order before hitting the API. */
export function validateRequired(form) {
  const details = {};
  form.querySelectorAll('[required]:not(:disabled)').forEach((input) => {
    if (!String(input.value).trim()) details[input.name] = 'This field is required.';
    else if (input.type === 'email' && !input.checkValidity()) details[input.name] = 'Enter a valid email address.';
  });
  const ci = form.querySelector('[name="checkIn"]')?.value;
  const co = form.querySelector('[name="checkOut"]')?.value;
  if (ci && co && co <= ci) details.checkOut = 'Check-out date must be after the check-in date.';
  if (Object.keys(details).length) {
    showFormError(form, new ApiError('Please complete the highlighted fields.', 400, details));
    return false;
  }
  return true;
}

export async function withBusy(button, fn) {
  const label = button?.innerHTML;
  if (button) { button.disabled = true; button.innerHTML = 'Please wait…'; }
  try { return await fn(); }
  finally { if (button) { button.disabled = false; button.innerHTML = label; } }
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal modal--sm';
    dlg.innerHTML = `
      <div class="modal__head"><h2>${escapeHtml(title)}</h2></div>
      <div class="modal__body"><p style="margin:0">${escapeHtml(message)}</p></div>
      <div class="modal__foot">
        <button type="button" class="btn btn--sm" data-act="no">Go back</button>
        <button type="button" class="btn btn--sm ${danger ? 'btn--danger' : 'btn--black'}" data-act="yes">${escapeHtml(confirmLabel)}</button>
      </div>`;
    document.body.append(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    dlg.querySelector('[data-act="no"]').addEventListener('click', () => done(false));
    dlg.querySelector('[data-act="yes"]').addEventListener('click', () => done(true));
    dlg.showModal();
  });
}
