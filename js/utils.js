// StravaApp global namespace — all modules communicate through this object
window.StravaApp = {
  activities: [],
  selectedSports: new Set(),
  dateRange: { from: null, to: null },
  state: {
    currentTab: 'map',
    currentViz: 'lines',
    hasEverFit: false,
    updateTimer: null
  },
  charts: {},
  _listeners: {},

  // --- Simple event emitter ---
  on: function(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  emit: function(event, data) {
    var fns = this._listeners[event] || [];
    for (var i = 0; i < fns.length; i++) fns[i](data);
  },

  // --- localStorage helpers ---
  saveSetting: function(key, value) {
    try { localStorage.setItem('strava_heatmap_' + key, JSON.stringify(value)); } catch (e) {}
  },

  loadSetting: function(key, defaultValue) {
    try {
      var v = localStorage.getItem('strava_heatmap_' + key);
      return v !== null ? JSON.parse(v) : defaultValue;
    } catch (e) { return defaultValue; }
  },

  removeSetting: function(key) {
    try { localStorage.removeItem('strava_heatmap_' + key); } catch (e) {}
  },

  // --- Sport type helpers ---
  isRunType: function(type) {
    return type === 'Run' || type === 'TrailRun' || type === 'VirtualRun';
  },

  isRideType: function(type) {
    return type === 'Ride' || type === 'VirtualRide' || type === 'EBikeRide';
  },

  // --- Sport colors ---
  sportColors: {
    'Run': '#fc4c02', 'Ride': '#00a9e0', 'Swim': '#00d4aa', 'Hike': '#8b4513', 'Walk': '#ff69b4',
    'VirtualRun': '#ff6b6b', 'VirtualRide': '#4ecdc4', 'TrailRun': '#228b22', 'AlpineSki': '#6495ed',
    'BackcountrySki': '#4169e1', 'Canoeing': '#20b2aa', 'Crossfit': '#dc143c', 'EBikeRide': '#00ced1',
    'Elliptical': '#da70d6', 'Golf': '#98fb98', 'Handcycle': '#ff7f50', 'IceSkate': '#b0e0e6',
    'InlineSkate': '#ff1493', 'Kayaking': '#48d1cc', 'Kitesurf': '#00fa9a', 'NordicSki': '#87ceeb',
    'RockClimbing': '#d2691e', 'RollerSki': '#ffd700', 'Rowing': '#4682b4', 'Sail': '#1e90ff',
    'Skateboard': '#ff4500', 'Snowboard': '#6a5acd', 'Snowshoe': '#708090', 'Soccer': '#32cd32',
    'StairStepper': '#ff69b4', 'StandUpPaddling': '#00bfff', 'Surfing': '#00ffff', 'Tennis': '#adff2f',
    'Velomobile': '#ff00ff', 'Wheelchair': '#9370db', 'WeightTraining': '#8b0000', 'Windsurf': '#7fffd4',
    'Workout': '#ffa500', 'Yoga': '#9932cc', 'Default': '#808080'
  },

  getSportColor: function(type) {
    return this.sportColors[type] || this.sportColors['Default'];
  },

  // --- Polyline decoder ---
  decodePolyline: function(encoded) {
    if (!encoded) return [];
    var points = [];
    var index = 0, len = encoded.length;
    var lat = 0, lng = 0;
    while (index < len) {
      var b, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  },

  // --- Date helpers ---
  getWeekStart: function(date) {
    var d = new Date(date);
    var day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Monday start
    d.setHours(0, 0, 0, 0);
    return d;
  },

  getWeekKey: function(date) {
    var ws = this.getWeekStart(date);
    return ws.toISOString().slice(0, 10);
  },

  getMonthKey: function(date) {
    var d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },

  getYearKey: function(date) {
    return String(new Date(date).getFullYear());
  },

  getDayKey: function(dateStr) {
    return dateStr.slice(0, 10);
  },

  // --- Format helpers ---
  formatDuration: function(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  },

  formatDurationLong: function(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  },

  formatPace: function(metersPerSecond) {
    if (!metersPerSecond || metersPerSecond <= 0) return '-';
    var secPerKm = 1000 / metersPerSecond;
    var min = Math.floor(secPerKm / 60);
    var sec = Math.floor(secPerKm % 60);
    return min + ':' + String(sec).padStart(2, '0') + '/km';
  },

  formatSpeed: function(metersPerSecond) {
    if (!metersPerSecond) return '-';
    return (metersPerSecond * 3.6).toFixed(1) + ' km/h';
  },

  // --- Get filtered activities (respects selected sports AND date range) ---
  getFilteredActivities: function() {
    var self = this;
    return this.activities.filter(function(a) {
      if (!self.selectedSports.has(a.type)) return false;
      if (self.dateRange.from) {
        var actDate = a.start_date_local.slice(0, 10);
        if (actDate < self.dateRange.from) return false;
      }
      if (self.dateRange.to) {
        var actDate2 = a.start_date_local.slice(0, 10);
        if (actDate2 > self.dateRange.to) return false;
      }
      return true;
    });
  },

  // --- Date range helpers ---
  setDateRange: function(from, to) {
    this.dateRange.from = from || null;
    this.dateRange.to = to || null;
    this.saveSetting('dateRange', this.dateRange);
    this.emit('dateRangeChanged');
  },

  setDateRangePreset: function(preset) {
    if (preset === 'all') {
      this.setDateRange(null, null);
      return;
    }
    var months = { '3m': 3, '6m': 6, '1y': 12, '2y': 24, '5y': 60 };
    var m = months[preset];
    if (!m) return;
    var d = new Date();
    d.setMonth(d.getMonth() - m);
    var from = d.toISOString().slice(0, 10);
    this.setDateRange(from, null);
  },

  restoreDateRange: function() {
    var saved = this.loadSetting('dateRange', null);
    if (saved) {
      this.dateRange.from = saved.from || null;
      this.dateRange.to = saved.to || null;
    }
  },

  // --- Per-panel date preset helpers ---
  computeDateRangeFromPreset: function(preset) {
    if (preset === 'all') return { from: null, to: null };
    var months = { '3m': 3, '6m': 6, '1y': 12, '2y': 24, '5y': 60 };
    var m = months[preset];
    if (!m) return { from: null, to: null };
    var d = new Date();
    d.setMonth(d.getMonth() - m);
    return { from: d.toISOString().slice(0, 10), to: null };
  },

  filterActivitiesByDateRange: function(activities, dateRange) {
    if (!dateRange || (!dateRange.from && !dateRange.to)) return activities;
    return activities.filter(function(a) {
      var actDate = a.start_date_local.slice(0, 10);
      if (dateRange.from && actDate < dateRange.from) return false;
      if (dateRange.to && actDate > dateRange.to) return false;
      return true;
    });
  },

  // --- Theme helpers ---
  initTheme: function() {
    var saved = this.loadSetting('theme', null);
    var theme;
    if (saved) {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    } else {
      theme = 'light';
    }
    this.applyTheme(theme);

    // Listen for system preference changes (only when no explicit override)
    var self = this;
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!self.loadSetting('theme', null)) {
          self.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  },

  applyTheme: function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.state.theme = theme;

    // Update toggle icon
    var toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
    }

    // Update Chart.js defaults if available
    if (typeof Chart !== 'undefined') {
      var textColor = theme === 'dark' ? '#e0e0e0' : '#666';
      var gridColor = theme === 'dark' ? '#444' : 'rgba(0,0,0,0.1)';
      Chart.defaults.color = textColor;
      Chart.defaults.borderColor = gridColor;
    }

    this.emit('themeChanged', theme);
  },

  toggleTheme: function() {
    var current = this.state.theme || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    this.saveSetting('theme', next);
    this.applyTheme(next);
  },

  // --- CSS variable reader helper ---
  getCSSVar: function(name, fallback) {
    var val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
  },

  createDatePresetControls: function(controlsEl, chartId, onChangeCallback) {
    var self = this;
    var storageKey = 'panel_' + chartId + '_datePreset';
    var savedPreset = self.loadSetting(storageKey, 'all');

    var group = document.createElement('div');
    group.className = 'chart-control-group chart-date-presets';

    var presets = ['3m', '6m', '1y', '2y', '5y', 'all'];
    var labels = { '3m': '3M', '6m': '6M', '1y': '1Y', '2y': '2Y', '5y': '5Y', 'all': 'All' };

    presets.forEach(function(preset) {
      var btn = document.createElement('button');
      btn.className = 'chart-toggle-btn' + (preset === savedPreset ? ' active' : '');
      btn.textContent = labels[preset];
      btn.dataset.datePreset = preset;
      btn.addEventListener('click', function() {
        group.querySelectorAll('[data-date-preset]').forEach(function(b) {
          b.classList.toggle('active', b.dataset.datePreset === preset);
        });
        self.saveSetting(storageKey, preset);
        var range = self.computeDateRangeFromPreset(preset);
        onChangeCallback(range);
      });
      group.appendChild(btn);
    });

    controlsEl.insertBefore(group, controlsEl.firstChild);
    return self.computeDateRangeFromPreset(savedPreset);
  }
};
