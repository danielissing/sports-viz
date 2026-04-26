# Sports Viz

A browser-based dashboard for visualizing your Strava activity data — heatmap, training stats, personal bests, and more. No server required; everything runs client-side from a single HTML file.

## Getting started

1. **Open the app** — visit the deployed GitHub Pages URL (or open `index.html` locally).
2. **Click "Connect with Strava"** — you'll be redirected to Strava to authorize the app.
3. **Done** — your activities load automatically and are cached in IndexedDB for fast reloads.

Your refresh token is saved in localStorage so you stay connected across sessions. Use **Sync New Activities** to pull only what's new since your last load.

### Self-hosting / development

If you want to run your own instance instead of using the shared deployment:

1. **Create a Strava API application** at https://www.strava.com/settings/api.
2. **Deploy a Cloudflare Worker** (see `worker/strava-proxy.js`) with your Client ID and Client Secret as secrets.
3. **Update `js/config.js`** with your own Worker URL and Client ID.
4. Set your **Authorization Callback Domain** in Strava to match where you host the Worker.

## Features

### Map tab
- Personal activity heatmap (a Strava Summit feature, for free)
- Filter by sport type and time range
- Line and heatmap visualization modes
- Multiple map styles (street, satellite, terrain, light, dark, outdoors)
- Adjustable line opacity and width

### Stats dashboard
- **Activity Breakdown** — doughnut snapshot or stacked area over time, with small sports grouped as "Other"
- **Year in Sport** — summary stats for the selected year
- **Training Volume** — stacked bar (weekly/monthly/yearly), Year-over-Year comparison, and Cumulative YTD overlay
- **Personal Bests** — per-sport records (longest distance, longest duration, most elevation, fastest pace / highest speed) with Strava links and suspicious-activity flagging
- **Streaks & Consistency** — contribution grid and streak stats
- **Activity Character** — bubble chart (distance vs elevation) with per-sport typical stats

### Other
- Dark mode (auto-detects system preference, manual toggle in tab bar)
- All UI settings persist across page reloads via localStorage
- Activities cached in IndexedDB with incremental sync support
- Unit tests via `test.html` (zero-dependency test runner)
