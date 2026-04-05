# Sports visualizations

A little (and evolving) repo where I upload small scripts and tools to visualize Strava activity data and the like. These tools don't belong to any larger project and can all be used independently.

## Strava heatmap

A single-file HTML app that builds a personal heatmap from your Strava activities — a feature that otherwise requires a premium subscription. You can filter by sport type, time range, map style, and toggle between line and heatmap visualizations.

### First-time setup

1. **Create a Strava API application** at https://www.strava.com/settings/api (set the "Authorization Callback Domain" to `localhost`). Note your **Client ID** and **Client Secret**.
2. **Run the authorization script once** to grant activity permissions and get your refresh token:
   ```
   python refresh_tokens.py
   ```
   It will open your browser for OAuth authorization and print the refresh token when done.
3. **Open `strava-heatmap.html`** in your browser, enter your Client ID, Client Secret, and Refresh Token, check **"Remember credentials"**, and click **Load Activities**.

That's it — you won't need to run the script again. The heatmap automatically refreshes your access token on each load using the stored refresh token.

### Features

- Filter by sport type and time range
- Line and heatmap visualization modes
- Multiple map styles (street, satellite, terrain, light, dark, outdoors)
- Adjustable line opacity and width
- All UI settings (credentials, map style, sliders, sport selections) persist across page reloads via localStorage
