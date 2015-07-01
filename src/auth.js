import JSONAPIClient from 'json-api-client';

import { exists } from './utils';

let { Model, makeHTTPRequest } = JSONAPIClient;

export default function(panoptesClient) {
  // Use this to override the default API-specific headers.
  const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // PhantomJS doesn't send any data with DELETE, so fake it here.
  const DELETE_METHOD_OVERRIDE_HEADERS = Object.create(JSON_HEADERS);
  DELETE_METHOD_OVERRIDE_HEADERS['X-HTTP-Method-Override'] = 'DELETE';

  // This will match the CSRF token in a string of HTML.
  // TODO: Get JSON instead.
  const CSRF_TOKEN_PATTERN = (function() {
    const CONTENT_ATTR = 'content=[\'"](.+)[\'"]',
        NAME_ATTR = 'name=[\'"]csrf-token[\'"]';
    return RegExp(NAME_ATTR + "\\s*" + CONTENT_ATTR + "|" + CONTENT_ATTR + "\\s*" + NAME_ATTR);
  })();

  // We don't want to wait until the token is already expired before refreshing it.
  const TOKEN_EXPIRATION_ALLOWANCE = 10 * 1000

  let host = panoptesClient.host;
  let api = panoptesClient.api;

  let auth = new Model({
    _currentUserPromise: null,
    _bearerToken: '',
    _bearerRefreshTimeout: NaN,

    _getAuthToken: function() {
      console.log('Getting auth token');

      let authTokenRequest = makeHTTPRequest('GET', host + '/?now=' + Date.now(), null, {'Accept': 'text/html'})
        .then(function(request) {
          let [_, authTokenMatch1, authTokenMatch2] = request.responseText.match(CSRF_TOKEN_PATTERN),
              authToken = authTokenMatch1 ? authTokenMatch1 : authTokenMatch2;

          console.info('Got auth token ' + authToken.slice(0, 6) + '...');
          return authToken;
        }).catch(function(request) {
          console.error('Failed to get auth token');
          return api.handleError(request);
        });

      return authTokenRequest;
    },

    _getBearerToken: function() {
      console.log('Getting bearer token');

      if (this._bearerToken) {
        console.info('Already had a bearer token', this._bearerToken);
        return Promise.resolve(this._bearerToken);
      } else {
        let bearerTokenRequest,
            data = {
              grant_type: 'password',
              client_id: panoptesClient.appID
            };

        return bearerTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS)
          .then((request) => {
            let token = this._handleNewBearerToken(request);
            console.info('Got bearer token ' + token.slice(0, 6) + '...');
            return token;
          }).catch(function(request) {
            // You're probably not signed in.
            console.error('Failed to get bearer token');
            return api.handleError(request);
          });
      }
    },

    _handleNewBearerToken: function(request) {
      let response = JSON.parse(request.responseText);

      this._bearerToken = response.access_token;
      panoptesClient.headers['Authorization'] = 'Bearer ' + this._bearerToken;

      let refresh = this._refreshBearerToken.bind(this, response.refresh_token);
      let timeToRefresh = (response.expires_in * 1000) - TOKEN_EXPIRATION_ALLOWANCE;
      this._bearerRefreshTimeout = setTimeout(refresh, timeToRefresh);

      return this._bearerToken;
    },

    _refreshBearerToken: function(refreshToken) {
      let data = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: panoptesClient.appID
      };

      let refreshTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS)
        .then((request) => {
          let token = this._handleNewBearerToken(request);
          console.info('Refreshed bearer token ' + token.slice(0, 6) + '...')
        }).catch(function(request) {
          console.error('Failed to refersh bearer token');
          return api.handleError(request);
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
      console.log('Getting session');

      return api.get('/me')
        .then(function(response) {
          let user = response[0];
          console.info('Got session', user.login, user.id);
          return response[0];
        })
        .catch(function(error) {
          console.error('Failed to get session');
          throw(error);
        });
    },

    register: function(opts) {
      if (!exists(opts)) {
        opts = {};
      }

      return this.checkCurrent().then(user => {
        if (exists(user)) {
          return this.signOut().then(() => {
            return this.register(opts);
          });
        } else {
          let registrationRequest = this._getAuthToken().then((token) => {
            let data = {
              authenticity_token: token,
              user: opts
            }

            // This weird URL is actually out of the API, but returns a JSON-API response.
            return api.post('/../users', data, JSON_HEADERS)
              .then(() => {
                return this._getBearerToken().then(() => {
                  return this._getSession().then(function(user) {
                    return user;
                  });
                });
              })
              .catch(function(error) {
                throw(error);
              });
          });

          this.update({
            _currentUserPromise: registrationRequest.catch(() => { return null; })
          });

          return registrationRequest;
        }
      });
    },

    checkCurrent: function() {
      if (!exists(this._currentUserPromise)) {
        console.log('Checking current user');

        this.update({
          _currentUserPromise: this._getBearerToken()
            .then(() => {
              return this._getSession();
            })
            .catch(function() {
              // Nobody's signed in. This isn't an error.
              console.info('No current user');
              return null;
            })
        });
      }

      return this._currentUserPromise;
    },

    signIn: function(opts) {
      if (!exists(opts)) {
        opts = {};
      }

      return this.checkCurrent().then((user) => {
        if (exists(user)) {
          return this.signOut().then(() => {
            return this.signIn(opts);
          });
        } else {
          let signInRequest = this._getAuthToken().then((token) => {
            let data = {
              authenticity_token: token,
              user: opts
            };

            return makeHTTPRequest('POST', host + '/users/sign_in', data, JSON_HEADERS)
              .then(() => {
                return this._getBearerToken().then(() => {
                  return this._getSession().then((user) => {
                    console.info('Signed in', user.login, user.id);
                    return user;
                  });
                });
              })
              .catch(function(request) {
                console.error('Failed to sign in');
                return api.handleError(request);
              });
          });

          this.update({
            _currentUserPromise: signInRequest.catch(function() { return null; })
          });

          return signInRequest;
        }
      })
    },

    disableAccount: function() {
      console.log('Disabling account');

      return this.checkCurrent().then((user) => {
        if (exists(user)) {
          return user.delete().then(() => {
            this._deleteBearerToken();
            this.update({_currentUserPromise: Promise.resolve(null)});
            console.info('Disabled account');
            return null;
          });
        } else {
          throw new Error('Failed to disable account; not signed in');
        }
      });
    },

    signOut: function() {
      console.log('Signing out');

      return this.checkCurrent().then((user) => {
        return this._getAuthToken().then((token) => {
          let data = {
            authenticity_token: token
          };

          return makeHTTPRequest('POST', host + '/users/sign_out', data, DELETE_METHOD_OVERRIDE_HEADERS).then(() => {
            this._deleteBearerToken();
            this.update({_currentUserPromise: Promise.resolve(null)});
            console.info('Signed out');
            return null;
          })
          .catch(function(request) {
            console.error('Failed to sign out');
            return api.handleError(request);
          });
        });
      });
    }
  });

  return auth;
};
