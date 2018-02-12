var JSONAPIClient = require('json-api-client');
var Model = JSONAPIClient.Model;
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;
var ls = require('local-storage');

var config = require('./config');
var apiClient = require('./api-client');

// Use this to override the default API-specific headers.
var JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// We don't want to wait until the token is already expired before refreshing it.
var TOKEN_EXPIRATION_ALLOWANCE = 60 * 1000;

// Save local storage stuff as something totally obvious
var LOCAL_STORAGE_PREFIX = 'panoptesClientOAuth_';

// Specify whether to use local or session storage for session data.
var SESSION_STORAGE = window.sessionStorage;

// Create our model, then do stuff with it later
module.exports = new Model({
  _bearerRefreshTimeout: NaN,
  _clientAppId: ls.get(LOCAL_STORAGE_PREFIX + 'clientAppId'),
  _currentSessionCheckPromise: null,
  _currentUserPromise: null,
  _tokenDetails: null,

  checkBearerToken: function() {
    var awaitBearerToken;
    if (this._bearerTokenIsExpired()) {
      awaitBearerToken = this._refreshBearerToken();
    } else {
      var tokenDetails = JSON.parse(SESSION_STORAGE.getItem(LOCAL_STORAGE_PREFIX + 'tokenDetails'));
      awaitBearerToken = Promise.resolve(tokenDetails);
    }
    return awaitBearerToken;
  },

  checkCurrent: function() {
    console.log('Checking current user');

    // If we're checking for an existing session already, defer this until
    // it's finished
    var initialCheck = this._currentSessionCheckPromise || Promise.resolve();

    if (!this._currentUserPromise) {
      this.update({
        _currentUserPromise: initialCheck
          .then(this._getSession)
          .catch(function() {
            // Nobody's signed in. This isn't an error.
            console.info('No current user');
            return null;
          }),
      });
    }

    return this._currentUserPromise;
  },

  init: function (appID) {
    return new Promise(function(resolve, reject) {

      // Don't init if we're in an iFrame, as we could be the token refresh process
      if (window.frameElement) {
        return false;
      }

      console.log('Using OAuth (implicit grant) for login');
      console.info('Setting app ID to', appID);
      ls.get(LOCAL_STORAGE_PREFIX + 'clientAppId', appID);
      this._clientAppId = appID;

      // Handle new token details if we've completed a sign in
      if (checkUrlForToken(window.location.hash)) {
        console.log('Token found in URL');
        var tokenDetails = parseUrl(window.location.hash);
        this._handleNewBearerToken(tokenDetails);

        // And redirect to the desired page
        var url = ls.get(LOCAL_STORAGE_PREFIX + 'redirectUri');
        location.assign(url);
      }

      // If not, let's try and pick up an existing Panoptes session anyway
      this._checkForPanoptesSession()
        .then(function(tokenDetails) {
          this._handleNewBearerToken(tokenDetails);
          resolve(tokenDetails)
        }.bind(this))
        .catch(function (error) {
          // We probably haven't signed in before
          console.info(error);
          resolve(null);
        });

    }.bind(this));


  },

  signIn: function(redirectUri) {
    console.log('Signing in with OAuth');
    var originalArguments = arguments;
    return this.checkCurrent()
      .then(function (token) {
        if (token) {
          return this.signOut().then(function() {
            return this.signIn.apply(this, originalArguments);
          }.bind(this));
        } else {
          this._saveRedirectUri(redirectUri);
          location.assign(this._createOAuthUrl(redirectUri));
        }
      }.bind(this));
  },

  signOut: function() {
    console.log('Signing out');
    return this.checkCurrent().then(function(user) {
      if (user) {
        return this._getAuthToken().then(function(token) {
          var url = config.oauthHost + '/users/sign_out';

          var deleteHeaders = Object.create(JSON_HEADERS);
          deleteHeaders['X-CSRF-Token'] = token;

          return makeHTTPRequest('DELETE', url, null, deleteHeaders)
            .then(function() {
              this._deleteBearerToken();
              this.update({
                _currentUserPromise: Promise.resolve(null),
              });
              console.info('Signed out');
              return null;
            }.bind(this))
            .catch(function(request) {
              console.error('Failed to sign out');
              return apiClient.handleError(request);
            }.bind(this));
        }.bind(this));
      } else {
        throw new Error('Failed to sign out; not signed in');
      }
    }.bind(this));
  },

  _createOAuthUrl: function(redirectUri) {
    if (!this._clientAppId) {
      throw new Error('Client app ID not set');
    }

    return [
      config.oauthHost,
      '/oauth/authorize',
      '?response_type=token',
      '&client_id=',
      this._clientAppId,
      '&redirect_uri=',
      redirectUri
    ].join('');
  },

  _bearerTokenIsExpired: function() {
    var tokenDetails = JSON.parse(SESSION_STORAGE.getItem(LOCAL_STORAGE_PREFIX + 'tokenDetails'));
    if (tokenDetails) {
      return Date.now() >= tokenDetails.expires_at - TOKEN_EXPIRATION_ALLOWANCE;
    } else {
      return false;
    }
  },

  _checkForPanoptesSession: function() {
    var sessionTokenDetails = JSON.parse(SESSION_STORAGE.getItem(LOCAL_STORAGE_PREFIX + 'tokenDetails'));
    var redirectUri = ls.get(LOCAL_STORAGE_PREFIX + 'redirectUri');
    this.update({
      _currentSessionCheckPromise: new Promise(function(resolve, reject) {
        if (sessionTokenDetails) {
          resolve(sessionTokenDetails);
        }

        if (!redirectUri) {
          reject(Error('No redirect URI found'));
        }

        // Create a new iFrame
        var url = this._createOAuthUrl(redirectUri);
        this._iframe = createIFrame(url);

        // Try and get the token details from our iFrame. If it throws an error,
        // it's because we're being redirected to the signin page (and therefore
        // there is no session) - so we should also replace the security error
        // with a more relevant one.
        this._iframe.onload = function() {
          try {
            var newUrl = this._iframe.contentWindow.location.href;
            if (checkUrlForToken(newUrl)) {
              console.info('Found existing Panoptes session');
              var newTokenDetails = parseUrl(newUrl);
              resolve(newTokenDetails);
            } else {
              throw new TypeError('Valid OAuth details not found in URL');
            }
          } catch (error) {
            if (error.name === 'SecurityError') {
              console.warn('No existing Panoptes session found');
            }
            reject(error);
          } finally {
            this._iframe = destroyIFrame(this._iframe);
          }
        }.bind(this);
      }.bind(this))
    });

    return this._currentSessionCheckPromise;
  },

  _deleteBearerToken: function() {
    console.log('Deleting bearer token');
    this._tokenDetails = null;
    delete apiClient.headers.Authorization;
    SESSION_STORAGE.removeItem(LOCAL_STORAGE_PREFIX + 'tokenDetails');
  },

  _getAuthToken: function() {
    console.log('Getting auth token');
    var url = config.oauthHost + '/users/sign_in/?now=' + Date.now();
    return makeHTTPRequest('GET', url, null, JSON_HEADERS)
      .then(function(response) {
        var authToken = response.header['x-csrf-token'];
        console.info('Got auth token', authToken.slice(-6));
        return authToken;
      })
      .catch(function(response) {
        console.error('Failed to get auth token');
        apiClient.handleError(response);
      });
  },

  _getSession: function() {
    console.log('Getting session');
    return apiClient.get('/me')
      .then(function(users) {
        var user = users[0];
        console.info('Got session', user.login, user.id);
        return user;
      })
      .catch(function(error) {
        console.error('Failed to get session');
        throw error;
      });
  },

  _handleNewBearerToken: function(tokenDetails) {
    console.log('Got new bearer token', tokenDetails.access_token.slice(-6));
    this._tokenDetails = tokenDetails;
    apiClient.headers.Authorization = 'Bearer ' + tokenDetails.access_token;

    var refresh = this._refreshBearerToken.bind(this);
    var timeToRefresh = (tokenDetails.expires_in * 1000) - TOKEN_EXPIRATION_ALLOWANCE;
    this._bearerRefreshTimeout = setTimeout(refresh, timeToRefresh);
    tokenDetails.expires_at = Date.now() + (tokenDetails.expires_in * 1000);
    SESSION_STORAGE.setItem(LOCAL_STORAGE_PREFIX + 'tokenDetails', JSON.stringify(tokenDetails));
    return tokenDetails;
  },

  _refreshBearerToken: function() {
    this._deleteBearerToken();
    return this._checkForPanoptesSession()
      .then(function(tokenDetails) {
        return this._handleNewBearerToken(tokenDetails);
      }.bind(this))
      .catch(function (error) {
        console.info('Panoptes session has expired');
        console.log(error);
      });
  },

  _saveRedirectUri: function(redirectUri) {
    console.info('Saving redirectUri:', redirectUri);
    ls.set(LOCAL_STORAGE_PREFIX + 'redirectUri', redirectUri);
  }

});

// Utility functions
function checkUrlForToken(string) {
  return string.indexOf('access_token') !== -1 &&
    string.indexOf('token_type=bearer') !== -1;
}

function parseUrl(string) {
  var params = string.slice(1).split('&');
  var tokenDetails = {};
  params.forEach(function(paramString) {
    var param = paramString.split('=');
    tokenDetails[param[0]] = param[1];
  });
  return tokenDetails;
}

function isTokenStillValid(tokenDetails) {
  return (tokenDetails.started_at + tokenDetails.expires_in) > Date.now();
}

function createIFrame(url) {
  var iframe = document.createElement('iframe');
  iframe.setAttribute('src', url);
  iframe.setAttribute('style', 'display: none;');
  document.body.appendChild(iframe);
  return iframe;
}

function destroyIFrame(iframe) {
  iframe.parentNode.removeChild(iframe);
  return null;
}
