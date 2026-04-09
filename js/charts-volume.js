(function() {
  var App = window.StravaApp;
  var chart = null;
  var granularity = null; // null = auto-detect
  var userOverrodeGranularity = false;
  var metric = 'distance';
  var yoyMode = false;
  var ytdMode = false;

  function getSmartGranularity() {
    if (userOverrodeGranularity && granularity) return granularity;
    // Auto-detect based on filtered data span
    var filtered = App.getFilteredActivities();
    if (filtered.length === 0) return 'monthly';
    var dates = filtered.map(function(a) { return new Date(a.start_date_local).getTime(); });
    var spanMs = Math.max.apply(null, dates) - Math.min.apply(null, dates);
    var spanYears = spanMs / (365.25 * 24 * 60 * 60 * 1000);
    if (spanYears > 5) return 'yearly';
    if (spanYears > 2) return 'monthly';
    return 'monthly';
  }

  function init() {
    var controlsEl = document.getElementById('controls-volume');
    if (!controlsEl || controlsEl.children.length > 0) return;

    var effectiveGran = getSmartGranularity();

    controlsEl.innerHTML =
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn' + (effectiveGran === 'weekly' ? ' active' : '') + '" data-gran="weekly">Weekly</button>' +
        '<button class="chart-toggle-btn' + (effectiveGran === 'monthly' ? ' active' : '') + '" data-gran="monthly">Monthly</button>' +
        '<button class="chart-toggle-btn' + (effectiveGran === 'yearly' ? ' active' : '') + '" data-gran="yearly">Yearly</button>' +
      '</div>' +
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn active" data-metric="distance">Distance</button>' +
        '<button class="chart-toggle-btn" data-metric="duration">Duration</button>' +
        '<button class="chart-toggle-btn" data-metric="elevation">Elevation</button>' +
      '</div>' +
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn" id="yoyToggle">Year-over-Year</button>' +
        '<button class="chart-toggle-btn" id="ytdToggle">Cumulative YTD</button>' +
      '</div>';

    controlsEl.querySelectorAll('[data-gran]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        granularity = btn.dataset.gran;
        userOverrodeGranularity = true;
        controlsEl.querySelectorAll('[data-gran]').forEach(function(b) {
          b.classList.toggle('active', b.dataset.gran === granularity);
        });
        render();
      });
    });

    controlsEl.querySelectorAll('[data-metric]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        metric = btn.dataset.metric;
        controlsEl.querySelectorAll('[data-metric]').forEach(function(b) {
          b.classList.toggle('active', b.dataset.metric === metric);
        });
        render();
      });
    });

    document.getElementById('yoyToggle').addEventListener('click', function() {
      yoyMode = !yoyMode;
      if (yoyMode) {
        ytdMode = false;
        document.getElementById('ytdToggle').classList.remove('active');
        // YoY with "Yearly" granularity is meaningless (1 point per year) — auto-switch to monthly
        var g = getEffectiveGranularity();
        if (g === 'yearly') {
          granularity = 'monthly';
          userOverrodeGranularity = true;
          controlsEl.querySelectorAll('[data-gran]').forEach(function(b) {
            b.classList.toggle('active', b.dataset.gran === 'monthly');
          });
        }
      }
      this.classList.toggle('active', yoyMode);
      render();
    });

    document.getElementById('ytdToggle').addEventListener('click', function() {
      ytdMode = !ytdMode;
      if (ytdMode) {
        yoyMode = false;
        document.getElementById('yoyToggle').classList.remove('active');
      }
      this.classList.toggle('active', ytdMode);
      render();
    });
  }

  function getEffectiveGranularity() {
    return getSmartGranularity();
  }

  function getKeyFn() {
    var g = getEffectiveGranularity();
    if (g === 'weekly') return function(a) { return App.getWeekKey(a.start_date_local); };
    if (g === 'yearly') return function(a) { return App.getYearKey(a.start_date_local); };
    return function(a) { return App.getMonthKey(a.start_date_local); };
  }

  function getMetricValue(activity) {
    if (metric === 'distance') return activity.distance / 1000;
    if (metric === 'duration') return activity.moving_time / 3600;
    return activity.total_elevation_gain;
  }

  function getMetricLabel() {
    if (metric === 'distance') return 'Distance (km)';
    if (metric === 'duration') return 'Duration (hours)';
    return 'Elevation (m)';
  }

  function getMetricUnit() {
    if (metric === 'distance') return ' km';
    if (metric === 'duration') return ' h';
    return ' m';
  }

  // Get the current period key for partial-period detection
  function getCurrentPeriodKey() {
    var now = new Date();
    var fakeActivity = { start_date_local: now.toISOString() };
    return getKeyFn()(fakeActivity);
  }

  function updateGranularityButtons() {
    var g = getEffectiveGranularity();
    var controlsEl = document.getElementById('controls-volume');
    if (!controlsEl) return;
    controlsEl.querySelectorAll('[data-gran]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.gran === g);
    });
  }

  function render() {
    var container = document.getElementById('chart-volume');
    if (!container) return;

    var filtered = App.getFilteredActivities();
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    // Update granularity buttons to reflect auto-detect
    if (!userOverrodeGranularity) updateGranularityButtons();

    if (ytdMode) {
      // YTD builds its own layout (chart + summary table)
      renderYTD(filtered);
    } else {
      // Non-YTD: ensure plain canvas
      if (!container.querySelector('canvas') || container.querySelector('.ytd-layout')) {
        container.innerHTML = '<canvas></canvas>';
      }
      var canvas = container.querySelector('canvas');
      if (yoyMode) {
        renderYoY(canvas, filtered);
      } else {
        renderStacked(canvas, filtered);
      }
    }
  }

  function renderStacked(canvas, filtered) {
    var keyFn = getKeyFn();
    var currentKey = getCurrentPeriodKey();

    // Group by period and sport
    var buckets = {};
    var sportTypes = new Set();
    filtered.forEach(function(a) {
      var key = keyFn(a);
      if (!buckets[key]) buckets[key] = {};
      if (!buckets[key][a.type]) buckets[key][a.type] = 0;
      buckets[key][a.type] += getMetricValue(a);
      sportTypes.add(a.type);
    });

    var sortedKeys = Object.keys(buckets).sort();
    var isLastCurrent = sortedKeys.length > 0 && sortedKeys[sortedKeys.length - 1] === currentKey;

    var datasets = [];
    sportTypes.forEach(function(sport) {
      var baseColor = App.getSportColor(sport);
      var dataValues = sortedKeys.map(function(key) { return +(buckets[key][sport] || 0).toFixed(2); });

      // Per-bar background colors — last bar gets 40% opacity if it's the current period
      var bgColors;
      if (isLastCurrent) {
        bgColors = dataValues.map(function(_, idx) {
          return idx === sortedKeys.length - 1 ? baseColor + '66' : baseColor;
        });
      } else {
        bgColors = baseColor;
      }

      datasets.push({
        label: sport,
        data: dataValues,
        backgroundColor: bgColors,
        borderWidth: 0
      });
    });

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: sortedKeys, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks: { maxRotation: 45, maxTicksLimit: 20 } },
          y: { stacked: true, title: { display: true, text: getMetricLabel() } }
        },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + getMetricUnit();
              }
            }
          }
        }
      }
    });
    App.charts.volume = chart;
  }

  function renderYoY(canvas, filtered) {
    var g = getEffectiveGranularity();
    var years = {};
    filtered.forEach(function(a) {
      var d = new Date(a.start_date_local);
      var year = d.getFullYear();
      if (!years[year]) years[year] = {};
      var periodKey;
      if (g === 'weekly') {
        var start = new Date(year, 0, 1);
        var diff = d - start;
        periodKey = 'W' + String(Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0');
      } else if (g === 'yearly') {
        periodKey = String(year);
      } else {
        periodKey = String(d.getMonth() + 1).padStart(2, '0');
      }
      if (!years[year][periodKey]) years[year][periodKey] = 0;
      years[year][periodKey] += getMetricValue(a);
    });

    var allPeriods = new Set();
    Object.values(years).forEach(function(y) {
      Object.keys(y).forEach(function(p) { allPeriods.add(p); });
    });
    var sortedPeriods = Array.from(allPeriods).sort();

    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var labels = sortedPeriods.map(function(p) {
      if (g === 'monthly') return monthNames[parseInt(p) - 1] || p;
      return p;
    });

    var yearColors = ['#fc4c02', '#00a9e0', '#00d4aa', '#ff69b4', '#8b4513', '#6495ed', '#dc143c'];
    var sortedYears = Object.keys(years).sort();
    var datasets = sortedYears.map(function(year, i) {
      return {
        label: year,
        data: sortedPeriods.map(function(p) { return +((years[year][p] || 0).toFixed(2)); }),
        borderColor: yearColors[i % yearColors.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0,
        pointRadius: 3
      };
    });

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { title: { display: true, text: getMetricLabel() } }
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + getMetricUnit();
              }
            }
          }
        }
      }
    });
    App.charts.volume = chart;
  }

  function renderYTD(filtered) {
    var container = document.getElementById('chart-volume');
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group activities by year and compute day-of-year + metric
    var years = {};
    filtered.forEach(function(a) {
      var d = new Date(a.start_date_local);
      var year = d.getFullYear();
      if (!years[year]) years[year] = [];
      var startOfYear = new Date(year, 0, 1);
      var dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
      years[year].push({ day: dayOfYear, value: getMetricValue(a) });
    });

    var yearColors = ['#fc4c02', '#00a9e0', '#00d4aa', '#ff69b4', '#8b4513', '#6495ed', '#dc143c'];
    var sortedYears = Object.keys(years).sort();

    var yearTotals = {}; // Track final cumulative per year for the summary table
    var datasets = sortedYears.map(function(year, i) {
      var entries = years[year].sort(function(a, b) { return a.day - b.day; });

      var dayTotals = {};
      entries.forEach(function(e) {
        dayTotals[e.day] = (dayTotals[e.day] || 0) + e.value;
      });

      var days = Object.keys(dayTotals).map(Number).sort(function(a, b) { return a - b; });
      var cumulative = 0;
      var data = days.map(function(day) {
        cumulative += dayTotals[day];
        return { x: day, y: +cumulative.toFixed(2) };
      });

      yearTotals[year] = { total: +cumulative.toFixed(1), color: yearColors[i % yearColors.length] };

      return {
        label: year,
        data: data,
        borderColor: yearColors[i % yearColors.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 8
      };
    });

    // Build layout: chart + summary table side by side
    container.innerHTML =
      '<div class="ytd-layout">' +
        '<div class="ytd-chart"><canvas></canvas></div>' +
        '<div class="ytd-summary"></div>' +
      '</div>';

    // Build summary table
    var summaryEl = container.querySelector('.ytd-summary');
    var unit = getMetricUnit();
    var tableHtml = '<table class="ytd-table">';
    tableHtml += '<thead><tr><th>Year</th><th>Total</th></tr></thead><tbody>';
    sortedYears.slice().reverse().forEach(function(year) {
      var t = yearTotals[year];
      tableHtml += '<tr>';
      tableHtml += '<td><span class="ytd-color-dot" style="background:' + t.color + '"></span>' + year + '</td>';
      tableHtml += '<td class="record-value">' + t.total.toLocaleString() + unit + '</td>';
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    summaryEl.innerHTML = tableHtml;

    var ytdCanvas = container.querySelector('canvas');

    var monthStartDays = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

    if (chart) chart.destroy();
    chart = new Chart(ytdCanvas, {
      type: 'line',
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            min: 1,
            max: 366,
            title: { display: false },
            ticks: {
              callback: function(value) {
                var idx = monthStartDays.indexOf(value);
                if (idx !== -1) return monthNames[idx];
                return '';
              },
              autoSkip: false,
              stepSize: 1,
              maxTicksLimit: 12
            },
            afterBuildTicks: function(axis) {
              axis.ticks = monthStartDays.map(function(d) { return { value: d }; });
            }
          },
          y: {
            title: { display: true, text: getMetricLabel() + ' (cumulative)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function(items) {
                if (!items.length) return '';
                var dayNum = items[0].raw.x;
                var d = new Date(2024, 0, dayNum);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              },
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.raw.y.toFixed(1) + getMetricUnit();
              }
            }
          }
        }
      }
    });
    App.charts.volume = chart;
  }

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
