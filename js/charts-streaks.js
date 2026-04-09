(function() {
  var App = window.StravaApp;
  var selectedYear = 'last12'; // 'last12' or a year string like '2024'

  function init() {
    var controlsEl = document.getElementById('controls-streaks');
    if (!controlsEl || controlsEl.dataset.init) return;
    controlsEl.dataset.init = 'true';
  }

  function getYearsInData(filtered) {
    var years = {};
    filtered.forEach(function(a) {
      var y = new Date(a.start_date_local).getFullYear();
      years[y] = true;
    });
    return Object.keys(years).sort().reverse();
  }

  function renderYearSelector(container, filtered) {
    var years = getYearsInData(filtered);
    var selectorEl = container.querySelector('.year-selector');
    if (!selectorEl) {
      selectorEl = document.createElement('div');
      selectorEl.className = 'year-selector';
      container.insertBefore(selectorEl, container.firstChild);
    }
    selectorEl.innerHTML = '';

    // "Last 12mo" button
    var last12Btn = document.createElement('button');
    last12Btn.className = 'year-selector-btn' + (selectedYear === 'last12' ? ' active' : '');
    last12Btn.textContent = 'Last 12mo';
    last12Btn.addEventListener('click', function() {
      selectedYear = 'last12';
      render();
    });
    selectorEl.appendChild(last12Btn);

    // Year buttons
    years.forEach(function(year) {
      var btn = document.createElement('button');
      btn.className = 'year-selector-btn' + (selectedYear === year ? ' active' : '');
      btn.textContent = year;
      btn.addEventListener('click', function() {
        selectedYear = year;
        render();
      });
      selectorEl.appendChild(btn);
    });
  }

  function render() {
    var container = document.getElementById('chart-streaks');
    if (!container) return;

    var filtered = App.getFilteredActivities();
    if (filtered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      return;
    }

    // Unique active days (using local date)
    var activeDays = new Set();
    filtered.forEach(function(a) {
      activeDays.add(App.getDayKey(a.start_date_local));
    });

    var sortedDays = Array.from(activeDays).sort();

    // Calculate longest streak
    var longestStreak = 1;
    var tempStreak = 1;
    for (var i = 1; i < sortedDays.length; i++) {
      var prev = new Date(sortedDays[i - 1]);
      var curr = new Date(sortedDays[i]);
      var diff = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
      if (diff === 1) {
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    if (sortedDays.length === 0) longestStreak = 0;

    // Current streak (from today backwards)
    var currentStreak = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayKey = today.toISOString().slice(0, 10);
    var yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    var yesterdayKey = yesterday.toISOString().slice(0, 10);

    if (activeDays.has(todayKey) || activeDays.has(yesterdayKey)) {
      currentStreak = 1;
      var checkDate = activeDays.has(todayKey) ? new Date(today) : new Date(yesterday);
      while (true) {
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        var key = checkDate.toISOString().slice(0, 10);
        if (activeDays.has(key)) currentStreak++;
        else break;
      }
    }

    // Weekly consistency (weeks with 3+ activities)
    var weekCounts = {};
    filtered.forEach(function(a) {
      var wk = App.getWeekKey(a.start_date_local);
      weekCounts[wk] = (weekCounts[wk] || 0) + 1;
    });
    var totalWeeks = Object.keys(weekCounts).length;
    var consistentWeeks = Object.values(weekCounts).filter(function(c) { return c >= 3; }).length;
    var consistency = totalWeeks > 0 ? Math.round((consistentWeeks / totalWeeks) * 100) : 0;

    // Build HTML
    var html = '<div class="streaks-content">';

    // Stats cards
    html += '<div class="streak-stats">';
    html += '<div class="streak-stat-card"><div class="streak-stat-value">' + currentStreak + '</div><div class="streak-stat-label">Current Streak (days)</div></div>';
    html += '<div class="streak-stat-card"><div class="streak-stat-value">' + longestStreak + '</div><div class="streak-stat-label">Longest Streak (days)</div></div>';
    html += '<div class="streak-stat-card"><div class="streak-stat-value">' + consistency + '%</div><div class="streak-stat-label">Weekly Consistency (3+ days)</div></div>';
    html += '</div>';

    // Contribution grid (for selected year only)
    html += renderContributionGrid(filtered);

    html += '</div>';
    container.innerHTML = html;

    // Add year selector above the grid
    renderYearSelector(container, filtered);
  }

  function renderContributionGrid(filtered) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var startDate, endDate;
    if (selectedYear === 'last12') {
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      var year = parseInt(selectedYear);
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      if (endDate > today) endDate = new Date(today);
    }

    // Align start to beginning of week (Sunday)
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Count activities per day
    var dayCounts = {};
    filtered.forEach(function(a) {
      var key = App.getDayKey(a.start_date_local);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    });

    // Find max for color scaling
    var maxCount = 0;
    Object.values(dayCounts).forEach(function(c) { if (c > maxCount) maxCount = c; });
    if (maxCount === 0) maxCount = 1;

    var cellSize = 12;
    var cellGap = 2;
    var totalSize = cellSize + cellGap;

    // Build weeks
    var weeks = [];
    var current = new Date(startDate);
    while (current <= endDate) {
      var week = [];
      for (var d = 0; d < 7; d++) {
        if (current <= endDate) {
          week.push(new Date(current));
        }
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }
      weeks.push(week);
    }

    var svgWidth = weeks.length * totalSize + 30;
    var svgHeight = 7 * totalSize + 30;

    var svg = '<div class="contribution-grid-wrapper">';
    svg += '<svg width="' + svgWidth + '" height="' + svgHeight + '" class="contribution-grid">';

    // Day labels
    var dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (var i = 0; i < 7; i++) {
      if (i % 2 === 1) {
        svg += '<text x="0" y="' + (i * totalSize + cellSize + 20) + '" font-size="9" fill="#666">' + dayLabels[i] + '</text>';
      }
    }

    // Month labels
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var lastMonth = -1;
    weeks.forEach(function(week, wi) {
      var dayInWeek = week[0];
      if (dayInWeek && dayInWeek.getMonth() !== lastMonth) {
        lastMonth = dayInWeek.getMonth();
        svg += '<text x="' + (wi * totalSize + 15) + '" y="12" font-size="9" fill="#666">' + monthNames[lastMonth] + '</text>';
      }
    });

    // Cells
    weeks.forEach(function(week, wi) {
      week.forEach(function(day, di) {
        var key = day.toISOString().slice(0, 10);
        var count = dayCounts[key] || 0;
        var intensity = count / maxCount;
        var color;
        if (count === 0) color = '#ebedf0';
        else if (intensity <= 0.25) color = '#ffd4b8';
        else if (intensity <= 0.5) color = '#ff9b63';
        else if (intensity <= 0.75) color = '#fc6b14';
        else color = '#c94400';

        var x = wi * totalSize + 15;
        var y = di * totalSize + 20;
        svg += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" rx="2" fill="' + color + '">';
        svg += '<title>' + key + ': ' + count + ' activit' + (count === 1 ? 'y' : 'ies') + '</title>';
        svg += '</rect>';
      });
    });

    svg += '</svg></div>';
    return svg;
  }

  App.on('updateCharts', function() {
    init();
    render();
  });
})();
