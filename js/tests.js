// Test suite — loaded by test.html after all app scripts + test-runner.js
(function() {
  var App = window.StravaApp;
  var T = window._test;

  // ========== A. utils.js (exported on App) ==========

  describe('isRunType', function() {
    it('returns true for Run', function() { assert.ok(App.isRunType('Run')); });
    it('returns true for TrailRun', function() { assert.ok(App.isRunType('TrailRun')); });
    it('returns true for VirtualRun', function() { assert.ok(App.isRunType('VirtualRun')); });
    it('returns false for Ride', function() { assert.ok(!App.isRunType('Ride')); });
    it('returns false for unknown string', function() { assert.ok(!App.isRunType('Yoga')); });
  });

  describe('isRideType', function() {
    it('returns true for Ride', function() { assert.ok(App.isRideType('Ride')); });
    it('returns true for VirtualRide', function() { assert.ok(App.isRideType('VirtualRide')); });
    it('returns true for EBikeRide', function() { assert.ok(App.isRideType('EBikeRide')); });
    it('returns false for Run', function() { assert.ok(!App.isRideType('Run')); });
    it('returns false for unknown string', function() { assert.ok(!App.isRideType('Swimming')); });
  });

  describe('getSportColor', function() {
    it('returns correct color for Run', function() {
      assert.equal(App.getSportColor('Run'), '#fc4c02');
    });
    it('returns Default color for unknown sport', function() {
      assert.equal(App.getSportColor('Zorbing'), '#808080');
    });
  });

  describe('getDayKey', function() {
    it('extracts YYYY-MM-DD from ISO string', function() {
      assert.equal(App.getDayKey('2024-03-15T10:30:00Z'), '2024-03-15');
    });
    it('works at year boundary', function() {
      assert.equal(App.getDayKey('2024-12-31T23:59:59Z'), '2024-12-31');
    });
    it('works for Jan 1', function() {
      assert.equal(App.getDayKey('2025-01-01T00:00:00Z'), '2025-01-01');
    });
  });

  describe('getMonthKey', function() {
    it('returns YYYY-MM format', function() {
      assert.equal(App.getMonthKey('2024-03-15T10:30:00Z'), '2024-03');
    });
    it('zero-pads single-digit months', function() {
      assert.equal(App.getMonthKey('2024-01-15T12:00:00'), '2024-01');
    });
    it('handles December', function() {
      assert.equal(App.getMonthKey('2024-12-31T23:59:59Z'), '2024-12');
    });
  });

  describe('getWeekKey', function() {
    it('returns Monday of the week as YYYY-MM-DD', function() {
      // 2024-03-15 is a Friday → Monday is 2024-03-11
      assert.equal(App.getWeekKey('2024-03-15T10:00:00Z'), '2024-03-11');
    });
    it('returns same day for a Monday', function() {
      // 2024-03-11 is a Monday
      assert.equal(App.getWeekKey('2024-03-11T10:00:00Z'), '2024-03-11');
    });
    it('handles Sunday (goes to previous Monday)', function() {
      // 2024-03-17 is a Sunday → Monday is 2024-03-11
      assert.equal(App.getWeekKey('2024-03-17T10:00:00Z'), '2024-03-11');
    });
  });

  describe('getYearKey', function() {
    it('returns year as string', function() {
      assert.equal(App.getYearKey('2024-06-15T10:00:00Z'), '2024');
    });
  });

  describe('formatDuration', function() {
    it('formats 0 seconds', function() {
      assert.equal(App.formatDuration(0), '0m');
    });
    it('formats 59 seconds as 0m', function() {
      assert.equal(App.formatDuration(59), '0m');
    });
    it('formats 3600 seconds as 1h 0m', function() {
      assert.equal(App.formatDuration(3600), '1h 0m');
    });
    it('formats 7265 seconds as 2h 1m', function() {
      assert.equal(App.formatDuration(7265), '2h 1m');
    });
    it('formats 300 seconds as 5m', function() {
      assert.equal(App.formatDuration(300), '5m');
    });
  });

  describe('formatDurationLong', function() {
    it('formats 0 seconds as 0:00', function() {
      assert.equal(App.formatDurationLong(0), '0:00');
    });
    it('formats 59 seconds as 0:59', function() {
      assert.equal(App.formatDurationLong(59), '0:59');
    });
    it('formats 3600 seconds as 1:00:00', function() {
      assert.equal(App.formatDurationLong(3600), '1:00:00');
    });
    it('formats 7265 seconds as 2:01:05', function() {
      assert.equal(App.formatDurationLong(7265), '2:01:05');
    });
  });

  describe('formatPace', function() {
    it('returns dash for 0', function() {
      assert.equal(App.formatPace(0), '-');
    });
    it('returns dash for negative speed', function() {
      assert.equal(App.formatPace(-1), '-');
    });
    it('formats typical run speed (~3 m/s → ~5:33/km)', function() {
      // 3 m/s → 1000/3 = 333.33 sec/km → 5:33
      assert.equal(App.formatPace(3), '5:33/km');
    });
    it('formats fast run speed (~4.5 m/s → ~3:42/km)', function() {
      // 4.5 m/s → 1000/4.5 = 222.22 sec/km → 3:42
      assert.equal(App.formatPace(4.5), '3:42/km');
    });
  });

  describe('formatSpeed', function() {
    it('returns dash for 0', function() {
      assert.equal(App.formatSpeed(0), '-');
    });
    it('formats typical ride speed (~8 m/s → 28.8 km/h)', function() {
      assert.equal(App.formatSpeed(8), '28.8 km/h');
    });
  });

  describe('filterActivitiesByDateRange', function() {
    var acts = [
      { start_date_local: '2024-01-15T10:00:00Z' },
      { start_date_local: '2024-06-15T10:00:00Z' },
      { start_date_local: '2024-12-01T10:00:00Z' }
    ];

    it('returns all when no range set', function() {
      var result = App.filterActivitiesByDateRange(acts, { from: null, to: null });
      assert.equal(result.length, 3);
    });

    it('filters with from-only', function() {
      var result = App.filterActivitiesByDateRange(acts, { from: '2024-06-01', to: null });
      assert.equal(result.length, 2);
    });

    it('filters with to-only', function() {
      var result = App.filterActivitiesByDateRange(acts, { from: null, to: '2024-06-30' });
      assert.equal(result.length, 2);
    });

    it('filters with both from and to', function() {
      var result = App.filterActivitiesByDateRange(acts, { from: '2024-03-01', to: '2024-09-01' });
      assert.equal(result.length, 1);
    });

    it('returns empty array when no matches', function() {
      var result = App.filterActivitiesByDateRange(acts, { from: '2025-01-01', to: null });
      assert.equal(result.length, 0);
    });

    it('handles empty activities array', function() {
      var result = App.filterActivitiesByDateRange([], { from: '2024-01-01', to: null });
      assert.equal(result.length, 0);
    });
  });

  describe('computeDateRangeFromPreset', function() {
    it('returns null/null for "all"', function() {
      var r = App.computeDateRangeFromPreset('all');
      assert.equal(r.from, null);
      assert.equal(r.to, null);
    });

    it('returns a from date for "3m"', function() {
      var r = App.computeDateRangeFromPreset('3m');
      assert.ok(r.from, 'from should be set');
      assert.equal(r.to, null);
      // from should be ~3 months ago (YYYY-MM-DD format)
      assert.ok(r.from.match(/^\d{4}-\d{2}-\d{2}$/), 'from should be YYYY-MM-DD');
    });

    it('returns a from date for each valid preset', function() {
      ['6m', '1y', '2y', '5y'].forEach(function(preset) {
        var r = App.computeDateRangeFromPreset(preset);
        assert.ok(r.from, preset + ' should set from');
        assert.equal(r.to, null, preset + ' should have null to');
      });
    });

    it('returns null/null for unknown preset', function() {
      var r = App.computeDateRangeFromPreset('bogus');
      assert.equal(r.from, null);
      assert.equal(r.to, null);
    });
  });

  describe('decodePolyline', function() {
    it('returns empty array for empty string', function() {
      assert.deepEqual(App.decodePolyline(''), []);
    });

    it('returns empty array for null', function() {
      assert.deepEqual(App.decodePolyline(null), []);
    });

    it('decodes a known polyline correctly', function() {
      // "_p~iF~ps|U" encodes (38.5, -120.2)
      // "_ulLnnqC" encodes delta to (40.7, -120.95) → cumulative (40.7, -120.95) is wrong, let me recalc
      // Standard test: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" encodes 3 points
      var points = App.decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      assert.equal(points.length, 3);
      // First point should be approximately (38.5, -120.2)
      assert.ok(Math.abs(points[0][0] - 38.5) < 0.01, 'lat ~38.5');
      assert.ok(Math.abs(points[0][1] - (-120.2)) < 0.01, 'lng ~-120.2');
    });
  });

  // ========== B. strava-api.js — normalizeActivity ==========

  describe('normalizeActivity', function() {
    it('maps all fields from a full raw object', function() {
      var raw = {
        id: 123,
        name: 'Morning Run',
        type: 'Run',
        sport_type: 'Run',
        start_date: '2024-03-15T07:00:00Z',
        start_date_local: '2024-03-15T08:00:00',
        distance: 10000,
        moving_time: 3000,
        elapsed_time: 3200,
        total_elevation_gain: 150,
        average_speed: 3.33,
        max_speed: 4.5,
        average_heartrate: 155,
        max_heartrate: 180,
        manual: false,
        trainer: false,
        map: { summary_polyline: 'abc123' }
      };
      var n = App.normalizeActivity(raw);
      assert.equal(n.id, 123);
      assert.equal(n.name, 'Morning Run');
      assert.equal(n.type, 'Run');
      assert.equal(n.distance, 10000);
      assert.equal(n.moving_time, 3000);
      assert.equal(n.total_elevation_gain, 150);
      assert.equal(n.average_speed, 3.33);
      assert.equal(n.polyline, 'abc123');
      assert.equal(n.average_heartrate, 155);
      assert.equal(n.manual, false);
    });

    it('applies defaults for minimal raw object', function() {
      var raw = { id: 456, start_date: '2024-01-01T00:00:00Z' };
      var n = App.normalizeActivity(raw);
      assert.equal(n.id, 456);
      assert.equal(n.name, 'Untitled');
      assert.equal(n.type, 'Unknown');
      assert.equal(n.distance, 0);
      assert.equal(n.moving_time, 0);
      assert.equal(n.total_elevation_gain, 0);
      assert.equal(n.average_speed, 0);
      assert.equal(n.polyline, null);
      assert.equal(n.manual, false);
    });

    it('extracts nested map.summary_polyline', function() {
      var raw = { id: 789, start_date: '2024-01-01T00:00:00Z', map: { summary_polyline: 'xyz' } };
      assert.equal(App.normalizeActivity(raw).polyline, 'xyz');
    });

    it('handles missing map field', function() {
      var raw = { id: 101, start_date: '2024-01-01T00:00:00Z' };
      assert.equal(App.normalizeActivity(raw).polyline, null);
    });

    it('handles map with null summary_polyline', function() {
      var raw = { id: 102, start_date: '2024-01-01T00:00:00Z', map: { summary_polyline: null } };
      assert.equal(App.normalizeActivity(raw).polyline, null);
    });

    it('uses start_date as fallback for start_date_local', function() {
      var raw = { id: 103, start_date: '2024-06-01T12:00:00Z' };
      var n = App.normalizeActivity(raw);
      assert.equal(n.start_date_local, '2024-06-01T12:00:00Z');
    });
  });

  // ========== C. charts-records.js — isSuspicious, buildRecords ==========

  describe('isSuspicious', function() {
    it('returns false for normal run pace', function() {
      // 3.5 m/s → 1000/3.5 = 285 sec/km → above 150 threshold
      assert.ok(!T.records.isSuspicious({ type: 'Run', average_speed: 3.5 }));
    });

    it('returns true for suspiciously fast run (pace < 2:30/km)', function() {
      // Need pace < 150 sec/km → speed > 1000/150 = 6.67 m/s
      assert.ok(T.records.isSuspicious({ type: 'Run', average_speed: 7.0 }));
    });

    it('returns false for normal ride speed', function() {
      // 8 m/s → 28.8 km/h, below 60 km/h threshold
      assert.ok(!T.records.isSuspicious({ type: 'Ride', average_speed: 8 }));
    });

    it('returns true for suspiciously fast ride (>60 km/h)', function() {
      // Need speed > 60 km/h → > 16.67 m/s
      assert.ok(T.records.isSuspicious({ type: 'Ride', average_speed: 17 }));
    });

    it('returns false for non-run/ride activity', function() {
      assert.ok(!T.records.isSuspicious({ type: 'Swim', average_speed: 100 }));
    });

    it('returns false for run with zero speed', function() {
      assert.ok(!T.records.isSuspicious({ type: 'Run', average_speed: 0 }));
    });
  });

  describe('buildRecords', function() {
    var runActs = [
      { id: 1, name: 'Long Run', type: 'Run', distance: 21000, moving_time: 6000, total_elevation_gain: 200, average_speed: 3.5, start_date: '2024-01-01T00:00:00Z' },
      { id: 2, name: 'Short Run', type: 'Run', distance: 5000, moving_time: 1500, total_elevation_gain: 50, average_speed: 3.33, start_date: '2024-02-01T00:00:00Z' },
      { id: 3, name: 'Fast Run', type: 'Run', distance: 10000, moving_time: 2400, total_elevation_gain: 100, average_speed: 4.17, start_date: '2024-03-01T00:00:00Z' }
    ];

    it('returns empty array for empty input', function() {
      assert.deepEqual(T.records.buildRecords([], 'Run'), []);
    });

    it('extracts correct number of records for runs', function() {
      var records = T.records.buildRecords(runActs, 'Run');
      // Should have: Longest Distance, Longest Duration, Most Elevation, Fastest Pace
      assert.equal(records.length, 4);
    });

    it('identifies longest distance correctly', function() {
      var records = T.records.buildRecords(runActs, 'Run');
      var dist = records.find(function(r) { return r.metric === 'Longest Distance'; });
      assert.ok(dist);
      assert.equal(dist.activity.id, 1); // 21km
    });

    it('identifies fastest pace correctly', function() {
      var records = T.records.buildRecords(runActs, 'Run');
      var pace = records.find(function(r) { return r.metric === 'Fastest Pace'; });
      assert.ok(pace);
      assert.equal(pace.activity.id, 3); // 4.17 m/s is fastest
    });

    it('does not include Fastest Pace for rides', function() {
      var rideActs = [
        { id: 10, name: 'Ride 1', type: 'Ride', distance: 50000, moving_time: 7200, total_elevation_gain: 500, average_speed: 6.94, start_date: '2024-01-01T00:00:00Z' }
      ];
      var records = T.records.buildRecords(rideActs, 'Ride');
      var pace = records.find(function(r) { return r.metric === 'Fastest Pace'; });
      assert.ok(!pace, 'Should not have Fastest Pace for rides');
    });

    it('includes Highest Avg Speed for rides', function() {
      var rideActs = [
        { id: 10, name: 'Ride 1', type: 'Ride', distance: 50000, moving_time: 7200, total_elevation_gain: 500, average_speed: 6.94, start_date: '2024-01-01T00:00:00Z' }
      ];
      var records = T.records.buildRecords(rideActs, 'Ride');
      var speed = records.find(function(r) { return r.metric === 'Highest Avg Speed'; });
      assert.ok(speed, 'Should have Highest Avg Speed for rides');
    });
  });

  // ========== D. charts-breakdown.js — groupWithOther, formatDisplayValue ==========

  describe('groupWithOther', function() {
    it('keeps all sports when all above 5% threshold', function() {
      T.breakdown._setMode('count');
      var data = {
        Run: { count: 60, distance: 0, duration: 0 },
        Ride: { count: 40, distance: 0, duration: 0 }
      };
      var grouped = T.breakdown.groupWithOther(data);
      assert.ok(grouped.Run, 'Run should remain');
      assert.ok(grouped.Ride, 'Ride should remain');
      assert.ok(!grouped.Other, 'No Other needed');
    });

    it('groups sport below threshold into Other', function() {
      T.breakdown._setMode('count');
      var data = {
        Run: { count: 90, distance: 0, duration: 0 },
        Ride: { count: 8, distance: 0, duration: 0 },
        Yoga: { count: 2, distance: 0, duration: 0 }  // 2% of 100 total → below 5%
      };
      var grouped = T.breakdown.groupWithOther(data);
      assert.ok(grouped.Run);
      assert.ok(grouped.Ride);
      assert.ok(!grouped.Yoga, 'Yoga should be grouped into Other');
      assert.ok(grouped.Other, 'Other should exist');
      assert.equal(grouped.Other.count, 2);
    });

    it('returns unchanged data when total is 0', function() {
      T.breakdown._setMode('count');
      var data = {
        Run: { count: 0, distance: 0, duration: 0 }
      };
      var grouped = T.breakdown.groupWithOther(data);
      assert.equal(grouped.Run.count, 0);
    });

    it('respects distance mode for threshold', function() {
      T.breakdown._setMode('distance');
      var data = {
        Run: { count: 50, distance: 100000, duration: 0 },
        Yoga: { count: 50, distance: 1000, duration: 0 }  // 1% by distance
      };
      var grouped = T.breakdown.groupWithOther(data);
      assert.ok(!grouped.Yoga, 'Yoga below 5% by distance');
      assert.ok(grouped.Other);
    });

    it('respects duration mode for threshold', function() {
      T.breakdown._setMode('duration');
      var data = {
        Run: { count: 10, distance: 0, duration: 36000 },
        Walk: { count: 10, distance: 0, duration: 1000 }  // ~2.7% by duration
      };
      var grouped = T.breakdown.groupWithOther(data);
      assert.ok(!grouped.Walk, 'Walk below 5% by duration');
      assert.ok(grouped.Other);
    });
  });

  describe('formatDisplayValue', function() {
    it('returns count in count mode', function() {
      T.breakdown._setMode('count');
      assert.equal(T.breakdown.formatDisplayValue('Run', { count: 42, distance: 10000, duration: 3600 }), 42);
    });

    it('returns km in distance mode', function() {
      T.breakdown._setMode('distance');
      var val = T.breakdown.formatDisplayValue('Run', { count: 1, distance: 10000, duration: 0 });
      assert.equal(val, 10); // 10000m → 10.0km
    });

    it('returns hours in duration mode', function() {
      T.breakdown._setMode('duration');
      var val = T.breakdown.formatDisplayValue('Run', { count: 1, distance: 0, duration: 7200 });
      assert.equal(val, 2); // 7200s → 2.0h
    });
  });

  // ========== E. charts-character.js — mean, getSportsFromFiltered ==========

  describe('mean', function() {
    it('returns 0 for empty array', function() {
      assert.equal(T.character.mean([]), 0);
    });

    it('returns the element for single-element array', function() {
      assert.equal(T.character.mean([42]), 42);
    });

    it('computes correct mean for multiple elements', function() {
      assert.equal(T.character.mean([10, 20, 30]), 20);
    });

    it('handles decimal results', function() {
      var result = T.character.mean([1, 2]);
      assert.equal(result, 1.5);
    });
  });

  describe('getSportsFromFiltered', function() {
    it('groups activities by type', function() {
      var acts = [
        { type: 'Run', distance: 5000, manual: false },
        { type: 'Run', distance: 10000, manual: false },
        { type: 'Ride', distance: 20000, manual: false }
      ];
      var sports = T.character.getSportsFromFiltered(acts);
      assert.equal(Object.keys(sports).length, 2);
      assert.equal(sports.Run.length, 2);
      assert.equal(sports.Ride.length, 1);
    });

    it('excludes manual activities', function() {
      var acts = [
        { type: 'Run', distance: 5000, manual: true },
        { type: 'Run', distance: 10000, manual: false }
      ];
      var sports = T.character.getSportsFromFiltered(acts);
      assert.equal(sports.Run.length, 1);
    });

    it('excludes zero-distance activities', function() {
      var acts = [
        { type: 'Yoga', distance: 0, manual: false },
        { type: 'Run', distance: 5000, manual: false }
      ];
      var sports = T.character.getSportsFromFiltered(acts);
      assert.ok(!sports.Yoga, 'Yoga with 0 distance excluded');
      assert.equal(sports.Run.length, 1);
    });

    it('returns empty object for empty input', function() {
      var sports = T.character.getSportsFromFiltered([]);
      assert.equal(Object.keys(sports).length, 0);
    });
  });

  // Render results to the page
  renderTestResults();
})();
