(function() {
  var App = window.StravaApp;

  App.oauth = {
    getRedirectUri: function() {
      return App.config.workerUrl + '/callback';
    },

    startAuth: function() {
      var params = new URLSearchParams({
        client_id: App.config.clientId,
        redirect_uri: this.getRedirectUri(),
        response_type: 'code',
        scope: 'read,activity:read_all,profile:read_all',
        approval_prompt: 'force',
        state: window.location.origin + window.location.pathname
      });
      window.location.href = 'https://www.strava.com/oauth/authorize?' + params.toString();
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

    exchangeCode: function(code) {
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

      var data = await this.exchangeCode(result.code);
      App.saveSetting('refreshToken', data.refresh_token);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athlete: data.athlete
      };
    }
  };
})();
