(function() {
  var App = window.StravaApp;
  var selectedSport = null;
  var localDateRange = { from: null, to: null };
  var presetInstalled = false;

  function getLocalFiltered() {
    return App.filterActivitiesByDateRange(App.activities, localDateRange);
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
    if (App.isRunType(activity.type) && activity.average_speed > 0) {
      var paceSecPerKm = 1000 / activity.average_speed;
      if (paceSecPerKm < 150) return true;
    }
    if (App.isRideType(activity.type) && activity.average_speed > 0) {
      if (activity.average_speed * 3.6 > 60) return true;
    }
    return false;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function stravaLink(activityId) {
    return '<a href="https://www.strava.com/activities/' + activityId +
      '" target="_blank" rel="noopener" class="strava-link" title="View on Strava">' +
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
      '<path d="M6.8 11.2L8.8 7.2H5.6L10.4 0L7.2 6.4H10.4L6.8 16L6.8 11.2Z"/>' +
      '</svg></a>';
  }

  function flagButton(activityId, flagged) {
    var isFlagged = flagged.indexOf(activityId) !== -1;
    return '<button class="flag-btn' + (isFlagged ? ' flagged' : '') + '" data-id="' + activityId + '" title="Flag as GPS error">&#128681;</button>';
  }

  function buildRecordRow(r, flagged) {
    var suspicious = isSuspicious(r.activity);
    var html = '<tr' + (suspicious ? ' class="suspicious"' : '') + '>';
    html += '<td>' + r.metric + '</td>';
    html += '<td class="record-value">' + r.value + '</td>';
    html += '<td>' + escapeHtml(r.activity.name) + (suspicious ? ' &#9888;' : '') + '</td>';
    html += '<td>' + new Date(r.activity.start_date).toLocaleDateString() + '</td>';
    html += '<td>' + stravaLink(r.activity.id) + flagButton(r.activity.id, flagged) + '</td>';
    html += '</tr>';
    return html;
  }

  function buildRecords(acts, sport) {
    if (acts.length === 0) return [];
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
    if (App.isRunType(sport)) {
      var withSpeed = acts.filter(function(a) { return a.average_speed > 0 && a.distance >= 1000; });
      if (withSpeed.length > 0) {
        var fastest = withSpeed.reduce(function(best, a) {
          return a.average_speed > best.average_speed ? a : best;
        }, withSpeed[0]);
        records.push({ metric: 'Fastest Pace', value: App.formatPace(fastest.average_speed), activity: fastest });
      }
    }

    // Highest avg speed (for ride types)
    if (App.isRideType(sport)) {
      var withSpeed2 = acts.filter(function(a) { return a.average_speed > 0 && a.distance >= 1000; });
      if (withSpeed2.length > 0) {
        var fastest2 = withSpeed2.reduce(function(best, a) {
          return a.average_speed > best.average_speed ? a : best;
        }, withSpeed2[0]);
        records.push({ metric: 'Highest Avg Speed', value: App.formatSpeed(fastest2.average_speed), activity: fastest2 });
      }
    }

    return records;
  }

  function buildFlaggedSection(filtered, flagged) {
    var flaggedInView = filtered.filter(function(a) { return flagged.indexOf(a.id) !== -1; });
    if (flaggedInView.length === 0) return '';

    var html = '<div class="flagged-section"><h4>Flagged Activities (' + flaggedInView.length + ')</h4>';
    html += '<div class="flagged-list">';
    flaggedInView.forEach(function(a) {
      html += '<span class="flagged-item">' + escapeHtml(a.name) +
        ' <button class="flag-btn flagged" data-id="' + a.id + '">&#128681;</button></span>';
    });
    html += '</div></div>';
    return html;
  }

  function buildSportDropdown(sports) {
    var controlsEl = document.getElementById('controls-records');
    if (!controlsEl) return;

    var sportList = Object.keys(sports).sort(function(a, b) {
      return sports[b].length - sports[a].length;
    });

    if (sportList.length === 0) {
      selectedSport = null;
      return;
    }

    // Keep selection if still valid, otherwise default to most popular
    if (!selectedSport || sportList.indexOf(selectedSport) === -1) {
      selectedSport = sportList[0];
    }

    // Find or create dropdown
    var select = controlsEl.querySelector('.sport-select');
    if (!select) {
      select = document.createElement('select');
      select.className = 'summary-select sport-select';
      select.addEventListener('change', function() {
        selectedSport = select.value;
        render();
      });
      controlsEl.appendChild(select);
    }

    // Rebuild options
    select.innerHTML = '';
    sportList.forEach(function(sport) {
      var opt = document.createElement('option');
      opt.value = sport;
      opt.textContent = sport + ' (' + sports[sport].length + ')';
      if (sport === selectedSport) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function initPresets() {
    var controlsEl = document.getElementById('controls-records');
    if (!controlsEl || presetInstalled) return;
    presetInstalled = true;

    localDateRange = App.createDatePresetControls(controlsEl, 'records', function(range) {
      localDateRange = range;
      render();
    });
  }

  function render() {
    var container = document.getElementById('chart-records');
    if (!container) return;

    var filtered = getLocalFiltered();
    var flagged = getFlaggedIds();
    var clean = filtered.filter(function(a) { return flagged.indexOf(a.id) === -1; });

    if (clean.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      // Remove sport dropdown if present
      var controlsEl = document.getElementById('controls-records');
      if (controlsEl) {
        var select = controlsEl.querySelector('.sport-select');
        if (select) select.remove();
      }
      return;
    }

    // Group by sport type
    var sports = {};
    clean.forEach(function(a) {
      if (!sports[a.type]) sports[a.type] = [];
      sports[a.type].push(a);
    });

    // Build sport dropdown
    buildSportDropdown(sports);

    if (!selectedSport || !sports[selectedSport]) {
      container.innerHTML = '<div class="chart-empty">Select a sport</div>';
      return;
    }

    var acts = sports[selectedSport];
    var records = buildRecords(acts, selectedSport);

    var html = '<div class="records-table-container">';

    if (records.length > 0) {
      html += '<div class="records-sport-group">';
      html += '<table class="records-table"><thead><tr><th>Metric</th><th>Value</th><th>Activity</th><th>Date</th><th></th></tr></thead><tbody>';
      records.forEach(function(r) {
        html += buildRecordRow(r, flagged);
      });
      html += '</tbody></table></div>';
    }

    // Flagged section
    html += buildFlaggedSection(filtered, flagged);

    html += '</div>';
    container.innerHTML = html;

    // Attach flag button listeners
    container.querySelectorAll('.flag-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleFlag(parseInt(btn.dataset.id));
      });
    });
  }

  App.on('updateCharts', function() {
    initPresets();
    render();
  });
})();
