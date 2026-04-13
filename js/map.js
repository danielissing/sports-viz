(function() {
  var App = window.StravaApp;

  // --- Initialize theme (Chart.js is loaded by now) ---
  App.initTheme();

  // --- Map state ---
  var routeLayers = [];
  var heatLayer = null;
  var mapInstance = L.map('map').setView([40.7128, -74.0060], 11);
  var tileLayers = {
    street: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '\u00a9 OpenStreetMap contributors \u00a9 CARTO', maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '\u00a9 Esri', maxZoom: 19 }),
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: '\u00a9 Esri', maxZoom: 19 }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '\u00a9 OpenStreetMap contributors \u00a9 CARTO', maxZoom: 19 }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '\u00a9 OpenStreetMap contributors \u00a9 CARTO', maxZoom: 19 }),
    outdoors: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '\u00a9 OpenTopoMap contributors \u00a9 OpenStreetMap contributors', maxZoom: 17 })
  };
  var currentTileLayer = tileLayers.light;
  currentTileLayer.addTo(mapInstance);

  // Expose map instance for other modules
  App.mapInstance = mapInstance;

  // --- Drawing (uses getFilteredActivities for date+sport filtering) ---
  function drawRoutes() {
    var opacity = document.getElementById('opacity').value / 100;
    var weight = parseInt(document.getElementById('lineWidth').value);
    var filtered = App.getFilteredActivities();
    filtered.forEach(function(activity) {
      if (!activity.polyline) return;
      var points = App.decodePolyline(activity.polyline);
      if (points.length < 2) return;
      var color = App.getSportColor(activity.type);
      var polyline = L.polyline(points, { color: color, weight: weight, opacity: opacity, smoothFactor: 1 });
      polyline.bindPopup(
        '<strong>' + activity.name + '</strong><br>' +
        'Type: ' + activity.type + '<br>' +
        'Date: ' + new Date(activity.start_date).toLocaleDateString() + '<br>' +
        'Distance: ' + (activity.distance / 1000).toFixed(2) + ' km'
      );
      routeLayers.push(polyline);
      polyline.addTo(mapInstance);
    });
  }

  function drawHeatmap() {
    var allPoints = [];
    var filtered = App.getFilteredActivities();
    filtered.forEach(function(activity) {
      if (!activity.polyline) return;
      var points = App.decodePolyline(activity.polyline);
      points.forEach(function(p) { allPoints.push([p[0], p[1], 0.5]); });
    });
    if (allPoints.length === 0) return;
    if (!L.heatLayer) {
      App.showMessage('error', 'Heatmap requires leaflet.heat plugin.');
      return;
    }
    heatLayer = L.heatLayer(allPoints, {
      radius: 25, blur: 15, maxZoom: 17, max: 1.0,
      gradient: { 0.0: 'transparent', 0.25: 'blue', 0.4: 'cyan', 0.6: 'lime', 0.75: 'yellow', 0.9: 'orange', 1.0: 'red' }
    }).addTo(mapInstance);
  }

  function updateMapStats() {
    var filtered = App.getFilteredActivities();
    var totalDistance = 0, minDate = new Date(), maxDate = new Date(0);
    var routeCount = 0, activityCount = filtered.length;
    filtered.forEach(function(activity) {
      if (activity.polyline) routeCount++;
      totalDistance += activity.distance || 0;
      var d = new Date(activity.start_date);
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    });
    document.getElementById('totalActivities').textContent = activityCount;
    document.getElementById('totalDistance').textContent = (totalDistance / 1000).toFixed(1) + ' km';
    document.getElementById('routeCount').textContent = routeCount;
    document.getElementById('dateRange').textContent = activityCount > 0
      ? minDate.toLocaleDateString() + ' - ' + maxDate.toLocaleDateString() : '-';
  }

  // --- Visualization update ---
  App.updateVisualization = function(opts) {
    opts = opts || { preserveView: true, fitBounds: false };
    var preserveView = opts.preserveView !== false;
    var center, zoom;
    if (preserveView) { center = mapInstance.getCenter(); zoom = mapInstance.getZoom(); }

    // Clear
    routeLayers.forEach(function(l) { mapInstance.removeLayer(l); });
    routeLayers = [];
    if (heatLayer) { mapInstance.removeLayer(heatLayer); heatLayer = null; }

    // Draw
    if (App.state.currentViz === 'lines') drawRoutes(); else drawHeatmap();
    updateMapStats();

    // Fit bounds on first draw
    if (opts.fitBounds) {
      var bounds = [];
      var filtered = App.getFilteredActivities();
      filtered.forEach(function(activity) {
        if (!activity.polyline) return;
        var points = App.decodePolyline(activity.polyline);
        bounds.push.apply(bounds, points);
      });
      if (bounds.length > 0) {
        mapInstance.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
        App.state.hasEverFit = true;
      }
    }

    // Restore view
    if (preserveView && center && typeof zoom === 'number') {
      mapInstance.setView(center, zoom, { animate: false });
    }
  };

  App.debounceMapUpdate = function() {
    clearTimeout(App.state.updateTimer);
    App.state.updateTimer = setTimeout(function() {
      App.updateVisualization({ preserveView: true, fitBounds: false });
    }, 200);
  };

  // --- Message helpers ---
  App.showMessage = function(type, message) {
    var errorEl = document.getElementById('error');
    var successEl = document.getElementById('success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    if (type === 'error') { errorEl.textContent = message; errorEl.style.display = 'block'; }
    else if (type === 'success') { successEl.textContent = message; successEl.style.display = 'block'; }
  };

  App.updateProgress = function(current, total, text) {
    var progressBar = document.getElementById('progressBar');
    var progressText = document.getElementById('progressText');
    if (current < 0) {
      progressText.textContent = text;
      return;
    }
    var percentage = total > 0 ? (current / total) * 100 : 0;
    progressBar.style.width = percentage + '%';
    progressText.textContent = text;
  };

  // --- Show activities on screen (common to cache load & fetch) ---
  function showActivities(fitBounds) {
    App.createSportButtons(App.activities);
    document.getElementById('activityControls').style.display = 'block';
    document.getElementById('mapStats').style.display = 'block';
    document.getElementById('dateRangeControls').style.display = 'block';
    App.updateVisualization({ preserveView: !fitBounds, fitBounds: fitBounds });
    App.emit('activitiesLoaded');
  }

  // --- Update cache status display ---
  function updateCacheStatus(count, lastSync) {
    var el = document.getElementById('cacheStatus');
    var textEl = document.getElementById('cacheStatusText');
    if (count > 0) {
      el.style.display = '';
      var syncInfo = lastSync ? ' (last sync: ' + new Date(lastSync).toLocaleDateString() + ')' : '';
      textEl.textContent = count + ' activities cached' + syncInfo;
      document.getElementById('syncNew').style.display = '';
      document.getElementById('fetchActivities').textContent = 'Reload All Activities';
    } else {
      el.style.display = 'none';
      document.getElementById('syncNew').style.display = 'none';
      document.getElementById('fetchActivities').textContent = 'Load All Activities';
    }
  }

  // --- Collapse credentials when saved ---
  function collapseCredsIfSaved() {
    if (App.loadSetting('rememberCreds', false)) {
      document.getElementById('credsBody').classList.add('collapsed');
      document.getElementById('credsArrow').classList.add('collapsed');
    }
  }

  // --- Credentials toggle ---
  document.getElementById('credsToggle').addEventListener('click', function() {
    document.getElementById('credsBody').classList.toggle('collapsed');
    document.getElementById('credsArrow').classList.toggle('collapsed');
  });

  // --- Helper: get credentials and refresh token ---
  async function getAccessToken() {
    var clientId = document.getElementById('clientId').value.trim();
    var clientSecret = document.getElementById('clientSecret').value.trim();
    var refreshTokenVal = document.getElementById('refreshToken').value.trim();
    if (!clientId || !clientSecret || !refreshTokenVal) {
      throw new Error('Please enter Client ID, Client Secret, and Refresh Token');
    }
    var tokens = await App.refreshAccessToken(clientId, clientSecret, refreshTokenVal);
    // Update rotated refresh token
    if (tokens.refreshToken !== refreshTokenVal) {
      document.getElementById('refreshToken').value = tokens.refreshToken;
      if (document.getElementById('rememberCreds').checked) {
        App.saveSetting('refreshToken', tokens.refreshToken);
      }
    }
    // Persist credentials
    if (document.getElementById('rememberCreds').checked) {
      App.saveSetting('clientId', clientId);
      App.saveSetting('clientSecret', clientSecret);
      App.saveSetting('refreshToken', document.getElementById('refreshToken').value.trim());
      App.saveSetting('rememberCreds', true);
    } else {
      App.removeSetting('clientId');
      App.removeSetting('clientSecret');
      App.removeSetting('refreshToken');
      App.removeSetting('rememberCreds');
    }
    return tokens.accessToken;
  }

  // --- Load All Activities button ---
  document.getElementById('fetchActivities').addEventListener('click', async function() {
    var button = document.getElementById('fetchActivities');
    var loading = document.getElementById('loading');

    button.disabled = true;
    document.getElementById('syncNew').disabled = true;
    loading.style.display = 'block';
    App.showMessage('', '');

    try {
      var accessToken = await getAccessToken();

      // Clear existing cache for full reload
      await App.storage.clear();

      var fetched = await App.fetchActivities(accessToken, 0, App.updateProgress);

      if (fetched.length === 0) {
        App.showMessage('error', 'No activities found');
      } else {
        // Reload all from IndexedDB (canonical source)
        App.activities = await App.storage.getAllActivities();
        App.activities.sort(function(a, b) { return a.start_date < b.start_date ? -1 : 1; });

        await App.storage.setMeta('lastSyncDate', new Date().toISOString());
        updateCacheStatus(App.activities.length, new Date().toISOString());
        collapseCredsIfSaved();

        var shouldFit = !App.state.hasEverFit;
        showActivities(shouldFit);
        App.showMessage('success', 'Loaded ' + App.activities.length + ' activities!');
      }
    } catch (err) {
      console.error('Error:', err);
      App.showMessage('error', err.message);
      // Even on error, show what was saved
      var count = await App.storage.getCount();
      if (count > 0) {
        App.activities = await App.storage.getAllActivities();
        App.activities.sort(function(a, b) { return a.start_date < b.start_date ? -1 : 1; });
        await App.storage.setMeta('lastSyncDate', new Date().toISOString());
        updateCacheStatus(count, new Date().toISOString());
        showActivities(!App.state.hasEverFit);
      }
    } finally {
      loading.style.display = 'none';
      button.disabled = false;
      document.getElementById('syncNew').disabled = false;
    }
  });

  // --- Sync New Activities button ---
  document.getElementById('syncNew').addEventListener('click', async function() {
    var button = document.getElementById('syncNew');
    var loading = document.getElementById('loading');

    button.disabled = true;
    document.getElementById('fetchActivities').disabled = true;
    loading.style.display = 'block';
    App.showMessage('', '');

    try {
      var accessToken = await getAccessToken();

      var newestDate = await App.storage.getNewestActivityDate();
      var afterEpoch = 0;
      if (newestDate) {
        afterEpoch = Math.floor(new Date(newestDate).getTime() / 1000);
      }

      var fetched = await App.fetchActivities(accessToken, afterEpoch, App.updateProgress);

      // Reload all from IndexedDB
      App.activities = await App.storage.getAllActivities();
      App.activities.sort(function(a, b) { return a.start_date < b.start_date ? -1 : 1; });

      await App.storage.setMeta('lastSyncDate', new Date().toISOString());
      updateCacheStatus(App.activities.length, new Date().toISOString());

      showActivities(!App.state.hasEverFit);
      App.showMessage('success', 'Synced ' + fetched.length + ' new activities! Total: ' + App.activities.length);
    } catch (err) {
      console.error('Error:', err);
      App.showMessage('error', err.message);
    } finally {
      loading.style.display = 'none';
      button.disabled = false;
      document.getElementById('fetchActivities').disabled = false;
    }
  });

  // --- Clear Cache ---
  document.getElementById('clearCache').addEventListener('click', async function(e) {
    e.preventDefault();
    await App.storage.clear();
    App.activities = [];
    App.selectedSports.clear();
    updateCacheStatus(0, null);
    document.getElementById('activityControls').style.display = 'none';
    document.getElementById('mapStats').style.display = 'none';
    document.getElementById('dateRangeControls').style.display = 'none';
    // Clear map
    routeLayers.forEach(function(l) { mapInstance.removeLayer(l); });
    routeLayers = [];
    if (heatLayer) { mapInstance.removeLayer(heatLayer); heatLayer = null; }
    App.showMessage('success', 'Cache cleared.');
    App.emit('activitiesLoaded');
  });

  // --- Manual update button ---
  document.getElementById('updateMap').addEventListener('click', function() {
    App.updateVisualization({ preserveView: true, fitBounds: false });
    App.showMessage('success', 'Map updated!');
  });

  // --- Map style switcher ---
  document.querySelectorAll('.map-style-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var style = btn.dataset.style;
      document.querySelectorAll('.map-style-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      mapInstance.removeLayer(currentTileLayer);
      currentTileLayer = tileLayers[style];
      currentTileLayer.addTo(mapInstance);
      App.saveSetting('mapStyle', style);
    });
  });

  // --- Viz toggle ---
  document.getElementById('vizLines').addEventListener('click', function() {
    App.state.currentViz = 'lines';
    document.getElementById('vizLines').classList.add('active');
    document.getElementById('vizHeat').classList.remove('active');
    App.saveSetting('vizMode', 'lines');
    App.updateVisualization({ preserveView: true, fitBounds: false });
  });

  document.getElementById('vizHeat').addEventListener('click', function() {
    App.state.currentViz = 'heat';
    document.getElementById('vizHeat').classList.add('active');
    document.getElementById('vizLines').classList.remove('active');
    App.saveSetting('vizMode', 'heat');
    App.updateVisualization({ preserveView: true, fitBounds: false });
  });

  // --- Sliders ---
  document.getElementById('opacity').addEventListener('input', function(e) {
    document.getElementById('opacityValue').textContent = e.target.value + '%';
    App.saveSetting('opacity', e.target.value);
    App.debounceMapUpdate();
  });

  document.getElementById('lineWidth').addEventListener('input', function(e) {
    document.getElementById('widthValue').textContent = e.target.value;
    App.saveSetting('lineWidth', e.target.value);
    App.debounceMapUpdate();
  });

  // --- Date range preset buttons (map sidebar) ---
  function setupDateRangeControls(containerSelector, fromId, toId) {
    var container = document.querySelector(containerSelector);
    if (!container) return;

    container.querySelectorAll('.date-preset-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('.date-preset-btn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.preset === btn.dataset.preset);
        });
        App.setDateRangePreset(btn.dataset.preset);
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
      });
    });

    var fromInput = document.getElementById(fromId);
    var toInput = document.getElementById(toId);
    if (fromInput) {
      fromInput.addEventListener('change', function() {
        container.querySelectorAll('.date-preset-btn').forEach(function(b) { b.classList.remove('active'); });
        App.setDateRange(fromInput.value || null, toInput ? toInput.value || null : null);
      });
    }
    if (toInput) {
      toInput.addEventListener('change', function() {
        container.querySelectorAll('.date-preset-btn').forEach(function(b) { b.classList.remove('active'); });
        App.setDateRange(fromInput ? fromInput.value || null : null, toInput.value || null);
      });
    }
  }

  // Re-render map when date range changes
  App.on('dateRangeChanged', function() {
    App.debounceMapUpdate();
  });

  // --- Restore settings on load ---
  (function restoreSettings() {
    if (App.loadSetting('rememberCreds', false)) {
      document.getElementById('clientId').value = App.loadSetting('clientId', '');
      document.getElementById('clientSecret').value = App.loadSetting('clientSecret', '');
      document.getElementById('refreshToken').value = App.loadSetting('refreshToken', '');
      document.getElementById('rememberCreds').checked = true;
    }
    var savedOpacity = App.loadSetting('opacity', null);
    if (savedOpacity !== null) {
      document.getElementById('opacity').value = savedOpacity;
      document.getElementById('opacityValue').textContent = savedOpacity + '%';
    }
    var savedWidth = App.loadSetting('lineWidth', null);
    if (savedWidth !== null) {
      document.getElementById('lineWidth').value = savedWidth;
      document.getElementById('widthValue').textContent = savedWidth;
    }
    var savedViz = App.loadSetting('vizMode', null);
    if (savedViz) {
      App.state.currentViz = savedViz;
      document.getElementById('vizLines').classList.toggle('active', savedViz === 'lines');
      document.getElementById('vizHeat').classList.toggle('active', savedViz === 'heat');
    }
    var savedStyle = App.loadSetting('mapStyle', null);
    if (savedStyle && tileLayers[savedStyle]) {
      mapInstance.removeLayer(currentTileLayer);
      currentTileLayer = tileLayers[savedStyle];
      currentTileLayer.addTo(mapInstance);
      document.querySelectorAll('.map-style-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.style === savedStyle);
      });
    }
    // Restore date range
    App.restoreDateRange();
    if (App.dateRange.from || App.dateRange.to) {
      // Deactivate "All" preset and set custom values
      var mapPresets = document.querySelector('#dateRangeControls');
      if (mapPresets) {
        mapPresets.querySelectorAll('.date-preset-btn').forEach(function(b) { b.classList.remove('active'); });
      }
      if (App.dateRange.from) {
        document.getElementById('dateFrom').value = App.dateRange.from;
      }
      if (App.dateRange.to) {
        document.getElementById('dateTo').value = App.dateRange.to;
      }
    }
  })();

  // Setup date range controls for map sidebar only
  setupDateRangeControls('#dateRangeControls', 'dateFrom', 'dateTo');

  // --- Cache-first startup ---
  (async function startup() {
    try {
      await App.storage.open();
      var count = await App.storage.getCount();
      if (count > 0) {
        var lastSync = await App.storage.getMeta('lastSyncDate');
        App.activities = await App.storage.getAllActivities();
        App.activities.sort(function(a, b) { return a.start_date < b.start_date ? -1 : 1; });
        updateCacheStatus(count, lastSync);
        collapseCredsIfSaved();
        showActivities(true);
      }
    } catch (err) {
      console.error('IndexedDB startup error:', err);
    }
  })();

  // --- Handle tab switch to map ---
  App.on('tabSwitch', function(tab) {
    if (tab === 'map') {
      setTimeout(function() { mapInstance.invalidateSize(); }, 100);
    }
  });

  // --- Collapsible sidebar ---
  (function() {
    var controls = document.getElementById('mapControls');
    var toggleBtn = document.getElementById('sidebarToggle');
    if (!controls || !toggleBtn) return;

    var collapsed = App.loadSetting('sidebarCollapsed', false);

    function updateSidebar() {
      controls.classList.toggle('collapsed', collapsed);
      toggleBtn.innerHTML = collapsed ? '&#8250;' : '&#8249;';
      // Position the toggle relative to the controls panel
      if (collapsed) {
        toggleBtn.style.right = '20px';
      } else {
        toggleBtn.style.right = (controls.offsetWidth + 20 + 8) + 'px';
      }
    }

    function repositionToggle() {
      if (!collapsed) {
        toggleBtn.style.right = (controls.offsetWidth + 20 + 8) + 'px';
      }
    }

    toggleBtn.addEventListener('click', function() {
      collapsed = !collapsed;
      App.saveSetting('sidebarCollapsed', collapsed);
      updateSidebar();
      // After transition ends, tell Leaflet to recalculate
      setTimeout(function() { mapInstance.invalidateSize(); }, 350);
    });

    window.addEventListener('resize', repositionToggle);

    // Initial state
    updateSidebar();
  })();
})();
