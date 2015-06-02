'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _jsonApiClient = require('json-api-client');

var _jsonApiClient2 = _interopRequireDefault(_jsonApiClient);

var _utils = require('./utils');

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

var DEFAULT_OPTS = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes.zooniverse.org',
  root: '/api',
  appID: null
};

var handleError = function handleError(request) {
  var response = undefined,
      errorMessage = null;

  if ('message' in request) {
    throw request;
  } else if ('responseText' in request) {
    try {
      response = JSON.parse(request.responseText);
    } catch (error) {}

    if ((0, _utils.exists)(response) && (0, _utils.exists)(response.error)) {
      errorMessage = response.error;

      if ((0, _utils.exists)(response.error_description)) {
        errorMessage = errorMessage + ' ' + response.error_description;
      }
    } else if ((0, _utils.exists)(response) && (0, _utils.exists)(response.errors) && (0, _utils.exists)(response.errors[0].message)) {
      errorMessage = [];

      response.errors.forEach(function (error) {
        var message = error.message;

        if (typeof message == 'string') {
          errorMessage.push(message);
        } else {
          var messageParts = [];
          for (var key in message) {
            var part = message[key];
            messageParts.push(key + ' ' + part);
          }
          errorMessage.push(messageParts.join('\n'));
        }
      });

      errorMessage = errorMessage.join('\n');
    }

    if ((0, _utils.exists)(request.responseText) && request.responseText.indexOf('<!DOCTYPE') != -1) {
      if (errorMessage == null) {
        errorMessage = request.responseText.trim() || request.status + ' ' + request.statusText;
      }
    }

    throw new Error(errorMessage);
  }
};

var PanoptesClient = function PanoptesClient(opts) {
  _classCallCheck(this, PanoptesClient);

  if (typeof opts === 'undefined') {
    opts = DEFAULT_OPTS;
  }

  for (var key in DEFAULT_OPTS) {
    if ((0, _utils.exists)(opts[key])) {
      this[key] = opts[key];
    } else {
      this[key] = DEFAULT_OPTS[key];
    }
  }

  if (!(0, _utils.exists)(this.appID)) {
    throw Error('Must provide an app ID');
  }

  this.api = new _jsonApiClient2['default'](this.host + this.root, this.headers);
  this.api.handleError = handleError;
  this.api.auth = (0, _auth2['default'])(this);
};

exports['default'] = PanoptesClient;
module.exports = exports['default'];