(function() {
  var App = window.StravaApp;
  var chart = null;
  var currentMode = 'count';
  var normalized = false;
  var localDateRange = { from: null, to: null };
  var presetInstalled = false;

  function getLocalFiltered() {
    return App.filterActivitiesByDateRange(App.activities, localDateRange);
  }

  function init() {
    var controlsEl = document.getElementById('controls-breakdown');
    if (!controlsEl || presetInstalled) return;
    presetInstalled = true;

    controlsEl.innerHTML =
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn active" data-mode="count">By Count</button>' +
        '<button class="chart-toggle-btn" data-mode="distance">By Distance</button>' +
        '<button class="chart-toggle-btn" data-mode="duration">By Duration</button>' +
      '</div>' +
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn active" data-view="stacked">Stacked</button>' +
        '<button class="chart-toggle-btn" data-view="normalized">%</button>' +
      '</div>';

    controlsEl.querySelectorAll('[data-mode]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentMode = btn.dataset.mode;
        controlsEl.querySelectorAll('[data-mode]').forEach(function(b) {
          b.classList.toggle('active', b.dataset.mode === currentMode);
        });
        render();
      });
    });

    controlsEl.querySelectorAll('[data-view]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        normalized = btn.dataset.view === 'normalized';
        controlsEl.querySelectorAll('[data-view]').forEach(function(b) {
          b.classList.toggle('active', (b.dataset.view === 'normalized') === normalized);
        });
        render();
      });
    });

    localDateRange = App.createDatePresetControls(controlsEl, 'breakdown', function(range) {
      localDateRange = range;
      render();
    });
  }

  function getModeValue(sportEntry) {
    if (currentMode === 'count') return sportEntry.count;
    if (currentMode === 'distance') return sportEntry.distance;
    return sportEntry.duration;
  }

  // Group sports contributing <5% of total into "Other"
  function groupWithOther(sportData) {
    var total = 0;
    Object.values(sportData).forEach(function(v) {
      total += getModeValue(v);
    });
    if (total === 0) return sportData;

    var threshold = total * 0.05;
    var grouped = {};
    var otherCount = 0, otherDist = 0, otherDur = 0;

    Object.keys(sportData).forEach(function(sport) {
      var val = getModeValue(sportData[sport]);
      if (val < threshold) {
        otherCount += sportData[sport].count;
        otherDist += sportData[sport].distance;
        otherDur += sportData[sport].duration;
      } else {
        grouped[sport] = {
          count: sportData[sport].count,
          distance: sportData[sport].distance,
          duration: sportData[sport].duration
        };
      }
    });

    if (otherCount > 0) {
      grouped['Other'] = { count: otherCount, distance: otherDist, duration: otherDur };
    }
    return grouped;
  }

  function formatDisplayValue(sport, data) {
    if (currentMode === 'count') return data.count;
    if (currentMode === 'distance') return +(data.distance / 1000).toFixed(1);
    return +(data.duration / 3600).toFixed(1);
  }

  function getModeSuffix() {
    if (currentMode === 'count') return ' activities';
    if (currentMode === 'distance') return ' km';
    return ' hours';
  }

  function getModeYLabel() {
    if (currentMode === 'count') return 'Activities';
    if (currentMode === 'distance') return 'Distance (km)';
    return 'Duration (hours)';
  }

  function render() {
    var container = document.getElementById('chart-breakdown');
    if (!container) return;

    var filtered = getLocalFiltered();
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    if (!container.querySelector('canvas')) {
      container.innerHTML = '<canvas></canvas>';
    }
    var canvas = container.querySelector('canvas');

    renderOverTime(canvas, filtered);
  }

  function renderOverTime(canvas, filtered) {
    // Aggregate totals to determine which sports to group
    var totalBySport = {};
    filtered.forEach(function(a) {
      if (!totalBySport[a.type]) totalBySport[a.type] = { count: 0, distance: 0, duration: 0 };
      totalBySport[a.type].count++;
      totalBySport[a.type].distance += a.distance;
      totalBySport[a.type].duration += a.moving_time;
    });
    var grouped = groupWithOther(totalBySport);
    var keepSports = new Set(Object.keys(grouped));
    keepSports.delete('Other');
    var hasOther = grouped.hasOwnProperty('Other');

    // Group by month and sport
    var buckets = {};
    filtered.forEach(function(a) {
      var key = App.getMonthKey(a.start_date_local);
      if (!buckets[key]) buckets[key] = {};
      var sport = keepSports.has(a.type) ? a.type : 'Other';
      if (!buckets[key][sport]) buckets[key][sport] = { count: 0, distance: 0, duration: 0 };
      buckets[key][sport].count++;
      buckets[key][sport].distance += a.distance;
      buckets[key][sport].duration += a.moving_time;
    });

    var sortedKeys = Object.keys(buckets).sort();

    // Build sport list in consistent order (largest first, Other last)
    var sportOrder = Object.entries(grouped)
      .filter(function(e) { return e[0] !== 'Other'; })
      .sort(function(a, b) {
        return getModeValue(b[1]) - getModeValue(a[1]);
      })
      .map(function(e) { return e[0]; });
    if (hasOther) sportOrder.push('Other');

    // Compute raw values per sport per month
    var rawData = {};
    sportOrder.forEach(function(sport) {
      rawData[sport] = sortedKeys.map(function(key) {
        var bucket = buckets[key][sport];
        if (!bucket) return 0;
        return formatDisplayValue(sport, bucket);
      });
    });

    // Compute column totals for normalization
    var columnTotals = sortedKeys.map(function(_, i) {
      var total = 0;
      sportOrder.forEach(function(sport) { total += rawData[sport][i]; });
      return total;
    });

    var datasets = sportOrder.map(function(sport) {
      var color = App.getSportColor(sport);
      var data = normalized
        ? rawData[sport].map(function(v, i) {
            return columnTotals[i] > 0 ? +(v / columnTotals[i] * 100).toFixed(1) : 0;
          })
        : rawData[sport];
      return {
        label: sport,
        data: data,
        backgroundColor: color + 'B3',
        borderColor: color,
        borderWidth: 1,
        fill: 'origin',
        tension: 0.3,
        pointRadius: 0
      };
    });

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: { labels: sortedKeys, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: { maxRotation: 45, maxTicksLimit: 20 }
          },
          y: {
            stacked: true,
            max: normalized ? 100 : undefined,
            title: { display: true, text: normalized ? 'Share (%)' : getModeYLabel() },
            ticks: normalized ? { callback: function(v) { return v + '%'; } } : {}
          }
        },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } },
          tooltip: {
            mode: 'index',
            callbacks: {
              label: function(ctx) {
                if (normalized) return ctx.dataset.label + ': ' + ctx.raw + '%';
                return ctx.dataset.label + ': ' + ctx.raw + getModeSuffix();
              }
            }
          }
        }
      }
    });
    App.charts.breakdown = chart;
  }

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
