(function() {
  var App = window.StravaApp;
  var chart = null;
  var granularity = null; // null = auto-detect
  var userOverrodeGranularity = false;
  var metric = 'distance';
  var viewMode = 'stacked'; // 'stacked', 'yoy', or 'ytd'
  var localDateRange = { from: null, to: null };
  var presetInstalled = false;
  var selectedSport = ''; // '' = all sports

  function getLocalFiltered() {
    return App.filterActivitiesByDateRange(App.activities, localDateRange);
  }

  function applySportFilter(activities) {
    if (!selectedSport) return activities;
    return activities.filter(function(a) { return a.type === selectedSport; });
  }

  function getSmartGranularity() {
    if (userOverrodeGranularity && granularity) return granularity;
    var filtered = getLocalFiltered();
    if (filtered.length === 0) return 'monthly';
    var dates = filtered.map(function(a) { return new Date(a.start_date_local).getTime(); });
    var spanMs = Math.max.apply(null, dates) - Math.min.apply(null, dates);
    var spanYears = spanMs / (365.25 * 24 * 60 * 60 * 1000);
    if (spanYears > 5) return 'yearly';
    if (spanYears > 2) return 'monthly';
    return 'monthly';
  }

  function buildSportDropdown(filtered) {
    var controlsEl = document.getElementById('controls-volume');
    if (!controlsEl) return;

    var sportCounts = {};
    filtered.forEach(function(a) {
      sportCounts[a.type] = (sportCounts[a.type] || 0) + 1;
    });
    var sportList = Object.keys(sportCounts).sort(function(a, b) {
      return sportCounts[b] - sportCounts[a];
    });

    if (selectedSport && sportList.indexOf(selectedSport) === -1) {
      selectedSport = '';
    }

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

    select.innerHTML = '';
    var allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All sports';
    if (!selectedSport) allOpt.selected = true;
    select.appendChild(allOpt);

    sportList.forEach(function(sport) {
      var opt = document.createElement('option');
      opt.value = sport;
      opt.textContent = sport + ' (' + sportCounts[sport] + ')';
      if (sport === selectedSport) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function init() {
    var controlsEl = document.getElementById('controls-volume');
    if (!controlsEl || presetInstalled) return;
    presetInstalled = true;

    var effectiveGran = getSmartGranularity();

    // Date range dropdown
    var storageKey = 'panel_volume_datePreset';
    var savedPreset = App.loadSetting(storageKey, 'all');

    var presets = [
      { value: '3m', label: '3 months' },
      { value: '6m', label: '6 months' },
      { value: '1y', label: '1 year' },
      { value: '2y', label: '2 years' },
      { value: '5y', label: '5 years' },
      { value: 'all', label: 'All time' }
    ];

    var dateSelectHtml = '<select class="summary-select" id="volumeDateRange">';
    presets.forEach(function(p) {
      dateSelectHtml += '<option value="' + p.value + '"' + (p.value === savedPreset ? ' selected' : '') + '>' + p.label + '</option>';
    });
    dateSelectHtml += '</select>';

    // Metric dropdown
    var metrics = [
      { value: 'distance', label: 'Distance' },
      { value: 'duration', label: 'Duration' },
      { value: 'elevation', label: 'Elevation' },
      { value: 'count', label: 'Count' }
    ];

    var metricSelectHtml = '<select class="summary-select" id="volumeMetric">';
    metrics.forEach(function(m) {
      metricSelectHtml += '<option value="' + m.value + '"' + (m.value === metric ? ' selected' : '') + '>' + m.label + '</option>';
    });
    metricSelectHtml += '</select>';

    // Granularity dropdown
    var grans = [
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' }
    ];

    var granSelectHtml = '<select class="summary-select" id="volumeGranularity">';
    grans.forEach(function(g) {
      granSelectHtml += '<option value="' + g.value + '"' + (g.value === effectiveGran ? ' selected' : '') + '>' + g.label + '</option>';
    });
    granSelectHtml += '</select>';

    controlsEl.innerHTML =
      '<div class="chart-control-group">' + dateSelectHtml + '</div>' +
      '<div class="chart-control-group">' + metricSelectHtml + '</div>' +
      '<div class="chart-control-group" id="volumeGranGroup">' + granSelectHtml + '</div>' +
      '<div class="chart-control-group chart-view-toggle">' +
        '<button class="chart-toggle-btn active" data-view="stacked">Stacked</button>' +
        '<button class="chart-toggle-btn" data-view="yoy">Year-over-Year</button>' +
        '<button class="chart-toggle-btn" data-view="ytd">Cumulative YTD</button>' +
      '</div>';

    // Date range handler
    document.getElementById('volumeDateRange').addEventListener('change', function() {
      var preset = this.value;
      App.saveSetting(storageKey, preset);
      localDateRange = App.computeDateRangeFromPreset(preset);
      render();
    });
    localDateRange = App.computeDateRangeFromPreset(savedPreset);

    // Metric handler
    document.getElementById('volumeMetric').addEventListener('change', function() {
      metric = this.value;
      render();
    });

    // Granularity handler
    document.getElementById('volumeGranularity').addEventListener('change', function() {
      granularity = this.value;
      userOverrodeGranularity = true;
      render();
    });

    controlsEl.querySelectorAll('.chart-view-toggle .chart-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var newMode = this.getAttribute('data-view');
        if (newMode === viewMode) return;

        viewMode = newMode;

        controlsEl.querySelectorAll('.chart-view-toggle .chart-toggle-btn').forEach(function(b) {
          b.classList.toggle('active', b.getAttribute('data-view') === viewMode);
        });

        if (viewMode === 'yoy') {
          var g = getEffectiveGranularity();
          if (g === 'yearly') {
            granularity = 'monthly';
            userOverrodeGranularity = true;
            document.getElementById('volumeGranularity').value = 'monthly';
          }
        }

        updateGranularityVisibility();
        render();
      });
    });
  }

  function updateGranularityVisibility() {
    var granGroup = document.getElementById('volumeGranGroup');
    if (granGroup) {
      granGroup.style.display = viewMode === 'ytd' ? 'none' : '';
    }
  }

  function getEffectiveGranularity() {
    return getSmartGranularity();
  }

  function updateGranularityDropdown() {
    var sel = document.getElementById('volumeGranularity');
    if (sel) sel.value = getEffectiveGranularity();
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
    if (metric === 'count') return 1;
    return activity.total_elevation_gain;
  }

  function getMetricLabel() {
    if (metric === 'distance') return 'Distance (km)';
    if (metric === 'duration') return 'Duration (hours)';
    if (metric === 'count') return 'Activities';
    return 'Elevation (m)';
  }

  function getMetricUnit() {
    if (metric === 'distance') return ' km';
    if (metric === 'duration') return ' h';
    if (metric === 'count') return '';
    return ' m';
  }

  function getCurrentPeriodKey() {
    var now = new Date();
    var fakeActivity = { start_date_local: now.toISOString() };
    return getKeyFn()(fakeActivity);
  }

  function getTodayDayOfYear() {
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    return Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
  }

  function render() {
    var container = document.getElementById('chart-volume');
    if (!container) return;

    var dateFiltered = getLocalFiltered();
    if (dateFiltered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    buildSportDropdown(dateFiltered);

    var filtered = applySportFilter(dateFiltered);
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities for selected sport</div>';
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    if (!userOverrodeGranularity) updateGranularityDropdown();
    updateGranularityVisibility();

    if (viewMode === 'ytd') {
      renderYTD(filtered);
    } else {
      if (!container.querySelector('canvas') || container.querySelector('.ytd-layout')) {
        container.innerHTML = '<canvas></canvas>';
      }
      var canvas = container.querySelector('canvas');
      if (viewMode === 'yoy') {
        renderYoY(canvas, filtered);
      } else {
        renderStacked(canvas, filtered);
      }
    }
  }

  function renderStacked(canvas, filtered) {
    var keyFn = getKeyFn();
    var currentKey = getCurrentPeriodKey();

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

  var todayLinePlugin = {
    id: 'todayLine',
    afterDraw: function(chartInstance) {
      var xScale = chartInstance.scales.x;
      if (!xScale) return;
      var todayDay = getTodayDayOfYear();
      var xPixel = xScale.getPixelForValue(todayDay);
      if (xPixel < xScale.left || xPixel > xScale.right) return;

      var lineColor = App.getCSSVar('--text-secondary', 'rgba(0,0,0,0.35)');
      var textColor = App.getCSSVar('--text-primary', 'rgba(0,0,0,0.5)');
      var ctx = chartInstance.ctx;
      var yScale = chartInstance.scales.y;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.moveTo(xPixel, yScale.top);
      ctx.lineTo(xPixel, yScale.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Today', xPixel, yScale.top - 4);
      ctx.restore();
    }
  };

  function renderYTD(filtered) {
    var container = document.getElementById('chart-volume');
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var currentYear = new Date().getFullYear();
    var todayDay = getTodayDayOfYear();

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

    var yearTotals = {};
    var datasets = sortedYears.map(function(year, i) {
      var entries = years[year].sort(function(a, b) { return a.day - b.day; });

      var dayTotals = {};
      entries.forEach(function(e) {
        dayTotals[e.day] = (dayTotals[e.day] || 0) + e.value;
      });

      var days = Object.keys(dayTotals).map(Number).sort(function(a, b) { return a - b; });
      var cumulative = 0;
      var ytdCumulative = 0;
      var data = days.map(function(day) {
        cumulative += dayTotals[day];
        if (day <= todayDay) ytdCumulative = cumulative;
        return { x: day, y: +cumulative.toFixed(2) };
      });

      var isCurrent = parseInt(year) === currentYear;
      var lastDay = data.length > 0 ? data[data.length - 1].x : 0;
      var endDay = isCurrent ? todayDay : 365;
      if (lastDay < endDay) {
        data.push({ x: endDay, y: +cumulative.toFixed(2) });
      }

      yearTotals[year] = {
        total: Math.round(cumulative),
        ytd: Math.round(ytdCumulative),
        color: yearColors[i % yearColors.length]
      };

      var yearIndex = sortedYears.length - 1 - sortedYears.indexOf(year);
      var opacity = isCurrent ? 1.0 : (yearIndex <= 1 ? 0.7 : (yearIndex <= 3 ? 0.5 : 0.35));
      var color = yearColors[i % yearColors.length];

      var borderColor;
      if (opacity < 1) {
        var alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
        borderColor = color + alphaHex;
      } else {
        borderColor = color;
      }

      return {
        label: year,
        data: data,
        borderColor: borderColor,
        backgroundColor: 'transparent',
        borderWidth: isCurrent ? 3 : 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 8
      };
    });

    container.innerHTML =
      '<div class="ytd-layout">' +
        '<div class="ytd-chart"><canvas></canvas></div>' +
        '<div class="ytd-summary"></div>' +
      '</div>';

    var summaryEl = container.querySelector('.ytd-summary');
    var unit = getMetricUnit();
    var tableHtml = '<table class="ytd-table">';
    tableHtml += '<thead><tr><th>Year</th><th>YTD</th><th>Total</th></tr></thead><tbody>';
    sortedYears.slice().reverse().forEach(function(year) {
      var t = yearTotals[year];
      var isCurrent = parseInt(year) === currentYear;
      var rowClass = isCurrent ? ' class="ytd-current-year"' : '';
      tableHtml += '<tr' + rowClass + '>';
      tableHtml += '<td><span class="ytd-color-dot" style="background:' + t.color + '"></span>' + year + '</td>';
      tableHtml += '<td class="record-value">' + t.ytd.toLocaleString() + unit + '</td>';
      tableHtml += '<td class="record-value">' + (isCurrent ? '\u2014' : t.total.toLocaleString() + unit) + '</td>';
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
      },
      plugins: [todayLinePlugin]
    });
    App.charts.volume = chart;
  }

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
