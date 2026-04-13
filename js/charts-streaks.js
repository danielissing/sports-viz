(function() {
  var App = window.StravaApp;
  var selectedYear = 'last12'; // 'last12' or a year string like '2024'
  var selectedSport = 'all';   // 'all' or a sport type string

  function init() {
    var controlsEl = document.getElementById('controls-streaks');
    if (!controlsEl || controlsEl.dataset.init) return;
    controlsEl.dataset.init = 'true';
  }

  function getYearsInData(activities) {
    var years = {};
    activities.forEach(function(a) {
      var y = new Date(a.start_date_local).getFullYear();
      years[y] = true;
    });
    return Object.keys(years).sort().reverse();
  }

  function getSportList(activities) {
    var counts = {};
    activities.forEach(function(a) {
      if (a.type) counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
  }

  function filterBySport(activities) {
    if (selectedSport === 'all') return activities;
    return activities.filter(function(a) { return a.type === selectedSport; });
  }

  function getDateRangeForYear() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedYear === 'last12') {
      var start = new Date(today);
      start.setFullYear(start.getFullYear() - 1);
      return { from: start.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
    }
    var year = parseInt(selectedYear);
    var endDate = new Date(year, 11, 31);
    if (endDate > today) endDate = today;
    return { from: year + '-01-01', to: endDate.toISOString().slice(0, 10) };
  }

  function filterByDateRange(activities) {
    var range = getDateRangeForYear();
    return activities.filter(function(a) {
      var d = a.start_date_local.slice(0, 10);
      return d >= range.from && d <= range.to;
    });
  }

  function renderControls(container) {
    var controlsEl = document.getElementById('controls-streaks');
    if (!controlsEl) return;

    // Year dropdown
    var yearSelect = controlsEl.querySelector('.year-select');
    if (!yearSelect) {
      yearSelect = document.createElement('select');
      yearSelect.className = 'summary-select year-select';
      yearSelect.addEventListener('change', function() {
        selectedYear = yearSelect.value;
        render();
      });
      controlsEl.appendChild(yearSelect);
    }

    var years = getYearsInData(App.activities);
    yearSelect.innerHTML = '';
    var last12Opt = document.createElement('option');
    last12Opt.value = 'last12';
    last12Opt.textContent = 'Last 12 months';
    if (selectedYear === 'last12') last12Opt.selected = true;
    yearSelect.appendChild(last12Opt);
    years.forEach(function(year) {
      var opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      if (selectedYear === year) opt.selected = true;
      yearSelect.appendChild(opt);
    });

    // Sport dropdown
    var sportSelect = controlsEl.querySelector('.sport-select');
    if (!sportSelect) {
      sportSelect = document.createElement('select');
      sportSelect.className = 'summary-select sport-select';
      sportSelect.addEventListener('change', function() {
        selectedSport = sportSelect.value;
        render();
      });
      controlsEl.appendChild(sportSelect);
    }

    var sports = getSportList(App.activities);
    sportSelect.innerHTML = '';
    var allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All sports';
    if (selectedSport === 'all') allOpt.selected = true;
    sportSelect.appendChild(allOpt);
    sports.forEach(function(sport) {
      var opt = document.createElement('option');
      opt.value = sport;
      opt.textContent = sport;
      if (selectedSport === sport) opt.selected = true;
      sportSelect.appendChild(opt);
    });
  }

  function render() {
    var container = document.getElementById('chart-streaks');
    if (!container) return;

    if (App.activities.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities to display</div>';
      return;
    }

    renderControls(container);

    // Apply both filters
    var sportFiltered = filterBySport(App.activities);
    var periodFiltered = filterByDateRange(sportFiltered);

    if (periodFiltered.length === 0) {
      container.innerHTML = '<div class="chart-empty">No activities in this period</div>';
      return;
    }

    // Unique active days within the selected period + sport
    var activeDays = new Set();
    periodFiltered.forEach(function(a) {
      activeDays.add(App.getDayKey(a.start_date_local));
    });

    var sortedDays = Array.from(activeDays).sort();

    // Calculate longest streak within the period
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

    // Current streak (from today backwards, using sport filter only)
    var currentStreak = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayKey = today.toISOString().slice(0, 10);
    var yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    var yesterdayKey = yesterday.toISOString().slice(0, 10);

    // Current streak uses all-time sport-filtered data (not period-limited)
    var allSportDays = new Set();
    sportFiltered.forEach(function(a) {
      allSportDays.add(App.getDayKey(a.start_date_local));
    });

    if (allSportDays.has(todayKey) || allSportDays.has(yesterdayKey)) {
      currentStreak = 1;
      var checkDate = allSportDays.has(todayKey) ? new Date(today) : new Date(yesterday);
      while (true) {
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        var key = checkDate.toISOString().slice(0, 10);
        if (allSportDays.has(key)) currentStreak++;
        else break;
      }
    }

    // Weekly consistency within the period
    var weekCounts = {};
    periodFiltered.forEach(function(a) {
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

    // Contribution grid
    html += renderContributionGrid(periodFiltered);

    html += '</div>';
    container.innerHTML = html;
  }

  function renderContributionGrid(activities) {
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
    activities.forEach(function(a) {
      var key = App.getDayKey(a.start_date_local);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    });

    // Find max for color scaling
    var maxCount = 0;
    Object.values(dayCounts).forEach(function(c) { if (c > maxCount) maxCount = c; });
    if (maxCount === 0) maxCount = 1;

    var cellSize = 9;
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
