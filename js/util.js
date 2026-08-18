/* ==========================================================================
   ChoreQuest — shared helpers (DOM, dates, formatting, overlays)
   ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* --------------------------------------------------------------------------
   Dates. Everything is stored as a local-time 'YYYY-MM-DD' day string so a
   chore done at 11pm belongs to that day, not to tomorrow in UTC.
   -------------------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** weekStart: 0 = Sunday, 1 = Monday */
export function startOfWeek(date, weekStart = 0) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(date) {
  return new Date(new Date(date).getFullYear(), 0, 1);
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function friendlyDate(iso) {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === toISO(addDays(new Date(), -1))) return 'Yesterday';
  const d = fromISO(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const pts = (n) => `${n.toLocaleString()}`;

/* --------------------------------------------------------------------------
   Feedback: haptics (where supported), toasts, confetti
   -------------------------------------------------------------------------- */

export function buzz(pattern = 12) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } }
}

let toastTimer;
export function toast(message, tone = 'default') {
  const host = $('#toast-host');
  if (!host) return;
  host.innerHTML = `<div class="toast toast--${tone}" role="status">${esc(message)}</div>`;
  host.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove('is-visible'), 2600);
}

export function celebrate(intensity = 28) {
  const host = $('#confetti-host');
  if (!host) return;
  const colors = ['#ff9f0a', '#ff375f', '#5e5ce6', '#30d158', '#64d2ff', '#ffd60a'];
  const bits = Array.from({ length: intensity }, () => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.35;
    const dur = 1.1 + Math.random() * 0.9;
    const rot = Math.random() * 720 - 360;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 6 + Math.random() * 8;
    return `<i style="left:${left}%;background:${color};width:${size}px;height:${size * 0.6}px;
      animation-delay:${delay}s;animation-duration:${dur}s;--rot:${rot}deg"></i>`;
  }).join('');
  host.innerHTML = bits;
  setTimeout(() => { host.innerHTML = ''; }, 2400);
}

/* --------------------------------------------------------------------------
   Sheets & dialogs. openSheet resolves with the chosen action id (or null).
   -------------------------------------------------------------------------- */

let sheetTeardown = null;   // pending innerHTML clear from the previous sheet
let sheetDetach = null;     // click listener of the currently open sheet

export function openSheet({ title, subtitle = '', body = '', actions = [], onMount }) {
  return new Promise((resolve) => {
    const host = $('#sheet-host');

    // A previous sheet may still be animating out. Cancel its teardown and drop
    // its listener, or it would wipe this sheet's markup mid-flight.
    if (sheetTeardown) { clearTimeout(sheetTeardown); sheetTeardown = null; }
    if (sheetDetach) { sheetDetach(); sheetDetach = null; }

    const buttons = actions.map((a) => `
      <button type="button" class="btn btn--${a.tone || 'plain'}" data-sheet-action="${esc(a.id)}">
        ${esc(a.label)}
      </button>`).join('');

    host.innerHTML = `
      <div class="scrim" data-sheet-action=""></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet__grabber"></div>
        <header class="sheet__head">
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </header>
        <div class="sheet__body">${body}</div>
        ${buttons ? `<footer class="sheet__foot">${buttons}</footer>` : ''}
      </div>`;
    host.classList.add('is-open');
    document.body.classList.add('is-locked');

    let settled = false;

    const onClick = (e) => {
      const trigger = e.target.closest('[data-sheet-action]');
      if (!trigger) return;
      const id = trigger.dataset.sheetAction;
      close(id === '' ? null : id);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };

    const detach = () => {
      host.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };

    function close(value) {
      if (settled) return;
      settled = true;
      detach();
      if (sheetDetach === detach) sheetDetach = null;
      host.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      // Leave the markup in place for the exit animation — and so the caller
      // can still read form values out of it on the next microtask.
      sheetTeardown = setTimeout(() => { host.innerHTML = ''; sheetTeardown = null; }, 260);
      resolve(value);
    }

    host.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    sheetDetach = detach;

    const sheet = $('.sheet', host);
    if (onMount) onMount(sheet, close);
    const focusable = $('input:not([type="radio"]):not([type="checkbox"]), textarea', sheet);
    if (focusable) setTimeout(() => focusable.focus(), 300);
  });
}

export async function confirmSheet({ title, subtitle, confirmLabel = 'Confirm', tone = 'primary' }) {
  const answer = await openSheet({
    title,
    subtitle,
    actions: [
      { id: 'confirm', label: confirmLabel, tone },
      { id: 'cancel', label: 'Cancel', tone: 'plain' },
    ],
  });
  return answer === 'confirm';
}
