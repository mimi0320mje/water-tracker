# Sip — Progress & Next Steps

_Last updated: 2026-06-22_

## Status
Live and working. Deployed to GitHub Pages: https://mimi0320mje.github.io/water-tracker/
Verified on desktop (browser preview) and on the iPhone 17 simulator.

## This session (2026-06-22) — History + cross-device sync
- **History calendar** (new **History** tab): monthly grid over the existing per-day `log`,
  marks days with intake and goal-reached days, tap a day to see its drinks + ml + kcal.
  Works for everyone (guest or logged-in). Verified in light + dark, month nav, day detail.
- **Accounts / cross-device sync** (Settings → Account): default **guest** (device-only,
  unchanged) with **Sign up / Log in**. When logged in, data syncs via **Appwrite** (free
  tier). First login **copies** existing guest data up; returning device adopts the cloud copy.
  - Sync code is isolated in **`cloud.js`** (`window.SipCloud`); `app.js` just calls it.
  - `sw.js` bumped to `sip-v4`; cross-origin (Appwrite) requests bypass the cache.
  - **Setup still required to go live:** follow `SETUP-appwrite.md`, then paste the project
    endpoint + ID into `cloud.js` (`CONFIG`). Until then the app shows "sync isn't set up
    yet" and stays guest-only — no errors. UI fully built + verified in the unconfigured state.

## Done
- Core: filling SVG cup toward a daily **2 L** goal; log drinks by **ml**; calories
  estimated per-100ml; all liquids count fully toward the goal.
- Points: **+1 per goal-day**, cumulative; rewards **wish list** where points are spent on
  claims; **claim history**.
- Single, changeable **cup color**; editable **drinks** and **daily goal**; **"Other"**
  custom-drink entry (optionally saved as a preset).
- PWA: installable ("Add to Home Screen"), works offline.
- Responsive: phone = bottom tab bar; desktop = left side nav.
- Storage: on-device only (`localStorage`), key `sip-data-v1`.

## Fixes applied this session
- **Modal would not close / blocked taps:** `.modal-overlay` had `display:flex` overriding
  the `hidden` attribute. Fixed with `.modal-overlay[hidden] { display:none }`.
- **Add-drink box clipped on short windows:** capped modal height + internal scroll.
- **Updates weren't reaching devices:** service worker switched from cache-first to
  **network-first** (cache bumped to `sip-v2`). Result: the home-screen app auto-updates to
  the latest version whenever it's opened online; offline falls back to the cached copy.

## Verified behaviour
- Desktop: log drinks, calories, reach 2 L → +1 point (no double-count), add reward, claim
  (points subtract + logged), goal/color settings, persistence on reload.
- iPhone 17 simulator: filled the cup to 2,000 ml → "🎉 Goal reached! +1 point", points
  badge → 1. Mobile layout correct.

## Known note (not a bug)
- Typing into the **iOS Simulator** on-screen keyboard triggers accent-picker popups and
  garbles input. This is a simulator host-keyboard quirk, **not** an app problem — typing on
  a real iPhone keyboard works normally.

## NEXT SESSION — finalize UX design (to do)
Open UX items to decide/refine with the user:
- Overall visual polish: cup shape/animation, colors, fonts, spacing.
- Home layout details, celebration animation, empty states.
- (Add specific UX decisions here as they are made.)

## Pending / phase 2 (deferred)
- Replace the seeded default drinks with the user's **real common-drinks list** (with
  calories; user will provide). Defaults currently: Water, Sparkling water, Coffee, Tea,
  Milk, Orange juice, Soda.
- Cross-device **sync** — built this session via Appwrite; needs the one-time
  `SETUP-appwrite.md` step to go live. (No longer device-only once configured.)
- Optional **partial hydration weighting** (e.g. coffee/alcohol counting less than water).
