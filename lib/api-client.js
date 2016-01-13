var JSONAPIClient = require('json-api-client');
var config = require('./config');

var apiClient = new JSONAPIClient(config.host + '/api', {
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.api+json; version=1',
});

function formatError(piece) {
  if (typeof piece === 'string') {
    return piece;
  } else if (Array.isArray(piece)) {
    return piece.map(formatError).join(' ; ');
  } else {
    return Object.keys(piece).map(function(key) {
      return key + ' -> ' + formatError(piece[key]);
    }).join('\n');
  }
}

apiClient.handleError = function(response) {
  response = [].concat(response)[0];
  var errorMessage;
  if (response) {
    if (response.message) {
      // It looks like an error already, don't modify it.
      throw response;
    } else if (response.body) {
      // An auto-parsed response, hooray. We'll build a string and throw an error.
      if (response.body.error) {
        errorMessage = response.body.error;
        if (response.error_description) {
          errorMessage += ' ' + response.error_description;
        }
      } else if (response.body.errors) {
        if (response.body.errors.length === 1 && response.body.errors[0].message) {
          errorMessage = formatError(response.body.errors[0].message);
        } else {
          errorMessage = formatError(response.body.errors);
        }
      }
    } else {
      console.error('Handling error with no response', this, arguments);
      errorMessage = 'Unknown error';
    }

    // // Manually set a reasonable error when we get HTML back (currently 500s will do this).
    // if (request.responseText.indexOf('<!DOCTYPE') !== -1 && errorMessage == null) {
    //   errorMessage = [
    //     'There was a problem on the server.',
    //     request.responseURL,
    //     '→',
    //     request.status,
    //   ].join(' ');
    // }
    //
    // if (errorMessage === undefined) {
    //   if (responseText in request) {
    //     errorMessage = request.responseText.trim();
    //   } else {
    //     errorMessage = request.status + ' ' + request.statusText;
    //   }
    // }

    throw new Error(errorMessage);
  }
};

module.exports = apiClient;

if (typeof window !== 'undefined') {
  window.zooAPI = apiClient;
}
