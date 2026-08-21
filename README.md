# ChoreQuest

A family chore app for iPhone. Parents set up children, chores and a reward
store; kids tick off chores, earn points that **keep accumulating across the
week, month and year**, and choose their own reward once they can afford it.

Built as an installable web app (PWA), so it runs on an iPhone home screen with
no App Store, no developer account and no sign-up.

---

## Why this one is different

The chore-app market is crowded — Greenlight, BusyKid and Modak tie chores to a
real debit card; PointUp, KidKarma and Kikaroo do points and badges. Two things
here are deliberately unlike most of them:

**Points accumulate over a long horizon.** Almost every competitor resets weekly
or converts points straight to cash. ChoreQuest shows *this week*, *this month*
and *this year* side by side, and the spendable balance never resets. Saving for
six months toward something big is the point, not a side effect.

**Consistency is paid for separately.** Points reward doing a chore once.
A *streak bonus* rewards doing it every single day it was due, all week — and
because harder chores are harder to sustain, the bonus scales with difficulty.

**The child chooses the reward.** The parent stocks the store and sets the
prices; the kid browses it, sees exactly how far off each item is, and decides
what to spend on. That is a shop, not a payout.

## Difficulty and streak bonuses

Every chore is rated **Easy, Medium, Hard or Extreme**. The rating does two
things: it suggests a point value, and it sets how much a perfect week is worth.

| Level | Suggested points | Default bonus | Roughly |
|---|---|---|---|
| 🟢 Easy | 5 | +10% | A minute or two — make the bed, feed the cat |
| 🔵 Medium | 10 | +25% | Ten minutes of real effort — clear the table, homework |
| 🟠 Hard | 20 | +50% | Half an hour, or something they resist — tidy the whole room |
| 🔴 Extreme | 40 | +100% | The big one — mow the lawn, deep-clean the bathroom |

A **perfect week** means the chore was done on *every day it was due* that week.
It then pays out that chore's points for the week plus the bonus percentage. A
Medium chore worth 10 points done all seven days earns 70 + 18 = **88**.

Drag the sliders in **Parent mode → Settings → Streak bonuses** to reprice any
level from 0% to 200%. The sliders update live as you drag and save when you let
go. Because bonuses are recalculated from history rather than stored, changing a
rate immediately reprices past weeks too.

Rules that keep it honest:

- A chore due fewer than **3 days a week** can't earn a streak — otherwise a
  once-a-week chore would collect a bonus for being done once.
- One-off chores never streak.
- A day only counts once a parent has **approved** it.
- Missing a day that has **already passed** breaks the streak. Not having done
  *today's* yet does not — the app says "do today's to stay on track" instead.
- Archiving a chore doesn't erase a week the child already completed.
- The bonus lands when the week's last due day is done and approved.

Kids see this on their **Progress** tab as a row per chore with one pip per due
day — filled for done, hollow red for missed, outlined for still to come, and
ring-marked when a saver covered it.

### Streak savers 🛟

Life happens — a sleepover, a sick day — and one missed Tuesday shouldn't erase
a week of effort. A **streak saver** repairs a single missed day so the streak
and its bonus survive:

- Kids **earn one saver for every flawless week** (perfect with no saver used —
  a repaired week doesn't earn one back, or savers would be free).
- Parents can also **grant savers** from the child's editor in Manage → Kids.
- A saver can repair a day in the **current or previous week** only, and only a
  day that was actually due and missed.
- The covered day itself earns **no points** — a saver protects the habit, it
  doesn't fake the work. A repaired 6-of-7 week pays its bonus on the 6 real
  days.
- When last week ended one day short, the Progress tab offers a one-tap
  **Streak rescue** so the near-miss still pays out.

### Celebrations, nudges and badges

- When a perfect week's bonus lands, the child gets a **tap-to-celebrate**
  banner with confetti — once, then it's remembered.
- The Today screen warns when **streaks are on the line today**, so the bonus
  is visible before it's lost rather than after.
- A **badge wall** on Progress marks milestones (first chore, 7- and 30-day
  streaks, perfect weeks, point totals, first reward) — all derived from
  history, so badges can never get out of sync.
- Parents get a **Last week** recap card on the Family tab: points, bonuses and
  perfect weeks per child at a glance.

## Profile locks

Each child can optionally be given their own **4-digit profile lock**, set by
the parent in **Manage → Kids**. Without one, anyone can tap any profile — fine
for a single child or trusting siblings, less so otherwise, since an unlocked
profile lets a sibling tick off someone else's chores or spend their points.

- Leave the field blank for no lock.
- A locked profile shows a 🔒 on the switcher and asks for its PIN on the way in.
- **The parent PIN opens every profile**, so a forgotten child PIN never locks
  anyone out.
- A parent already inside Parent mode is not challenged again when they tap a
  child from the dashboard.

Like the parent PIN, this is a deterrent between siblings, not security — see
*Known limits*.

## How gift cards work

ChoreQuest **never buys, sells, stores or delivers a gift card.** When a child
redeems one, their points are deducted and the parent gets a request in the
Review tab; the parent buys the card themselves and marks it as given. Declining
a request refunds the points automatically.

This is a deliberate design choice, not a missing feature:

- Apple's App Store rules require digital gift cards that are redeemable inside
  an app to be sold through in-app purchase.
- Apple's **Kids Category** bans in-app purchases and outbound links entirely.

Keeping fulfilment in the parent's hands sidesteps both, and keeps the app free
of payment handling.

## Privacy

There is no account, no server and no network request. Everything lives in
`localStorage` on the one device. Because no personal data ever leaves the
phone, the COPPA surface for under-13 users is about as small as it can be.
Backup and restore are manual, from Parent mode → Settings.

---

## Running it

It is plain static files — no build step, no dependencies.

```bash
python3 -m http.server 8099
# then open http://localhost:8099
```

A server is required (ES modules and service workers do not run from `file://`).

### Putting it on an iPhone

1. Host this repository anywhere that serves **HTTPS** — GitHub Pages, Netlify,
   Cloudflare Pages and Vercel all work with zero configuration. See
   *Deploying* below for the one-minute GitHub Pages route.
2. Open the URL in **Safari** on the iPhone (not Chrome — only Safari can
   install a web app on iOS).
3. Tap **Share → Add to Home Screen**.

It then launches full screen with its own icon, runs offline, and behaves like
any other app. The app shows this hint itself the first time it is opened in
iOS Safari.

## First run

1. Tap **Get started** and choose a 4-digit parent PIN.
   The PIN is a soft lock to keep kids out of the settings — it is not
   encryption, and it is stored in plain text alongside everything else.
2. Add each child (name, avatar, colour) — and optionally a 4-digit profile
   lock so siblings can't open each other's profiles.
3. Seven starter chores and six starter rewards are pre-loaded — edit, delete or
   add to them under **Manage**.
4. Hand the phone to a child: **Exit** → tap their face.

## How the points work

| | |
|---|---|
| **Earning** | A kid taps a chore → it goes to *pending* → a parent approves it in Review → the points land. |
| **Point value** | Captured at the moment the chore is done, so editing a chore later never rewrites past earnings. |
| **Spendable balance** | Lifetime approved points − points spent on requested or fulfilled redemptions. |
| **Declined redemption** | Refunds automatically (declined redemptions are excluded from the spend total). |
| **Streak** | Consecutive days with at least one approved chore. Today not being done yet does not break it. |
| **Streak bonus** | Recalculated from history, never stored — so late approvals, declines and changed rates all settle correctly. |
| **Deleting a chore** | Archives it. Points already earned from it stay put. |
| **Deleting a child** | Removes their history with them. |
| **Profile lock** | Optional per child. The parent PIN is a master key for every profile. |
| **Streak saver** | Earned per flawless week or parent-granted. Covers a missed day for the streak; the day still earns no points. |

## Layout

```
├── index.html              app shell
├── styles.css              iOS-flavoured design system, light + dark
├── manifest.webmanifest    home screen metadata
├── sw.js                   service worker (offline)
├── icons/                  generated PNG app icons
└── js/
    ├── app.js              routing, profile switcher, PIN flow
    ├── store.js            state, persistence, all the points maths
    ├── kid.js              Today / Rewards / Progress
    ├── parent.js           PIN gate, approvals, CRUD, settings
    ├── icons.js            tab bar SVGs
    └── util.js             dates, DOM helpers, sheets, toasts
```

`store.js` holds every rule about points; the view modules only read from it.

Run the maths checks with:

```bash
node test/streaks.test.mjs
```

## Deploying to GitHub Pages

The app is static files at the repository root, so no build or workflow is
needed:

1. **Settings → Pages**
2. **Source: Deploy from a branch**
3. **Branch: `main`, folder: `/ (root)`** → Save

A minute later it is live at `https://<user>.github.io/chorequest/`. Open that
in Safari on the iPhone and add it to the Home Screen.

Because every path in the app is relative, it works from a subdirectory like
`/chorequest/` without any configuration change.

## Known limits

- **One device.** No sync between a parent's phone and a child's. Backup and
  restore move data manually.
- **The PINs are not security.** Both the parent PIN and the profile locks are
  stored in plain text alongside everything else. They stop a curious
  eight-year-old, nothing more.
- **Clearing Safari's website data erases everything.** Take a backup first.
  (Installing to the Home Screen makes this considerably less likely.)
- **No notifications.** iOS web apps can do push when installed, but it is not
  wired up here.

## Launching on the App Store and Play Store

See **[STORE.md](./STORE.md)** for the full path: Android via a Trusted Web
Activity (Bubblewrap, no code changes), iPhone via Capacitor (needs a Mac),
the Kids-category rules both stores apply, and the store-required
[privacy policy](./privacy.html) that ships with the app.


