(function() {
  var App = window.StravaApp;
  var chart = null;
  var currentView = 'character'; // 'character' | 'typical'
  var selectedSport = null;
  var localDateRange = { from: null, to: null };
  var logScale = false;
  var presetInstalled = false;

  function getLocalFiltered() {
    return App.filterActivitiesByDateRange(App.activities, localDateRange);
  }

  function mean(arr) {
    if (arr.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }

  function getSportsFromFiltered(filtered) {
    var sports = {};
    filtered.forEach(function(a) {
      if (a.distance > 0 && !a.manual) {
        if (!sports[a.type]) sports[a.type] = [];
        sports[a.type].push(a);
      }
    });
    return sports;
  }

  function buildControls(sports) {
    var controlsEl = document.getElementById('controls-character');
    if (!controlsEl) return;

    var sportList = Object.keys(sports).sort(function(a, b) {
      return sports[b].length - sports[a].length;
    });

    if (!selectedSport || sportList.indexOf(selectedSport) === -1) {
      selectedSport = sportList[0] || null;
    }

    // Build/update view toggles (only once, keep if present)
    var viewGroup = controlsEl.querySelector('.view-toggle-group');
    if (!viewGroup) {
      viewGroup = document.createElement('div');
      viewGroup.className = 'chart-control-group view-toggle-group';
      viewGroup.innerHTML =
        '<button class="chart-toggle-btn' + (currentView === 'character' ? ' active' : '') + '" data-cview="character">Character</button>' +
        '<button class="chart-toggle-btn' + (currentView === 'typical' ? ' active' : '') + '" data-cview="typical">Typical</button>';
      viewGroup.querySelectorAll('[data-cview]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          currentView = btn.dataset.cview;
          viewGroup.querySelectorAll('[data-cview]').forEach(function(b) {
            b.classList.toggle('active', b.dataset.cview === currentView);
          });
          updateScaleToggleVisibility();
          render();
        });
      });
      controlsEl.appendChild(viewGroup);
    }

    // Log scale toggle (only relevant for Character scatter view)
    var scaleGroup = controlsEl.querySelector('.scale-toggle-group');
    if (!scaleGroup) {
      scaleGroup = document.createElement('div');
      scaleGroup.className = 'chart-control-group scale-toggle-group';
      scaleGroup.innerHTML =
        '<button class="chart-toggle-btn active" data-scale="linear">Linear</button>' +
        '<button class="chart-toggle-btn" data-scale="log">Log</button>';
      scaleGroup.querySelectorAll('[data-scale]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          logScale = btn.dataset.scale === 'log';
          scaleGroup.querySelectorAll('[data-scale]').forEach(function(b) {
            b.classList.toggle('active', (b.dataset.scale === 'log') === logScale);
          });
          render();
        });
      });
      controlsEl.appendChild(scaleGroup);
    }
    updateScaleToggleVisibility();

    // Find or create sport dropdown
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

  function updateScaleToggleVisibility() {
    var controlsEl = document.getElementById('controls-character');
    if (!controlsEl) return;
    var scaleGroup = controlsEl.querySelector('.scale-toggle-group');
    if (scaleGroup) {
      scaleGroup.style.display = currentView === 'character' ? '' : 'none';
    }
  }

  function initPresets() {
    var controlsEl = document.getElementById('controls-character');
    if (!controlsEl || presetInstalled) return;
    presetInstalled = true;

    localDateRange = App.createDatePresetControls(controlsEl, 'character', function(range) {
      localDateRange = range;
      render();
    });
  }

  function render() {
    var container = document.getElementById('chart-character');
    if (!container) return;

    var filtered = getLocalFiltered();
    var sports = getSportsFromFiltered(filtered);

    if (Object.keys(sports).length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      var ctrl = document.getElementById('controls-character');
      if (ctrl) {
        var select = ctrl.querySelector('.sport-select');
        if (select) select.remove();
      }
      return;
    }

    buildControls(sports);

    if (!selectedSport || !sports[selectedSport]) {
      container.innerHTML = '<div class="chart-empty">Select a sport</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    var acts = sports[selectedSport];

    if (currentView === 'typical') {
      // Typical builds its own layout (chart + stats box)
      renderTypical(acts);
    } else {
      // Ensure plain canvas for non-typical views
      if (!container.querySelector('canvas') || container.querySelector('.typical-layout')) {
        container.innerHTML = '<canvas></canvas>';
      }
      var canvas = container.querySelector('canvas');
      renderBubble(canvas, acts);
    }
  }

  function renderBubble(canvas, acts) {
    var color = App.getSportColor(selectedSport);
    var count = acts.length;
    var alphaHex = count > 500 ? '40' : '80';
    var maxRadius = count > 500 ? 12 : 20;

    var dataset = {
      label: selectedSport,
      data: acts.map(function(a) {
        return {
          x: +(a.distance / 1000).toFixed(2),
          y: Math.round(a.total_elevation_gain),
          r: Math.max(2, Math.min(maxRadius, Math.sqrt(a.moving_time / 60))),
          _name: a.name,
          _duration: App.formatDuration(a.moving_time)
        };
      }),
      backgroundColor: color + alphaHex,
      borderColor: color,
      borderWidth: count > 500 ? 0.5 : 1
    };

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'bubble',
      data: { datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: logScale ? 'logarithmic' : 'linear',
            title: { display: true, text: 'Distance (km)' },
            beginAtZero: !logScale,
            min: logScale ? 0.1 : undefined
          },
          y: {
            type: logScale ? 'logarithmic' : 'linear',
            title: { display: true, text: 'Elevation Gain (m)' },
            beginAtZero: !logScale,
            min: logScale ? 1 : undefined
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var d = ctx.raw;
                return d._name + ' \u2014 ' + d.x + ' km, ' + d.y + ' m elev, ' + d._duration;
              }
            }
          }
        }
      }
    });
    App.charts.character = chart;
  }

  function computeAllTimeAverages(acts) {
    var distances = [], durations = [], paces = [], elevations = [];
    var usesPace = App.isRunType(selectedSport);
    acts.forEach(function(a) {
      distances.push(a.distance / 1000);
      durations.push(a.moving_time);
      elevations.push(a.total_elevation_gain);
      if (a.average_speed > 0 && a.distance >= 500) {
        if (usesPace) {
          paces.push((1000 / a.average_speed) / 60);
        } else {
          paces.push(a.average_speed * 3.6);
        }
      }
    });
    return {
      distance: mean(distances),
      duration: mean(durations),
      elevation: mean(elevations),
      pace: paces.length > 0 ? mean(paces) : null,
      count: acts.length,
      usesPace: usesPace
    };
  }

  function getPeriodLabel() {
    if (!localDateRange.from && !localDateRange.to) return 'All-Time';
    var presetKey = App.loadSetting('panel_character_datePreset', 'all');
    var labels = { '3m': 'Last 3 Months', '6m': 'Last 6 Months', '1y': 'Last Year', '2y': 'Last 2 Years', '5y': 'Last 5 Years', 'all': 'All-Time' };
    return labels[presetKey] || 'Selected Period';
  }

  function buildSummaryBox(stats) {
    var html = '<div class="typical-stat-group">';
    html += '<h5>' + getPeriodLabel() + ' Average ' + selectedSport + '</h5>';
    html += '<div class="typical-stat-row"><span class="label">Activities</span><span class="value">' + stats.count + '</span></div>';
    html += '<div class="typical-stat-row"><span class="label">Distance</span><span class="value">' + stats.distance.toFixed(1) + ' km</span></div>';
    html += '<div class="typical-stat-row"><span class="label">Duration</span><span class="value">' + App.formatDuration(stats.duration) + '</span></div>';
    html += '<div class="typical-stat-row"><span class="label">Elevation</span><span class="value">' + Math.round(stats.elevation) + ' m</span></div>';
    if (stats.pace !== null) {
      if (stats.usesPace) {
        var totalSec = stats.pace * 60;
        var min = Math.floor(totalSec / 60);
        var sec = Math.floor(totalSec % 60);
        html += '<div class="typical-stat-row"><span class="label">Pace</span><span class="value">' + min + ':' + String(sec).padStart(2, '0') + '/km</span></div>';
      } else {
        html += '<div class="typical-stat-row"><span class="label">Speed</span><span class="value">' + stats.pace.toFixed(1) + ' km/h</span></div>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderTypical(acts) {
    var container = document.getElementById('chart-character');

    // Group by quarter (YYYY-Q#) and compute averages
    var quarters = {};
    acts.forEach(function(a) {
      var d = new Date(a.start_date_local);
      var q = Math.floor(d.getMonth() / 3) + 1;
      var key = d.getFullYear() + '-Q' + q;
      if (!quarters[key]) quarters[key] = { distances: [], durations: [], elevations: [] };
      quarters[key].distances.push(a.distance / 1000);
      quarters[key].durations.push(a.moving_time / 60);
      quarters[key].elevations.push(a.total_elevation_gain);
    });

    var sortedKeys = Object.keys(quarters).sort();

    var avgDist = sortedKeys.map(function(k) { return +mean(quarters[k].distances).toFixed(1); });
    var avgDur = sortedKeys.map(function(k) { return +mean(quarters[k].durations).toFixed(0); });
    var counts = sortedKeys.map(function(k) { return quarters[k].distances.length; });

    var color = App.getSportColor(selectedSport);

    // Build layout: chart + summary box
    var periodStats = computeAllTimeAverages(acts);
    container.innerHTML =
      '<div class="typical-layout">' +
        '<div class="typical-chart"><canvas></canvas></div>' +
        '<div class="typical-summary">' + buildSummaryBox(periodStats) + '</div>' +
      '</div>';

    var canvas = container.querySelector('canvas');

    var datasets = [
      {
        label: 'Avg Distance (km)',
        data: avgDist,
        borderColor: color,
        backgroundColor: color + '33',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 3
      },
      {
        label: 'Avg Duration (min)',
        data: avgDur,
        borderColor: App.getCSSVar('--text-secondary', '#666'),
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 3],
        tension: 0.3,
        pointRadius: 3
      }
    ];

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: { labels: sortedKeys, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { maxRotation: 45, maxTicksLimit: 16 } },
          y: {
            title: { display: true, text: 'Distance (km) / Duration (min)' }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterTitle: function(items) {
                if (!items.length) return '';
                var idx = items[0].dataIndex;
                return counts[idx] + ' activities';
              }
            }
          }
        }
      }
    });
    App.charts.character = chart;
  }

  // Expose pure functions for testing
  if (window._test) {
    window._test.character = {
      mean: mean,
      getSportsFromFiltered: getSportsFromFiltered
    };
  }

  App.on('updateCharts', function() {
    initPresets();
    render();
  });
})();
