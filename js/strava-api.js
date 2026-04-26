(function() {
  var App = window.StravaApp;

  App.refreshAccessToken = async function(clientId, clientSecret, refreshToken) {
    var resp;
    if (App.config) {
      // Shared mode: POST to Worker (adds secret server-side)
      resp = await fetch(App.config.workerUrl + '/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
    } else {
      // Manual mode: direct to Strava with full credentials
      var body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });
      resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        body: body
      });
    }
    if (!resp.ok) {
      var text = await resp.text();
      throw new Error('Token refresh failed (' + resp.status + '): ' + text);
    }
    var data = await resp.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at
    };
  };

  App.normalizeActivity = function(raw) {
    return {
      id: raw.id,
      name: raw.name || 'Untitled',
      type: raw.type || 'Unknown',
      sport_type: raw.sport_type || raw.type || 'Unknown',
      start_date: raw.start_date,
      start_date_local: raw.start_date_local || raw.start_date,
      distance: raw.distance || 0,
      moving_time: raw.moving_time || 0,
      elapsed_time: raw.elapsed_time || 0,
      total_elevation_gain: raw.total_elevation_gain || 0,
      average_speed: raw.average_speed || 0,
      max_speed: raw.max_speed || 0,
      average_heartrate: raw.average_heartrate || null,
      max_heartrate: raw.max_heartrate || null,
      manual: raw.manual || false,
      trainer: raw.trainer || false,
      polyline: (raw.map && raw.map.summary_polyline) ? raw.map.summary_polyline : null
    };
  };

  // afterEpoch: Unix timestamp (seconds). 0 = fetch entire history.
  App.fetchActivities = async function(accessToken, afterEpoch, onProgress) {
    var activities = [];
    var page = 1;
    var perPage = 100;

    var authHeaders = { 'Authorization': 'Bearer ' + accessToken };

    if (onProgress) onProgress(0, 100, 'Testing access token...');

    var testResponse = await fetch('https://www.strava.com/api/v3/athlete', { headers: authHeaders });
    if (!testResponse.ok) throw new Error('Invalid or expired access token');
    var athlete = await testResponse.json();

    if (onProgress) onProgress(10, 100, 'Loading activities for ' + athlete.firstname + '...');

    var hasMore = true;
    while (hasMore) {
      var url = 'https://www.strava.com/api/v3/athlete/activities?page=' + page +
                '&per_page=' + perPage + '&after=' + afterEpoch;
      var response = await fetch(url, { headers: authHeaders });
      if (!response.ok) {
        if (response.status === 429) {
          // Persist whatever we have so far before throwing
          if (onProgress) onProgress(-1, 100, 'Rate limited — ' + activities.length + ' activities saved so far.');
          throw new Error('Rate limit exceeded. ' + activities.length + ' activities were saved. Wait 15 minutes and click Sync New.');
        }
        throw new Error('Failed to fetch activities (' + response.status + ')');
      }
      var pageActivities = await response.json();
      if (!pageActivities || pageActivities.length === 0) { hasMore = false; break; }

      var normalized = pageActivities.map(function(raw) {
        return App.normalizeActivity(raw);
      });

      // Persist each page immediately to IndexedDB
      if (App.storage) {
        await App.storage.putActivities(normalized);
      }

      activities = activities.concat(normalized);

      var progressPercent = Math.min(10 + (page * 10), 90);
      if (onProgress) onProgress(progressPercent, 100, 'Loaded ' + activities.length + ' activities (page ' + page + ')...');

      if (pageActivities.length < perPage) {
        hasMore = false;
      } else {
        page++;
        await new Promise(function(r) { setTimeout(r, 200); });
      }
      if (page > 50) hasMore = false;
    }

    if (onProgress) onProgress(100, 100, 'Loaded ' + activities.length + ' activities!');
    return activities;
  };
})();
