(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require('./lib/client');

},{"./lib/client":3}],2:[function(require,module,exports){
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

},{"./client":3,"./utils":4,"json-api-client":8,"promise":9}],3:[function(require,module,exports){
var utils = require('./utils'),
    exists = utils.exists;

var auth = require('./auth');
var JSONAPIClient = require('json-api-client');

var DEFAULT_OPTS = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes.zooniverse.org',
  root: '/api',
  appID: null
}

function PanoptesClient(opts) {
  if (typeof opts === 'undefined') {
    opts = DEFAULT_OPTS;
  }

  for (var key in DEFAULT_OPTS) {
    if (exists(opts[key])) {
      this[key] = opts[key];
    }
  }

  if (!exists(this.appID)) {
    throw Error('Must provide an app ID');
  }

  this.api = new JSONAPIClient(this.host + this.root, this.headers);
  this.api.auth = auth(this);
}

PanoptesClient.prototype.handleError == function(request) {
  var response, errorMessage = null;

  try {
    response = JSON.parse(request.responseText);
  } catch (error) {}

  if (exists(response) && exists(response.error)) {
    errorMessage = response.error;

    if (exists(response.error_description)) {
      errorMessage = errorMessage + ' ' + response.error_description;
    }
  } else if (exists(response) && exists(response.errors) && exists(response.errors[0].message)) {
    errorMessage = []

    response.errors.forEach(function(error) {
      var message = error.message;

      if (typeof message == 'string') {
        errorMessage.push(message);
      } else {
        var messageParts = [];
        for (var key in messagePart) {
          var part = messagePart[key];
          messageParts.push(key + ' ' + part);
        }
        errorMessage.push(messageParts.join('\n'));
      }
    });

    errorMessage.join('\n');
  }

  if (exists(request.responseText) && request.responseText.indexOf('<!DOCTYPE') != -1) {
    if (errorMessage == null) {
      errorMessage = request.responseText.trim() || request.status + ' ' + request.statusText;
    }
  }

  throw new Error(errorMessage);
}

if (typeof window !== 'undefined') {
  window.PanoptesClient = PanoptesClient;
}

module.exports = PanoptesClient;

},{"./auth":2,"./utils":4,"json-api-client":8}],4:[function(require,module,exports){
var exists = function(variable) {
  return (typeof variable !== 'undefined' && variable !== null)
}

if (!exists(window) && !exists(window.console)) {
  var proxiedConsole = {},
      methodsForLogging = ['log', 'info', 'error'];
  methodsForLogging.forEach(function(method) {    
    proxiedConsole[method] = function() {}
  });
}

module.exports = {
  exists: exists,
  console: (exists(console) ? console : proxiedConsole)
};

},{}],5:[function(require,module,exports){
/*global define:false require:false */
module.exports = (function(){
	// Import Events
	var events = require('events')

	// Export Domain
	var domain = {}
	domain.createDomain = domain.create = function(){
		var d = new events.EventEmitter()

		function emitError(e) {
			d.emit('error', e)
		}

		d.add = function(emitter){
			emitter.on('error', emitError)
		}
		d.remove = function(emitter){
			emitter.removeListener('error', emitError)
		}
		d.bind = function(fn){
			return function(){
				var args = Array.prototype.slice.call(arguments)
				try {
					fn.apply(null, args)
				}
				catch (err){
					emitError(err)
				}
			}
		}
		d.intercept = function(fn){
			return function(err){
				if ( err ) {
					emitError(err)
				}
				else {
					var args = Array.prototype.slice.call(arguments, 1)
					try {
						fn.apply(null, args)
					}
					catch (err){
						emitError(err)
					}
				}
			}
		}
		d.run = function(fn){
			try {
				fn()
			}
			catch (err) {
				emitError(err)
			}
			return this
		};
		d.dispose = function(){
			this.removeAllListeners()
			return this
		};
		d.enter = d.exit = function(){
			return this
		}
		return d
	};
	return domain
}).call(this)
},{"events":6}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],7:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
(function (global){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.JSONAPIClient=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var DEFAULT_SIGNAL, Emitter, arraysMatch, callHandler,
  __slice = [].slice;

DEFAULT_SIGNAL = 'change';

arraysMatch = function(array1, array2) {
  var i, item, matches, _ref;
  matches = (function() {
    var _i, _len, _results;
    _results = [];
    for (i = _i = 0, _len = array1.length; _i < _len; i = ++_i) {
      item = array1[i];
      if (array2[i] === item) {
        _results.push(i);
      }
    }
    return _results;
  })();
  return (array1.length === (_ref = array2.length) && _ref === matches.length);
};

callHandler = function(handler, payload) {
  var boundArgs, context, _ref;
  if (Array.isArray(handler)) {
    _ref = handler, context = _ref[0], handler = _ref[1], boundArgs = 3 <= _ref.length ? __slice.call(_ref, 2) : [];
    if (typeof handler === 'string') {
      handler = context[handler];
    }
  } else {
    boundArgs = [];
  }
  handler.apply(context, boundArgs.concat(payload));
};

module.exports = Emitter = (function() {
  Emitter.prototype._callbacks = null;

  function Emitter() {
    this._callbacks = {};
  }

  Emitter.prototype.listen = function() {
    var callback, signal, _arg, _base, _i;
    _arg = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), callback = arguments[_i++];
    signal = _arg[0];
    if (signal == null) {
      signal = DEFAULT_SIGNAL;
    }
    if ((_base = this._callbacks)[signal] == null) {
      _base[signal] = [];
    }
    this._callbacks[signal].push(callback);
    return this;
  };

  Emitter.prototype.stopListening = function() {
    var callback, handler, i, index, signal, _arg, _i, _j, _ref;
    _arg = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), callback = arguments[_i++];
    signal = _arg[0];
    if (signal == null) {
      signal = DEFAULT_SIGNAL;
    }
    if (this._callbacks[signal] != null) {
      if (callback != null) {
        if (Array.isArray(callback)) {
          index = -1;
          _ref = this._callbacks[signal];
          for (i = _j = _ref.length - 1; _j >= 0; i = _j += -1) {
            handler = _ref[i];
            if (Array.isArray(handler)) {
              if (arraysMatch(callback, handler)) {
                index = i;
                break;
              }
            }
          }
        } else {
          index = this._callbacks[signal].lastIndexOf(callback);
        }
        if (index !== -1) {
          this._callbacks[signal].splice(index, 1);
        }
      } else {
        this._callbacks[signal].splice(0);
      }
    }
    return this;
  };

  Emitter.prototype.emit = function() {
    var callback, payload, signal, _i, _len, _ref;
    signal = arguments[0], payload = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (signal == null) {
      signal = DEFAULT_SIGNAL;
    }
    if (signal in this._callbacks) {
      _ref = this._callbacks[signal];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        callback = _ref[_i];
        callHandler(callback, payload);
      }
    }
    return this;
  };

  Emitter.prototype.destroy = function() {
    var callback, signal, _i, _len, _ref;
    this.emit('destroy');
    for (signal in this._callbacks) {
      _ref = this._callbacks[signal];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        callback = _ref[_i];
        this.stopListening(signal, callback);
      }
    }
  };

  return Emitter;

})();



},{}],2:[function(_dereq_,module,exports){
var DEFAULT_TYPE_AND_ACCEPT, Emitter, JSONAPIClient, Model, RESERVED_TOP_LEVEL_KEYS, Resource, Type, makeHTTPRequest, mergeInto,
  __slice = [].slice,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

makeHTTPRequest = _dereq_('./make-http-request');

mergeInto = _dereq_('./merge-into');

Emitter = _dereq_('./emitter');

Type = _dereq_('./type');

Model = _dereq_('./model');

Resource = _dereq_('./resource');

DEFAULT_TYPE_AND_ACCEPT = {
  'Content-Type': 'application/vnd.api+json',
  'Accept': 'application/vnd.api+json'
};

RESERVED_TOP_LEVEL_KEYS = ['meta', 'links', 'linked', 'data'];

JSONAPIClient = (function() {
  var method, _fn, _i, _len, _ref;

  JSONAPIClient.prototype.root = '/';

  JSONAPIClient.prototype.headers = null;

  JSONAPIClient.prototype._typesCache = null;

  function JSONAPIClient(root, headers) {
    this.root = root;
    this.headers = headers != null ? headers : {};
    this._typesCache = {};
  }

  JSONAPIClient.prototype.request = function(method, url, payload, headers) {
    var allHeaders, fullURL;
    fullURL = this.root + url;
    allHeaders = mergeInto({}, DEFAULT_TYPE_AND_ACCEPT, this.headers, headers);
    return makeHTTPRequest(method, fullURL, payload, allHeaders).then(this.processResponse.bind(this))["catch"](this.handleError.bind(this));
  };

  _ref = ['get', 'post', 'put', 'delete'];
  _fn = function(method) {
    return JSONAPIClient.prototype[method] = function() {
      return this.request.apply(this, [method].concat(__slice.call(arguments)));
    };
  };
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    method = _ref[_i];
    _fn(method);
  }

  JSONAPIClient.prototype.processResponse = function(request) {
    var headers, linkedResources, resourceData, resources, response, results, typeName, _j, _k, _l, _len1, _len2, _len3, _ref1, _ref2, _ref3, _ref4;
    response = (function() {
      try {
        return JSON.parse(request.responseText);
      } catch (_error) {
        return {};
      }
    })();
    headers = this._getHeadersFor(request);
    if ('links' in response) {
      this._handleLinks(response.links);
    }
    if ('linked' in response) {
      _ref1 = response.linked;
      for (typeName in _ref1) {
        linkedResources = _ref1[typeName];
        _ref2 = [].concat(linkedResources);
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          resourceData = _ref2[_j];
          this.type(typeName).create(resourceData, headers, response.meta);
        }
      }
    }
    results = [];
    if ('data' in response) {
      _ref3 = [].concat(response.data);
      for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
        resourceData = _ref3[_k];
        results.push(this.type(resourceData.type).create(resourceData, headers, response.meta));
      }
    } else {
      for (typeName in response) {
        resources = response[typeName];
        if (__indexOf.call(RESERVED_TOP_LEVEL_KEYS, typeName) < 0) {
          _ref4 = [].concat(resources);
          for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
            resourceData = _ref4[_l];
            results.push(this.type(typeName).create(resourceData, headers, response.meta));
          }
        }
      }
    }
    return results;
  };

  JSONAPIClient.prototype._getHeadersFor = function(request) {
    var headers, key, pair, value, _j, _len1, _ref1, _ref2;
    headers = {};
    _ref1 = request.getAllResponseHeaders().split('\n');
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      pair = _ref1[_j];
      if (!(pair !== '')) {
        continue;
      }
      _ref2 = pair.split(':'), key = _ref2[0], value = 2 <= _ref2.length ? __slice.call(_ref2, 1) : [];
      headers[key.trim()] = value.join(':').trim();
    }
    return headers;
  };

  JSONAPIClient.prototype._handleLinks = function(links) {
    var attributeName, href, link, type, typeAndAttribute, typeName, _ref1, _results;
    _results = [];
    for (typeAndAttribute in links) {
      link = links[typeAndAttribute];
      _ref1 = typeAndAttribute.split('.'), typeName = _ref1[0], attributeName = _ref1[1];
      if (typeof link === 'string') {
        href = link;
      } else {
        href = link.href, type = link.type;
      }
      _results.push(this._handleLink(typeName, attributeName, href, type));
    }
    return _results;
  };

  JSONAPIClient.prototype._handleLink = function(typeName, attributeName, hrefTemplate, attributeTypeName) {
    var type, _base;
    type = this.type(typeName);
    if ((_base = type._links)[attributeName] == null) {
      _base[attributeName] = {};
    }
    if (hrefTemplate != null) {
      type._links[attributeName].href = hrefTemplate;
    }
    if (attributeTypeName != null) {
      return type._links[attributeName].type = attributeTypeName;
    }
  };

  JSONAPIClient.prototype.handleError = function() {
    return Promise.reject.apply(Promise, arguments);
  };

  JSONAPIClient.prototype.type = function(name) {
    var _base;
    if ((_base = this._typesCache)[name] == null) {
      _base[name] = new Type(name, this);
    }
    return this._typesCache[name];
  };

  JSONAPIClient.prototype.createType = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use JSONAPIClient::type, not ::createType'].concat(__slice.call(arguments)));
    }
    return this.type.apply(this, arguments);
  };

  return JSONAPIClient;

})();

module.exports = JSONAPIClient;

module.exports.makeHTTPRequest = makeHTTPRequest;

module.exports.Emitter = Emitter;

module.exports.Type = Type;

module.exports.Model = Model;

module.exports.Resource = Resource;

Object.defineProperty(module.exports, 'util', {
  get: function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn('makeHTTPRequest is available directly from the JSONAPIClient object, no need for `util`');
    }
    return {
      makeHTTPRequest: makeHTTPRequest
    };
  }
});



},{"./emitter":1,"./make-http-request":3,"./merge-into":4,"./model":5,"./resource":6,"./type":7}],3:[function(_dereq_,module,exports){
var CACHE_FOR, cachedGets;

CACHE_FOR = 1000;

cachedGets = {};

module.exports = function(method, url, data, headers, modify) {
  var key, promise, value;
  method = method.toUpperCase();
  if (method === 'GET') {
    if ((data != null) && Object.keys(data).length !== 0) {
      url += '?' + ((function() {
        var _results;
        _results = [];
        for (key in data) {
          value = data[key];
          _results.push([key, value].join('='));
        }
        return _results;
      })()).join('&');
      data = null;
    }
    promise = cachedGets[url];
  }
  if (promise == null) {
    promise = new Promise(function(resolve, reject) {
      var header, request, _ref;
      request = new XMLHttpRequest;
      request.open(method, encodeURI(url));
      request.withCredentials = true;
      if (headers != null) {
        for (header in headers) {
          value = headers[header];
          if (value != null) {
            request.setRequestHeader(header, value);
          }
        }
      }
      if (modify != null) {
        modify(request);
      }
      request.onreadystatechange = function(e) {
        var _ref;
        if (request.readyState === request.DONE) {
          if ((200 <= (_ref = request.status) && _ref < 300)) {
            if (method === 'GET') {
              setTimeout((function() {
                return delete cachedGets[url];
              }), CACHE_FOR);
            }
            return resolve(request);
          } else {
            if (method === 'GET') {
              setTimeout((function() {
                return delete cachedGets[url];
              }), CACHE_FOR);
            }
            return reject(request);
          }
        }
      };
      if ((data != null) && (headers != null ? (_ref = headers['Content-Type']) != null ? _ref.indexOf('json') : void 0 : void 0) !== -1) {
        data = JSON.stringify(data);
      }
      return request.send(data);
    });
  }
  if (method === 'GET') {
    cachedGets[url] = promise;
  }
  return promise;
};



},{}],4:[function(_dereq_,module,exports){
var __hasProp = {}.hasOwnProperty;

module.exports = function() {
  var argument, key, value, _i, _len, _ref;
  _ref = Array.prototype.slice.call(arguments, 1);
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    argument = _ref[_i];
    if (argument != null) {
      for (key in argument) {
        if (!__hasProp.call(argument, key)) continue;
        value = argument[key];
        arguments[0][key] = value;
      }
    }
  }
  return arguments[0];
};



},{}],5:[function(_dereq_,module,exports){
var Emitter, Model, isIndex, mergeInto, removeUnderscoredKeys,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Emitter = _dereq_('./emitter');

mergeInto = _dereq_('./merge-into');

isIndex = function(string) {
  var integer;
  integer = Math.abs(parseInt(string, 10));
  return integer.toString(10) === string && !isNaN(integer);
};

removeUnderscoredKeys = function(target) {
  var key, results, value, _i, _len, _results;
  if (Array.isArray(target)) {
    _results = [];
    for (_i = 0, _len = target.length; _i < _len; _i++) {
      value = target[_i];
      _results.push(removeUnderscoredKeys(value));
    }
    return _results;
  } else if ((target != null) && typeof target === 'object') {
    results = {};
    for (key in target) {
      value = target[key];
      if (key.charAt(0) !== '_') {
        results[key] = removeUnderscoredKeys(value);
      }
    }
    return results;
  } else {
    return target;
  }
};

module.exports = Model = (function(_super) {
  __extends(Model, _super);

  Model.prototype._changedKeys = null;

  function Model() {
    var configs;
    configs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Model.__super__.constructor.apply(this, arguments);
    this._changedKeys = [];
    mergeInto.apply(null, [this].concat(__slice.call(configs)));
    this.emit('create');
  }

  Model.prototype.update = function(changeSet) {
    var base, key, lastKey, path, rootKey, value, _i, _len, _name, _ref;
    if (changeSet == null) {
      changeSet = {};
    }
    if (typeof changeSet === 'string') {
      for (_i = 0, _len = arguments.length; _i < _len; _i++) {
        key = arguments[_i];
        if (__indexOf.call(this._changedKeys, key) < 0) {
          (_ref = this._changedKeys).push.apply(_ref, arguments);
        }
      }
    } else {
      for (key in changeSet) {
        if (!__hasProp.call(changeSet, key)) continue;
        value = changeSet[key];
        path = key.split('.');
        rootKey = path[0];
        base = this;
        while (path.length !== 1) {
          if (base[_name = path[0]] == null) {
            base[_name] = isIndex(path[0]) ? [] : {};
          }
          base = base[path.shift()];
        }
        lastKey = path.shift();
        if (value === void 0) {
          if (Array.isArray(base)) {
            base.splice(lastKey, 1);
          } else {
            delete base[lastKey];
          }
        } else {
          base[lastKey] = value;
        }
        if (__indexOf.call(this._changedKeys, rootKey) < 0) {
          this._changedKeys.push(rootKey);
        }
      }
    }
    this.emit('change');
    return this;
  };

  Model.prototype.hasUnsavedChanges = function() {
    return this._changedKeys.length !== 0;
  };

  Model.prototype.toJSON = function() {
    return removeUnderscoredKeys(this);
  };

  Model.prototype.destroy = function() {
    this._changedKeys.splice(0);
    return Model.__super__.destroy.apply(this, arguments);
  };

  return Model;

})(Emitter);



},{"./emitter":1,"./merge-into":4}],6:[function(_dereq_,module,exports){
var Model, PLACEHOLDERS_PATTERN, Resource, ResourcePromise,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice,
  __modulo = function(a, b) { return (+a % (b = +b) + b) % b; };

Model = _dereq_('./model');

PLACEHOLDERS_PATTERN = /{(.+?)}/g;

Resource = (function(_super) {
  __extends(Resource, _super);

  Resource.prototype._type = null;

  Resource.prototype._headers = null;

  Resource.prototype._meta = null;

  Resource.prototype._linksCache = null;

  function Resource(_type) {
    this._type = _type;
    if (this._type == null) {
      throw new Error('Don\'t call the Resource constructor directly, use `client.type("things").create({});`');
    }
    this._headers = {};
    this._meta = {};
    this._linksCache = {};
    Resource.__super__.constructor.call(this, null);
    this._type.emit('change');
    this.emit('create');
  }

  Resource.prototype.getMeta = function(key) {
    if (key == null) {
      key = this._type._name;
    }
    return this._meta[key];
  };

  Resource.prototype.update = function() {
    var value;
    value = Resource.__super__.update.apply(this, arguments);
    if (this.id && this._type._resourcesCache[this.id] !== this) {
      this._type._resourcesCache[this.id] = this;
      this._type.emit('change');
    }
    return value;
  };

  Resource.prototype.save = function() {
    var payload, save;
    payload = {};
    payload[this._type._name] = this.toJSON.call(this.getChangesSinceSave());
    save = this.id ? this.refresh(true).then((function(_this) {
      return function() {
        return _this._type._client.put(_this._getURL(), payload, _this._getHeadersForModification());
      };
    })(this)) : this._type._client.post(this._type._getURL(), payload);
    return new ResourcePromise(save.then((function(_this) {
      return function(_arg) {
        var result;
        result = _arg[0];
        if (result !== _this) {
          _this.update(result);
          _this._changedKeys.splice(0);
          result.destroy();
        }
        _this.emit('save');
        return _this;
      };
    })(this)));
  };

  Resource.prototype.getChangesSinceSave = function() {
    var changes, key, _i, _len, _ref;
    changes = {};
    _ref = this._changedKeys;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      key = _ref[_i];
      changes[key] = this[key];
    }
    return changes;
  };

  Resource.prototype.refresh = function(saveChanges) {
    var changes;
    if (saveChanges) {
      changes = this.getChangesSinceSave();
      return this.refresh().then((function(_this) {
        return function() {
          return _this.update(changes);
        };
      })(this));
    } else if (this.id) {
      return this._type.get(this.id, {});
    } else {
      throw new Error('Can\'t refresh a resource with no ID');
    }
  };

  Resource.prototype.uncache = function() {
    if (this.id) {
      this.emit('uncache');
      return delete this._type._resourcesCache[this.id];
    } else {
      throw new Error('Can\'t uncache a resource with no ID');
    }
  };

  Resource.prototype["delete"] = function() {
    var deletion;
    deletion = this.id ? this.refresh(true).then((function(_this) {
      return function() {
        return _this._type._client["delete"](_this._getURL(), null, _this._getHeadersForModification());
      };
    })(this)) : Promise.resolve();
    return new ResourcePromise(deletion.then((function(_this) {
      return function() {
        _this.emit('delete');
        _this._type.emit('change');
        _this.destroy();
        return null;
      };
    })(this)));
  };

  Resource.prototype.get = function(name, _arg) {
    var href, id, ids, resourceLink, result, skipCache, type, typeLink, _ref;
    skipCache = (_arg != null ? _arg : {}).skipCache;
    if ((this._linksCache[name] != null) && !skipCache) {
      return this._linksCache[name];
    } else {
      resourceLink = (_ref = this.links) != null ? _ref[name] : void 0;
      typeLink = this._type._links[name];
      result = (function() {
        var _ref1, _ref2, _ref3, _ref4;
        if ((resourceLink != null) || (typeLink != null)) {
          href = (_ref1 = resourceLink != null ? resourceLink.href : void 0) != null ? _ref1 : typeLink != null ? typeLink.href : void 0;
          type = (_ref2 = resourceLink != null ? resourceLink.type : void 0) != null ? _ref2 : typeLink != null ? typeLink.type : void 0;
          id = (_ref3 = resourceLink != null ? resourceLink.id : void 0) != null ? _ref3 : typeLink != null ? typeLink.id : void 0;
          if (id == null) {
            id = typeof resourceLink === 'string' ? resourceLink : void 0;
          }
          ids = (_ref4 = resourceLink != null ? resourceLink.ids : void 0) != null ? _ref4 : typeLink != null ? typeLink.ids : void 0;
          if (ids == null) {
            ids = Array.isArray(resourceLink) ? resourceLink : void 0;
          }
          if (href != null) {
            return this._type._client.get(this._applyHREF(href)).then(function(links) {
              if (id != null) {
                return links[0];
              } else {
                return links;
              }
            });
          } else if (type != null) {
            return this._type._client.type(type).get(id != null ? id : ids).then(function(links) {
              if (id != null) {
                return links[0];
              } else {
                return links;
              }
            });
          } else if (name in this) {
            return Promise.resolve(this[name]);
          } else {
            throw new Error("No link '" + name + "' defined for " + this._type._name + "#" + this.id);
          }
        }
      }).call(this);
      result.then((function(_this) {
        return function() {
          return _this._linksCache[name] = result;
        };
      })(this));
      return new ResourcePromise(result);
    }
  };

  Resource.prototype._applyHREF = function(href) {
    var context;
    context = {};
    context[this._type._name] = this;
    return href.replace(PLACEHOLDERS_PATTERN, function(_, path) {
      var segment, segments, value, _ref, _ref1;
      segments = path.split('.');
      value = context;
      while (segments.length !== 0) {
        segment = segments.shift();
        value = (_ref = value[segment]) != null ? _ref : (_ref1 = value.links) != null ? _ref1[segment] : void 0;
      }
      if (Array.isArray(value)) {
        value = value.join(',');
      }
      if (typeof value !== 'string') {
        throw new Error("Value for '" + path + "' in '" + href + "' should be a string.");
      }
      return value;
    });
  };

  Resource.prototype.addLink = function(name, value) {
    var data, url;
    url = this._getURL('links', name);
    data = {};
    data[name] = value;
    return this._type._client.post(url, data).then((function(_this) {
      return function() {
        _this.uncacheLink(name);
        return _this.refresh();
      };
    })(this));
  };

  Resource.prototype.removeLink = function(name, value) {
    var url;
    url = this._getURL('links', name, [].concat(value).join(','));
    return this._type._client["delete"](url).then((function(_this) {
      return function() {
        _this.uncacheLink(name);
        return _this.refresh();
      };
    })(this));
  };

  Resource.prototype.uncacheLink = function(name) {
    return delete this._linksCache[name];
  };

  Resource.prototype._getHeadersForModification = function() {
    return {
      'If-Unmodified-Since': this._getHeader('Last-Modified'),
      'If-Match': this._getHeader('ETag')
    };
  };

  Resource.prototype._getHeader = function(header) {
    var name, value;
    header = header.toLowerCase();
    return ((function() {
      var _ref, _results;
      _ref = this._headers;
      _results = [];
      for (name in _ref) {
        value = _ref[name];
        if (name.toLowerCase() === header) {
          _results.push(value);
        }
      }
      return _results;
    }).call(this))[0];
  };

  Resource.prototype._getURL = function() {
    var _ref;
    return this.href || (_ref = this._type)._getURL.apply(_ref, [this.id].concat(__slice.call(arguments)));
  };

  Resource.prototype.link = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use Resource::get, not ::link'].concat(__slice.call(arguments)));
    }
    return this.get.apply(this, arguments);
  };

  Resource.prototype.getRequestMeta = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use Resource::getMeta, not ::getRequestMeta'].concat(__slice.call(arguments)));
    }
    return this.getMeta.apply(this, arguments);
  };

  return Resource;

})(Model);

ResourcePromise = (function() {
  var method, methodName, _ref;

  ResourcePromise.prototype._promise = null;

  function ResourcePromise(_promise) {
    this._promise = _promise;
    if (!(this._promise instanceof Promise)) {
      throw new Error('ResourcePromise requires a real promise instance');
    }
  }

  ResourcePromise.prototype.then = function() {
    var _ref;
    return (_ref = this._promise).then.apply(_ref, arguments);
  };

  ResourcePromise.prototype["catch"] = function() {
    var _ref;
    return (_ref = this._promise)["catch"].apply(_ref, arguments);
  };

  ResourcePromise.prototype.index = function(index) {
    this._promise = this._promise.then(function(value) {
      index = __modulo(index, value.length);
      return value[index];
    });
    return this;
  };

  _ref = Resource.prototype;
  for (methodName in _ref) {
    method = _ref[methodName];
    if (typeof method === 'function' && !(methodName in ResourcePromise.prototype)) {
      (function(methodName) {
        return ResourcePromise.prototype[methodName] = function() {
          var args;
          args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          this._promise = this._promise.then((function(_this) {
            return function(promisedValue) {
              var resource, result, results;
              results = (function() {
                var _i, _len, _ref1, _results;
                _ref1 = [].concat(promisedValue);
                _results = [];
                for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
                  resource = _ref1[_i];
                  result = resource[methodName].apply(resource, args);
                  if (result instanceof this.constructor) {
                    result = result._promise;
                  }
                  _results.push(result);
                }
                return _results;
              }).call(_this);
              if (Array.isArray(promisedValue)) {
                return Promise.all(results);
              } else {
                return results[0];
              }
            };
          })(this));
          return this;
        };
      })(methodName);
    }
  }

  return ResourcePromise;

})();

module.exports = Resource;

module.exports.Promise = ResourcePromise;



},{"./model":5}],7:[function(_dereq_,module,exports){
var Emitter, Resource, Type, mergeInto,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

Emitter = _dereq_('./emitter');

Resource = _dereq_('./resource');

mergeInto = _dereq_('./merge-into');

module.exports = Type = (function(_super) {
  __extends(Type, _super);

  Type.prototype.Resource = Resource;

  Type.prototype._name = '';

  Type.prototype._client = null;

  Type.prototype._links = null;

  Type.prototype._resourcesCache = null;

  function Type(_name, _client) {
    this._name = _name;
    this._client = _client;
    Type.__super__.constructor.apply(this, arguments);
    this._links = {};
    this._resourcesCache = {};
    if (!(this._name && (this._client != null))) {
      throw new Error('Don\'t call the Type constructor directly, use `client.type("things");`');
    }
  }

  Type.prototype.create = function(data, headers, meta) {
    var resource, _ref, _ref1;
    if (data == null) {
      data = {};
    }
    if (headers == null) {
      headers = {};
    }
    if (meta == null) {
      meta = {};
    }
    if (data.type && data.type !== this._name) {
      return (_ref = this._client.type(data.type)).create.apply(_ref, arguments);
    } else {
      resource = (_ref1 = this._resourcesCache[data.id]) != null ? _ref1 : new this.Resource(this);
      mergeInto(resource._headers, headers);
      mergeInto(resource._meta, meta);
      resource.update(data);
      if (resource === this._resourcesCache[data.id]) {
        resource._changedKeys.splice(0);
      }
      return resource;
    }
  };

  Type.prototype.get = function() {
    return new Resource.Promise(typeof arguments[0] === 'string' ? this._getByID.apply(this, arguments) : Array.isArray(arguments[0]) ? this._getByIDs.apply(this, arguments) : this._getByQuery.apply(this, arguments));
  };

  Type.prototype._getByID = function() {
    var id, otherArgs;
    id = arguments[0], otherArgs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    return this._getByIDs.apply(this, [[id]].concat(__slice.call(otherArgs))).then(function(_arg) {
      var resource;
      resource = _arg[0];
      return resource;
    });
  };

  Type.prototype._getByIDs = function() {
    var id, ids, otherArgs, requests;
    ids = arguments[0], otherArgs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    requests = (function() {
      var _i, _len, _ref, _results;
      _results = [];
      for (_i = 0, _len = ids.length; _i < _len; _i++) {
        id = ids[_i];
        if (id in this._resourcesCache && otherArgs.length === 0) {
          _results.push(Promise.resolve(this._resourcesCache[id]));
        } else {
          _results.push((_ref = this._client).get.apply(_ref, [this._getURL(id)].concat(__slice.call(otherArgs))).then(function(_arg) {
            var resource;
            resource = _arg[0];
            return resource;
          }));
        }
      }
      return _results;
    }).call(this);
    return Promise.all(requests);
  };

  Type.prototype._getByQuery = function() {
    var otherArgs, query, _ref;
    query = arguments[0], otherArgs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    return (_ref = this._client).get.apply(_ref, [this._getURL(), query].concat(__slice.call(otherArgs)));
  };

  Type.prototype._getURL = function() {
    return ['', this._name].concat(__slice.call(arguments)).join('/');
  };

  Type.prototype.createResource = function() {
    if (typeof console !== "undefined" && console !== null) {
      console.warn.apply(console, ['Use Type::create, not ::createResource'].concat(__slice.call(arguments)));
    }
    return this.create.apply(this, arguments);
  };

  return Type;

})(Emitter);



},{"./emitter":1,"./merge-into":4,"./resource":6}]},{},[2])(2)
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],9:[function(require,module,exports){
'use strict';

module.exports = require('./lib')

},{"./lib":14}],10:[function(require,module,exports){
'use strict';

var asap = require('asap/raw')

function noop() {};

// States:
//
// 0 - pending
// 1 - fulfilled with _value
// 2 - rejected with _value
// 3 - adopted the state of another promise, _value
//
// once the state is no longer pending (0) it is immutable

// All `_` prefixed properties will be reduced to `_{random number}`
// at build time to obfuscate them and discourage their use.
// We don't use symbols or Object.defineProperty to fully hide them
// because the performance isn't good enough.


// to avoid using try/catch inside critical functions, we
// extract them to here.
var LAST_ERROR = null;
var IS_ERROR = {};
function getThen(obj) {
  try {
    return obj.then;
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

function tryCallOne(fn, a) {
  try {
    return fn(a);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}
function tryCallTwo(fn, a, b) {
  try {
    fn(a, b);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

module.exports = Promise;
function Promise(fn) {
  if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new')
  if (typeof fn !== 'function') throw new TypeError('not a function')
  this._71 = 0;
  this._18 = null;
  this._61 = [];
  if (fn === noop) return;
  doResolve(fn, this);
}
Promise.prototype._10 = function (onFulfilled, onRejected) {
  var self = this;
  return new this.constructor(function (resolve, reject) {
    var res = new Promise(noop);
    res.then(resolve, reject);
    self._24(new Handler(onFulfilled, onRejected, res));
  });
};
Promise.prototype.then = function(onFulfilled, onRejected) {
  if (this.constructor !== Promise) return this._10(onFulfilled, onRejected);
  var res = new Promise(noop);
  this._24(new Handler(onFulfilled, onRejected, res));
  return res;
};
Promise.prototype._24 = function(deferred) {
  if (this._71 === 3) {
    this._18._24(deferred);
    return;
  }
  if (this._71 === 0) {
    this._61.push(deferred);
    return;
  }
  var state = this._71;
  var value = this._18;
  asap(function() {
    var cb = state === 1 ? deferred.onFulfilled : deferred.onRejected
    if (cb === null) {
      (state === 1 ? deferred.promise._82(value) : deferred.promise._67(value))
      return
    }
    var ret = tryCallOne(cb, value);
    if (ret === IS_ERROR) {
      deferred.promise._67(LAST_ERROR)
    } else {
      deferred.promise._82(ret)
    }
  });
};
Promise.prototype._82 = function(newValue) {
  //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
  if (newValue === this) {
    return this._67(new TypeError('A promise cannot be resolved with itself.'))
  }
  if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
    var then = getThen(newValue);
    if (then === IS_ERROR) {
      return this._67(LAST_ERROR);
    }
    if (
      then === this.then &&
      newValue instanceof Promise &&
      newValue._24 === this._24
    ) {
      this._71 = 3;
      this._18 = newValue;
      for (var i = 0; i < this._61.length; i++) {
        newValue._24(this._61[i]);
      }
      return;
    } else if (typeof then === 'function') {
      doResolve(then.bind(newValue), this)
      return
    }
  }
  this._71 = 1
  this._18 = newValue
  this._94()
}

Promise.prototype._67 = function (newValue) {
  this._71 = 2
  this._18 = newValue
  this._94()
}
Promise.prototype._94 = function () {
  for (var i = 0; i < this._61.length; i++)
    this._24(this._61[i])
  this._61 = null
}


function Handler(onFulfilled, onRejected, promise){
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
  this.onRejected = typeof onRejected === 'function' ? onRejected : null
  this.promise = promise;
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, promise) {
  var done = false;
  var res = tryCallTwo(fn, function (value) {
    if (done) return
    done = true
    promise._82(value)
  }, function (reason) {
    if (done) return
    done = true
    promise._67(reason)
  })
  if (!done && res === IS_ERROR) {
    done = true
    promise._67(LAST_ERROR)
  }
}
},{"asap/raw":18}],11:[function(require,module,exports){
'use strict';

var Promise = require('./core.js')

module.exports = Promise
Promise.prototype.done = function (onFulfilled, onRejected) {
  var self = arguments.length ? this.then.apply(this, arguments) : this
  self.then(null, function (err) {
    setTimeout(function () {
      throw err
    }, 0)
  })
}
},{"./core.js":10}],12:[function(require,module,exports){
'use strict';

//This file contains the ES6 extensions to the core Promises/A+ API

var Promise = require('./core.js')
var asap = require('asap/raw')

module.exports = Promise

/* Static Functions */

function ValuePromise(value) {
  this.then = function (onFulfilled) {
    if (typeof onFulfilled !== 'function') return this
    return new Promise(function (resolve, reject) {
      asap(function () {
        try {
          resolve(onFulfilled(value))
        } catch (ex) {
          reject(ex);
        }
      })
    })
  }
}
ValuePromise.prototype = Promise.prototype

var TRUE = new ValuePromise(true)
var FALSE = new ValuePromise(false)
var NULL = new ValuePromise(null)
var UNDEFINED = new ValuePromise(undefined)
var ZERO = new ValuePromise(0)
var EMPTYSTRING = new ValuePromise('')

Promise.resolve = function (value) {
  if (value instanceof Promise) return value

  if (value === null) return NULL
  if (value === undefined) return UNDEFINED
  if (value === true) return TRUE
  if (value === false) return FALSE
  if (value === 0) return ZERO
  if (value === '') return EMPTYSTRING

  if (typeof value === 'object' || typeof value === 'function') {
    try {
      var then = value.then
      if (typeof then === 'function') {
        return new Promise(then.bind(value))
      }
    } catch (ex) {
      return new Promise(function (resolve, reject) {
        reject(ex)
      })
    }
  }

  return new ValuePromise(value)
}

Promise.all = function (arr) {
  var args = Array.prototype.slice.call(arr)

  return new Promise(function (resolve, reject) {
    if (args.length === 0) return resolve([])
    var remaining = args.length
    function res(i, val) {
      if (val && (typeof val === 'object' || typeof val === 'function')) {
        var then = val.then
        if (typeof then === 'function') {
          then.call(val, function (val) { res(i, val) }, reject)
          return
        }
      }
      args[i] = val
      if (--remaining === 0) {
        resolve(args);
      }
    }
    for (var i = 0; i < args.length; i++) {
      res(i, args[i])
    }
  })
}

Promise.reject = function (value) {
  return new Promise(function (resolve, reject) { 
    reject(value);
  });
}

Promise.race = function (values) {
  return new Promise(function (resolve, reject) { 
    values.forEach(function(value){
      Promise.resolve(value).then(resolve, reject);
    })
  });
}

/* Prototype Methods */

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
}

},{"./core.js":10,"asap/raw":18}],13:[function(require,module,exports){
'use strict';

var Promise = require('./core.js')

module.exports = Promise
Promise.prototype['finally'] = function (f) {
  return this.then(function (value) {
    return Promise.resolve(f()).then(function () {
      return value
    })
  }, function (err) {
    return Promise.resolve(f()).then(function () {
      throw err
    })
  })
}

},{"./core.js":10}],14:[function(require,module,exports){
'use strict';

module.exports = require('./core.js')
require('./done.js')
require('./finally.js')
require('./es6-extensions.js')
require('./node-extensions.js')

},{"./core.js":10,"./done.js":11,"./es6-extensions.js":12,"./finally.js":13,"./node-extensions.js":15}],15:[function(require,module,exports){
'use strict';

//This file contains then/promise specific extensions that are only useful for node.js interop

var Promise = require('./core.js')
var asap = require('asap')

module.exports = Promise

/* Static Functions */

Promise.denodeify = function (fn, argumentCount) {
  argumentCount = argumentCount || Infinity
  return function () {
    var self = this
    var args = Array.prototype.slice.call(arguments)
    return new Promise(function (resolve, reject) {
      while (args.length && args.length > argumentCount) {
        args.pop()
      }
      args.push(function (err, res) {
        if (err) reject(err)
        else resolve(res)
      })
      var res = fn.apply(self, args)
      if (res && (typeof res === 'object' || typeof res === 'function') && typeof res.then === 'function') {
        resolve(res)
      }
    })
  }
}
Promise.nodeify = function (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    var callback = typeof args[args.length - 1] === 'function' ? args.pop() : null
    var ctx = this
    try {
      return fn.apply(this, arguments).nodeify(callback, ctx)
    } catch (ex) {
      if (callback === null || typeof callback == 'undefined') {
        return new Promise(function (resolve, reject) { reject(ex) })
      } else {
        asap(function () {
          callback.call(ctx, ex)
        })
      }
    }
  }
}

Promise.prototype.nodeify = function (callback, ctx) {
  if (typeof callback != 'function') return this

  this.then(function (value) {
    asap(function () {
      callback.call(ctx, null, value)
    })
  }, function (err) {
    asap(function () {
      callback.call(ctx, err)
    })
  })
}

},{"./core.js":10,"asap":16}],16:[function(require,module,exports){
"use strict";

// rawAsap provides everything we need except exception management.
var rawAsap = require("./raw");
// RawTasks are recycled to reduce GC churn.
var freeTasks = [];
// We queue errors to ensure they are thrown in right order (FIFO).
// Array-as-queue is good enough here, since we are just dealing with exceptions.
var pendingErrors = [];
var requestErrorThrow = rawAsap.makeRequestCallFromTimer(throwFirstError);

function throwFirstError() {
    if (pendingErrors.length) {
        throw pendingErrors.shift();
    }
}

/**
 * Calls a task as soon as possible after returning, in its own event, with priority
 * over other events like animation, reflow, and repaint. An error thrown from an
 * event will not interrupt, nor even substantially slow down the processing of
 * other events, but will be rather postponed to a lower priority event.
 * @param {{call}} task A callable object, typically a function that takes no
 * arguments.
 */
module.exports = asap;
function asap(task) {
    var rawTask;
    if (freeTasks.length) {
        rawTask = freeTasks.pop();
    } else {
        rawTask = new RawTask();
    }
    rawTask.task = task;
    rawAsap(rawTask);
}

// We wrap tasks with recyclable task objects.  A task object implements
// `call`, just like a function.
function RawTask() {
    this.task = null;
}

// The sole purpose of wrapping the task is to catch the exception and recycle
// the task object after its single use.
RawTask.prototype.call = function () {
    try {
        this.task.call();
    } catch (error) {
        if (asap.onerror) {
            // This hook exists purely for testing purposes.
            // Its name will be periodically randomized to break any code that
            // depends on its existence.
            asap.onerror(error);
        } else {
            // In a web browser, exceptions are not fatal. However, to avoid
            // slowing down the queue of pending tasks, we rethrow the error in a
            // lower priority turn.
            pendingErrors.push(error);
            requestErrorThrow();
        }
    } finally {
        this.task = null;
        freeTasks[freeTasks.length] = this;
    }
};

},{"./raw":17}],17:[function(require,module,exports){
(function (global){
"use strict";

// Use the fastest means possible to execute a task in its own turn, with
// priority over other events including IO, animation, reflow, and redraw
// events in browsers.
//
// An exception thrown by a task will permanently interrupt the processing of
// subsequent tasks. The higher level `asap` function ensures that if an
// exception is thrown by a task, that the task queue will continue flushing as
// soon as possible, but if you use `rawAsap` directly, you are responsible to
// either ensure that no exceptions are thrown from your task, or to manually
// call `rawAsap.requestFlush` if an exception is thrown.
module.exports = rawAsap;
function rawAsap(task) {
    if (!queue.length) {
        requestFlush();
        flushing = true;
    }
    // Equivalent to push, but avoids a function call.
    queue[queue.length] = task;
}

var queue = [];
// Once a flush has been requested, no further calls to `requestFlush` are
// necessary until the next `flush` completes.
var flushing = false;
// `requestFlush` is an implementation-specific method that attempts to kick
// off a `flush` event as quickly as possible. `flush` will attempt to exhaust
// the event queue before yielding to the browser's own event loop.
var requestFlush;
// The position of the next task to execute in the task queue. This is
// preserved between calls to `flush` so that it can be resumed if
// a task throws an exception.
var index = 0;
// If a task schedules additional tasks recursively, the task queue can grow
// unbounded. To prevent memory exhaustion, the task queue will periodically
// truncate already-completed tasks.
var capacity = 1024;

// The flush function processes all tasks that have been scheduled with
// `rawAsap` unless and until one of those tasks throws an exception.
// If a task throws an exception, `flush` ensures that its state will remain
// consistent and will resume where it left off when called again.
// However, `flush` does not make any arrangements to be called again if an
// exception is thrown.
function flush() {
    while (index < queue.length) {
        var currentIndex = index;
        // Advance the index before calling the task. This ensures that we will
        // begin flushing on the next task the task throws an error.
        index = index + 1;
        queue[currentIndex].call();
        // Prevent leaking memory for long chains of recursive calls to `asap`.
        // If we call `asap` within tasks scheduled by `asap`, the queue will
        // grow, but to avoid an O(n) walk for every task we execute, we don't
        // shift tasks off the queue after they have been executed.
        // Instead, we periodically shift 1024 tasks off the queue.
        if (index > capacity) {
            // Manually shift all values starting at the index back to the
            // beginning of the queue.
            for (var scan = 0; scan < index; scan++) {
                queue[scan] = queue[scan + index];
            }
            queue.length -= index;
            index = 0;
        }
    }
    queue.length = 0;
    index = 0;
    flushing = false;
}

// `requestFlush` is implemented using a strategy based on data collected from
// every available SauceLabs Selenium web driver worker at time of writing.
// https://docs.google.com/spreadsheets/d/1mG-5UYGup5qxGdEMWkhP6BWCz053NUb2E1QoUTU16uA/edit#gid=783724593

// Safari 6 and 6.1 for desktop, iPad, and iPhone are the only browsers that
// have WebKitMutationObserver but not un-prefixed MutationObserver.
// Must use `global` instead of `window` to work in both frames and web
// workers. `global` is a provision of Browserify, Mr, Mrs, or Mop.
var BrowserMutationObserver = global.MutationObserver || global.WebKitMutationObserver;

// MutationObservers are desirable because they have high priority and work
// reliably everywhere they are implemented.
// They are implemented in all modern browsers.
//
// - Android 4-4.3
// - Chrome 26-34
// - Firefox 14-29
// - Internet Explorer 11
// - iPad Safari 6-7.1
// - iPhone Safari 7-7.1
// - Safari 6-7
if (typeof BrowserMutationObserver === "function") {
    requestFlush = makeRequestCallFromMutationObserver(flush);

// MessageChannels are desirable because they give direct access to the HTML
// task queue, are implemented in Internet Explorer 10, Safari 5.0-1, and Opera
// 11-12, and in web workers in many engines.
// Although message channels yield to any queued rendering and IO tasks, they
// would be better than imposing the 4ms delay of timers.
// However, they do not work reliably in Internet Explorer or Safari.

// Internet Explorer 10 is the only browser that has setImmediate but does
// not have MutationObservers.
// Although setImmediate yields to the browser's renderer, it would be
// preferrable to falling back to setTimeout since it does not have
// the minimum 4ms penalty.
// Unfortunately there appears to be a bug in Internet Explorer 10 Mobile (and
// Desktop to a lesser extent) that renders both setImmediate and
// MessageChannel useless for the purposes of ASAP.
// https://github.com/kriskowal/q/issues/396

// Timers are implemented universally.
// We fall back to timers in workers in most engines, and in foreground
// contexts in the following browsers.
// However, note that even this simple case requires nuances to operate in a
// broad spectrum of browsers.
//
// - Firefox 3-13
// - Internet Explorer 6-9
// - iPad Safari 4.3
// - Lynx 2.8.7
} else {
    requestFlush = makeRequestCallFromTimer(flush);
}

// `requestFlush` requests that the high priority event queue be flushed as
// soon as possible.
// This is useful to prevent an error thrown in a task from stalling the event
// queue if the exception handled by Node.js’s
// `process.on("uncaughtException")` or by a domain.
rawAsap.requestFlush = requestFlush;

// To request a high priority event, we induce a mutation observer by toggling
// the text of a text node between "1" and "-1".
function makeRequestCallFromMutationObserver(callback) {
    var toggle = 1;
    var observer = new BrowserMutationObserver(callback);
    var node = document.createTextNode("");
    observer.observe(node, {characterData: true});
    return function requestCall() {
        toggle = -toggle;
        node.data = toggle;
    };
}

// The message channel technique was discovered by Malte Ubl and was the
// original foundation for this library.
// http://www.nonblocking.io/2011/06/windownexttick.html

// Safari 6.0.5 (at least) intermittently fails to create message ports on a
// page's first load. Thankfully, this version of Safari supports
// MutationObservers, so we don't need to fall back in that case.

// function makeRequestCallFromMessageChannel(callback) {
//     var channel = new MessageChannel();
//     channel.port1.onmessage = callback;
//     return function requestCall() {
//         channel.port2.postMessage(0);
//     };
// }

// For reasons explained above, we are also unable to use `setImmediate`
// under any circumstances.
// Even if we were, there is another bug in Internet Explorer 10.
// It is not sufficient to assign `setImmediate` to `requestFlush` because
// `setImmediate` must be called *by name* and therefore must be wrapped in a
// closure.
// Never forget.

// function makeRequestCallFromSetImmediate(callback) {
//     return function requestCall() {
//         setImmediate(callback);
//     };
// }

// Safari 6.0 has a problem where timers will get lost while the user is
// scrolling. This problem does not impact ASAP because Safari 6.0 supports
// mutation observers, so that implementation is used instead.
// However, if we ever elect to use timers in Safari, the prevalent work-around
// is to add a scroll event listener that calls for a flush.

// `setTimeout` does not call the passed callback if the delay is less than
// approximately 7 in web workers in Firefox 8 through 18, and sometimes not
// even then.

function makeRequestCallFromTimer(callback) {
    return function requestCall() {
        // We dispatch a timeout with a specified delay of 0 for engines that
        // can reliably accommodate that request. This will usually be snapped
        // to a 4 milisecond delay, but once we're flushing, there's no delay
        // between events.
        var timeoutHandle = setTimeout(handleTimer, 0);
        // However, since this timer gets frequently dropped in Firefox
        // workers, we enlist an interval handle that will try to fire
        // an event 20 times per second until it succeeds.
        var intervalHandle = setInterval(handleTimer, 50);

        function handleTimer() {
            // Whichever timer succeeds will cancel both timers and
            // execute the callback.
            clearTimeout(timeoutHandle);
            clearInterval(intervalHandle);
            callback();
        }
    };
}

// This is for `asap.js` only.
// Its name will be periodically randomized to break any code that depends on
// its existence.
rawAsap.makeRequestCallFromTimer = makeRequestCallFromTimer;

// ASAP was originally a nextTick shim included in Q. This was factored out
// into this ASAP package. It was later adapted to RSVP which made further
// amendments. These decisions, particularly to marginalize MessageChannel and
// to capture the MutationObserver implementation in a closure, were integrated
// back into ASAP proper.
// https://github.com/tildeio/rsvp.js/blob/cddf7232546a9cf858524b75cde6f9edf72620a7/lib/rsvp/asap.js


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],18:[function(require,module,exports){
(function (process){
"use strict";

var domain; // The domain module is executed on demand
var hasSetImmediate = typeof setImmediate === "function";

// Use the fastest means possible to execute a task in its own turn, with
// priority over other events including network IO events in Node.js.
//
// An exception thrown by a task will permanently interrupt the processing of
// subsequent tasks. The higher level `asap` function ensures that if an
// exception is thrown by a task, that the task queue will continue flushing as
// soon as possible, but if you use `rawAsap` directly, you are responsible to
// either ensure that no exceptions are thrown from your task, or to manually
// call `rawAsap.requestFlush` if an exception is thrown.
module.exports = rawAsap;
function rawAsap(task) {
    if (!queue.length) {
        requestFlush();
        flushing = true;
    }
    // Avoids a function call
    queue[queue.length] = task;
}

var queue = [];
// Once a flush has been requested, no further calls to `requestFlush` are
// necessary until the next `flush` completes.
var flushing = false;
// The position of the next task to execute in the task queue. This is
// preserved between calls to `flush` so that it can be resumed if
// a task throws an exception.
var index = 0;
// If a task schedules additional tasks recursively, the task queue can grown
// unbounded. To prevent memory excaustion, the task queue will periodically
// truncate already-completed tasks.
var capacity = 1024;

// The flush function processes all tasks that have been scheduled with
// `rawAsap` unless and until one of those tasks throws an exception.
// If a task throws an exception, `flush` ensures that its state will remain
// consistent and will resume where it left off when called again.
// However, `flush` does not make any arrangements to be called again if an
// exception is thrown.
function flush() {
    while (index < queue.length) {
        var currentIndex = index;
        // Advance the index before calling the task. This ensures that we will
        // begin flushing on the next task the task throws an error.
        index = index + 1;
        queue[currentIndex].call();
        // Prevent leaking memory for long chains of recursive calls to `asap`.
        // If we call `asap` within tasks scheduled by `asap`, the queue will
        // grow, but to avoid an O(n) walk for every task we execute, we don't
        // shift tasks off the queue after they have been executed.
        // Instead, we periodically shift 1024 tasks off the queue.
        if (index > capacity) {
            // Manually shift all values starting at the index back to the
            // beginning of the queue.
            for (var scan = 0; scan < index; scan++) {
                queue[scan] = queue[scan + index];
            }
            queue.length -= index;
            index = 0;
        }
    }
    queue.length = 0;
    index = 0;
    flushing = false;
}

rawAsap.requestFlush = requestFlush;
function requestFlush() {
    // Ensure flushing is not bound to any domain.
    // It is not sufficient to exit the domain, because domains exist on a stack.
    // To execute code outside of any domain, the following dance is necessary.
    var parentDomain = process.domain;
    if (parentDomain) {
        if (!domain) {
            // Lazy execute the domain module.
            // Only employed if the user elects to use domains.
            domain = require("domain");
        }
        domain.active = process.domain = null;
    }

    // `setImmediate` is slower that `process.nextTick`, but `process.nextTick`
    // cannot handle recursion.
    // `requestFlush` will only be called recursively from `asap.js`, to resume
    // flushing after an error is thrown into a domain.
    // Conveniently, `setImmediate` was introduced in the same version
    // `process.nextTick` started throwing recursion errors.
    if (flushing && hasSetImmediate) {
        setImmediate(flush);
    } else {
        process.nextTick(flush);
    }

    if (parentDomain) {
        domain.active = process.domain = parentDomain;
    }
}


}).call(this,require('_process'))
},{"_process":7,"domain":5}]},{},[1]);
