(function() {
  var App = window.StravaApp;
  var chart = null;
  var currentView = 'character'; // 'character' | 'pace'

  function init() {
    var controlsEl = document.getElementById('controls-character');
    if (!controlsEl || controlsEl.children.length > 0) return;

    controlsEl.innerHTML =
      '<div class="chart-control-group">' +
        '<button class="chart-toggle-btn active" data-view="character">Character</button>' +
        '<button class="chart-toggle-btn" data-view="pace">Pace Trend</button>' +
      '</div>';

    controlsEl.querySelectorAll('[data-view]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentView = btn.dataset.view;
        controlsEl.querySelectorAll('[data-view]').forEach(function(b) {
          b.classList.toggle('active', b.dataset.view === currentView);
        });
        render();
      });
    });
  }

  function linearRegression(points) {
    var n = points.length;
    if (n < 2) return null;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
      sumXY += points[i].x * points[i].y;
      sumXX += points[i].x * points[i].x;
    }
    var denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    var slope = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;
    return { slope: slope, intercept: intercept };
  }

  function isRunType(type) {
    return type === 'Run' || type === 'TrailRun' || type === 'VirtualRun';
  }

  function render() {
    var container = document.getElementById('chart-character');
    if (!container) return;

    var filtered = App.getFilteredActivities().filter(function(a) {
      return a.distance > 0 && !a.manual;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    if (!container.querySelector('canvas')) {
      container.innerHTML = '<canvas></canvas>';
    }
    var canvas = container.querySelector('canvas');

    if (currentView === 'pace') {
      renderPaceTrend(canvas, filtered);
    } else {
      renderBubble(canvas, filtered);
    }
  }

  function renderBubble(canvas, filtered) {
    var sports = {};
    filtered.forEach(function(a) {
      if (!sports[a.type]) sports[a.type] = [];
      sports[a.type].push(a);
    });

    var datasets = Object.keys(sports).map(function(sport) {
      var color = App.getSportColor(sport);
      return {
        label: sport,
        data: sports[sport].map(function(a) {
          return {
            x: +(a.distance / 1000).toFixed(2),
            y: Math.round(a.total_elevation_gain),
            r: Math.max(3, Math.min(20, Math.sqrt(a.moving_time / 60))),
            _name: a.name,
            _duration: App.formatDuration(a.moving_time)
          };
        }),
        backgroundColor: color + '80',
        borderColor: color,
        borderWidth: 1
      };
    });

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'bubble',
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'Distance (km)' },
            beginAtZero: true
          },
          y: {
            title: { display: true, text: 'Elevation Gain (m)' },
            beginAtZero: true
          }
        },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true } },
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

  function renderPaceTrend(canvas, filtered) {
    var withSpeed = filtered.filter(function(a) {
      return a.average_speed > 0 && a.distance >= 500;
    });

    if (withSpeed.length === 0) {
      var container = document.getElementById('chart-character');
      container.innerHTML = '<div class="chart-empty">No activities with pace data</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    // Determine if all sports are run types (for axis reversal)
    var sportTypes = {};
    withSpeed.forEach(function(a) { sportTypes[a.type] = true; });
    var allRuns = Object.keys(sportTypes).every(isRunType);

    var sports = {};
    withSpeed.forEach(function(a) {
      if (!sports[a.type]) sports[a.type] = [];
      sports[a.type].push(a);
    });

    var datasets = [];
    Object.keys(sports).forEach(function(sport) {
      var color = App.getSportColor(sport);
      var usesPace = isRunType(sport);

      var data = sports[sport].map(function(a) {
        var dateMs = new Date(a.start_date_local).getTime();
        var yVal;
        if (usesPace) {
          yVal = (1000 / a.average_speed) / 60; // min/km
        } else {
          yVal = a.average_speed * 3.6; // km/h
        }
        return {
          x: dateMs,
          y: +yVal.toFixed(3),
          _name: a.name,
          _date: new Date(a.start_date_local).toLocaleDateString(),
          _pace: usesPace ? App.formatPace(a.average_speed) : App.formatSpeed(a.average_speed),
          _dist: (a.distance / 1000).toFixed(1) + ' km'
        };
      });

      datasets.push({
        label: sport,
        data: data,
        backgroundColor: color + '99',
        borderColor: color,
        borderWidth: 0,
        pointRadius: 4,
        pointHoverRadius: 6,
        showLine: false
      });

      // Linear regression trend line
      if (data.length >= 2) {
        var reg = linearRegression(data);
        if (reg) {
          var xMin = data.reduce(function(m, d) { return d.x < m ? d.x : m; }, data[0].x);
          var xMax = data.reduce(function(m, d) { return d.x > m ? d.x : m; }, data[0].x);
          datasets.push({
            label: sport + ' trend',
            data: [
              { x: xMin, y: +(reg.slope * xMin + reg.intercept).toFixed(3) },
              { x: xMax, y: +(reg.slope * xMax + reg.intercept).toFixed(3) }
            ],
            borderColor: color,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            showLine: true,
            fill: false
          });
        }
      }
    });

    // Y-axis label
    var hasRuns = Object.keys(sports).some(isRunType);
    var hasNonRuns = Object.keys(sports).some(function(s) { return !isRunType(s); });
    var yLabel;
    if (hasRuns && !hasNonRuns) yLabel = 'Pace (min/km)';
    else if (!hasRuns && hasNonRuns) yLabel = 'Speed (km/h)';
    else yLabel = 'Pace (min/km) / Speed (km/h)';

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'scatter',
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            title: { display: true, text: 'Date' },
            time: { unit: 'month', tooltipFormat: 'MMM yyyy' }
          },
          y: {
            title: { display: true, text: yLabel },
            reverse: allRuns
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              filter: function(item) {
                return item.text.indexOf(' trend') === -1;
              }
            }
          },
          tooltip: {
            filter: function(item) {
              return item.dataset.label.indexOf(' trend') === -1;
            },
            callbacks: {
              label: function(ctx) {
                var d = ctx.raw;
                return d._name + ' \u2014 ' + d._date + ', ' + d._pace + ', ' + d._dist;
              }
            }
          }
        }
      }
    });
    App.charts.character = chart;
  }

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
