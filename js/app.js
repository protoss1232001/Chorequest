/* ==========================================================================
   ChoreQuest — app shell: routing, the profile switcher, the PIN flow.
   ========================================================================== */

import * as store from './store.js';
import { $, esc, pts, plural, toast, buzz } from './util.js';
import { renderKidScreen, handleKidAction } from './kid.js';
import { renderParentScreen, renderPinScreen, handleParentAction } from './parent.js';

const root = $('#app');

const route = {
  screen: 'switcher',   // switcher | kid | pin | parent
  kidId: null,
  kidTab: 'today',
  parentTab: 'home',
  manageSub: 'chores',
};

const pin = { buffer: '', mode: 'enter', error: '', first: '', afterUnlock: 'parent' };

/* --------------------------------------------------------------------------
   Profile switcher — the front door. Kids tap their face, parents tap Parent.
   -------------------------------------------------------------------------- */

function renderSwitcher() {
  const kids = store.kids();
  const pending = store.pendingCompletions().length + store.pendingRedemptions().length;

  if (!kids.length) {
    return `
      <div class="screen screen--switcher">
        <div class="welcome">
          <span class="welcome__mark">⭐</span>
          <h1>ChoreQuest</h1>
          <p class="welcome__tag">Chores in, points up, rewards out.</p>
          <ul class="welcome__points">
            <li><span>👨‍👩‍👧</span><div><strong>Set up each child</strong><em>Their own profile, colour and chore list.</em></div></li>
            <li><span>⭐</span><div><strong>Points that keep adding up</strong><em>Week, month and year totals — no weekly reset.</em></div></li>
            <li><span>🎁</span><div><strong>They pick the reward</strong><em>From a store you stock and approve.</em></div></li>
          </ul>
          <button class="btn btn--primary btn--block" data-action="parent-mode">Get started</button>
          <p class="fine-print">Everything stays on this device. No account, no sign-up.</p>
        </div>
      </div>`;
  }

  return `
    <div class="screen screen--switcher">
      <div class="switcher">
        <header class="switcher__head">
          <span class="switcher__mark">⭐</span>
          <h1>Who's here?</h1>
          <p>Tap your name to see today's chores.</p>
        </header>
        <ul class="profile-grid">
          ${kids.map((kid) => {
            const bal = store.balance(kid.id);
            const progress = store.todayProgress(kid.id);
            const left = progress.total - progress.done;
            return `
              <li>
                <button class="profile" data-action="open-kid" data-id="${kid.id}"
                  style="--kid-accent:${store.kidColorHex(kid)}">
                  <span class="avatar avatar--lg">${esc(kid.avatar)}</span>
                  <strong>${esc(kid.name)}</strong>
                  <em>${pts(bal)} points</em>
                  ${left > 0 ? `<span class="profile__todo">${plural(left, 'chore', 'chores')} left</span>`
                    : progress.total ? '<span class="profile__todo profile__todo--done">All done ✓</span>' : ''}
                </button>
              </li>`;
          }).join('')}
        </ul>
        <button class="parent-entry" data-action="parent-mode">
          <span>🔒</span>
          <span class="parent-entry__body">
            <strong>Parent mode</strong>
            <em>Approve chores, set rewards</em>
          </span>
          ${pending ? `<span class="badge">${pending}</span>` : '<span class="parent-entry__chev">›</span>'}
        </button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

let lastRouteKey = '';

function render() {
  // A kid profile can disappear while its screen is open (parent deleted it).
  if (route.screen === 'kid' && !store.getKid(route.kidId)) {
    route.screen = 'switcher';
    route.kidId = null;
  }

  let html;
  if (route.screen === 'kid') html = renderKidScreen(route.kidId, route.kidTab);
  else if (route.screen === 'pin') html = renderPinScreen(pin.buffer, pin.mode, pin.error);
  else if (route.screen === 'parent') html = renderParentScreen(route.parentTab, route.manageSub);
  else html = renderSwitcher();

  // Only treat this as a navigation when the destination actually changed —
  // a re-render caused by ticking off a chore should not replay the entry
  // animation or throw the list back to the top.
  const key = [route.screen, route.kidId, route.kidTab, route.parentTab, route.manageSub].join('|');
  const navigated = key !== lastRouteKey;
  lastRouteKey = key;

  root.innerHTML = html;
  document.documentElement.dataset.screen = route.screen;

  if (navigated) {
    window.scrollTo(0, 0);
    root.querySelector('.scroll-body')?.classList.add('is-entering');
  }
}

const goHome = () => { route.screen = 'switcher'; route.kidId = null; render(); };

/* --------------------------------------------------------------------------
   PIN flow
   -------------------------------------------------------------------------- */

function startParentMode() {
  pin.buffer = '';
  pin.error = '';
  pin.first = '';
  pin.mode = store.hasPin() ? 'enter' : 'create';
  route.screen = 'pin';
  render();
}

function pinDigit(digit) {
  if (pin.buffer.length >= 4) return;
  pin.buffer += digit;
  pin.error = '';
  buzz(6);

  if (pin.buffer.length < 4) { render(); return; }

  const entered = pin.buffer;

  if (pin.mode === 'enter') {
    if (store.checkPin(entered)) {
      pin.buffer = '';
      route.screen = 'parent';
      route.parentTab = 'home';
    } else {
      pin.buffer = '';
      pin.error = 'That PIN did not match. Try again.';
      buzz([40, 60, 40]);
    }
  } else if (pin.mode === 'create') {
    pin.first = entered;
    pin.buffer = '';
    pin.mode = 'confirm';
  } else if (pin.mode === 'confirm') {
    if (entered === pin.first) {
      store.setSettings({ pin: entered });
      pin.buffer = '';
      route.screen = 'parent';
      route.parentTab = 'home';
      toast('PIN saved', 'success');
    } else {
      pin.buffer = '';
      pin.first = '';
      pin.mode = 'create';
      pin.error = 'Those did not match. Start again.';
      buzz([40, 60, 40]);
    }
  }
  render();
}

/* --------------------------------------------------------------------------
   Events — one delegated listener for the whole app.
   -------------------------------------------------------------------------- */

let busy = false;

async function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el || busy) return;
  const action = el.dataset.action;

  // Navigation is handled here; the kid and parent modules own their own verbs.
  switch (action) {
    case 'switch-profile': goHome(); return;
    case 'parent-mode': startParentMode(); return;
    case 'open-kid':
      route.screen = 'kid';
      route.kidId = el.dataset.id;
      route.kidTab = 'today';
      render();
      return;
    case 'kid-tab': route.kidTab = el.dataset.tab; render(); return;
    case 'parent-tab': route.parentTab = el.dataset.tab; render(); return;
    case 'manage-sub': route.manageSub = el.dataset.sub; render(); return;
    case 'pin-key': pinDigit(el.dataset.key); return;
    case 'pin-del': pin.buffer = pin.buffer.slice(0, -1); pin.error = ''; render(); return;
    case 'change-pin':
      pin.buffer = ''; pin.first = ''; pin.error = ''; pin.mode = 'create';
      route.screen = 'pin';
      render();
      return;
    case 'dismiss-install':
      localStorage.setItem('chorequest.installHintSeen', '1');
      $('#install-hint')?.remove();
      return;
    default: break;
  }

  // Sheets are async; block a second tap while one is open.
  busy = true;
  try {
    const ctx = { kidId: route.kidId, goHome };
    const handled = (await handleKidAction(action, el, ctx)) || (await handleParentAction(action, el, ctx));
    if (!handled) console.warn('ChoreQuest: unhandled action', action);
  } finally {
    busy = false;
  }
}

/* --------------------------------------------------------------------------
   "Add to Home Screen" nudge — iOS Safari gives no install prompt of its own.
   -------------------------------------------------------------------------- */

function maybeShowInstallHint() {
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (standalone || !isIOS || localStorage.getItem('chorequest.installHintSeen')) return;

  const hint = document.createElement('div');
  hint.id = 'install-hint';
  hint.className = 'install-hint';
  hint.innerHTML = `
    <span>📲</span>
    <p>Add ChoreQuest to your Home Screen: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
    <button data-action="dismiss-install" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(hint);
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

store.load();
store.subscribe(render);
document.addEventListener('click', onClick);

// Keep the number pad usable from a hardware keyboard too.
document.addEventListener('keydown', (e) => {
  if (route.screen !== 'pin') return;
  if (/^[0-9]$/.test(e.key)) pinDigit(e.key);
  else if (e.key === 'Backspace') { pin.buffer = pin.buffer.slice(0, -1); pin.error = ''; render(); }
});

render();
maybeShowInstallHint();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is a bonus, not a requirement */ });
  });
}
