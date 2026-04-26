(function() {
  var App = window.StravaApp;

  App.oauth = {
    getRedirectUri: function() {
      if (App.config) {
        return App.config.workerUrl + '/callback';
      }
      return window.location.origin + window.location.pathname;
    },

    startAuth: function(clientId, clientSecret) {
      var useWorker = !!App.config;

      if (useWorker) {
        // Shared mode: credentials come from config, redirect goes through Worker
        var params = new URLSearchParams({
          client_id: App.config.clientId,
          redirect_uri: this.getRedirectUri(),
          response_type: 'code',
          scope: 'read,activity:read_all,profile:read_all',
          approval_prompt: 'force',
          state: window.location.origin + window.location.pathname
        });
        window.location.href = 'https://www.strava.com/oauth/authorize?' + params.toString();
      } else {
        // Manual mode: credentials passed in, direct redirect
        localStorage.setItem('oauth_clientId', clientId);
        localStorage.setItem('oauth_clientSecret', clientSecret);

        var params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: window.location.origin + window.location.pathname,
          response_type: 'code',
          scope: 'read,activity:read_all,profile:read_all',
          approval_prompt: 'force'
        });
        window.location.href = 'https://www.strava.com/oauth/authorize?' + params.toString();
      }
    },

    parseCallback: function() {
      var params = new URLSearchParams(window.location.search);
      if (params.has('code')) {
        return { code: params.get('code') };
      }
      if (params.has('error')) {
        return { error: params.get('error') };
      }
      return null;
    },

    cleanUrl: function() {
      var url = window.location.origin + window.location.pathname;
      history.replaceState(null, '', url);
    },

    exchangeCode: function(code, clientId, clientSecret) {
      if (App.config) {
        // Shared mode: POST to Worker (adds secret server-side)
        return fetch(App.config.workerUrl + '/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code })
        }).then(function(resp) {
          if (!resp.ok) {
            return resp.text().then(function(text) {
              throw new Error('Token exchange failed (' + resp.status + '): ' + text);
            });
          }
          return resp.json();
        });
      }

      // Manual mode: direct to Strava with full credentials
      var body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
      });

      return fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        body: body
      }).then(function(resp) {
        if (!resp.ok) {
          return resp.text().then(function(text) {
            throw new Error('Token exchange failed (' + resp.status + '): ' + text);
          });
        }
        return resp.json();
      });
    },

    handleCallback: async function() {
      var result = this.parseCallback();
      if (!result) return null;

      this.cleanUrl();

      if (result.error) {
        throw new Error(result.error === 'access_denied'
          ? 'Authorization denied. Please try again and click "Authorize" on Strava.'
          : 'Authorization failed: ' + result.error);
      }

      var data;
      if (App.config) {
        // Shared mode: exchange via Worker, no local credentials needed
        data = await this.exchangeCode(result.code);
        App.saveSetting('refreshToken', data.refresh_token);
        App.saveSetting('rememberCreds', true);
      } else {
        // Manual mode: retrieve saved credentials
        var clientId = localStorage.getItem('oauth_clientId');
        var clientSecret = localStorage.getItem('oauth_clientSecret');

        if (!clientId || !clientSecret) {
          throw new Error('Credentials lost after redirect. Please enter your Client ID and Secret and try again.');
        }

        data = await this.exchangeCode(result.code, clientId, clientSecret);

        App.saveSetting('clientId', clientId);
        App.saveSetting('clientSecret', clientSecret);
        App.saveSetting('refreshToken', data.refresh_token);
        App.saveSetting('rememberCreds', true);

        localStorage.removeItem('oauth_clientId');
        localStorage.removeItem('oauth_clientSecret');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athlete: data.athlete
      };
    }
  };
})();
