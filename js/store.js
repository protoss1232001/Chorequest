/* ==========================================================================
   ChoreQuest — state, persistence and domain logic.

   Everything lives in localStorage on the device. No accounts, no server,
   no network calls: that keeps a kids' app clear of COPPA data-collection
   duties and means the family's chore history never leaves the phone.
   ========================================================================== */

import { uid, todayISO, toISO, fromISO, addDays, startOfWeek, startOfMonth, startOfYear } from './util.js';

const STORAGE_KEY = 'chorequest.v1';

export const KID_COLORS = [
  { id: 'grape', label: 'Grape', hex: '#7d5fff' },
  { id: 'ocean', label: 'Ocean', hex: '#0a84ff' },
  { id: 'mint', label: 'Mint', hex: '#00c7a3' },
  { id: 'sunny', label: 'Sunny', hex: '#ff9f0a' },
  { id: 'cherry', label: 'Cherry', hex: '#ff375f' },
  { id: 'sky', label: 'Sky', hex: '#32ade6' },
];

export const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐨', '🐧', '🐸', '🦁', '🐰', '🐙', '🦖', '🐝', '🦉', '🐳'];

export const CHORE_EMOJI = ['🧹', '🍽️', '🛏️', '🗑️', '🧺', '🐕', '📚', '🦷', '🚿', '🧸', '🌱', '🚗', '✏️', '🧼', '🍳', '♻️'];

export const REWARD_EMOJI = ['🎁', '🎮', '🍿', '🎬', '🍦', '🛝', '📱', '🎧', '👟', '🧱', '🎨', '🎟️', '🍕', '📖', '⚽', '💎'];

/* Gift-card brands a parent can pick from. The app never sells or delivers a
   card itself — it records what the kid chose so the parent can buy it. That
   keeps us clear of Apple's rule that in-app-redeemable digital gift cards
   must go through in-app purchase. */
export const GIFT_BRANDS = [
  'Amazon', 'Apple / App Store', 'Google Play', 'Roblox', 'Nintendo eShop',
  'PlayStation Store', 'Xbox', 'Steam', 'Target', 'Starbucks', 'Netflix', 'Other',
];

const STARTER_CHORES = [
  { title: 'Make your bed', emoji: '🛏️', points: 5, repeat: 'daily' },
  { title: 'Brush teeth (morning & night)', emoji: '🦷', points: 5, repeat: 'daily' },
  { title: 'Clear the dinner table', emoji: '🍽️', points: 10, repeat: 'daily' },
  { title: 'Homework done', emoji: '📚', points: 15, repeat: 'weekly', days: [1, 2, 3, 4, 5] },
  { title: 'Tidy your room', emoji: '🧸', points: 20, repeat: 'weekly', days: [6] },
  { title: 'Take out the recycling', emoji: '♻️', points: 15, repeat: 'weekly', days: [0] },
  { title: 'Help with laundry', emoji: '🧺', points: 15, repeat: 'weekly', days: [3] },
];

const STARTER_REWARDS = [
  { title: 'Extra 30 min screen time', emoji: '📱', cost: 100, kind: 'treat' },
  { title: 'Pick the movie on Friday', emoji: '🎬', cost: 150, kind: 'treat' },
  { title: 'Ice cream trip', emoji: '🍦', cost: 250, kind: 'treat' },
  { title: '$5 Amazon gift card', emoji: '🎁', cost: 500, kind: 'giftcard', brand: 'Amazon', value: '$5' },
  { title: '$10 Roblox gift card', emoji: '🎮', cost: 1000, kind: 'giftcard', brand: 'Roblox', value: '$10' },
  { title: '$25 Apple gift card', emoji: '🎧', cost: 2500, kind: 'giftcard', brand: 'Apple / App Store', value: '$25' },
];

function seedState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    createdAt: now,
    settings: { pin: '', weekStart: 0, seenIntro: false },
    kids: [],
    chores: STARTER_CHORES.map((c, i) => ({
      id: uid('chore'), title: c.title, emoji: c.emoji, points: c.points,
      repeat: c.repeat, days: c.days || [], assignment: 'all',
      archived: false, order: i, createdAt: now,
    })),
    rewards: STARTER_REWARDS.map((r, i) => ({
      id: uid('reward'), title: r.title, emoji: r.emoji, cost: r.cost,
      kind: r.kind, brand: r.brand || '', value: r.value || '',
      archived: false, order: i, createdAt: now,
    })),
    completions: [],
    redemptions: [],
  };
}

/* --------------------------------------------------------------------------
   Persistence
   -------------------------------------------------------------------------- */

let state = seedState();
const listeners = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...seedState(), ...parsed, settings: { ...seedState().settings, ...(parsed.settings || {}) } };
    }
  } catch (err) {
    console.warn('ChoreQuest: could not read saved data, starting fresh.', err);
  }
  return state;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('ChoreQuest: could not save.', err);
  }
}

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  persist();
  listeners.forEach((fn) => fn(state));
}

/** Mutate state through here so every change saves and re-renders. */
function update(mutator) {
  mutator(state);
  commit();
}

/* --------------------------------------------------------------------------
   Kids
   -------------------------------------------------------------------------- */

export const kids = () => state.kids;
export const getKid = (id) => state.kids.find((k) => k.id === id) || null;

export function addKid({ name, avatar, color }) {
  const kid = {
    id: uid('kid'),
    name: name.trim(),
    avatar: avatar || AVATARS[state.kids.length % AVATARS.length],
    color: color || KID_COLORS[state.kids.length % KID_COLORS.length].id,
    createdAt: new Date().toISOString(),
  };
  update((s) => s.kids.push(kid));
  return kid;
}

export function updateKid(id, patch) {
  update((s) => {
    const kid = s.kids.find((k) => k.id === id);
    if (kid) Object.assign(kid, patch);
  });
}

/** Removing a kid takes their history with them — nothing is left dangling. */
export function removeKid(id) {
  update((s) => {
    s.kids = s.kids.filter((k) => k.id !== id);
    s.completions = s.completions.filter((c) => c.kidId !== id);
    s.redemptions = s.redemptions.filter((r) => r.kidId !== id);
    s.chores.forEach((chore) => {
      if (Array.isArray(chore.assignment)) {
        chore.assignment = chore.assignment.filter((kidId) => kidId !== id);
      }
    });
  });
}

export const kidColorHex = (kid) =>
  (KID_COLORS.find((c) => c.id === kid?.color) || KID_COLORS[0]).hex;

/* --------------------------------------------------------------------------
   Chores
   -------------------------------------------------------------------------- */

export const chores = () => state.chores.filter((c) => !c.archived);
export const getChore = (id) => state.chores.find((c) => c.id === id) || null;

export function addChore(data) {
  const chore = {
    id: uid('chore'),
    title: data.title.trim(),
    emoji: data.emoji || '✅',
    points: Number(data.points) || 0,
    repeat: data.repeat || 'daily',
    days: data.days || [],
    assignment: data.assignment || 'all',
    archived: false,
    order: state.chores.length,
    createdAt: new Date().toISOString(),
  };
  update((s) => s.chores.push(chore));
  return chore;
}

export function updateChore(id, patch) {
  update((s) => {
    const chore = s.chores.find((c) => c.id === id);
    if (chore) Object.assign(chore, patch);
  });
}

/** Chores are archived rather than deleted so past earnings keep their story. */
export function archiveChore(id) {
  update((s) => {
    const chore = s.chores.find((c) => c.id === id);
    if (chore) chore.archived = true;
  });
}

export function isAssignedTo(chore, kidId) {
  return chore.assignment === 'all' || (Array.isArray(chore.assignment) && chore.assignment.includes(kidId));
}

/**
 * Is this chore on the given kid's list for `dateISO`?
 * daily  → every day
 * weekly → only on the selected weekdays
 * once   → until it has been done (pending or approved), then it retires
 */
export function isChoreDue(chore, kidId, dateISO) {
  if (chore.archived || !isAssignedTo(chore, kidId)) return false;
  if (chore.repeat === 'daily') return true;
  if (chore.repeat === 'weekly') return (chore.days || []).includes(fromISO(dateISO).getDay());
  if (chore.repeat === 'once') {
    const done = state.completions.some(
      (c) => c.choreId === chore.id && c.kidId === kidId && c.status !== 'declined',
    );
    return !done || completionFor(chore.id, kidId, dateISO) !== null;
  }
  return false;
}

export function choresForKid(kidId, dateISO = todayISO()) {
  return chores()
    .filter((chore) => isChoreDue(chore, kidId, dateISO))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function repeatLabel(chore) {
  if (chore.repeat === 'daily') return 'Every day';
  if (chore.repeat === 'once') return 'One time';
  const days = chore.days || [];
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.length ? days.slice().sort().map((d) => names[d]).join(', ') : 'No days set';
}

/* --------------------------------------------------------------------------
   Completions — a kid marks a chore done, a parent approves it.
   -------------------------------------------------------------------------- */

export function completionFor(choreId, kidId, dateISO) {
  return state.completions.find(
    (c) => c.choreId === choreId && c.kidId === kidId && c.date === dateISO && c.status !== 'declined',
  ) || null;
}

export function markChoreDone(choreId, kidId, dateISO = todayISO()) {
  if (completionFor(choreId, kidId, dateISO)) return null;
  const chore = getChore(choreId);
  if (!chore) return null;
  const entry = {
    id: uid('done'),
    choreId, kidId,
    date: dateISO,
    // Points are captured now, so editing the chore later never rewrites history.
    points: chore.points,
    title: chore.title,
    emoji: chore.emoji,
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  update((s) => s.completions.push(entry));
  return entry;
}

/** A kid can take back a tap while it is still waiting on a parent. */
export function undoCompletion(completionId) {
  update((s) => {
    s.completions = s.completions.filter((c) => !(c.id === completionId && c.status === 'pending'));
  });
}

export function reviewCompletion(completionId, approved) {
  update((s) => {
    const entry = s.completions.find((c) => c.id === completionId);
    if (!entry || entry.status !== 'pending') return;
    entry.status = approved ? 'approved' : 'declined';
    entry.reviewedAt = new Date().toISOString();
  });
}

export function approveAllPending(kidId = null) {
  update((s) => {
    s.completions
      .filter((c) => c.status === 'pending' && (!kidId || c.kidId === kidId))
      .forEach((c) => { c.status = 'approved'; c.reviewedAt = new Date().toISOString(); });
  });
}

export const pendingCompletions = (kidId = null) =>
  state.completions
    .filter((c) => c.status === 'pending' && (!kidId || c.kidId === kidId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const approvedCompletions = (kidId) =>
  state.completions.filter((c) => c.kidId === kidId && c.status === 'approved');

/* --------------------------------------------------------------------------
   Rewards & redemptions
   -------------------------------------------------------------------------- */

export const rewards = () => state.rewards.filter((r) => !r.archived).sort((a, b) => a.cost - b.cost);
export const getReward = (id) => state.rewards.find((r) => r.id === id) || null;

export function addReward(data) {
  const reward = {
    id: uid('reward'),
    title: data.title.trim(),
    emoji: data.emoji || '🎁',
    cost: Number(data.cost) || 0,
    kind: data.kind || 'treat',
    brand: data.brand || '',
    value: data.value || '',
    archived: false,
    order: state.rewards.length,
    createdAt: new Date().toISOString(),
  };
  update((s) => s.rewards.push(reward));
  return reward;
}

export function updateReward(id, patch) {
  update((s) => {
    const reward = s.rewards.find((r) => r.id === id);
    if (reward) Object.assign(reward, patch);
  });
}

export function archiveReward(id) {
  update((s) => {
    const reward = s.rewards.find((r) => r.id === id);
    if (reward) reward.archived = true;
  });
}

/**
 * Redeeming spends points immediately so a kid can't promise the same
 * balance twice. A declined request refunds automatically, because
 * `balance()` only counts requested and fulfilled redemptions.
 */
export function redeemReward(rewardId, kidId) {
  const reward = getReward(rewardId);
  if (!reward) return { ok: false, reason: 'missing' };
  if (balance(kidId) < reward.cost) return { ok: false, reason: 'insufficient' };

  const entry = {
    id: uid('redeem'),
    kidId, rewardId,
    title: reward.title,
    emoji: reward.emoji,
    cost: reward.cost,
    kind: reward.kind,
    brand: reward.brand,
    value: reward.value,
    status: 'requested',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  update((s) => s.redemptions.push(entry));
  return { ok: true, entry };
}

export function reviewRedemption(redemptionId, fulfilled) {
  update((s) => {
    const entry = s.redemptions.find((r) => r.id === redemptionId);
    if (!entry || entry.status !== 'requested') return;
    entry.status = fulfilled ? 'fulfilled' : 'declined';
    entry.reviewedAt = new Date().toISOString();
  });
}

export const pendingRedemptions = (kidId = null) =>
  state.redemptions
    .filter((r) => r.status === 'requested' && (!kidId || r.kidId === kidId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const redemptionsFor = (kidId) =>
  state.redemptions.filter((r) => r.kidId === kidId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/* --------------------------------------------------------------------------
   The points maths
   -------------------------------------------------------------------------- */

/** Lifetime approved points — the number that never goes down. */
export const lifetimePoints = (kidId) =>
  approvedCompletions(kidId).reduce((sum, c) => sum + c.points, 0);

export const spentPoints = (kidId) =>
  state.redemptions
    .filter((r) => r.kidId === kidId && r.status !== 'declined')
    .reduce((sum, r) => sum + r.cost, 0);

/** Spendable balance. */
export const balance = (kidId) => lifetimePoints(kidId) - spentPoints(kidId);

export function pointsEarnedSince(kidId, startDate) {
  const startISO = toISO(startDate);
  return approvedCompletions(kidId)
    .filter((c) => c.date >= startISO)
    .reduce((sum, c) => sum + c.points, 0);
}

/**
 * The week / month / year view that makes long-horizon saving visible.
 * Most chore apps zero out weekly; here the year total keeps climbing.
 */
export function accumulation(kidId) {
  const now = new Date();
  return {
    week: pointsEarnedSince(kidId, startOfWeek(now, state.settings.weekStart)),
    month: pointsEarnedSince(kidId, startOfMonth(now)),
    year: pointsEarnedSince(kidId, startOfYear(now)),
    lifetime: lifetimePoints(kidId),
  };
}

/** Consecutive days ending today (or yesterday, if today is still young). */
export function streak(kidId) {
  const days = new Set(approvedCompletions(kidId).map((c) => c.date));
  if (!days.size) return 0;
  let count = 0;
  let cursor = new Date();
  // Today not being done yet shouldn't break a live streak.
  if (!days.has(toISO(cursor))) cursor = addDays(cursor, -1);
  while (days.has(toISO(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** How today is going, for the kid's progress ring. */
export function todayProgress(kidId) {
  const today = todayISO();
  const due = choresForKid(kidId, today);
  const done = due.filter((chore) => completionFor(chore.id, kidId, today)).length;
  return { done, total: due.length, pct: due.length ? Math.round((done / due.length) * 100) : 0 };
}

/** The next reward this kid is saving toward — the carrot on the progress screen. */
export function nextReward(kidId) {
  const have = balance(kidId);
  return rewards().find((r) => r.cost > have) || null;
}

/* --------------------------------------------------------------------------
   Settings, backup, reset
   -------------------------------------------------------------------------- */

export const settings = () => state.settings;

export function setSettings(patch) {
  update((s) => Object.assign(s.settings, patch));
}

export const hasPin = () => Boolean(state.settings.pin);
export const checkPin = (candidate) => state.settings.pin === candidate;

export const exportData = () => JSON.stringify(state, null, 2);

export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.kids)) {
    throw new Error('That file does not look like a ChoreQuest backup.');
  }
  update((s) => {
    Object.keys(s).forEach((k) => delete s[k]);
    Object.assign(s, { ...seedState(), ...parsed });
  });
}

export function resetAll() {
  update((s) => {
    Object.keys(s).forEach((k) => delete s[k]);
    Object.assign(s, seedState());
  });
}
