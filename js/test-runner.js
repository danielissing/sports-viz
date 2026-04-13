// Minimal test runner — no dependencies
(function() {
  var results = { passed: 0, failed: 0, errors: [] };
  var currentGroup = '';
  var output = [];

  window.describe = function(name, fn) {
    currentGroup = name;
    output.push('<h3>' + esc(name) + '</h3>');
    fn();
    currentGroup = '';
  };

  window.it = function(name, fn) {
    try {
      fn();
      results.passed++;
      output.push('<div class="pass">PASS — ' + esc(name) + '</div>');
    } catch (e) {
      results.failed++;
      var label = currentGroup ? currentGroup + ' > ' + name : name;
      results.errors.push({ label: label, message: e.message });
      output.push('<div class="fail">FAIL — ' + esc(name) + '<br><span class="err">' + esc(e.message) + '</span></div>');
    }
  };

  window.assert = {
    equal: function(a, b, msg) {
      if (a !== b) throw new Error((msg || 'equal') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
    },
    deepEqual: function(a, b, msg) {
      var aj = JSON.stringify(a), bj = JSON.stringify(b);
      if (aj !== bj) throw new Error((msg || 'deepEqual') + ': expected ' + bj + ', got ' + aj);
    },
    ok: function(v, msg) {
      if (!v) throw new Error((msg || 'ok') + ': expected truthy, got ' + JSON.stringify(v));
    },
    throws: function(fn, msg) {
      var threw = false;
      try { fn(); } catch (e) { threw = true; }
      if (!threw) throw new Error((msg || 'throws') + ': expected function to throw');
    }
  };

  window.renderTestResults = function() {
    var el = document.getElementById('results');
    var total = results.passed + results.failed;
    var color = results.failed === 0 ? '#2e7d32' : '#c62828';
    var html = '<div class="summary" style="background:' + color + '">' +
      total + ' tests: ' + results.passed + ' passed, ' + results.failed + ' failed</div>';
    html += output.join('');
    el.innerHTML = html;
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
