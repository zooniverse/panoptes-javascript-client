var JSONAPIClient = require('json-api-client');
var Model = JSONAPIClient.Model;
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;
var config = require('./config');
var apiClient = require('./api-client');

// Use this to override the default API-specific headers.
var JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// We don't want to wait until the token is already expired before refreshing it.
var BEARER_TOKEN_EXPIRATION_ALLOWANCE = 60 * 1000;

module.exports = new Model({
  _currentUserPromise: null,

  _bearerToken: '',
  _bearerTokenExpiration: NaN,
  _refreshToken: '',
  _tokenRefreshPromise: null,

  _getAuthToken: function() {
    console.log('Getting auth token');
    var url = config.host + '/users/sign_in/?now=' + Date.now();
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

  _getBearerToken: function() {
    console.log('Getting bearer token');
    if (this._bearerToken) {
      console.info('Already had a bearer token', this._bearerToken);
      return Promise.resolve(this._bearerToken);
    } else {
      var url = config.host + '/oauth/token';

      var data = {
        'grant_type': 'password',
        'client_id': config.clientAppID,
      };

      return makeHTTPRequest('POST', url, data, JSON_HEADERS)
        .then(function(request) {
          var token = this._handleNewBearerToken(request);
          console.info('Got bearer token', token.slice(-6));
          return token;
        }.bind(this))
        .catch(function(request) {
          // You're probably not signed in.
          console.error('Failed to get bearer token');
          return apiClient.handleError(request);
        });
    }
  },

  _handleNewBearerToken: function(request) {
    var response = JSON.parse(request.text);

    this._bearerToken = response.access_token;
    apiClient.headers.Authorization = 'Bearer ' + this._bearerToken;

    this._bearerTokenExpiration = Date.now() + (response.expires_in * 1000);
    this._refreshToken = response.refresh_token;

    return this._bearerToken;
  },

  _bearerTokenIsExpired: function() {
    return Date.now() >= this._bearerTokenExpiration - BEARER_TOKEN_EXPIRATION_ALLOWANCE;
  },

  _refreshBearerToken: function() {
    if (this._tokenRefreshPromise === null) {
      console.log('Refreshing expired bearer token');

      var url = config.host + '/oauth/token';

      var data = {
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
        client_id: config.clientAppID,
      };

      this._tokenRefreshPromise = makeHTTPRequest('POST', url, data, JSON_HEADERS)
        .then(function(request) {
          var token = this._handleNewBearerToken(request);
          console.info('Refreshed bearer token', token.slice(-6));
        }.bind(this))
        .catch(function(request) {
          console.error('Failed to refresh bearer token');
          apiClient.handleError(request);
        })
        .then(function() {
          this._tokenRefreshPromise = null;
        }.bind(this));
    }

    return this._tokenRefreshPromise;
  },

  _deleteBearerToken: function() {
    this._bearerToken = '';
    delete apiClient.headers.Authorization;
    this._bearerTokenExpiration = NaN;
    this._refreshToken = '';
    console.log('Deleted bearer token');
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

  register: function(given) {
    var originalArguments = arguments;
    return this.checkCurrent().then(function(user) {
      if (user) {
        return this.signOut().then(function() {
          return this.register.apply(this, originalArguments);
        }.bind(this));
      } else {
        console.log('Registering new account', given.login);
        var registrationRequest = this._getAuthToken().then(function(token) {
          var data = {
            authenticity_token: token,
            user: {
              login: given.login,
              email: given.email,
              password: given.password,
              credited_name: given.credited_name,
              global_email_communication: given.global_email_communication,
              project_id: given.project_id,
              beta_email_communication: given.beta_email_communication,
              project_email_communication: given.project_email_communication,
            },
          };

          // This URL is outside the API, but it actually returns a JSON-API response, so handle it with the client.
          return apiClient.post('/../users', data, JSON_HEADERS)
            .then(function() {
              return this._getBearerToken().then(function() {
                return this._getSession().then(function(user) {
                  console.info('Registered account', user.login, user.id);
                  return user;
                });
              }.bind(this));
            }.bind(this))
            .catch(function(error) {
              console.error('Failed to register');
              throw error;
            });
        }.bind(this));

        this.update({
          _currentUserPromise: registrationRequest.catch(function() {
            return null;
          }),
        });

        return registrationRequest;
      }
    }.bind(this));
  },

  checkCurrent: function() {
    if (!this._currentUserPromise) {
      console.log('Checking current user');
      this.update({
        _currentUserPromise: this._getBearerToken()
          .then(function() {
            return this._getSession();
          }.bind(this))
          .catch(function() {
            // Nobody's signed in. This isn't an error.
            console.info('No current user');
            return null;
          }),
      });
    }

    return this._currentUserPromise;
  },

  checkBearerToken: function() {
    var awaitBearerToken;
    if (this._bearerTokenIsExpired()) {
      awaitBearerToken = this._refreshBearerToken();
    } else {
      awaitBearerToken = Promise.resolve(this._bearerToken);
    }
    return awaitBearerToken;
  },

  signIn: function(credentials) {
    var originalArguments = arguments;
    return this.checkCurrent().then(function(user) {
      if (user) {
        return this.signOut().then(function() {
          return this.signIn.apply(this, originalArguments);
        }.bind(this));
      } else {
        console.log('Signing in', credentials.login);
        var signInRequest = this._getAuthToken().then(function(token) {
          var url = config.host + '/users/sign_in';

          var data = {
            authenticity_token: token,
            user: {
              login: credentials.login,
              password: credentials.password,
              remember_me: true,
            },
          };

          return makeHTTPRequest('POST', url, data, JSON_HEADERS)
            .then(function() {
              return this._getBearerToken().then(function() {
                return this._getSession().then(function(user) {
                  console.info('Signed in', user.login, user.id);
                  return user;
                }.bind(this));
              }.bind(this));
            }.bind(this))
            .catch(function(request) {
              console.error('Failed to sign in');
              apiClient.handleError(request);
            });
        }.bind(this));

        this.update({
          _currentUserPromise: signInRequest.catch(function() {
            return null;
          }),
        });

        return signInRequest;
      }
    }.bind(this));
  },

  changePassword: function(given) {
    return this.checkCurrent().then(function(user) {
      if (user) {
        return this._getAuthToken().then(function(token) {
          var data = {
            authenticity_token: token,
            user: {
              current_password: given.current,
              password: given.replacement,
              password_confirmation: given.replacement,
            },
          };

          return apiClient.put('/../users', data, JSON_HEADERS)
            .then(function() {
              // Rough, but it'll do for now. Without signing out and back in, the session is lost.
              return this.signOut();
            }.bind(this))
            .then(function() {
              return this.signIn({
                login: user.login,
                password: given.replacement,
              });
            }.bind(this));
        }.bind(this));
      } else {
        throw new Error('No signed-in user to change the password for');
      }
    }.bind(this));
  },

  requestPasswordReset: function(given) {
    return this._getAuthToken().then(function(token) {
      var data = {
        authenticity_token: token,
        user: {
          email: given.email,
        },
      };

      return apiClient.post('/../users/password', data, JSON_HEADERS);
    }.bind(this));
  },

  resetPassword: function(given) {
    return this._getAuthToken().then(function(authToken) {
      var data = {
        authenticity_token: authToken,
        user: {
          password: given.password,
          password_confirmation: given.confirmation,
          reset_password_token: given.token,
        },
      };

      return apiClient.put('/../users/password', data, JSON_HEADERS);
    }.bind(this));
  },

  disableAccount: function() {
    console.log('Disabling account');
    return this.checkCurrent().then(function(user) {
      if (user) {
        return user.delete().then(function() {
          this._deleteBearerToken();
          this.update({
            _currentUserPromise: Promise.resolve(null),
          });
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
      if (user) {
        return this._getAuthToken().then(function(token) {
          var url = config.host + '/users/sign_out';

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

  unsubscribeEmail: function(given) {
    return this._getAuthToken().then(function(token) {
      var url = config.host + '/unsubscribe';

      var data = {
        authenticity_token: token,
        email: given.email,
      };

      return makeHTTPRequest('POST', url, data, JSON_HEADERS);
    }.bind(this));
  },
});
