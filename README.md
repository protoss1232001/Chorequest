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

**The child chooses the reward.** The parent stocks the store and sets the
prices; the kid browses it, sees exactly how far off each item is, and decides
what to spend on. That is a shop, not a payout.

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
2. Add each child (name, avatar, colour).
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
| **Deleting a chore** | Archives it. Points already earned from it stay put. |
| **Deleting a child** | Removes their history with them. |

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
- **The PIN is not security.** It stops a curious eight-year-old, nothing more.
- **Clearing Safari's website data erases everything.** Take a backup first.
  (Installing to the Home Screen makes this considerably less likely.)
- **No notifications.** iOS web apps can do push when installed, but it is not
  wired up here.

## If this ever goes to the App Store

The natural next step is to wrap this same codebase with
[Capacitor](https://capacitorjs.com), which produces a real Xcode project
without a rewrite. That needs a Mac, an Apple Developer account ($99/year), and
a privacy policy. If it is listed in the Kids Category, the no-IAP and
no-outbound-links rules above become hard requirements — which is why the app is
already built to respect them.
