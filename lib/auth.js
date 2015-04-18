var utils = require('./utils'),
    exists = utils.exists,
    console = utils.console;
    
var Promise = require('promise');

var PanoptesClient = require('./client');
var JSONAPIClient = require('json-api-client'),
    Model = JSONAPIClient.Model,
    makeHTTPRequest = JSONAPIClient.makeHTTPRequest;

module.exports = function(panoptesClient) {
  // Use this to override the default API-specific headers.
  var JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // PhantomJS doesn't send any data with DELETE, so fake it here.
  var DELETE_METHOD_OVERRIDE_HEADERS = Object.create(JSON_HEADERS);
  DELETE_METHOD_OVERRIDE_HEADERS['X-HTTP-Method-Override'] = 'DELETE';

  // This will match the CSRF token in a string of HTML.
  // TODO: Get JSON instead.
  var CSRF_TOKEN_PATTERN = (function() {
    var CONTENT_ATTR, NAME_ATTR;
    NAME_ATTR = 'name=[\'"]csrf-token[\'"]';
    CONTENT_ATTR = 'content=[\'"](.+)[\'"]';
    return RegExp(NAME_ATTR + "\\s*" + CONTENT_ATTR + "|" + CONTENT_ATTR + "\\s*" + NAME_ATTR);
  })();

  // We don't want to wait until the token is already expired before refreshing it.
  var TOKEN_EXPIRATION_ALLOWANCE = 10 * 1000

  var host = panoptesClient.host;
  var api = panoptesClient.api;

  var auth = new Model({
    _currentUserPromise: null,
    _bearerToken: '',
    _bearerRefreshTimeout: NaN,

    _getAuthToken: function() {
      console.log('Getting auth token');

      var authTokenRequest = makeHTTPRequest('GET', host + '/?now=' + Date.now(), null, {'Accept': 'text/html'}).then(function(request) {
        var ref = request.responseText.match(CSRF_TOKEN_PATTERN),
            authTokenMatch1 = ref[1],
            authTokenMatch2 = ref[2],
            authToken = authTokenMatch1 ? authTokenMatch1 : authTokenMatch2;

        console.info('Got auth token ' + authToken.slice(0, 6) + '...');
        return authToken;
      }).catch(function(request) {
        console.error('Failed to get auth token');
        panoptesClient.handleError(request);
      });

      return authTokenRequest;
    },

    _getBearerToken: function() {
      console.log('Getting bearer token');

      if (this._bearerToken) {
        console.info('Already had a bearer token', this._bearerToken);
        return Promise.resolve(this._bearerToken);
      } else {
        var bearerTokenRequest,
            data = {
              grant_type: 'password',
              client_id: panoptesClient.appID
            };

        return bearerTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS).then(function(request) {
          var token = this._handleNewBearerToken(request);
          console.info('Got bearer token ' + token.slice(0, 6) + '...');
          return token;
        }.bind(this)).catch(function(request) {
          // You're probably not signed in.
          console.error('Failed to get bearer token');
          panoptesClient.handleError(request);
        });
      }
    },

    _handleNewBearerToken: function(request) {
      var response = JSON.parse(request.responseText);

      this._bearerToken = response.access_token;
      panoptesClient.headers['Authorization'] = 'Bearer ' + this._bearerToken;

      var refresh = this._refreshBearerToken.bind(this, response.refresh_token);
      var timeToRefresh = (response.expires_in * 1000) - TOKEN_EXPIRATION_ALLOWANCE;
      this._bearerRefreshTimeout = setTimeout(refresh, timeToRefresh);

      return this._bearerToken;
    },

    _refreshBearerToken: function(refreshToken) {
      var data = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: panoptesClient.appID
      };

      var refreshTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS).then(function(request) {
        var token = this._handleNewBearerToken(request);
        console.info('Refreshed bearer token ' + token.slice(0, 6) + '...')
      }.bind(this)).catch(function(request) {
        console.error('Failed to refersh bearer token');
        panoptesClient.handleError(request);
      });

      return refreshTokenRequest;
    },

    _deleteBearerToken: function() {
      this._bearerToken = '';
      delete panoptesClient.headers['Authorization'];
      clearTimeout(this._bearerRefreshTimeout);
      console.log('Deleted bearer token');
    },

    _getSession: function() {
      return api.get('/me')
        .then(function(response) {
          var user = response[0];
          console.info('Got session', user.display_name, user.id);
          return user;
        }.bind(this))
        .catch(function(error) {
          console.error('Failed to get session');
          throw(error);
        });
    },

    register: function(opts) {
      var display_name = opts.display_name,
          email = opts.email,
          password = opts.password,
          global_email_communication = opts.global_email_communication;

      return this.checkCurrent().then(function(user) {
        if (exists(user)) {
          return this.signOut().then(function() {
            return this.register({
              display_name: display_name,
              email: email,
              password: password,
              global_email_communication: global_email_communication
            });
          }.bind(this));
        } else {
          console.log('Registering new account', display_name);

          var registrationRequest = this._getAuthToken().then(function(token) {
            var data = {
              authenticity_token: token,
              user: {
                display_name: display_name,
                email: email,
                password, password,
                global_email_communication: global_email_communication
              }
            }

            // This weird URL is actually out of the API, but returns a JSON-API response.
            api.post('/../users', data, JSON_HEADERS).then(function() {
              this._getBearerToken().then(function() {
                this._getSession().then(function(user) {
                  console.info('Registered account', user.display_name, user.id);
                  return user;
                }.bind(this));
              }.bind(this));
            }.bind(this)).catch(function(error) {
              console.error('Failed to register');
              throw(error);
            });
          }.bind(this));

          this.update({
            _currentUserPromise: registrationRequest.catch(function() {})
          });

          return registrationRequest;
        }
      }.bind(this));
    },

    checkCurrent: function() {
      if (!exists(this._currentUserPromise)) {
        console.log('Checking current user');

        var currentUserPromise = this._getBearerToken()
          .then(function() {
            return this._getSession();
          }.bind(this))
          .catch(function() {
            // Nobody's signed in. This isn't an error.
            console.info('No current user');
            return null;
          });

        this.update({_currentUserPromise: currentUserPromise});
      }

      return this._currentUserPromise;
    },

    signIn: function(opts) {
      var display_name = opts.display_name,
          password = opts.password;

      return this.checkCurrent().then(function(user) {
        if (exists(user)) {
          return this.signOut().then(function() {
            return this.signIn(opts);
          });
        } else {
          console.log('Signing in', display_name);

          var signInRequest = this._getAuthToken().then(function(token) {
            var data = {
              authenticity_token: token,
              user: opts
            };

            return makeHTTPRequest('POST', host + '/users/sign_in', data, JSON_HEADERS)
              .then(function() {
                return this._getBearerToken().then(function() {
                  return this._getSession().then(function(user) {
                    console.info('Signed in', user.display_name, user.id);
                    return user;
                  });
                }.bind(this));
              }.bind(this))
              .catch(function(error) {
                console.error('Failed to sign in');
                panoptesClient.handleError(request);
              });
          }.bind(this));

          this.update({
            _currentUserPromise: signInRequest.catch(function() {})
          });

          return signInRequest;
        }
      }.bind(this))
    },

    disableAccount: function() {
      console.log('Disabling account');

      return this.checkCurrent().then(function(user) {
        if (exists(user)) {
          return user.delete().then(function() {
            this._deleteBearerToken();
            this.update({_currentUserPromise: Promise.resolve(null)});
            console.info('Disabled account');
            return null;
          }.bind(this));
        } else {
          throw new Error('Failed to disable account; not signed in');
        }
      }.bind(this));
    },

    signOut: function() {
      console.log('Signing out');

      return this.checkCurrent().then(function(user) {
        return this._getAuthToken().then(function(token) {
          var data = {
            authenticity_token: token
          };

          return makeHTTPRequest('POST', host + '/users/sign_out', data, DELETE_METHOD_OVERRIDE_HEADERS).then(function() {
            this._deleteBearerToken();
            this.update({_currentUserPromise: Promise.resolve(null)});
            console.info('Signed out');
            return null;
          }.bind(this))
          .catch(function(request) {
            console.error('Failed to sign out');
            panoptesClient.handleError(request);
          });
        }.bind(this));
      }.bind(this));
    }
  });

  return auth;
};
