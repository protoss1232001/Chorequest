/* ==========================================================================
   ChoreQuest — the parent's side: approvals and everything that gets set up.
   ========================================================================== */

import * as store from './store.js';
import { ICONS } from './icons.js';
import {
  $, $$, esc, pts, plural, friendlyDate, todayISO, DAY_INITIALS,
  toast, buzz, openSheet, confirmSheet,
} from './util.js';

/* --------------------------------------------------------------------------
   Form building blocks used inside sheets
   -------------------------------------------------------------------------- */

const field = (label, control, hint = '') => `
  <label class="field">
    <span class="field__label">${esc(label)}</span>
    ${control}
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}
  </label>`;

const emojiPicker = (name, options, selected) => `
  <div class="field">
    <span class="field__label">Icon</span>
    <div class="emoji-picker">
      ${options.map((e) => `
        <label class="emoji-picker__opt">
          <input type="radio" name="${name}" value="${esc(e)}" ${e === selected ? 'checked' : ''}>
          <span>${e}</span>
        </label>`).join('')}
    </div>
  </div>`;

const diffDot = (level) => `<i class="diff-dot diff-dot--${level}" aria-hidden="true"></i>`;

/* Difficulty sets the suggested point value and, more importantly, how much a
   full-week streak on this chore is worth. */
const difficultyPicker = (chore) => {
  const current = chore.difficulty || 'medium';
  const active = store.DIFFICULTY.find((d) => d.id === current) || store.DIFFICULTY[1];
  return `
    <div class="field" data-difficulty>
      <span class="field__label">Difficulty</span>
      <div class="chip-picker">
        ${store.DIFFICULTY.map((d) => `
          <label class="chip-picker__opt">
            <input type="radio" name="difficulty" value="${d.id}" data-suggest="${d.points}"
              ${d.id === current ? 'checked' : ''}>
            <span>${diffDot(d.id)}${esc(d.label)}</span>
          </label>`).join('')}
      </div>
      <span class="field__hint" data-diff-hint>${esc(active.hint)}
        Full-week streak bonus: <strong>+${store.settings().streakBonus[active.id]}%</strong>.</span>
    </div>`;
};

const dayPicker = (selected = []) => `
  <div class="field" data-days>
    <span class="field__label">Which days</span>
    <div class="day-picker">
      ${DAY_INITIALS.map((initial, i) => `
        <label class="day-picker__opt">
          <input type="checkbox" name="day" value="${i}" ${selected.includes(i) ? 'checked' : ''}>
          <span>${initial}</span>
        </label>`).join('')}
    </div>
    <span class="field__hint">Tip: pick Mon–Fri for school-day chores.</span>
  </div>`;

const kidPicker = (assignment) => {
  const list = store.kids();
  if (!list.length) return '';
  const all = assignment === 'all';
  return `
    <div class="field" data-assignment>
      <span class="field__label">Who does it</span>
      <div class="chip-picker">
        <label class="chip-picker__opt">
          <input type="radio" name="assignMode" value="all" ${all ? 'checked' : ''}>
          <span>Everyone</span>
        </label>
        <label class="chip-picker__opt">
          <input type="radio" name="assignMode" value="some" ${all ? '' : 'checked'}>
          <span>Just some kids</span>
        </label>
      </div>
      <div class="chip-picker chip-picker--kids" ${all ? 'hidden' : ''} data-kid-list>
        ${list.map((k) => `
          <label class="chip-picker__opt">
            <input type="checkbox" name="assignKid" value="${k.id}"
              ${!all && assignment.includes(k.id) ? 'checked' : ''}>
            <span>${esc(k.avatar)} ${esc(k.name)}</span>
          </label>`).join('')}
      </div>
    </div>`;
};

const readRadio = (root, name) => $(`input[name="${name}"]:checked`, root)?.value ?? '';
const readChecks = (root, name) => $$(`input[name="${name}"]:checked`, root).map((i) => i.value);

function readAssignment(root) {
  if (!$('[data-assignment]', root)) return 'all';
  if (readRadio(root, 'assignMode') === 'all') return 'all';
  const picked = readChecks(root, 'assignKid');
  return picked.length ? picked : 'all';
}

/* --------------------------------------------------------------------------
   PIN screen — a soft lock. It keeps a curious kid out of the settings, and
   is deliberately not presented as real security.
   -------------------------------------------------------------------------- */

export function renderPinScreen({ buffer, mode, error, target }, kid = null) {
  const forKid = Boolean(target) && Boolean(kid);
  const creating = mode === 'create' || mode === 'confirm';

  const titles = {
    create: 'Choose a parent PIN',
    confirm: 'Enter it once more',
    enter: forKid ? `${kid.name}'s profile` : 'Parent mode',
  };
  const subtitles = {
    create: 'Four digits. Kids will need this to change chores or rewards.',
    confirm: 'Just to be sure you can remember it.',
    enter: forKid
      ? 'Type your PIN to see your chores.'
      : 'Enter your PIN to manage chores, kids and rewards.',
  };

  const dots = Array.from({ length: 4 }, (_, i) =>
    `<span class="pin-dot ${i < buffer.length ? 'is-filled' : ''}"></span>`).join('');

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  return `
    <div class="screen screen--pin" ${forKid ? `style="--accent:${store.kidColorHex(kid)}"` : ''}>
      <header class="pin-head">
        <button class="link-btn" data-action="switch-profile">Cancel</button>
      </header>
      <div class="pin-body">
        ${forKid
          ? `<span class="avatar avatar--lg pin-avatar">${esc(kid.avatar)}</span>`
          : `<span class="pin-lock">${creating ? '🔐' : '🔒'}</span>`}
        <h1>${esc(titles[mode])}</h1>
        <p>${esc(subtitles[mode])}</p>
        <div class="pin-dots ${error ? 'is-error' : ''}">${dots}</div>
        ${error ? `<p class="pin-error">${esc(error)}</p>` : ''}
      </div>
      <div class="keypad">
        ${keys.map((k) => {
          if (k === null) return '<span></span>';
          if (k === 'del') return `<button class="keypad__key keypad__key--fn" data-action="pin-del" aria-label="Delete">⌫</button>`;
          return `<button class="keypad__key" data-action="pin-key" data-key="${k}">${k}</button>`;
        }).join('')}
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Tab 1 — Home
   -------------------------------------------------------------------------- */

/* Every parent tab needs its own way back to the profile switcher. */
const parentHead = (title, extra = '') => `
    <header class="parent-head">
      <div>
        <p class="parent-head__eyebrow">Parent mode</p>
        <h1>${esc(title)}</h1>
      </div>
      <div class="parent-head__actions">
        ${extra}
        <button class="link-btn" data-action="switch-profile">Exit</button>
      </div>
    </header>`;

function kidSummaryCard(kid) {
  const acc = store.accumulation(kid.id);
  const bal = store.balance(kid.id);
  const pending = store.pendingCompletions(kid.id).length;
  const progress = store.todayProgress(kid.id);

  return `
    <li>
      <button class="kid-card" data-action="open-kid" data-id="${kid.id}"
        style="--kid-accent:${store.kidColorHex(kid)}">
        <span class="avatar">${esc(kid.avatar)}</span>
        <span class="kid-card__body">
          <strong>${esc(kid.name)}</strong>
          <em>${progress.done}/${progress.total} chores today · ${pts(acc.week)} pts this week</em>
        </span>
        <span class="kid-card__right">
          <span class="kid-card__balance">${pts(bal)}</span>
          ${pending ? `<span class="badge">${pending} to review</span>` : ''}
        </span>
      </button>
    </li>`;
}

function renderParentHome() {
  const list = store.kids();
  const pendingChores = store.pendingCompletions().length;
  const pendingRewards = store.pendingRedemptions().length;
  const totalPending = pendingChores + pendingRewards;

  return `
    ${parentHead('Family')}
    <div class="scroll-body">
      ${totalPending ? `
        <button class="card card--alert" data-action="parent-tab" data-tab="approve">
          <span class="card--alert__icon">🔔</span>
          <span>
            <strong>${plural(totalPending, 'thing', 'things')} to review</strong>
            <em>${pendingChores ? `${plural(pendingChores, 'chore', 'chores')}` : ''}${pendingChores && pendingRewards ? ' · ' : ''}${pendingRewards ? `${plural(pendingRewards, 'reward request', 'reward requests')}` : ''}</em>
          </span>
          <span class="card--alert__chev">›</span>
        </button>` : `
        <div class="card card--calm">
          <span>✅</span>
          <div><strong>All caught up</strong><em>Nothing waiting for your approval.</em></div>
        </div>`}

      <h3 class="section-title">Kids</h3>
      ${list.length ? `<ul class="kid-list">${list.map(kidSummaryCard).join('')}</ul>` : `
        <div class="empty">
          <span class="empty__art">👋</span>
          <h3>Add your first child</h3>
          <p>Create a profile so they can start earning points.</p>
        </div>`}
      <button class="btn btn--primary btn--block" data-action="add-kid">Add a child</button>

      <h3 class="section-title">Quick setup</h3>
      <div class="quick-grid">
        <button class="quick" data-action="add-chore"><span>🧹</span><strong>New chore</strong></button>
        <button class="quick" data-action="add-reward"><span>🎁</span><strong>New reward</strong></button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Tab 2 — Approvals
   -------------------------------------------------------------------------- */

function renderApprovals() {
  const chorePending = store.pendingCompletions();
  const rewardPending = store.pendingRedemptions();

  const choreItems = chorePending.map((c) => {
    const kid = store.getKid(c.kidId);
    return `
      <li class="review">
        <span class="review__emoji">${esc(c.emoji)}</span>
        <span class="review__body">
          <strong>${esc(c.title)}</strong>
          <em>${esc(kid?.avatar || '')} ${esc(kid?.name || 'Unknown')} · ${friendlyDate(c.date)} · +${pts(c.points)} pts</em>
        </span>
        <span class="review__actions">
          <button class="icon-btn icon-btn--no" data-action="review-chore" data-id="${c.id}" data-ok="0" aria-label="Decline">✕</button>
          <button class="icon-btn icon-btn--yes" data-action="review-chore" data-id="${c.id}" data-ok="1" aria-label="Approve">✓</button>
        </span>
      </li>`;
  }).join('');

  const rewardItems = rewardPending.map((r) => {
    const kid = store.getKid(r.kidId);
    const detail = r.kind === 'giftcard'
      ? `${r.brand || 'Gift card'}${r.value ? ` · ${r.value}` : ''}`
      : 'Treat';
    return `
      <li class="review review--reward">
        <span class="review__emoji">${esc(r.emoji)}</span>
        <span class="review__body">
          <strong>${esc(r.title)}</strong>
          <em>${esc(kid?.avatar || '')} ${esc(kid?.name || 'Unknown')} · ${esc(detail)} · ${pts(r.cost)} pts spent</em>
        </span>
        <span class="review__actions">
          <button class="icon-btn icon-btn--no" data-action="review-redemption" data-id="${r.id}" data-ok="0" aria-label="Decline and refund">✕</button>
          <button class="icon-btn icon-btn--yes" data-action="review-redemption" data-id="${r.id}" data-ok="1" aria-label="Mark as given">✓</button>
        </span>
      </li>`;
  }).join('');

  return `
    ${parentHead('Review', chorePending.length > 1 ? '<button class="link-btn" data-action="approve-all">Approve all</button>' : '')}
    <div class="scroll-body">
      ${!chorePending.length && !rewardPending.length ? `
        <div class="empty">
          <span class="empty__art">🎉</span>
          <h3>Nothing to review</h3>
          <p>Chores your kids finish will land here for approval.</p>
        </div>` : ''}

      ${rewardPending.length ? `
        <h3 class="section-title">Reward requests</h3>
        <p class="section-note">Approving marks the reward as given. Declining refunds the points.</p>
        <ul class="review-list">${rewardItems}</ul>` : ''}

      ${chorePending.length ? `
        <h3 class="section-title">Completed chores</h3>
        <ul class="review-list">${choreItems}</ul>` : ''}
    </div>`;
}

/* --------------------------------------------------------------------------
   Tab 3 — Manage (kids / chores / rewards)
   -------------------------------------------------------------------------- */

function renderManage(sub = 'chores') {
  const segments = [
    { id: 'chores', label: 'Chores' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'kids', label: 'Kids' },
  ];

  let body = '';

  if (sub === 'chores') {
    const list = store.chores().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    body = list.length ? `
      <ul class="manage-list">
        ${list.map((c) => {
          const who = c.assignment === 'all'
            ? 'Everyone'
            : c.assignment.map((id) => store.getKid(id)?.name).filter(Boolean).join(', ') || 'Nobody';
          return `
            <li>
              <button class="manage-row" data-action="edit-chore" data-id="${c.id}">
                <span class="manage-row__emoji">${esc(c.emoji)}</span>
                <span class="manage-row__body">
                  <strong>${esc(c.title)}</strong>
                  <em>${diffDot(c.difficulty || 'medium')}${esc(store.difficultyOf(c).label)} · ${esc(store.repeatLabel(c))} · ${esc(who)}</em>
                </span>
                <span class="manage-row__points">+${pts(c.points)}</span>
              </button>
            </li>`;
        }).join('')}
      </ul>` : `<div class="empty"><span class="empty__art">🧹</span><h3>No chores yet</h3><p>Add the first one below.</p></div>`;
    body += '<button class="btn btn--primary btn--block" data-action="add-chore">Add a chore</button>';
  }

  if (sub === 'rewards') {
    const list = store.rewards();
    body = list.length ? `
      <ul class="manage-list">
        ${list.map((r) => `
          <li>
            <button class="manage-row" data-action="edit-reward" data-id="${r.id}">
              <span class="manage-row__emoji">${esc(r.emoji)}</span>
              <span class="manage-row__body">
                <strong>${esc(r.title)}</strong>
                <em>${r.kind === 'giftcard' ? `${esc(r.brand || 'Gift card')}${r.value ? ` · ${esc(r.value)}` : ''}` : 'Treat'}</em>
              </span>
              <span class="manage-row__points">${pts(r.cost)} pts</span>
            </button>
          </li>`).join('')}
      </ul>` : `<div class="empty"><span class="empty__art">🎁</span><h3>No rewards yet</h3><p>Give your kids something to save for.</p></div>`;
    body += `
      <button class="btn btn--primary btn--block" data-action="add-reward">Add a reward</button>
      <p class="fine-print">ChoreQuest never buys or delivers gift cards. When a child redeems one,
        you get a request here and buy the card yourself.</p>`;
  }

  if (sub === 'kids') {
    const list = store.kids();
    body = list.length ? `
      <ul class="manage-list">
        ${list.map((k) => `
          <li>
            <button class="manage-row" data-action="edit-kid" data-id="${k.id}">
              <span class="manage-row__emoji">${esc(k.avatar)}</span>
              <span class="manage-row__body">
                <strong>${esc(k.name)}</strong>
                <em>${pts(store.balance(k.id))} points · ${pts(store.lifetimePoints(k.id))} earned all time${k.pin ? ' · 🔒 Locked' : ''}</em>
              </span>
              <span class="manage-row__chev">›</span>
            </button>
          </li>`).join('')}
      </ul>` : `<div class="empty"><span class="empty__art">👋</span><h3>No kids yet</h3><p>Add a profile to get started.</p></div>`;
    body += '<button class="btn btn--primary btn--block" data-action="add-kid">Add a child</button>';
  }

  return `
    ${parentHead('Manage')}
    <div class="scroll-body">
      <div class="segmented" role="tablist">
        ${segments.map((s) => `
          <button role="tab" class="${s.id === sub ? 'is-active' : ''}"
            data-action="manage-sub" data-sub="${s.id}" aria-selected="${s.id === sub}">${s.label}</button>`).join('')}
      </div>
      ${body}
    </div>`;
}

/* --------------------------------------------------------------------------
   Streak bonus sliders
   -------------------------------------------------------------------------- */

const SLIDER_MAX = 200;

/** A worked example so the percentage means something concrete. */
export function bonusExample(level, pct) {
  const week = level.points * 7;
  const bonus = Math.round((week * pct) / 100);
  const article = /^[aeiou]/i.test(level.label) ? 'An' : 'A';
  return `${article} ${level.label.toLowerCase()} chore worth ${level.points} pts, done every day for a week: `
    + `${week} pts + ${bonus} bonus = ${week + bonus}.`;
}

const bonusSlider = (level) => {
  const pct = store.settings().streakBonus[level.id] ?? level.bonus;
  return `
    <div class="slider-row" style="--fill:${(pct / SLIDER_MAX) * 100}%">
      <div class="slider-row__head">
        <span class="slider-row__name">${diffDot(level.id)}${esc(level.label)}</span>
        <output class="slider-row__value" data-bonus-out="${level.id}">+${pct}%</output>
      </div>
      <input type="range" min="0" max="${SLIDER_MAX}" step="5" value="${pct}"
        data-bonus="${level.id}" aria-label="${esc(level.label)} chore streak bonus">
      <p class="slider-row__example" data-bonus-eg="${level.id}">${esc(bonusExample(level, pct))}</p>
    </div>`;
};

/** Live feedback while the thumb is moving — deliberately does not save yet. */
export function dragBonus(input) {
  const level = store.DIFFICULTY.find((d) => d.id === input.dataset.bonus);
  const row = input.closest('.slider-row');
  if (!level || !row) return;
  const pct = Number(input.value);
  row.style.setProperty('--fill', `${(pct / Number(input.max)) * 100}%`);
  const out = $('[data-bonus-out]', row);
  const eg = $('[data-bonus-eg]', row);
  if (out) out.textContent = `+${pct}%`;
  if (eg) eg.textContent = bonusExample(level, pct);
}

/** Saved on release, so a re-render never yanks the thumb mid-drag. */
export function commitBonus(input) {
  store.setStreakBonus(input.dataset.bonus, Number(input.value));
}

/* --------------------------------------------------------------------------
   Tab 4 — Settings
   -------------------------------------------------------------------------- */

function renderSettings() {
  const s = store.settings();
  return `
    ${parentHead('Settings')}
    <div class="scroll-body">
      <h3 class="section-title">Family</h3>
      <ul class="settings-list">
        <li><button class="settings-row" data-action="change-pin">
          <span>Parent PIN</span><em>${store.hasPin() ? 'Set' : 'Not set'} ›</em></button></li>
        <li><button class="settings-row" data-action="week-start">
          <span>Week starts on</span><em>${s.weekStart === 1 ? 'Monday' : 'Sunday'} ›</em></button></li>
      </ul>

      <h3 class="section-title">Streak bonuses</h3>
      <p class="section-note">When a child does a chore on <strong>every day it is due</strong> in one week,
        they earn a bonus on top of that chore's points. Harder chores are harder to keep up, so they are
        worth more. Chores due fewer than ${store.MIN_STREAK_DAYS} days a week can't earn a streak.</p>
      <div class="card card--sliders">
        ${store.DIFFICULTY.map(bonusSlider).join('')}
      </div>
      <p class="fine-print">Drag to change. Set a level to 0% to switch its bonus off. Changes apply to
        past weeks too, since bonuses are always recalculated from what actually happened.</p>

      <h3 class="section-title">Your data</h3>
      <p class="section-note">Everything is stored on this device only — no account, no server, nothing sent anywhere.</p>
      <ul class="settings-list">
        <li><button class="settings-row" data-action="export-data"><span>Download a backup</span><em>›</em></button></li>
        <li><button class="settings-row" data-action="import-data"><span>Restore from a backup</span><em>›</em></button></li>
        <li><button class="settings-row settings-row--danger" data-action="reset-all"><span>Erase everything</span><em>›</em></button></li>
      </ul>

      <h3 class="section-title">About</h3>
      <p class="fine-print">
        ChoreQuest keeps a chore list, awards points, and lets kids choose rewards you have stocked.
        Points accumulate across the week, month and year so children can save toward something bigger.
        The app does not sell, buy or deliver gift cards — you fulfil each request yourself.
      </p>
    </div>`;
}

/* --------------------------------------------------------------------------
   Assembly
   -------------------------------------------------------------------------- */

const PARENT_TABS = [
  { id: 'home', label: 'Family', icon: 'family' },
  { id: 'approve', label: 'Review', icon: 'review' },
  { id: 'manage', label: 'Manage', icon: 'manage' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function renderParentScreen(tab = 'home', sub = 'chores') {
  const screen = {
    home: renderParentHome,
    approve: renderApprovals,
    manage: () => renderManage(sub),
    settings: renderSettings,
  }[tab] || renderParentHome;

  const pending = store.pendingCompletions().length + store.pendingRedemptions().length;

  return `
    <div class="screen screen--parent">
      ${screen()}
      <nav class="tabbar" aria-label="Parent sections">
        ${PARENT_TABS.map((t) => `
          <button class="tabbar__item ${t.id === tab ? 'is-active' : ''}"
            data-action="parent-tab" data-tab="${t.id}" aria-current="${t.id === tab ? 'page' : 'false'}">
            <span class="tabbar__icon">${ICONS[t.icon]}${t.id === 'approve' && pending ? `<i class="dot">${pending}</i>` : ''}</span>
            <span class="tabbar__label">${t.label}</span>
          </button>`).join('')}
      </nav>
    </div>`;
}

/* --------------------------------------------------------------------------
   Editors
   -------------------------------------------------------------------------- */

async function kidEditor(existing) {
  const isNew = !existing;
  const kid = existing || { name: '', avatar: store.AVATARS[store.kids().length % store.AVATARS.length], color: store.KID_COLORS[store.kids().length % store.KID_COLORS.length].id };

  let sheet;
  const answer = await openSheet({
    title: isNew ? 'Add a child' : `Edit ${kid.name}`,
    body: `
      ${field('Name', `<input type="text" name="name" value="${esc(kid.name)}" placeholder="e.g. Maya" maxlength="24" autocomplete="off">`)}
      ${emojiPicker('avatar', store.AVATARS, kid.avatar)}
      <div class="field">
        <span class="field__label">Colour</span>
        <div class="colour-picker">
          ${store.KID_COLORS.map((c) => `
            <label class="colour-picker__opt" style="--swatch:${c.hex}">
              <input type="radio" name="colour" value="${c.id}" ${c.id === kid.color ? 'checked' : ''}>
              <span aria-label="${c.label}"></span>
            </label>`).join('')}
        </div>
      </div>
      ${field('Profile lock (optional)',
        `<input type="text" name="kidPin" value="${esc(kid.pin || '')}" inputmode="numeric"
          pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="No lock — anyone can open it">`,
        'A 4-digit PIN this child types to open their own profile, so siblings can\'t tick off '
        + 'their chores or spend their points. Leave blank for no lock. Your parent PIN opens every profile.')}
      ${isNew ? '' : `<button type="button" class="btn btn--danger btn--block" data-sheet-action="delete">Remove ${esc(kid.name)}</button>`}`,
    actions: [
      { id: 'save', label: isNew ? 'Add child' : 'Save', tone: 'primary' },
      { id: 'cancel', label: 'Cancel', tone: 'plain' },
    ],
    onMount: (el) => { sheet = el; },
  });

  if (answer === 'delete') {
    const sure = await confirmSheet({
      title: `Remove ${kid.name}?`,
      subtitle: 'Their points and chore history are deleted too. This cannot be undone.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (sure) { store.removeKid(kid.id); toast(`${kid.name} removed`); }
    return;
  }

  if (answer !== 'save') return;

  const name = $('input[name="name"]', sheet).value.trim();
  if (!name) { toast('Please enter a name', 'warn'); return; }

  const kidPin = $('input[name="kidPin"]', sheet).value.trim();
  if (kidPin && !/^\d{4}$/.test(kidPin)) {
    toast('A profile lock must be exactly 4 digits', 'warn');
    return;
  }

  const patch = {
    name,
    avatar: readRadio(sheet, 'avatar'),
    color: readRadio(sheet, 'colour'),
    pin: kidPin,
  };

  if (isNew) { store.addKid(patch); toast(`${name} added 🎉`, 'success'); }
  else { store.updateKid(kid.id, patch); toast('Saved', 'success'); }
}

async function choreEditor(existing) {
  const isNew = !existing;
  const chore = existing || { title: '', emoji: '🧹', points: 10, repeat: 'daily', days: [1, 2, 3, 4, 5], assignment: 'all' };

  let sheet;
  const answer = await openSheet({
    title: isNew ? 'New chore' : 'Edit chore',
    body: `
      ${field('What is it', `<input type="text" name="title" value="${esc(chore.title)}" placeholder="e.g. Feed the dog" maxlength="60" autocomplete="off">`)}
      ${emojiPicker('emoji', store.CHORE_EMOJI, chore.emoji)}
      ${difficultyPicker(chore)}
      ${field('Points when approved', `<input type="number" name="points" value="${chore.points}" min="0" max="1000" inputmode="numeric">`, 'Bigger jobs deserve more points.')}
      <div class="field">
        <span class="field__label">How often</span>
        <div class="chip-picker" data-repeat>
          ${[['daily', 'Every day'], ['weekly', 'Certain days'], ['once', 'One time']].map(([v, l]) => `
            <label class="chip-picker__opt">
              <input type="radio" name="repeat" value="${v}" ${chore.repeat === v ? 'checked' : ''}>
              <span>${l}</span>
            </label>`).join('')}
        </div>
      </div>
      <div data-days-wrap ${chore.repeat === 'weekly' ? '' : 'hidden'}>${dayPicker(chore.days || [])}</div>
      ${kidPicker(chore.assignment)}
      ${isNew ? '' : '<button type="button" class="btn btn--danger btn--block" data-sheet-action="delete">Delete chore</button>'}`,
    actions: [
      { id: 'save', label: isNew ? 'Add chore' : 'Save', tone: 'primary' },
      { id: 'cancel', label: 'Cancel', tone: 'plain' },
    ],
    onMount: (el) => {
      sheet = el;
      // Day chooser only makes sense for the "certain days" option.
      $('[data-repeat]', el)?.addEventListener('change', () => {
        $('[data-days-wrap]', el).hidden = readRadio(el, 'repeat') !== 'weekly';
      });
      $('[data-difficulty]', el)?.addEventListener('change', (e) => {
        if (e.target.name !== 'difficulty') return;
        const level = store.DIFFICULTY.find((d) => d.id === e.target.value);
        if (!level) return;
        $('[data-diff-hint]', el).innerHTML =
          `${esc(level.hint)} Full-week streak bonus: <strong>+${store.settings().streakBonus[level.id]}%</strong>.`;
        // Only suggest points for a new chore — never overwrite a considered value.
        if (isNew) $('input[name="points"]', el).value = String(e.target.dataset.suggest);
      });
      $('[data-assignment]', el)?.addEventListener('change', (e) => {
        if (e.target.name === 'assignMode') {
          $('[data-kid-list]', el).hidden = e.target.value === 'all';
        }
      });
    },
  });

  if (answer === 'delete') {
    const sure = await confirmSheet({
      title: 'Delete this chore?',
      subtitle: 'Points already earned from it stay on your kids’ balances.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (sure) { store.archiveChore(chore.id); toast('Chore deleted'); }
    return;
  }

  if (answer !== 'save') return;

  const title = $('input[name="title"]', sheet).value.trim();
  if (!title) { toast('Please name the chore', 'warn'); return; }

  const repeat = readRadio(sheet, 'repeat');
  const days = repeat === 'weekly' ? readChecks(sheet, 'day').map(Number) : [];
  if (repeat === 'weekly' && !days.length) { toast('Pick at least one day', 'warn'); return; }

  const patch = {
    title,
    emoji: readRadio(sheet, 'emoji'),
    points: Math.max(0, Number($('input[name="points"]', sheet).value) || 0),
    repeat, days,
    difficulty: readRadio(sheet, 'difficulty') || 'medium',
    assignment: readAssignment(sheet),
  };

  if (isNew) { store.addChore(patch); toast('Chore added', 'success'); }
  else { store.updateChore(chore.id, patch); toast('Saved', 'success'); }
}

async function rewardEditor(existing) {
  const isNew = !existing;
  const reward = existing || { title: '', emoji: '🎁', cost: 250, kind: 'treat', brand: '', value: '' };

  let sheet;
  const answer = await openSheet({
    title: isNew ? 'New reward' : 'Edit reward',
    body: `
      ${field('Reward', `<input type="text" name="title" value="${esc(reward.title)}" placeholder="e.g. $10 Amazon gift card" maxlength="60" autocomplete="off">`)}
      ${emojiPicker('emoji', store.REWARD_EMOJI, reward.emoji)}
      ${field('Points to unlock', `<input type="number" name="cost" value="${reward.cost}" min="1" max="100000" inputmode="numeric">`, 'A year of daily chores adds up fast — price big rewards generously.')}
      <div class="field">
        <span class="field__label">Type</span>
        <div class="chip-picker" data-kind>
          ${[['treat', 'Treat or privilege'], ['giftcard', 'Gift card']].map(([v, l]) => `
            <label class="chip-picker__opt">
              <input type="radio" name="kind" value="${v}" ${reward.kind === v ? 'checked' : ''}>
              <span>${l}</span>
            </label>`).join('')}
        </div>
      </div>
      <div data-gift-wrap ${reward.kind === 'giftcard' ? '' : 'hidden'}>
        ${field('Brand', `<select name="brand">${store.GIFT_BRANDS.map((b) =>
          `<option value="${esc(b)}" ${b === reward.brand ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`)}
        ${field('Card value', `<input type="text" name="value" value="${esc(reward.value)}" placeholder="e.g. $10" maxlength="12">`,
          'You buy the card yourself when your child redeems it.')}
      </div>
      ${isNew ? '' : '<button type="button" class="btn btn--danger btn--block" data-sheet-action="delete">Delete reward</button>'}`,
    actions: [
      { id: 'save', label: isNew ? 'Add reward' : 'Save', tone: 'primary' },
      { id: 'cancel', label: 'Cancel', tone: 'plain' },
    ],
    onMount: (el) => {
      sheet = el;
      $('[data-kind]', el)?.addEventListener('change', () => {
        $('[data-gift-wrap]', el).hidden = readRadio(el, 'kind') !== 'giftcard';
      });
    },
  });

  if (answer === 'delete') {
    const sure = await confirmSheet({
      title: 'Delete this reward?',
      subtitle: 'It disappears from the store. Already-approved redemptions are untouched.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (sure) { store.archiveReward(reward.id); toast('Reward deleted'); }
    return;
  }

  if (answer !== 'save') return;

  const title = $('input[name="title"]', sheet).value.trim();
  if (!title) { toast('Please name the reward', 'warn'); return; }
  const kind = readRadio(sheet, 'kind');

  const patch = {
    title,
    emoji: readRadio(sheet, 'emoji'),
    cost: Math.max(1, Number($('input[name="cost"]', sheet).value) || 1),
    kind,
    brand: kind === 'giftcard' ? $('select[name="brand"]', sheet).value : '',
    value: kind === 'giftcard' ? $('input[name="value"]', sheet).value.trim() : '',
  };

  if (isNew) { store.addReward(patch); toast('Reward added', 'success'); }
  else { store.updateReward(reward.id, patch); toast('Saved', 'success'); }
}

/* --------------------------------------------------------------------------
   Backup / restore
   -------------------------------------------------------------------------- */

async function exportFlow() {
  const json = store.exportData();
  const stamp = todayISO();
  let sheet;

  await openSheet({
    title: 'Backup your data',
    subtitle: 'Save this file somewhere safe. Restoring it brings back every kid, chore and point.',
    body: `
      <a class="btn btn--primary btn--block" data-download
        download="chorequest-backup-${stamp}.json"
        href="data:application/json;charset=utf-8,${encodeURIComponent(json)}">Download backup file</a>
      ${field('Or copy the text', `<textarea name="json" rows="6" readonly>${esc(json)}</textarea>`)}
      <button type="button" class="btn btn--plain btn--block" data-copy>Copy to clipboard</button>`,
    actions: [{ id: 'done', label: 'Done', tone: 'plain' }],
    onMount: (el) => {
      sheet = el;
      $('[data-copy]', el).addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(json);
          toast('Backup copied', 'success');
        } catch {
          $('textarea[name="json"]', el).select();
          toast('Press ⌘/Ctrl+C to copy');
        }
      });
    },
  });
}

async function importFlow() {
  let sheet;
  const answer = await openSheet({
    title: 'Restore a backup',
    subtitle: 'This replaces everything currently in the app.',
    body: `
      ${field('Choose a backup file', '<input type="file" name="file" accept="application/json,.json">')}
      ${field('Or paste the backup text', '<textarea name="json" rows="6" placeholder="{ &quot;version&quot;: 1, ... }"></textarea>')}`,
    actions: [
      { id: 'restore', label: 'Restore', tone: 'danger' },
      { id: 'cancel', label: 'Cancel', tone: 'plain' },
    ],
    onMount: (el) => {
      sheet = el;
      $('input[name="file"]', el).addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) $('textarea[name="json"]', el).value = await file.text();
      });
    },
  });

  if (answer !== 'restore') return;
  const text = $('textarea[name="json"]', sheet).value.trim();
  if (!text) { toast('Nothing to restore', 'warn'); return; }
  try {
    store.importData(text);
    toast('Backup restored', 'success');
  } catch (err) {
    toast(err.message || 'That backup could not be read', 'warn');
  }
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

export async function handleParentAction(action, el, ctx) {
  switch (action) {
    case 'add-kid': await kidEditor(null); return true;
    case 'edit-kid': await kidEditor(store.getKid(el.dataset.id)); return true;
    case 'add-chore': await choreEditor(null); return true;
    case 'edit-chore': await choreEditor(store.getChore(el.dataset.id)); return true;
    case 'add-reward': await rewardEditor(null); return true;
    case 'edit-reward': await rewardEditor(store.getReward(el.dataset.id)); return true;

    case 'review-chore':
      store.reviewCompletion(el.dataset.id, el.dataset.ok === '1');
      buzz();
      toast(el.dataset.ok === '1' ? 'Approved — points awarded' : 'Declined', el.dataset.ok === '1' ? 'success' : 'default');
      return true;

    case 'review-redemption': {
      const fulfilled = el.dataset.ok === '1';
      store.reviewRedemption(el.dataset.id, fulfilled);
      buzz();
      toast(fulfilled ? 'Marked as given 🎁' : 'Declined — points refunded', fulfilled ? 'success' : 'default');
      return true;
    }

    case 'approve-all': {
      const count = store.pendingCompletions().length;
      const sure = await confirmSheet({
        title: `Approve all ${count} chores?`,
        subtitle: 'Every pending chore is approved and the points are awarded.',
        confirmLabel: 'Approve all',
      });
      if (sure) { store.approveAllPending(); toast(`${plural(count, 'chore', 'chores')} approved`, 'success'); }
      return true;
    }

    case 'week-start': {
      const current = store.settings().weekStart;
      const answer = await openSheet({
        title: 'Week starts on',
        subtitle: 'Used for the "this week" points total.',
        actions: [
          { id: '0', label: `Sunday${current === 0 ? '  ✓' : ''}`, tone: 'plain' },
          { id: '1', label: `Monday${current === 1 ? '  ✓' : ''}`, tone: 'plain' },
        ],
      });
      if (answer === '0' || answer === '1') {
        store.setSettings({ weekStart: Number(answer) });
        toast('Saved', 'success');
      }
      return true;
    }

    case 'export-data': await exportFlow(); return true;
    case 'import-data': await importFlow(); return true;

    case 'reset-all': {
      const sure = await confirmSheet({
        title: 'Erase everything?',
        subtitle: 'Every child, chore, point and reward is deleted from this device. There is no undo.',
        confirmLabel: 'Erase everything',
        tone: 'danger',
      });
      if (sure) { store.resetAll(); toast('All data erased'); ctx.goHome(); }
      return true;
    }

    default: return false;
  }
}
