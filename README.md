# Sports Viz

A browser-based dashboard for visualizing your Strava activity data — heatmap, training stats, personal bests, and more. No server required; everything runs client-side from a single HTML file.

## First-time setup

1. **Create a Strava API application** at https://www.strava.com/settings/api.
   - Set the **Authorization Callback Domain** to match where you'll host the app (e.g. `localhost`, `<username>.github.io`, or your custom domain).
   - Note your **Client ID** and **Client Secret**.
2. **Open `index.html`** in your browser (or visit the deployed GitHub Pages URL).
3. Enter your **Client ID** and **Client Secret**, then click **Connect with Strava**.
4. Authorize the app on Strava — you'll be redirected back and your activities will load automatically.

That's it — credentials are saved in localStorage and your access token refreshes automatically on each visit.

### Alternative: manual token entry

If you already have a refresh token (e.g. from the `refresh_tokens.py` script), you can paste it directly into the Refresh Token field and click **Load All Activities** instead of using the Connect button.

## Features

### Map tab
- Personal activity heatmap (a Strava Summit feature, for free)
- Filter by sport type and time range
- Line and heatmap visualization modes
- Multiple map styles (street, satellite, terrain, light, dark, outdoors)
- Adjustable line opacity and width

### Stats dashboard
- **Activity Breakdown** — doughnut snapshot or stacked area over time, with small sports grouped as "Other"
- **Training Volume** — stacked bar (weekly/monthly/yearly), Year-over-Year comparison, and Cumulative YTD overlay
- **Personal Bests** — records per sport with Strava links, plus Best Efforts for standard run distances (5K, 10K, HM, Marathon)
- **Activity Character** — bubble chart (distance vs elevation) and Pace Trend scatter with regression lines
- **Streaks & Consistency** — contribution grid and streak stats

All UI settings persist across page reloads via localStorage.
