/*
 * Unit checks for the streak-bonus maths.
 * Run with:  node test/streaks.test.mjs
 * A stubbed localStorage is enough — store.js touches nothing else.
 */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, v),
};

const store = await import(new URL('../js/store.js', import.meta.url));
const { toISO, addDays, startOfWeek } = await import(new URL('../js/util.js', import.meta.url));

let pass = 0, fail = 0;
const is = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${ok ? '' : `  → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
  ok ? pass++ : fail++;
};

const thisWeek = startOfWeek(new Date(), 0);
const lastWeek = addDays(thisWeek, -7);
const long_ago = toISO(addDays(thisWeek, -60));

const chore = (id, over) => ({
  id, title: id, emoji: '🧹', points: 10, repeat: 'daily', days: [],
  assignment: 'all', difficulty: 'medium', archived: false, order: 0,
  createdAt: `${long_ago}T00:00:00.000Z`, ...over,
});

const done = (choreId, dateISO, points, status = 'approved') => ({
  id: `d_${choreId}_${dateISO}`, choreId, kidId: 'k1', date: dateISO, points,
  title: choreId, emoji: '🧹', status, createdAt: `${dateISO}T10:00:00.000Z`, reviewedAt: null,
});

function seed(chores, completions) {
  store.importData(JSON.stringify({
    version: 1,
    settings: { pin: '', weekStart: 0, seenIntro: true, streakBonus: { easy: 10, medium: 25, hard: 50, extreme: 100 } },
    kids: [{ id: 'k1', name: 'Test', avatar: '🦊', color: 'grape', createdAt: `${long_ago}T00:00:00.000Z` }],
    chores, rewards: [], completions, redemptions: [],
  }));
}

const weekDays = (start) => Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)));

console.log('\n— a perfect week on a daily chore —');
seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
is('base points banked', store.basePointsEarned('k1'), 70);
is('bonus is 25% of the week', store.bonusPointsTotal('k1'), 18);          // 70 * 0.25 = 17.5 → 18
is('lifetime = base + bonus', store.lifetimePoints('k1'), 88);
is('one perfect week recorded', store.weeklyBonuses('k1').length, 1);

console.log('\n— one missed day kills the bonus —');
seed([chore('daily10')], weekDays(lastWeek).slice(0, 6).map((d) => done('daily10', d, 10)));
is('no bonus for 6 of 7 days', store.bonusPointsTotal('k1'), 0);
is('base points still banked', store.basePointsEarned('k1'), 60);

console.log('\n— a day that is only pending does not count —');
seed([chore('daily10')], [
  ...weekDays(lastWeek).slice(0, 6).map((d) => done('daily10', d, 10)),
  done('daily10', weekDays(lastWeek)[6], 10, 'pending'),
]);
is('pending day blocks the bonus', store.bonusPointsTotal('k1'), 0);

console.log('\n— approving that last day settles the bonus —');
store.reviewCompletion(`d_daily10_${weekDays(lastWeek)[6]}`, true);
is('bonus appears once approved', store.bonusPointsTotal('k1'), 18);

console.log('\n— declining the outstanding day leaves no bonus —');
seed([chore('daily10')], [
  ...weekDays(lastWeek).slice(0, 6).map((d) => done('daily10', d, 10)),
  done('daily10', weekDays(lastWeek)[6], 10, 'pending'),
]);
store.reviewCompletion(`d_daily10_${weekDays(lastWeek)[6]}`, false);
is('declined day never earns the bonus', store.bonusPointsTotal('k1'), 0);
is('and its points are not banked', store.basePointsEarned('k1'), 60);

console.log('\n— a chore due fewer than MIN_STREAK_DAYS cannot streak —');
const oneDay = [lastWeek.getDay()];
seed([chore('weekly1', { repeat: 'weekly', days: oneDay, points: 20, difficulty: 'extreme' })],
     [done('weekly1', toISO(lastWeek), 20)]);
is('single-day chore earns no streak bonus', store.bonusPointsTotal('k1'), 0);
is('but the chore points still count', store.basePointsEarned('k1'), 20);

console.log('\n— a weekday chore, all five days, hard = 50% —');
const weekdayISOs = weekDays(lastWeek).filter((d) => [1, 2, 3, 4, 5].includes(new Date(`${d}T00:00:00`).getDay()));
seed([chore('school', { repeat: 'weekly', days: [1, 2, 3, 4, 5], points: 20, difficulty: 'hard' })],
     weekdayISOs.map((d) => done('school', d, 20)));
is('five weekdays banked', store.basePointsEarned('k1'), 100);
is('hard bonus is 50%', store.bonusPointsTotal('k1'), 50);

console.log('\n— the bonus percentage is configurable —');
store.setStreakBonus('hard', 80);
is('slider change re-prices the bonus', store.bonusPointsTotal('k1'), 80);
store.setStreakBonus('hard', 0);
is('zero disables the bonus entirely', store.bonusPointsTotal('k1'), 0);

console.log('\n— the current week counts only days that have happened —');
const today = new Date();
const elapsed = weekDays(thisWeek).filter((d) => d <= toISO(today));
seed([chore('daily10')], elapsed.map((d) => done('daily10', d, 10)));
const live = store.activeStreaks('k1')[0];
is('every elapsed day is done', [live.done, live.dueSoFar], [elapsed.length, elapsed.length]);
is('still on track', live.onTrack, true);
is('the week spans 7 days', live.dueTotal, 7);
is('bonus not paid until the week finishes', live.complete, elapsed.length === 7);

console.log('\n— points earned this week include the bonus —');
seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
is('last week total is base + bonus', store.pointsEarnedSince('k1', lastWeek), 88);
is('this week is empty', store.pointsEarnedSince('k1', thisWeek), 0);

console.log('\n— archiving keeps a week already completed —');
seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
store.archiveChore('daily10');
is('bonus survives archiving the chore', store.bonusPointsTotal('k1'), 18);


console.log('\n— not having done today\'s chore yet is not a broken streak —');
{
  const elapsed = weekDays(thisWeek).filter((d) => d <= toISO(new Date()));
  const beforeToday = elapsed.slice(0, -1);
  seed([chore('daily10')], beforeToday.map((d) => done('daily10', d, 10)));
  const live = store.activeStreaks('k1')[0];
  is('streak is not broken', live.broken, false);
  is('still counted as on track', live.onTrack, true);
  is('today is flagged as outstanding', [live.todayDue, live.todayDone], [true, false]);
}

console.log('\n— missing a day that already passed does break it —');
{
  const elapsed = weekDays(thisWeek).filter((d) => d <= toISO(new Date()));
  if (elapsed.length >= 2) {
    seed([chore('daily10')], elapsed.slice(1).map((d) => done('daily10', d, 10)));
    const live = store.activeStreaks('k1')[0];
    is('streak reported as broken', live.broken, true);
    is('and no longer on track', live.onTrack, false);
  } else {
    console.log('  skip  (today is the first day of the week — no past day to miss)');
  }
}

console.log('\n— per-day detail lines up with the week —');
{
  seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
  const past = store.choreWeekStreak(store.getState().chores[0], 'k1', lastWeek);
  is('seven days described', past.days.length, 7);
  is('every one marked done', past.days.every((d) => d.done), true);
  is('all in the past', past.days.every((d) => d.past), true);
}


/* ---- streak savers ------------------------------------------------------- */

console.log('\n— a flawless week earns a saver —');
seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
is('one saver available', store.saversAvailable('k1'), 1);
is('the week is flawless', store.weeklyBonuses('k1')[0].flawless, true);

console.log('\n— a saver repairs a 6/7 week and the bonus lands —');
{
  const days = weekDays(lastWeek);
  seed([chore('daily10')], days.slice(1).map((d) => done('daily10', d, 10)));
  is('no saver, no bonus', store.bonusPointsTotal('k1'), 0);
  store.getState().saverGrants.push({ id: 'g1', kidId: 'k1', createdAt: days[0] });
  is('granted saver is available', store.saversAvailable('k1'), 1);
  const res = store.applySaver('k1', 'daily10', days[0]);
  is('saver applies', res.ok, true);
  is('saver is spent', store.saversAvailable('k1'), 0);
  // 6 real days x 10 = 60 base; medium 25% => 15 bonus. The covered day earns nothing.
  is('bonus computed on real work only', store.bonusPointsTotal('k1'), 15);
  const week = store.weeklyBonuses('k1')[0];
  is('repaired week is complete but not flawless', [week.complete, week.flawless], [true, false]);
  is('a repaired week does not earn a saver back', store.saversAvailable('k1'), 0);
}

console.log('\n— savers refuse invalid days —');
{
  const days = weekDays(lastWeek);
  seed([chore('daily10')], days.slice(1).map((d) => done('daily10', d, 10)));
  store.getState().saverGrants.push({ id: 'g1', kidId: 'k1', createdAt: days[0] });
  is('cannot repair a day already done', store.applySaver('k1', 'daily10', days[1]).ok, false);
  is('cannot repair today or the future', store.applySaver('k1', 'daily10', toISO(new Date())).ok, false);
  is('cannot repair ancient history', store.applySaver('k1', 'daily10', toISO(addDays(lastWeek, -14))).ok, false);
  store.applySaver('k1', 'daily10', days[0]);
  is('cannot cover the same day twice', store.applySaver('k1', 'daily10', days[0]).ok, false);
}
{
  seed([chore('daily10')], []);
  is('no savers means no repair', store.applySaver('k1', 'daily10', toISO(lastWeek)).ok, false);
}
{
  seed([chore('weekly1', { repeat: 'weekly', days: [lastWeek.getDay()] })], []);
  store.getState().saverGrants.push({ id: 'g1', kidId: 'k1', createdAt: 'x' });
  const offDay = toISO(addDays(lastWeek, 1));
  is('cannot repair a day the chore was not due', store.applySaver('k1', 'weekly1', offDay).ok, false);
}

console.log('\n— rescue offers surface last week\'s near-misses —');
{
  const days = weekDays(lastWeek);
  seed([chore('daily10')], days.slice(1).map((d) => done('daily10', d, 10)));
  is('no saver, no offer', store.rescueCandidates('k1').length, 0);
  store.getState().saverGrants.push({ id: 'g1', kidId: 'k1', createdAt: days[0] });
  const offers = store.rescueCandidates('k1');
  is('one rescue offered', offers.length, 1);
  is('it names the missed day', offers[0].firstMissedDate, days[0]);
  store.applySaver('k1', 'daily10', days[0]);
  is('offer disappears once repaired', store.rescueCandidates('k1').length, 0);
}
{
  const days = weekDays(lastWeek);
  seed([chore('daily10')], days.slice(2).map((d) => done('daily10', d, 10)));
  store.getState().saverGrants.push({ id: 'g1', kidId: 'k1', createdAt: days[0] });
  is('two missed days is not a one-saver rescue', store.rescueCandidates('k1').length, 0);
}

console.log('\n— celebrations are shown once —');
{
  seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
  const fresh = store.unseenBonuses('k1');
  is('new bonus awaits celebration', fresh.length, 1);
  store.markCelebrated('k1', fresh);
  is('celebrated bonus stays seen', store.unseenBonuses('k1').length, 0);
}

console.log('\n— last week recap adds up —');
{
  seed([chore('daily10')], weekDays(lastWeek).map((d) => done('daily10', d, 10)));
  const r = store.lastWeekRecap('k1');
  is('recap totals base + bonus', [r.base, r.bonus, r.points, r.perfect], [70, 18, 88, 1]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
