# Sip 💧 — Water & Liquid Tracker

A small personal web app to track how much liquid you drink each day, hit a daily
goal (default **2 L / 2000 ml**), and earn rewards.

**Live:** https://mimi0320mje.github.io/water-tracker/
(Open on your iPhone → Share → **Add to Home Screen** to use it like an app.)

## Features

- **Filling cup** — an empty glass fills up as you approach your daily goal.
- **Log any drink** — pick a drink, type the amount in ml. Calories are estimated from
  each drink's calories-per-100 ml. Use **"Other"** to add a custom drink on the fly.
- **All liquids count** fully toward the daily goal.
- **Points** — reach your goal in a day = **+1 point**. Points add up across days.
- **Wish list** — add your own rewards with a point cost, then **claim** them
  (claiming spends points). Claimed rewards are kept in a history log.
- **Editable** — drinks, the daily goal, and the cup color can all be changed.
- **Saved on your device** (browser `localStorage`) — no account, free, private.
- **Installable** — "Add to Home Screen" on iPhone for an app-like experience.

## Run it

Just open `index.html` in a browser:

```
open index.html
```

For full PWA / "Add to Home Screen" behaviour, use the hosted GitHub Pages link
(served over https).

## Files

- `index.html` — all screens (Home / Drinks / Rewards / Settings)
- `styles.css` — design tokens + responsive layout (phone-first, desktop two-column)
- `app.js` — state, storage, cup rendering, points & rewards logic
- `manifest.json`, `sw.js`, `icons/` — PWA install + offline support

## Note

Data lives in one browser on one device. Clearing browser data wipes it, and it does
not yet sync between phone and laptop (a possible later enhancement).
