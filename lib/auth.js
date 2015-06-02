'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _slicedToArray(arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }

var _jsonApiClient = require('json-api-client');

var _jsonApiClient2 = _interopRequireDefault(_jsonApiClient);

var _utils = require('./utils');

var Model = _jsonApiClient2['default'].Model;
var makeHTTPRequest = _jsonApiClient2['default'].makeHTTPRequest;

exports['default'] = function (panoptesClient) {
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
  var CSRF_TOKEN_PATTERN = (function () {
    var CONTENT_ATTR = 'content=[\'"](.+)[\'"]',
        NAME_ATTR = 'name=[\'"]csrf-token[\'"]';
    return RegExp(NAME_ATTR + '\\s*' + CONTENT_ATTR + '|' + CONTENT_ATTR + '\\s*' + NAME_ATTR);
  })();

  // We don't want to wait until the token is already expired before refreshing it.
  var TOKEN_EXPIRATION_ALLOWANCE = 10 * 1000;

  var host = panoptesClient.host;
  var api = panoptesClient.api;

  var auth = new Model({
    _currentUserPromise: null,
    _bearerToken: '',
    _bearerRefreshTimeout: NaN,

    _getAuthToken: function _getAuthToken() {
      console.log('Getting auth token');

      var authTokenRequest = makeHTTPRequest('GET', host + '/?now=' + Date.now(), null, { 'Accept': 'text/html' }).then(function (request) {
        var _request$responseText$match = request.responseText.match(CSRF_TOKEN_PATTERN);

        var _request$responseText$match2 = _slicedToArray(_request$responseText$match, 3);

        var _ = _request$responseText$match2[0];
        var authTokenMatch1 = _request$responseText$match2[1];
        var authTokenMatch2 = _request$responseText$match2[2];
        var authToken = authTokenMatch1 ? authTokenMatch1 : authTokenMatch2;

        console.info('Got auth token ' + authToken.slice(0, 6) + '...');
        return authToken;
      })['catch'](function (request) {
        console.error('Failed to get auth token');
        return api.handleError(request);
      });

      return authTokenRequest;
    },

    _getBearerToken: function _getBearerToken() {
      var _this = this;

      console.log('Getting bearer token');

      if (this._bearerToken) {
        console.info('Already had a bearer token', this._bearerToken);
        return Promise.resolve(this._bearerToken);
      } else {
        var bearerTokenRequest = undefined,
            data = {
          grant_type: 'password',
          client_id: panoptesClient.appID
        };

        return bearerTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS).then(function (request) {
          var token = _this._handleNewBearerToken(request);
          console.info('Got bearer token ' + token.slice(0, 6) + '...');
          return token;
        })['catch'](function (request) {
          // You're probably not signed in.
          console.error('Failed to get bearer token');
          return api.handleError(request);
        });
      }
    },

    _handleNewBearerToken: function _handleNewBearerToken(request) {
      var response = JSON.parse(request.responseText);

      this._bearerToken = response.access_token;
      panoptesClient.headers['Authorization'] = 'Bearer ' + this._bearerToken;

      var refresh = this._refreshBearerToken.bind(this, response.refresh_token);
      var timeToRefresh = response.expires_in * 1000 - TOKEN_EXPIRATION_ALLOWANCE;
      this._bearerRefreshTimeout = setTimeout(refresh, timeToRefresh);

      return this._bearerToken;
    },

    _refreshBearerToken: function _refreshBearerToken(refreshToken) {
      var _this2 = this;

      var data = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: panoptesClient.appID
      };

      var refreshTokenRequest = makeHTTPRequest('POST', host + '/oauth/token', data, JSON_HEADERS).then(function (request) {
        var token = _this2._handleNewBearerToken(request);
        console.info('Refreshed bearer token ' + token.slice(0, 6) + '...');
      })['catch'](function (request) {
        console.error('Failed to refersh bearer token');
        return api.handleError(request);
      });

      return refreshTokenRequest;
    },

    _deleteBearerToken: function _deleteBearerToken() {
      this._bearerToken = '';
      delete panoptesClient.headers['Authorization'];
      clearTimeout(this._bearerRefreshTimeout);
      console.log('Deleted bearer token');
    },

    _getSession: function _getSession() {
      console.log('Getting session');

      return api.get('/me').then(function (response) {
        var user = response[0];
        console.info('Got session', user.display_name, user.id);
        return response[0];
      })['catch'](function (error) {
        console.error('Failed to get session');
        throw error;
      });
    },

    register: function register(opts) {
      var _this3 = this;

      if (!(0, _utils.exists)(opts)) {
        opts = {};
      }

      var display_name = opts.display_name,
          email = opts.email,
          password = opts.password,
          global_email_communication = opts.global_email_communication;

      return this.checkCurrent().then(function (user) {
        if ((0, _utils.exists)(user)) {
          return _this3.signOut().then(function () {
            return _this3.register({
              display_name: display_name,
              email: email,
              password: password,
              global_email_communication: global_email_communication
            });
          });
        } else {
          console.log('Registering new account', display_name);

          var registrationRequest = _this3._getAuthToken().then(function (token) {
            var data = {
              authenticity_token: token,
              user: opts
            };

            // This weird URL is actually out of the API, but returns a JSON-API response.
            return api.post('/../users', data, JSON_HEADERS).then(function () {
              return _this3._getBearerToken().then(function () {
                return _this3._getSession().then(function (user) {
                  console.info('Registered account', user.display_name, user.id);
                  return user;
                });
              });
            })['catch'](function (error) {
              console.error('Failed to register');
              throw error;
            });
          });

          _this3.update({
            _currentUserPromise: registrationRequest['catch'](function () {
              return null;
            })
          });

          return registrationRequest;
        }
      });
    },

    checkCurrent: function checkCurrent() {
      var _this4 = this;

      if (!(0, _utils.exists)(this._currentUserPromise)) {
        console.log('Checking current user');

        this.update({
          _currentUserPromise: this._getBearerToken().then(function () {
            return _this4._getSession();
          })['catch'](function () {
            // Nobody's signed in. This isn't an error.
            console.info('No current user');
            return null;
          })
        });
      }

      return this._currentUserPromise;
    },

    signIn: function signIn(opts) {
      var _this5 = this;

      if (!(0, _utils.exists)(opts)) {
        opts = {};
      }

      var display_name = opts.display_name,
          password = opts.password;

      return this.checkCurrent().then(function (user) {
        if ((0, _utils.exists)(user)) {
          return _this5.signOut().then(function () {
            return _this5.signIn(opts);
          });
        } else {
          console.log('Signing in', display_name);

          var signInRequest = _this5._getAuthToken().then(function (token) {
            var data = {
              authenticity_token: token,
              user: opts
            };

            return makeHTTPRequest('POST', host + '/users/sign_in', data, JSON_HEADERS).then(function () {
              return _this5._getBearerToken().then(function () {
                return _this5._getSession().then(function (user) {
                  console.info('Signed in', user.display_name, user.id);
                  return user;
                });
              });
            })['catch'](function (request) {
              console.error('Failed to sign in');
              return api.handleError(request);
            });
          });

          _this5.update({
            _currentUserPromise: signInRequest['catch'](function () {
              return null;
            })
          });

          return signInRequest;
        }
      });
    },

    disableAccount: function disableAccount() {
      var _this6 = this;

      console.log('Disabling account');

      return this.checkCurrent().then(function (user) {
        if ((0, _utils.exists)(user)) {
          return user['delete']().then(function () {
            _this6._deleteBearerToken();
            _this6.update({ _currentUserPromise: Promise.resolve(null) });
            console.info('Disabled account');
            return null;
          });
        } else {
          throw new Error('Failed to disable account; not signed in');
        }
      });
    },

    signOut: function signOut() {
      var _this7 = this;

      console.log('Signing out');

      return this.checkCurrent().then(function (user) {
        return _this7._getAuthToken().then(function (token) {
          var data = {
            authenticity_token: token
          };

          return makeHTTPRequest('POST', host + '/users/sign_out', data, DELETE_METHOD_OVERRIDE_HEADERS).then(function () {
            _this7._deleteBearerToken();
            _this7.update({ _currentUserPromise: Promise.resolve(null) });
            console.info('Signed out');
            return null;
          })['catch'](function (request) {
            console.error('Failed to sign out');
            return api.handleError(request);
          });
        });
      });
    }
  });

  return auth;
};

;
module.exports = exports['default'];