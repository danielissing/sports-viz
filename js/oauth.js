(function() {
  var App = window.StravaApp;

  function getCredentials() {
    if (App.config && App.config.clientId && App.config.clientSecret) {
      return { clientId: App.config.clientId, clientSecret: App.config.clientSecret };
    }
    return null;
  }

  App.oauth = {
    hasConfig: function() {
      return !!getCredentials();
    },

    getRedirectUri: function() {
      return window.location.origin + window.location.pathname;
    },

    startAuth: function(clientId, clientSecret) {
      var creds = getCredentials();
      var id = clientId || (creds && creds.clientId);
      var secret = clientSecret || (creds && creds.clientSecret);

      if (!id || !secret) {
        throw new Error('No Strava API credentials available.');
      }

      // Save credentials temporarily for retrieval after redirect
      localStorage.setItem('oauth_clientId', id);
      localStorage.setItem('oauth_clientSecret', secret);

      var params = new URLSearchParams({
        client_id: id,
        redirect_uri: this.getRedirectUri(),
        response_type: 'code',
        scope: 'read,activity:read_all,profile:read_all',
        approval_prompt: 'force'
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

    exchangeCode: function(code, clientId, clientSecret) {
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

      // Retrieve credentials: prefer config, fall back to localStorage temp keys
      var creds = getCredentials();
      var clientId = creds ? creds.clientId : localStorage.getItem('oauth_clientId');
      var clientSecret = creds ? creds.clientSecret : localStorage.getItem('oauth_clientSecret');

      if (!clientId || !clientSecret) {
        throw new Error('Credentials lost after redirect. Please enter your Client ID and Secret and try again.');
      }

      // Exchange authorization code for tokens
      var data = await this.exchangeCode(result.code, clientId, clientSecret);

      // Save refresh token (always needed per-user)
      App.saveSetting('refreshToken', data.refresh_token);

      // Save manual credentials if not using config
      if (!creds) {
        App.saveSetting('clientId', clientId);
        App.saveSetting('clientSecret', clientSecret);
        App.saveSetting('rememberCreds', true);
      }

      // Clean up temporary keys
      localStorage.removeItem('oauth_clientId');
      localStorage.removeItem('oauth_clientSecret');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athlete: data.athlete
      };
    }
  };
})();
