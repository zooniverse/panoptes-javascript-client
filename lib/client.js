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
