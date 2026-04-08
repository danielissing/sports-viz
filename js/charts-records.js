(function() {
  var App = window.StravaApp;

  function init() {
    var controlsEl = document.getElementById('controls-records');
    if (!controlsEl || controlsEl.dataset.init) return;
    controlsEl.dataset.init = 'true';
  }

  function getFlaggedIds() {
    return App.loadSetting('flaggedActivityIds', []);
  }

  function toggleFlag(id) {
    var flagged = getFlaggedIds();
    var idx = flagged.indexOf(id);
    if (idx === -1) flagged.push(id);
    else flagged.splice(idx, 1);
    App.saveSetting('flaggedActivityIds', flagged);
    render();
  }

  function isSuspicious(activity) {
    // Flag runs faster than 2:30/km
    if ((activity.type === 'Run' || activity.type === 'TrailRun' || activity.type === 'VirtualRun') &&
        activity.average_speed > 0) {
      var paceSecPerKm = 1000 / activity.average_speed;
      if (paceSecPerKm < 150) return true;
    }
    // Flag rides faster than 60 km/h avg
    if ((activity.type === 'Ride' || activity.type === 'VirtualRide' || activity.type === 'EBikeRide') &&
        activity.average_speed > 0) {
      if (activity.average_speed * 3.6 > 60) return true;
    }
    return false;
  }

  function render() {
    var container = document.getElementById('chart-records');
    if (!container) return;

    var filtered = App.getFilteredActivities();
    var flagged = getFlaggedIds();

    // Exclude flagged activities from records calculation
    var clean = filtered.filter(function(a) { return flagged.indexOf(a.id) === -1; });

    if (clean.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      return;
    }

    // Group by sport type
    var sports = {};
    clean.forEach(function(a) {
      if (!sports[a.type]) sports[a.type] = [];
      sports[a.type].push(a);
    });

    var html = '<div class="records-table-container">';

    Object.keys(sports).sort().forEach(function(sport) {
      var acts = sports[sport];
      var records = [];

      // Longest distance
      var maxDist = acts.reduce(function(best, a) {
        return a.distance > best.distance ? a : best;
      }, acts[0]);
      if (maxDist.distance > 0) {
        records.push({ metric: 'Longest Distance', value: (maxDist.distance / 1000).toFixed(2) + ' km', activity: maxDist });
      }

      // Longest duration
      var maxDur = acts.reduce(function(best, a) {
        return a.moving_time > best.moving_time ? a : best;
      }, acts[0]);
      if (maxDur.moving_time > 0) {
        records.push({ metric: 'Longest Duration', value: App.formatDurationLong(maxDur.moving_time), activity: maxDur });
      }

      // Most elevation
      var maxElev = acts.reduce(function(best, a) {
        return a.total_elevation_gain > best.total_elevation_gain ? a : best;
      }, acts[0]);
      if (maxElev.total_elevation_gain > 0) {
        records.push({ metric: 'Most Elevation', value: Math.round(maxElev.total_elevation_gain) + ' m', activity: maxElev });
      }

      // Fastest pace (for run types)
      if (sport === 'Run' || sport === 'TrailRun' || sport === 'VirtualRun') {
        var withSpeed = acts.filter(function(a) { return a.average_speed > 0 && a.distance >= 1000; });
        if (withSpeed.length > 0) {
          var fastest = withSpeed.reduce(function(best, a) {
            return a.average_speed > best.average_speed ? a : best;
          }, withSpeed[0]);
          records.push({ metric: 'Fastest Pace', value: App.formatPace(fastest.average_speed), activity: fastest });
        }
      }

      // Highest avg speed (for ride types)
      if (sport === 'Ride' || sport === 'VirtualRide' || sport === 'EBikeRide') {
        var withSpeed2 = acts.filter(function(a) { return a.average_speed > 0 && a.distance >= 1000; });
        if (withSpeed2.length > 0) {
          var fastest2 = withSpeed2.reduce(function(best, a) {
            return a.average_speed > best.average_speed ? a : best;
          }, withSpeed2[0]);
          records.push({ metric: 'Highest Avg Speed', value: App.formatSpeed(fastest2.average_speed), activity: fastest2 });
        }
      }

      if (records.length === 0) return;

      var color = App.getSportColor(sport);
      html += '<div class="records-sport-group">';
      html += '<h4 style="color:' + color + ';border-left:3px solid ' + color + ';padding-left:8px;">' + sport + '</h4>';
      html += '<table class="records-table"><thead><tr><th>Metric</th><th>Value</th><th>Activity</th><th>Date</th><th></th></tr></thead><tbody>';

      records.forEach(function(r) {
        var suspicious = isSuspicious(r.activity);
        var isFlagged = flagged.indexOf(r.activity.id) !== -1;
        html += '<tr' + (suspicious ? ' class="suspicious"' : '') + '>';
        html += '<td>' + r.metric + '</td>';
        html += '<td class="record-value">' + r.value + '</td>';
        html += '<td>' + escapeHtml(r.activity.name) + (suspicious ? ' &#9888;' : '') + '</td>';
        html += '<td>' + new Date(r.activity.start_date).toLocaleDateString() + '</td>';
        html += '<td><button class="flag-btn' + (isFlagged ? ' flagged' : '') + '" data-id="' + r.activity.id + '" title="Flag as GPS error">&#128681;</button></td>';
        html += '</tr>';
      });

      html += '</tbody></table></div>';
    });

    // Show flagged activities if any
    var flaggedInView = filtered.filter(function(a) { return flagged.indexOf(a.id) !== -1; });
    if (flaggedInView.length > 0) {
      html += '<div class="flagged-section"><h4>Flagged Activities (' + flaggedInView.length + ')</h4>';
      html += '<div class="flagged-list">';
      flaggedInView.forEach(function(a) {
        html += '<span class="flagged-item">' + escapeHtml(a.name) +
          ' <button class="flag-btn flagged" data-id="' + a.id + '">&#128681;</button></span>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach flag button listeners
    container.querySelectorAll('.flag-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleFlag(parseInt(btn.dataset.id));
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
