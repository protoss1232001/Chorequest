# Getting ChoreQuest into the App Store and Play Store

The app is a self-contained PWA, which is deliberately the easiest starting
point for both stores. The two paths are different, and Android's is much
shorter — do it first.

## TL;DR

| | Android (Play Store) | iPhone (App Store) |
|---|---|---|
| Wrapper | **TWA via Bubblewrap** — packages the live PWA URL | **Capacitor** — bundles the files into a native shell |
| Machine needed | Any (Linux/Mac/Windows) | **Mac with Xcode** |
| Account cost | $25 one-time | $99 / year |
| Code changes | None | None to start; notifications plugin later |
| Review risk | Low | Medium — see 4.2 note below |

---

## Android: Trusted Web Activity (the short path)

A TWA is Chrome rendering your deployed PWA full-screen inside a store-installable
package. The app stays on GitHub Pages; the store package is a thin pointer.

1. Install [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):
   `npm i -g @bubblewrap/cli`
2. `bubblewrap init --manifest https://protoss1232001.github.io/Chorequest/manifest.webmanifest`
   — accept the defaults; it reads name, icons and colors from the manifest.
3. `bubblewrap build` → produces a signed `.aab`.
4. Host the generated `assetlinks.json` at
   `https://protoss1232001.github.io/.well-known/assetlinks.json`
   (a `protoss1232001.github.io` *user* repo, or move hosting to Netlify/Cloudflare
   which serve `.well-known` from this repo directly). This is what removes the
   browser bar.
5. Create the listing in [Play Console](https://play.google.com/console)
   ($25 one-time), upload the `.aab`.

Play requirements to have ready:
- **Privacy policy URL**: `https://protoss1232001.github.io/Chorequest/privacy.html` (already in the repo).
- **Data safety form**: declare *no data collected, no data shared* — true here.
- **Families policy**: if you target children, opt in to the *Designed for
  Families* program. ChoreQuest already complies: no ads, no IAP, no data
  collection, no external links inside kid screens. You'll self-certify and
  pick a target age group.

## iPhone: Capacitor

iOS has no TWA equivalent; the PWA must be wrapped into a real Xcode project.

1. On a Mac: `npm init -y && npm i @capacitor/core @capacitor/cli`
2. `npx cap init ChoreQuest com.yourname.chorequest --web-dir .`
3. `npx cap add ios` → opens a full Xcode project with this repo as the web root.
4. Join the [Apple Developer Program]() ($99/yr), set the bundle id, archive,
   upload via Xcode.

App Review notes:
- **Guideline 4.2 (minimum functionality)**: Apple sometimes rejects thin web
  wrappers. The counter is native value — add the
  `@capacitor/local-notifications` plugin and wire the daily chore reminder
  (see below); that plus offline support and Face-ID-free local PINs has been
  enough for comparable apps.
- **Kids Category** (optional): if you list under Kids, the existing design
  already satisfies the hard rules — no IAP, no ads, no outbound links in kid
  flows, no data collection. The privacy policy URL is required either way.
- App Privacy "nutrition label": *Data Not Collected* — matches reality.

## The one native feature worth adding first: reminders

The web app cannot wake a phone that hasn't opened it — that needs a native
notification, and it's the single biggest streak-keeping feature a store build
unlocks. With Capacitor (or Bubblewrap's notification delegation):

- **Kid reminder**: "🔥 2 streaks on the line — 3 chores left today" at a
  parent-chosen hour (default 5pm).
- **Parent reminder**: "4 chores waiting for approval" at ~8pm, only when the
  queue is non-empty.

Both are *local* notifications scheduled on-device from data the app already
has — no server, no push infrastructure, and the no-data-leaves-the-device
privacy story stays true.

## Before submitting either store

- [ ] Buy/choose the final app name (ChoreQuest is used by others — check
      trademark comfort or pick a variant).
- [ ] Screenshots: 6.7" and 5.5" for iOS, phone + 7" tablet for Play. Run the
      app in device-sized browser windows and capture the Today, Rewards,
      Progress and slider screens.
- [ ] 1024×1024 store icon (derive from `icons/icon-512.png` source script).
- [ ] Short + long description. Lead with the two differentiators: points
      that accumulate all year, and streak bonuses sized by difficulty.
- [ ] Age rating questionnaires (both stores) — all "no" answers here.
