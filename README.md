# Sports visualizations

A little (and evolving) repo where I upload small scripts and tools to visualize Strava activity data and the like. These tools don't 
belong to any larger project and can all be used independently.

## Strava heatmap

A simple html script to build your own heatmap from Strava activities (a feature that otehrwise requires a premium subscription). You can select the type of sport and how far back you want to go. 

The `refresh_tokens.py` script might be needed to generate a valid access token. You can run it in the console, and it will ask you for your client ID and secret to generate the tokens. The latter can be found at https://www.strava.com/settings/api (you may have to create your own API first).
