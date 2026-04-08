(function() {
  var App = window.StravaApp;
  var chart = null;

  function init() {
    var controlsEl = document.getElementById('controls-character');
    if (!controlsEl || controlsEl.dataset.init) return;
    controlsEl.dataset.init = 'true';
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

    // Group by sport type
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

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
