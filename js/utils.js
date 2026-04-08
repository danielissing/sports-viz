// StravaApp global namespace — all modules communicate through this object
window.StravaApp = {
  activities: [],
  selectedSports: new Set(),
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

  // --- Get filtered activities (respects selected sports) ---
  getFilteredActivities: function() {
    var self = this;
    return this.activities.filter(function(a) {
      return self.selectedSports.has(a.type);
    });
  }
};
