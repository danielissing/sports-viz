# Sports Viz

A browser-based dashboard for visualizing your Strava activity data — heatmap, training stats, personal bests, and more. No server required; everything runs client-side from a single HTML file.

## First-time setup

1. **Create a Strava API application** at https://www.strava.com/settings/api (set the "Authorization Callback Domain" to `localhost`). Note your **Client ID** and **Client Secret**.
2. **Run the authorization script once** to grant activity permissions and get your refresh token:
   ```
   python refresh_tokens.py
   ```
   It will open your browser for OAuth authorization and print the refresh token when done.
3. **Open `strava-viz.html`** in your browser, enter your Client ID, Client Secret, and Refresh Token, check **"Remember credentials"**, and click **Load Activities**.

That's it — you won't need to run the script again. The app automatically refreshes your access token on each load using the stored refresh token.

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
