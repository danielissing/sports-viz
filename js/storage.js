(function() {
  var App = window.StravaApp;
  var DB_NAME = 'strava_viz';
  var DB_VERSION = 1;
  var db = null;

  App.storage = {
    open: function() {
      return new Promise(function(resolve, reject) {
        if (db) { resolve(db); return; }
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains('activities')) {
            var store = d.createObjectStore('activities', { keyPath: 'id' });
            store.createIndex('start_date', 'start_date', { unique: false });
          }
          if (!d.objectStoreNames.contains('meta')) {
            d.createObjectStore('meta', { keyPath: 'key' });
          }
        };
        request.onsuccess = function(e) {
          db = e.target.result;
          resolve(db);
        };
        request.onerror = function(e) {
          reject(new Error('IndexedDB open failed: ' + e.target.error));
        };
      });
    },

    putActivities: function(activities) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('activities', 'readwrite');
        var store = tx.objectStore('activities');
        activities.forEach(function(a) { store.put(a); });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function(e) { reject(new Error('putActivities failed: ' + e.target.error)); };
      });
    },

    getAllActivities: function() {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('activities', 'readonly');
        var store = tx.objectStore('activities');
        var request = store.getAll();
        request.onsuccess = function() { resolve(request.result || []); };
        request.onerror = function(e) { reject(new Error('getAllActivities failed: ' + e.target.error)); };
      });
    },

    getNewestActivityDate: function() {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('activities', 'readonly');
        var store = tx.objectStore('activities');
        var index = store.index('start_date');
        var request = index.openCursor(null, 'prev');
        request.onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor) {
            resolve(cursor.value.start_date);
          } else {
            resolve(null);
          }
        };
        request.onerror = function(e) { reject(new Error('getNewestActivityDate failed: ' + e.target.error)); };
      });
    },

    getCount: function() {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('activities', 'readonly');
        var store = tx.objectStore('activities');
        var request = store.count();
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function(e) { reject(new Error('getCount failed: ' + e.target.error)); };
      });
    },

    getMeta: function(key) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('meta', 'readonly');
        var store = tx.objectStore('meta');
        var request = store.get(key);
        request.onsuccess = function() {
          resolve(request.result ? request.result.value : null);
        };
        request.onerror = function(e) { reject(new Error('getMeta failed: ' + e.target.error)); };
      });
    },

    setMeta: function(key, value) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('meta', 'readwrite');
        var store = tx.objectStore('meta');
        store.put({ key: key, value: value });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function(e) { reject(new Error('setMeta failed: ' + e.target.error)); };
      });
    },

    clear: function() {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(['activities', 'meta'], 'readwrite');
        tx.objectStore('activities').clear();
        tx.objectStore('meta').clear();
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function(e) { reject(new Error('clear failed: ' + e.target.error)); };
      });
    }
  };
})();
