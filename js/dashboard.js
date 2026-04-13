(function() {
  var App = window.StravaApp;

  // --- Tab switching ---
  document.querySelectorAll('.tab-btn[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      App.switchTab(btn.dataset.tab);
    });
  });

  // --- Theme toggle ---
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      App.toggleTheme();
    });
  }

  // Re-render charts when theme changes
  App.on('themeChanged', function() {
    if (App.state.currentTab === 'stats' && App.activities.length > 0) {
      App.emit('updateCharts');
    }
  });

  App.switchTab = function(tab) {
    App.state.currentTab = tab;
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('mapView').style.display = (tab === 'map') ? '' : 'none';
    document.getElementById('statsView').style.display = (tab === 'stats') ? '' : 'none';
    App.emit('tabSwitch', tab);
    if (tab === 'stats' && App.activities.length > 0) {
      App.updateDashboard();
    }
  };

  // --- Create sport buttons in map controls ---
  App.createSportButtons = function(activities) {
    var sportCounts = {};
    activities.forEach(function(a) {
      if (a.type) sportCounts[a.type] = (sportCounts[a.type] || 0) + 1;
    });

    var savedSports = App.loadSetting('selectedSports', null);
    var sortedSports = Object.entries(sportCounts).sort(function(a, b) { return b[1] - a[1]; });

    App.selectedSports.clear();
    sortedSports.forEach(function(entry) {
      var sport = entry[0];
      var isActive = savedSports ? savedSports.indexOf(sport) !== -1 : true;
      if (isActive) App.selectedSports.add(sport);
    });

    // Build buttons in map controls only
    var container = document.getElementById('sportButtons');
    if (!container) return;

    container.innerHTML = '';
    sortedSports.forEach(function(entry) {
      var sport = entry[0];
      var count = entry[1];
      var btn = document.createElement('button');
      var isActive = App.selectedSports.has(sport);
      var sportColor = App.getSportColor(sport);
      btn.className = 'sport-btn' + (isActive ? ' active' : '');
      btn.innerHTML = sport + ' <span class="count">(' + count + ')</span>';
      btn.dataset.sport = sport;
      btn.style.borderColor = sportColor;
      if (isActive) {
        btn.style.backgroundColor = sportColor;
      }
      btn.addEventListener('click', function() {
        if (App.selectedSports.has(sport)) {
          App.selectedSports.delete(sport);
        } else {
          App.selectedSports.add(sport);
        }
        App.saveSetting('selectedSports', Array.from(App.selectedSports));
        App.syncSportButtons();
        App.debounceMapUpdate();
      });
      container.appendChild(btn);
    });
  };

  App.syncSportButtons = function() {
    document.querySelectorAll('#sportButtons .sport-btn').forEach(function(btn) {
      var isActive = App.selectedSports.has(btn.dataset.sport);
      btn.classList.toggle('active', isActive);
      btn.style.backgroundColor = isActive ? App.getSportColor(btn.dataset.sport) : '';
    });
  };

  // --- Dashboard update ---
  App.updateDashboard = function() {
    if (App.activities.length === 0) {
      document.getElementById('dashboardEmpty').style.display = 'block';
      document.getElementById('dashboardGrid').style.display = 'none';
      return;
    }
    document.getElementById('dashboardEmpty').style.display = 'none';
    document.getElementById('dashboardGrid').style.display = '';

    App.ensureDashboardCards();
    App.emit('updateCharts');
  };

  App.ensureDashboardCards = function() {
    var grid = document.getElementById('dashboardGrid');
    if (grid.children.length > 0) return; // Already created

    var cards = [
      { id: 'breakdown', title: 'Activity Breakdown' },
      { id: 'summary', title: 'Year in Sport' },
      { id: 'volume', title: 'Training Volume' },
      { id: 'records', title: 'Personal Bests' },
      { id: 'streaks', title: 'Streaks & Consistency' },
      { id: 'character', title: 'Activity Character' }
    ];

    cards.forEach(function(card) {
      var div = document.createElement('div');
      div.className = 'chart-card';
      div.id = 'card-' + card.id;
      div.innerHTML =
        '<div class="chart-card-header">' +
          '<h3>' + card.title + '</h3>' +
          '<div class="chart-controls" id="controls-' + card.id + '"></div>' +
        '</div>' +
        '<div class="chart-body" id="chart-' + card.id + '"></div>';
      grid.appendChild(div);
    });
  };

  // --- Listen for events ---
  App.on('activitiesLoaded', function() {
    if (App.state.currentTab === 'stats') {
      App.updateDashboard();
    }
  });
})();
