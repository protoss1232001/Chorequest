/* ==========================================================================
   ChoreQuest — the kid's side of the app.
   Three tabs: what to do today, what you can get, and how you're doing.
   ========================================================================== */

import * as store from './store.js';
import { ICONS } from './icons.js';
import {
  esc, pts, plural, todayISO, friendlyDate, greeting, buzz, toast, celebrate,
  openSheet, confirmSheet, clamp,
} from './util.js';

/* --------------------------------------------------------------------------
   Small shared pieces
   -------------------------------------------------------------------------- */

function progressRing(pct, { size = 68, stroke = 7 } = {}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamp(pct, 0, 100) / 100);
  return `
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"></circle>
      <circle class="ring__value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
    </svg>`;
}

function meter(current, target) {
  const pct = target > 0 ? clamp(Math.round((current / target) * 100), 0, 100) : 0;
  return `
    <div class="meter" role="progressbar" aria-valuenow="${current}" aria-valuemin="0" aria-valuemax="${target}">
      <span style="width:${pct}%"></span>
    </div>`;
}

function kidHeader(kid, subtitle) {
  const bal = store.balance(kid.id);
  return `
    <header class="kid-head">
      <button class="kid-head__switch" data-action="switch-profile" aria-label="Switch profile">
        <span class="avatar avatar--sm">${esc(kid.avatar)}</span>
      </button>
      <div class="kid-head__text">
        <p class="kid-head__eyebrow">${esc(subtitle)}</p>
        <h1>${esc(kid.name)}</h1>
      </div>
      <div class="balance-pill" title="Points you can spend">
        <span class="balance-pill__star">⭐</span>
        <strong>${pts(bal)}</strong>
      </div>
    </header>`;
}

/* --------------------------------------------------------------------------
   Tab 1 — Today
   -------------------------------------------------------------------------- */

function choreRow(chore, kid, dateISO, streak) {
  const done = store.completionFor(chore.id, kid.id, dateISO);
  const state = done ? done.status : 'todo';

  if (state === 'approved') {
    return `
      <li class="chore chore--approved">
        <span class="chore__emoji">${esc(chore.emoji)}</span>
        <span class="chore__body">
          <span class="chore__title">${esc(chore.title)}</span>
          <span class="chore__meta">Approved by a grown-up</span>
        </span>
        <span class="chore__earned">+${pts(done.points)}</span>
      </li>`;
  }

  if (state === 'pending') {
    return `
      <li class="chore chore--pending">
        <span class="chore__emoji">${esc(chore.emoji)}</span>
        <span class="chore__body">
          <span class="chore__title">${esc(chore.title)}</span>
          <span class="chore__meta">⏳ Waiting for a grown-up</span>
        </span>
        <button class="chore__undo" data-action="undo-chore" data-id="${done.id}">Undo</button>
      </li>`;
  }

  return `
    <li>
      <button class="chore chore--todo" data-action="do-chore" data-id="${chore.id}">
        <span class="chore__check" aria-hidden="true"></span>
        <span class="chore__emoji">${esc(chore.emoji)}</span>
        <span class="chore__body">
          <span class="chore__title">${esc(chore.title)}</span>
          <span class="chore__meta">${esc(store.repeatLabel(chore))}${streak
            ? ` · 🔥 ${streak.done}/${streak.dueTotal} this week`
            : ''}</span>
        </span>
        <span class="chore__points">+${pts(chore.points)}</span>
      </button>
    </li>`;
}

function renderToday(kid) {
  const today = todayISO();
  const due = store.choresForKid(kid.id, today);
  const progress = store.todayProgress(kid.id);
  const flame = store.streak(kid.id);
  const allDone = progress.total > 0 && progress.done === progress.total;

  const todo = due.filter((c) => !store.completionFor(c.id, kid.id, today));
  const settled = due.filter((c) => store.completionFor(c.id, kid.id, today));
  const streaks = store.activeStreakMap(kid.id);

  const summary = `
    <section class="card card--summary">
      <div class="summary__ring">
        ${progressRing(progress.pct)}
        <span class="summary__ring-label">${progress.done}<i>/${progress.total}</i></span>
      </div>
      <div class="summary__text">
        <h2>${allDone ? 'All done today! 🎉' : progress.total === 0 ? 'Nothing due today' : `${plural(todo.length, 'chore', 'chores')} to go`}</h2>
        <p>${allDone
          ? 'Every chore is checked off. Nice work.'
          : progress.total === 0
            ? 'Enjoy the day off — check back tomorrow.'
            : `You've earned ${pts(store.accumulation(kid.id).week)} points this week.`}</p>
      </div>
      ${flame > 0 ? `<div class="streak" title="${plural(flame, 'day', 'days')} in a row"><span>🔥</span><strong>${flame}</strong></div>` : ''}
    </section>`;

  const body = due.length === 0
    ? `<div class="empty">
         <span class="empty__art">🌤️</span>
         <h3>No chores today</h3>
         <p>Ask a grown-up to add some in Parent mode.</p>
       </div>`
    : `
      ${todo.length ? `<h3 class="section-title">To do</h3>
        <ul class="chore-list">${todo.map((c) => choreRow(c, kid, today, streaks.get(c.id))).join('')}</ul>` : ''}
      ${settled.length ? `<h3 class="section-title">Done today</h3>
        <ul class="chore-list">${settled.map((c) => choreRow(c, kid, today, streaks.get(c.id))).join('')}</ul>` : ''}`;

  return `
    ${kidHeader(kid, greeting())}
    <div class="scroll-body">
      ${summary}
      ${body}
    </div>`;
}

/* --------------------------------------------------------------------------
   Tab 2 — Rewards. The kid browses and chooses; the parent stocked the shelf.
   -------------------------------------------------------------------------- */

function rewardCard(reward, bal) {
  const affordable = bal >= reward.cost;
  const short = reward.cost - bal;
  const badge = reward.kind === 'giftcard'
    ? `<span class="tag tag--gift">${esc(reward.brand || 'Gift card')}${reward.value ? ` · ${esc(reward.value)}` : ''}</span>`
    : '<span class="tag">Treat</span>';

  return `
    <li>
      <button class="reward ${affordable ? 'reward--ready' : 'reward--locked'}"
        data-action="redeem" data-id="${reward.id}"
        aria-label="${esc(reward.title)}, ${reward.cost} points. ${affordable
          ? 'You can claim this now.'
          : `${short} more points to go.`}">
        <span class="reward__emoji">${esc(reward.emoji)}</span>
        <span class="reward__body">
          <span class="reward__title">${esc(reward.title)}</span>
          ${badge}
          ${affordable
            ? '<span class="reward__status reward__status--ready">You can get this now</span>'
            : `${meter(bal, reward.cost)}
               <span class="reward__status">${pts(short)} more ${short === 1 ? 'point' : 'points'} to go</span>`}
        </span>
        <span class="reward__cost">${pts(reward.cost)}<i>pts</i></span>
      </button>
    </li>`;
}

function renderRewards(kid) {
  const bal = store.balance(kid.id);
  const all = store.rewards();
  const ready = all.filter((r) => bal >= r.cost);
  const saving = all.filter((r) => bal < r.cost);
  const mine = store.redemptionsFor(kid.id).slice(0, 6);

  const body = all.length === 0
    ? `<div class="empty">
         <span class="empty__art">🎁</span>
         <h3>No rewards yet</h3>
         <p>A grown-up can add rewards in Parent mode.</p>
       </div>`
    : `
      ${ready.length ? `<h3 class="section-title">Ready to claim</h3>
        <ul class="reward-list">${ready.map((r) => rewardCard(r, bal)).join('')}</ul>` : ''}
      ${saving.length ? `<h3 class="section-title">Keep saving</h3>
        <ul class="reward-list">${saving.map((r) => rewardCard(r, bal)).join('')}</ul>` : ''}`;

  const history = mine.length ? `
    <h3 class="section-title">Your requests</h3>
    <ul class="mini-list">
      ${mine.map((r) => `
        <li class="mini">
          <span class="mini__emoji">${esc(r.emoji)}</span>
          <span class="mini__body">
            <strong>${esc(r.title)}</strong>
            <em>${friendlyDate(r.createdAt.slice(0, 10))}</em>
          </span>
          <span class="chip chip--${r.status}">${{
            requested: 'Waiting', fulfilled: 'Got it 🎉', declined: 'Not this time',
          }[r.status]}</span>
        </li>`).join('')}
    </ul>` : '';

  return `
    ${kidHeader(kid, 'Reward store')}
    <div class="scroll-body">
      <section class="card card--wallet">
        <p>You have</p>
        <strong>${pts(bal)}</strong>
        <span>points to spend</span>
      </section>
      ${body}
      ${history}
    </div>`;
}

/* --------------------------------------------------------------------------
   Tab 3 — Progress. Week, month and year totals side by side, so a long
   save toward something big is visible instead of resetting every Sunday.
   -------------------------------------------------------------------------- */

function streakRow(s) {
  const pips = s.days.map((d) => {
    const state = d.done ? 'is-done' : d.past ? 'is-missed' : d.isToday ? 'is-today' : '';
    return `<i class="pip ${state}"></i>`;
  }).join('');

  // Missing a day that has already passed breaks the streak. Not having done
  // today's yet is just a nudge.
  const detail = s.complete
    ? `Perfect week! +${pts(s.bonusPoints)} bonus`
    : s.broken
      ? `${s.done} of ${s.dueTotal} days · fresh start next week`
      : s.todayDue && !s.todayDone
        ? `${s.done} of ${s.dueTotal} days · do today's to stay on track`
        : `${s.done} of ${s.dueTotal} days · on track`;

  const state = s.complete ? 'is-complete' : s.broken ? 'is-broken' : 'is-on-track';
  return `
    <li class="streak-row ${state}">
      <span class="streak-row__emoji">${esc(s.emoji)}</span>
      <span class="streak-row__body">
        <strong>${esc(s.title)}</strong>
        <span class="pips">${pips}</span>
        <em>${detail}</em>
      </span>
      <span class="streak-badge diff--${s.difficulty}">+${s.bonusPct}%</span>
    </li>`;
}

function renderProgress(kid) {
  const acc = store.accumulation(kid.id);
  const bal = store.balance(kid.id);
  const flame = store.streak(kid.id);
  const goal = store.nextReward(kid.id);
  const streaks = store.activeStreaks(kid.id);
  const bonuses = store.weeklyBonuses(kid.id);

  // Chores and earned bonuses share one timeline.
  const recent = [
    ...store.getState().completions
      .filter((c) => c.kidId === kid.id && c.status !== 'declined')
      .map((c) => ({ kind: 'chore', date: c.date, emoji: c.emoji, title: c.title, points: c.points, status: c.status })),
    ...bonuses.map((b) => ({
      kind: 'bonus', date: b.earnedOn, emoji: '🔥',
      title: `${b.title} — perfect week`, points: b.bonusPoints, status: 'approved',
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'bonus' ? -1 : 1))
    .slice(0, 12);

  return `
    ${kidHeader(kid, 'Your progress')}
    <div class="scroll-body">
      <section class="card card--wallet">
        <p>Spendable balance</p>
        <strong>${pts(bal)}</strong>
        <span>${pts(acc.lifetime)} points earned all time</span>
      </section>

      <h3 class="section-title">Points earned</h3>
      <div class="stat-grid">
        <div class="stat"><em>This week</em><strong>${pts(acc.week)}</strong></div>
        <div class="stat"><em>This month</em><strong>${pts(acc.month)}</strong></div>
        <div class="stat"><em>This year</em><strong>${pts(acc.year)}</strong></div>
        <div class="stat"><em>Day streak</em><strong>${flame} 🔥</strong></div>
        <div class="stat"><em>Bonus points</em><strong>${pts(store.bonusPointsTotal(kid.id))}</strong></div>
        <div class="stat"><em>Perfect weeks</em><strong>${bonuses.length}</strong></div>
      </div>

      ${streaks.length ? `
        <h3 class="section-title">This week's streaks</h3>
        <p class="section-note">Do a chore every day it's due and you earn bonus points on top.</p>
        <ul class="streak-list">${streaks.map(streakRow).join('')}</ul>` : ''}

      ${goal ? `
        <h3 class="section-title">Saving toward</h3>
        <section class="card card--goal">
          <span class="goal__emoji">${esc(goal.emoji)}</span>
          <div class="goal__body">
            <strong>${esc(goal.title)}</strong>
            ${meter(bal, goal.cost)}
            <em>${pts(bal)} of ${pts(goal.cost)} points · ${pts(goal.cost - bal)} to go</em>
          </div>
        </section>` : ''}

      <h3 class="section-title">Recent activity</h3>
      ${recent.length ? `
        <ul class="mini-list">
          ${recent.map((c) => `
            <li class="mini ${c.kind === 'bonus' ? 'mini--bonus' : ''}">
              <span class="mini__emoji">${esc(c.emoji)}</span>
              <span class="mini__body">
                <strong>${esc(c.title)}</strong>
                <em>${friendlyDate(c.date)}</em>
              </span>
              <span class="chip chip--${c.status}">${c.status === 'approved' ? `+${pts(c.points)}` : 'Waiting'}</span>
            </li>`).join('')}
        </ul>`
      : `<div class="empty empty--sm"><p>Complete a chore and it will show up here.</p></div>`}
    </div>`;
}

/* --------------------------------------------------------------------------
   Assembly
   -------------------------------------------------------------------------- */

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'progress', label: 'Progress' },
];

export function renderKidScreen(kidId, tab = 'today') {
  const kid = store.getKid(kidId);
  if (!kid) return '<div class="empty"><h3>That profile is gone</h3></div>';

  const screen = { today: renderToday, rewards: renderRewards, progress: renderProgress }[tab] || renderToday;

  return `
    <div class="screen screen--kid" style="--kid-accent:${store.kidColorHex(kid)}">
      ${screen(kid)}
      <nav class="tabbar" aria-label="Sections">
        ${TABS.map((t) => `
          <button class="tabbar__item ${t.id === tab ? 'is-active' : ''}"
            data-action="kid-tab" data-tab="${t.id}" aria-current="${t.id === tab ? 'page' : 'false'}">
            <span class="tabbar__icon">${ICONS[t.id]}</span>
            <span class="tabbar__label">${t.label}</span>
          </button>`).join('')}
      </nav>
    </div>`;
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

export async function handleKidAction(action, el, ctx) {
  const kidId = ctx.kidId;

  if (action === 'do-chore') {
    const entry = store.markChoreDone(el.dataset.id, kidId);
    if (entry) {
      buzz([8, 30, 8]);
      const left = store.todayProgress(kidId);
      if (left.total > 0 && left.done === left.total) {
        celebrate();
        toast('Every chore done today! 🎉', 'success');
      } else {
        toast(`Sent for approval · +${pts(entry.points)} pending`, 'success');
      }
    }
    return true;
  }

  if (action === 'undo-chore') {
    store.undoCompletion(el.dataset.id);
    toast('Taken back off the list');
    return true;
  }

  if (action === 'redeem') {
    const reward = store.getReward(el.dataset.id);
    if (!reward) return true;
    const bal = store.balance(kidId);

    if (bal < reward.cost) {
      const short = reward.cost - bal;
      await openSheet({
        title: `${reward.emoji} ${reward.title}`,
        subtitle: `You need ${pts(short)} more ${short === 1 ? 'point' : 'points'}. Keep going — you're at ${pts(bal)} of ${pts(reward.cost)}.`,
        actions: [{ id: 'ok', label: 'Got it', tone: 'plain' }],
      });
      return true;
    }

    const ok = await confirmSheet({
      title: `Get ${reward.emoji} ${reward.title}?`,
      subtitle: `This costs ${pts(reward.cost)} points. You'll have ${pts(bal - reward.cost)} left, and a grown-up will get your request.`,
      confirmLabel: `Spend ${pts(reward.cost)} points`,
    });

    if (ok) {
      const result = store.redeemReward(reward.id, kidId);
      if (result.ok) {
        buzz([10, 40, 10, 40, 20]);
        celebrate(44);
        toast('Request sent to your grown-up! 🎉', 'success');
      } else {
        toast("You don't have enough points for that yet", 'warn');
      }
    }
    return true;
  }

  return false;
}
