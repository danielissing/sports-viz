(function() {
  var App = window.StravaApp;
  var chart = null;
  var currentMode = 'count';

  function init() {
    var controlsEl = document.getElementById('controls-breakdown');
    if (!controlsEl || controlsEl.children.length > 0) return;

    controlsEl.innerHTML =
      '<button class="chart-toggle-btn active" data-mode="count">By Count</button>' +
      '<button class="chart-toggle-btn" data-mode="distance">By Distance</button>';

    controlsEl.querySelectorAll('.chart-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentMode = btn.dataset.mode;
        controlsEl.querySelectorAll('.chart-toggle-btn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.mode === currentMode);
        });
        render();
      });
    });
  }

  function render() {
    var container = document.getElementById('chart-breakdown');
    if (!container) return;

    var filtered = App.getFilteredActivities();
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    // Aggregate by sport type
    var sportData = {};
    filtered.forEach(function(a) {
      if (!sportData[a.type]) sportData[a.type] = { count: 0, distance: 0 };
      sportData[a.type].count++;
      sportData[a.type].distance += a.distance;
    });

    var sorted = Object.entries(sportData).sort(function(a, b) {
      return currentMode === 'count' ? b[1].count - a[1].count : b[1].distance - a[1].distance;
    });

    var labels = sorted.map(function(e) { return e[0]; });
    var values = sorted.map(function(e) {
      return currentMode === 'count' ? e[1].count : +(e[1].distance / 1000).toFixed(1);
    });
    var colors = labels.map(function(l) { return App.getSportColor(l); });

    // Ensure canvas exists
    if (!container.querySelector('canvas')) {
      container.innerHTML = '<canvas></canvas>';
    }
    var canvas = container.querySelector('canvas');

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { padding: 15, usePointStyle: true, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                var pct = ((ctx.raw / total) * 100).toFixed(1);
                var suffix = currentMode === 'count' ? ' activities' : ' km';
                return ctx.label + ': ' + ctx.raw + suffix + ' (' + pct + '%)';
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
