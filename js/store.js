/* ==========================================================================
   ChoreQuest — state, persistence and domain logic.

   Everything lives in localStorage on the device. No accounts, no server,
   no network calls: that keeps a kids' app clear of COPPA data-collection
   duties and means the family's chore history never leaves the phone.
   ========================================================================== */

import { uid, clamp, todayISO, toISO, fromISO, addDays, startOfWeek, startOfMonth, startOfYear } from './util.js';

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

/**
 * Difficulty drives two things: a suggested point value, and how big the
 * full-week streak bonus is. Harder chores are harder to keep up every single
 * day, so sustaining one for a week is worth proportionally more.
 */
export const DIFFICULTY = [
  { id: 'easy', label: 'Easy', points: 5, bonus: 10,
    hint: 'A minute or two, barely a chore — make the bed, feed the cat.' },
  { id: 'medium', label: 'Medium', points: 10, bonus: 25,
    hint: 'Ten minutes of real effort — clear the table, homework.' },
  { id: 'hard', label: 'Hard', points: 20, bonus: 50,
    hint: 'Half an hour, or something they resist — tidy the whole room.' },
  { id: 'extreme', label: 'Extreme', points: 40, bonus: 100,
    hint: 'The big one — mow the lawn, deep-clean the bathroom.' },
];

export const difficultyOf = (chore) =>
  DIFFICULTY.find((d) => d.id === (chore?.difficulty || 'medium')) || DIFFICULTY[1];

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
  { title: 'Make your bed', emoji: '🛏️', points: 5, repeat: 'daily', difficulty: 'easy' },
  { title: 'Brush teeth (morning & night)', emoji: '🦷', points: 5, repeat: 'daily', difficulty: 'easy' },
  { title: 'Clear the dinner table', emoji: '🍽️', points: 10, repeat: 'daily', difficulty: 'medium' },
  { title: 'Homework done', emoji: '📚', points: 15, repeat: 'weekly', days: [1, 2, 3, 4, 5], difficulty: 'medium' },
  { title: 'Tidy your room', emoji: '🧸', points: 20, repeat: 'weekly', days: [6], difficulty: 'hard' },
  { title: 'Take out the recycling', emoji: '♻️', points: 15, repeat: 'weekly', days: [0], difficulty: 'medium' },
  { title: 'Help with laundry', emoji: '🧺', points: 15, repeat: 'weekly', days: [3], difficulty: 'medium' },
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
    settings: {
      pin: '', weekStart: 0, seenIntro: false,
      // Percentage added on top of a chore's weekly points for a perfect week.
      streakBonus: Object.fromEntries(DIFFICULTY.map((d) => [d.id, d.bonus])),
    },
    kids: [],
    chores: STARTER_CHORES.map((c, i) => ({
      id: uid('chore'), title: c.title, emoji: c.emoji, points: c.points,
      repeat: c.repeat, days: c.days || [], assignment: 'all',
      difficulty: c.difficulty, archived: false, order: i, createdAt: now,
    })),
    rewards: STARTER_REWARDS.map((r, i) => ({
      id: uid('reward'), title: r.title, emoji: r.emoji, cost: r.cost,
      kind: r.kind, brand: r.brand || '', value: r.value || '',
      archived: false, order: i, createdAt: now,
    })),
    completions: [],
    redemptions: [],
    // Streak savers: grants are given by a parent, uses repair one missed day.
    // Both are event lists so every balance stays derivable from history.
    saverGrants: [],
    saverUses: [],
    // Perfect-week celebrations the kid has already seen, keyed per bonus.
    celebrated: {},
  };
}

/* --------------------------------------------------------------------------
   Persistence
   -------------------------------------------------------------------------- */

let state = seedState();
const listeners = new Set();

/* Streak bonuses are recomputed from history rather than stored, so they stay
   correct when a parent approves late or changes their mind. That scan is
   memoised against a revision counter so it runs once per change, not once
   per render. */
let revision = 0;
let memoRev = -1;
const memoCache = new Map();

function memo(key, compute) {
  if (memoRev !== revision) { memoCache.clear(); memoRev = revision; }
  if (!memoCache.has(key)) memoCache.set(key, compute());
  return memoCache.get(key);
}

export function load() {
  revision += 1;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = seedState();
      state = {
        ...base, ...parsed,
        settings: {
          ...base.settings,
          ...(parsed.settings || {}),
          streakBonus: { ...base.settings.streakBonus, ...((parsed.settings || {}).streakBonus || {}) },
        },
      };
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
  revision += 1;
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

export function addKid({ name, avatar, color, pin }) {
  const kid = {
    id: uid('kid'),
    name: name.trim(),
    avatar: avatar || AVATARS[state.kids.length % AVATARS.length],
    color: color || KID_COLORS[state.kids.length % KID_COLORS.length].id,
    pin: pin || '',
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
    s.saverGrants = s.saverGrants.filter((g) => g.kidId !== id);
    s.saverUses = s.saverUses.filter((u) => u.kidId !== id);
    s.chores.forEach((chore) => {
      if (Array.isArray(chore.assignment)) {
        chore.assignment = chore.assignment.filter((kidId) => kidId !== id);
      }
    });
  });
}

export const kidHasPin = (id) => Boolean(getKid(id)?.pin);

/**
 * A child's own PIN opens their profile — and so does the parent PIN, which
 * acts as a master key so a forgotten kid PIN never locks anyone out.
 */
export function checkKidPin(id, code) {
  const kid = getKid(id);
  if (!kid) return false;
  if (kid.pin && kid.pin === code) return true;
  return Boolean(state.settings.pin) && state.settings.pin === code;
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
    difficulty: data.difficulty || 'medium',
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
    if (!chore) return;
    chore.archived = true;
    // Recorded so past streaks stay intact: days after this date simply stop
    // counting, rather than breaking a week the child actually completed.
    chore.archivedAt = new Date().toISOString();
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
   Weekly streak bonuses.

   A "perfect week" means the child did a chore on every single day it was due
   that week. That earns a bonus on top of the points already banked for it,
   sized by the chore's difficulty. Bonuses are derived from history, never
   stored, so approving late or declining afterwards always settles correctly.
   -------------------------------------------------------------------------- */

/** Below this many scheduled days a week, finishing isn't a streak. */
export const MIN_STREAK_DAYS = 3;

/** Schedule-only check — deliberately ignores completions, unlike isChoreDue. */
function isScheduledOn(chore, dateISO) {
  if (chore.repeat === 'daily') return true;
  if (chore.repeat === 'weekly') return (chore.days || []).includes(fromISO(dateISO).getDay());
  return false;   // a one-off chore cannot build a streak
}

export const streakBonusPct = (chore) => {
  const level = chore.difficulty || 'medium';
  const configured = (state.settings.streakBonus || {})[level];
  return Number(configured ?? difficultyOf(chore).bonus ?? 0);
};

function saverIndex(kidId) {
  return memo(`sv:${kidId}`, () => new Set(
    state.saverUses.filter((u) => u.kidId === kidId).map((u) => `${u.choreId}|${u.date}`),
  ));
}

function approvedIndex(kidId) {
  return memo(`idx:${kidId}`, () => {
    const map = new Map();
    state.completions.forEach((c) => {
      if (c.kidId === kidId && c.status === 'approved') map.set(`${c.choreId}|${c.date}`, c);
    });
    return map;
  });
}

/**
 * How one chore's streak stands for one kid in one week.
 * `dueTotal` spans the whole week; `dueSoFar` stops at today, so the current
 * week can show honest progress without counting days that haven't happened.
 */
export function choreWeekStreak(chore, kidId, weekStart, index = approvedIndex(kidId), covered = saverIndex(kidId)) {
  const today = todayISO();
  const bornOn = (chore.createdAt || '').slice(0, 10);
  const retiredOn = chore.archivedAt ? chore.archivedAt.slice(0, 10) : null;

  const dueAll = [];
  const dueSoFar = [];
  for (let i = 0; i < 7; i += 1) {
    const iso = toISO(addDays(weekStart, i));
    if (bornOn && iso < bornOn) continue;        // before the chore existed
    if (retiredOn && iso > retiredOn) break;     // after it was retired
    if (!isScheduledOn(chore, iso)) continue;
    dueAll.push(iso);
    if (iso <= today) dueSoFar.push(iso);
  }

  const doneDays = dueSoFar.filter((iso) => index.has(`${chore.id}|${iso}`));
  // A saver covers a missed day for the streak, but only real work earns
  // points — the bonus is a percentage of what was actually done.
  const basePoints = doneDays.reduce((sum, iso) => sum + index.get(`${chore.id}|${iso}`).points, 0);
  const bonusPct = streakBonusPct(chore);
  const eligible = isAssignedTo(chore, kidId) && dueAll.length >= MIN_STREAK_DAYS;

  const days = dueAll.map((iso) => ({
    date: iso,
    done: index.has(`${chore.id}|${iso}`),
    covered: covered.has(`${chore.id}|${iso}`),
    past: iso < today,
    isToday: iso === today,
  }));

  const counted = days.filter((d) => d.done || d.covered).length;
  const usedSaver = days.some((d) => d.covered);
  const complete = eligible && counted === dueAll.length;

  // Only a missed day that has already passed breaks a streak. Not having done
  // today's chore yet is not a failure — the day isn't over.
  const missedPastDays = days.filter((d) => d.past && !d.done && !d.covered);
  const missedPast = missedPastDays.length;
  const todayEntry = days.find((d) => d.isToday) || null;

  return {
    choreId: chore.id,
    kidId,
    title: chore.title,
    emoji: chore.emoji,
    difficulty: chore.difficulty || 'medium',
    weekStart: toISO(weekStart),
    dueTotal: dueAll.length,
    dueSoFar: dueSoFar.length,
    done: doneDays.length,
    days,
    eligible,
    complete,
    usedSaver,
    // Flawless means perfect without a saver — the only kind that earns one,
    // otherwise a saver would refund itself every week.
    flawless: complete && !usedSaver,
    missedPast,
    firstMissedDate: missedPastDays[0]?.date || null,
    broken: eligible && missedPast > 0,
    todayDue: Boolean(todayEntry),
    todayDone: Boolean(todayEntry?.done),
    onTrack: eligible && missedPast === 0,
    basePoints,
    bonusPct,
    bonusPoints: complete ? Math.round((basePoints * bonusPct) / 100) : 0,
    // Credited on the last day the chore was due, which is when it was earned.
    earnedOn: dueAll.length ? dueAll[dueAll.length - 1] : null,
  };
}

/** Every perfect week this child has ever put together. */
export function weeklyBonuses(kidId) {
  return memo(`bonus:${kidId}`, () => {
    const approved = state.completions.filter((c) => c.kidId === kidId && c.status === 'approved');
    if (!approved.length) return [];

    const index = approvedIndex(kidId);
    const earliest = approved.reduce((min, c) => (c.date < min ? c.date : min), approved[0].date);
    let cursor = startOfWeek(fromISO(earliest), state.settings.weekStart);
    const lastWeek = startOfWeek(new Date(), state.settings.weekStart);

    const earned = [];
    let guard = 0;
    while (cursor <= lastWeek && guard < 520) {   // ~10 years, a runaway guard
      guard += 1;
      // Archived chores are included: a week already completed keeps its bonus.
      state.chores.forEach((chore) => {
        const streak = choreWeekStreak(chore, kidId, cursor, index);
        if (streak.complete && streak.bonusPoints > 0) earned.push(streak);
      });
      cursor = addDays(cursor, 7);
    }
    return earned;
  });
}

export const bonusPointsTotal = (kidId) =>
  weeklyBonuses(kidId).reduce((sum, b) => sum + b.bonusPoints, 0);

/** This week's streaks, live, for the child's Progress screen. */
export function activeStreaks(kidId) {
  const weekStart = startOfWeek(new Date(), state.settings.weekStart);
  const index = approvedIndex(kidId);
  return state.chores
    .filter((c) => !c.archived && isAssignedTo(c, kidId))
    .map((c) => choreWeekStreak(c, kidId, weekStart, index))
    .filter((s) => s.eligible)
    .sort((a, b) => (b.done / b.dueTotal) - (a.done / a.dueTotal) || b.bonusPct - a.bonusPct);
}

/** Keyed by chore id, for decorating the Today list. */
export function activeStreakMap(kidId) {
  return new Map(activeStreaks(kidId).map((s) => [s.choreId, s]));
}

/* --------------------------------------------------------------------------
   The points maths
   -------------------------------------------------------------------------- */

/** Points from approved chores alone, before any streak bonus. */
export const basePointsEarned = (kidId) =>
  approvedCompletions(kidId).reduce((sum, c) => sum + c.points, 0);

/** Lifetime points — chores plus streak bonuses. Never goes down. */
export const lifetimePoints = (kidId) => basePointsEarned(kidId) + bonusPointsTotal(kidId);

export const spentPoints = (kidId) =>
  state.redemptions
    .filter((r) => r.kidId === kidId && r.status !== 'declined')
    .reduce((sum, r) => sum + r.cost, 0);

/** Spendable balance. */
export const balance = (kidId) => lifetimePoints(kidId) - spentPoints(kidId);

export function pointsEarnedSince(kidId, startDate) {
  const startISO = toISO(startDate);
  const base = approvedCompletions(kidId)
    .filter((c) => c.date >= startISO)
    .reduce((sum, c) => sum + c.points, 0);
  const bonus = weeklyBonuses(kidId)
    .filter((b) => b.earnedOn && b.earnedOn >= startISO)
    .reduce((sum, b) => sum + b.bonusPoints, 0);
  return base + bonus;
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
   Streak savers.

   A saver (one per kid, stackable) repairs a single missed day so the week's
   streak — and its bonus — survives. Kids earn one for every flawless week;
   parents can also grant them. The missed day itself still earns no points:
   a saver protects the habit, it doesn't fake the work.
   -------------------------------------------------------------------------- */

export const flawlessWeeks = (kidId) =>
  weeklyBonuses(kidId).filter((b) => b.flawless).length;

export function saversAvailable(kidId) {
  const granted = state.saverGrants.filter((g) => g.kidId === kidId).length;
  const used = state.saverUses.filter((u) => u.kidId === kidId).length;
  return Math.max(0, flawlessWeeks(kidId) + granted - used);
}

export function grantSaver(kidId) {
  if (!getKid(kidId)) return;
  update((s) => s.saverGrants.push({ id: uid('sgr'), kidId, createdAt: new Date().toISOString() }));
}

/** Is this specific day repairable right now? Shared by apply and the UI. */
export function canRepairDay(kidId, choreId, dateISO) {
  const chore = getChore(choreId);
  if (!chore || !isAssignedTo(chore, kidId)) return false;
  const today = todayISO();
  if (dateISO >= today) return false;                       // only a day already lost
  // Repairs reach back to the start of the previous week, so a Sunday-night
  // miss can still be rescued on Monday morning — but ancient history can't.
  const floor = toISO(addDays(startOfWeek(new Date(), state.settings.weekStart), -7));
  if (dateISO < floor) return false;
  if (!isScheduledOn(chore, dateISO)) return false;          // must be a scheduled day
  if (completionFor(choreId, kidId, dateISO)) return false;  // already done
  return !state.saverUses.some((u) => u.kidId === kidId && u.choreId === choreId && u.date === dateISO);
}

export function applySaver(kidId, choreId, dateISO) {
  if (saversAvailable(kidId) <= 0) return { ok: false, reason: 'none' };
  if (!canRepairDay(kidId, choreId, dateISO)) return { ok: false, reason: 'invalid' };
  update((s) => s.saverUses.push({
    id: uid('sus'), kidId, choreId, date: dateISO, createdAt: new Date().toISOString(),
  }));
  return { ok: true };
}

/**
 * Last week's near-misses: one repairable day away from the bonus. These are
 * the moments a saver matters most, so the UI offers them explicitly.
 */
export function rescueCandidates(kidId) {
  if (saversAvailable(kidId) <= 0) return [];
  const lastWeek = addDays(startOfWeek(new Date(), state.settings.weekStart), -7);
  const index = approvedIndex(kidId);
  const covered = saverIndex(kidId);
  return state.chores
    .filter((c) => !c.archived && isAssignedTo(c, kidId))
    .map((c) => choreWeekStreak(c, kidId, lastWeek, index, covered))
    .filter((w) => w.eligible && !w.complete && w.missedPast === 1
      && canRepairDay(kidId, w.choreId, w.firstMissedDate));
}

/* --------------------------------------------------------------------------
   Perfect-week celebrations — shown to the kid once, then remembered.
   -------------------------------------------------------------------------- */

const bonusKey = (kidId, b) => `${kidId}|${b.choreId}|${b.weekStart}`;

export function unseenBonuses(kidId) {
  // Old bonuses from an imported backup shouldn't trigger a confetti backlog.
  const horizon = toISO(addDays(new Date(), -14));
  return weeklyBonuses(kidId).filter((b) =>
    b.earnedOn >= horizon && !state.celebrated[bonusKey(kidId, b)]);
}

export function markCelebrated(kidId, bonuses) {
  if (!bonuses.length) return;
  update((s) => bonuses.forEach((b) => { s.celebrated[bonusKey(kidId, b)] = true; }));
}

/* --------------------------------------------------------------------------
   Last week in one line, for the parent's recap card.
   -------------------------------------------------------------------------- */

export function lastWeekRecap(kidId) {
  const thisStart = toISO(startOfWeek(new Date(), state.settings.weekStart));
  const lastStart = toISO(addDays(startOfWeek(new Date(), state.settings.weekStart), -7));
  const base = approvedCompletions(kidId)
    .filter((c) => c.date >= lastStart && c.date < thisStart)
    .reduce((sum, c) => sum + c.points, 0);
  const weeks = weeklyBonuses(kidId).filter((b) => b.weekStart === lastStart);
  const bonus = weeks.reduce((sum, b) => sum + b.bonusPoints, 0);
  return { points: base + bonus, base, bonus, perfect: weeks.length };
}

/* --------------------------------------------------------------------------
   Settings, backup, reset
   -------------------------------------------------------------------------- */

export const settings = () => state.settings;

export function setStreakBonus(level, pct) {
  update((s) => {
    s.settings.streakBonus = {
      ...(s.settings.streakBonus || {}),
      [level]: clamp(Math.round(Number(pct) || 0), 0, 200),
    };
  });
}

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
