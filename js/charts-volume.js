(function() {
  var App = window.StravaApp;
  var chart = null;
  var granularity = 'monthly';
  var metric = 'distance';
  var yoyMode = false;
  var ytdMode = false;

  function init() {
    var controlsEl = document.getElementById('controls-volume');
    if (!controlsEl || controlsEl.children.length > 0) return;

    controlsEl.innerHTML =
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn" data-gran="weekly">Weekly</button>' +
        '<button class="chart-toggle-btn active" data-gran="monthly">Monthly</button>' +
        '<button class="chart-toggle-btn" data-gran="yearly">Yearly</button>' +
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

  function getKeyFn() {
    if (granularity === 'weekly') return function(a) { return App.getWeekKey(a.start_date_local); };
    if (granularity === 'yearly') return function(a) { return App.getYearKey(a.start_date_local); };
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

  function render() {
    var container = document.getElementById('chart-volume');
    if (!container) return;

    var filtered = App.getFilteredActivities();
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    if (!container.querySelector('canvas')) {
      container.innerHTML = '<canvas></canvas>';
    }
    var canvas = container.querySelector('canvas');

    if (ytdMode) {
      renderYTD(canvas, filtered);
    } else if (yoyMode) {
      renderYoY(canvas, filtered);
    } else {
      renderStacked(canvas, filtered);
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
    var years = {};
    filtered.forEach(function(a) {
      var d = new Date(a.start_date_local);
      var year = d.getFullYear();
      if (!years[year]) years[year] = {};
      var periodKey;
      if (granularity === 'weekly') {
        var start = new Date(year, 0, 1);
        var diff = d - start;
        periodKey = 'W' + String(Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0');
      } else if (granularity === 'yearly') {
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
      if (granularity === 'monthly') return monthNames[parseInt(p) - 1] || p;
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
        tension: 0.3,
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

  function renderYTD(canvas, filtered) {
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group activities by year and compute day-of-year + metric
    var years = {};
    filtered.forEach(function(a) {
      var d = new Date(a.start_date_local);
      var year = d.getFullYear();
      if (!years[year]) years[year] = [];
      // Day of year: 1-based
      var startOfYear = new Date(year, 0, 1);
      var dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
      years[year].push({ day: dayOfYear, value: getMetricValue(a) });
    });

    // For each year, sort by day and compute cumulative sum
    var yearColors = ['#fc4c02', '#00a9e0', '#00d4aa', '#ff69b4', '#8b4513', '#6495ed', '#dc143c'];
    var sortedYears = Object.keys(years).sort();

    var datasets = sortedYears.map(function(year, i) {
      var entries = years[year].sort(function(a, b) { return a.day - b.day; });

      // Aggregate by day first (multiple activities on same day)
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

    // Month-start day numbers for x-axis ticks
    var monthStartDays = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
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
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              title: function(items) {
                if (!items.length) return '';
                var dayNum = items[0].raw.x;
                // Approximate month/day from day number
                var d = new Date(2024, 0, dayNum); // use leap year for safety
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
