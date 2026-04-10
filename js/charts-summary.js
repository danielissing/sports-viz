(function() {
  var App = window.StravaApp;
  var initialized = false;

  function getAvailableYears() {
    var years = {};
    App.activities.forEach(function(a) {
      var y = new Date(a.start_date_local).getFullYear();
      years[y] = true;
    });
    return Object.keys(years).sort().reverse();
  }

  function init() {
    var controlsEl = document.getElementById('controls-summary');
    if (!controlsEl || controlsEl.children.length > 0) return;

    var years = getAvailableYears();

    var yearOpts = '<option value="all">All Time</option>';
    years.forEach(function(y) {
      yearOpts += '<option value="' + y + '">' + y + '</option>';
    });

    controlsEl.innerHTML =
      '<select class="summary-select" id="summaryYear">' + yearOpts + '</select>';

    document.getElementById('summaryYear').addEventListener('change', render);
    initialized = true;
  }

  function render() {
    var container = document.getElementById('chart-summary');
    if (!container) return;

    var yearVal = document.getElementById('summaryYear').value;

    // Filter by year only (this panel has its own filter, independent of global filters)
    var filtered = App.activities;
    if (yearVal !== 'all') {
      var year = parseInt(yearVal);
      filtered = App.activities.filter(function(a) {
        return new Date(a.start_date_local).getFullYear() === year;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities for this period.</div>';
      return;
    }

    // Compute totals
    var totalDistance = 0;
    var totalTime = 0;
    var totalElevation = 0;

    filtered.forEach(function(a) {
      totalDistance += a.distance || 0;
      totalTime += a.moving_time || 0;
      totalElevation += a.total_elevation_gain || 0;
    });

    // Build summary stats
    var html = '<h4 class="summary-section-title">All Activities</h4>';
    html += '<table class="summary-stats-table"><tbody>';
    html += statRow('Activities', filtered.length.toLocaleString());
    html += statRow('Distance', (totalDistance / 1000).toFixed(1) + ' km');
    html += statRow('Time', formatLongDuration(totalTime));
    html += statRow('Elevation', Math.round(totalElevation).toLocaleString() + ' m');
    html += '</tbody></table>';

    // Per-sport breakdown
    var sportStats = {};
    filtered.forEach(function(a) {
      if (!sportStats[a.type]) sportStats[a.type] = { count: 0, distance: 0, time: 0, elevation: 0 };
      var s = sportStats[a.type];
      s.count++;
      s.distance += a.distance || 0;
      s.time += a.moving_time || 0;
      s.elevation += a.total_elevation_gain || 0;
    });

    var totalCount = filtered.length;
    var sorted = Object.entries(sportStats).sort(function(a, b) { return b[1].count - a[1].count; });

    html += '<h4 class="summary-section-title">By Sport</h4>';
    html += '<table class="summary-breakdown-table">';
    html += '<thead><tr><th>Sport</th><th>Count</th><th>Distance</th><th>Time</th><th>Elev.</th></tr></thead>';
    html += '<tbody>';
    sorted.forEach(function(entry) {
      var sport = entry[0];
      var s = entry[1];
      var color = App.getSportColor(sport);
      var pct = totalCount > 0 ? (s.count / totalCount * 100).toFixed(1) : '0';
      html += '<tr>' +
        '<td><span class="summary-color-dot" style="background:' + color + '"></span>' + sport + '</td>' +
        '<td>' + s.count + ' <span class="summary-pct">(' + pct + '%)</span></td>' +
        '<td>' + (s.distance / 1000).toFixed(1) + ' km</td>' +
        '<td>' + App.formatDuration(s.time) + '</td>' +
        '<td>' + Math.round(s.elevation).toLocaleString() + ' m</td>' +
        '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
  }

  function statRow(label, value) {
    return '<tr>' +
      '<td class="summary-label">' + label + '</td>' +
      '<td class="summary-value">' + value + '</td>' +
      '</tr>';
  }

  function formatLongDuration(seconds) {
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  App.on('updateCharts', function() {
    if (!initialized) {
      init();
    }
    render();
  });
})();
