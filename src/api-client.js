var JSONAPIClient = require('json-api-client');
var config = require('./config');

var apiClient = new JSONAPIClient(config.host + '/api', {
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.api+json; version=1',
});

apiClient.handleError = function(request) {
  if (request.message) {
    throw request;
  } else if (request.responseText) {
    var errorMessage;
    var response = JSON.parse(request.responseText);

    if (response && response.error) {
      errorMessage = response.error;
      if (response.error_description) {
        errorMessage = errorMessage + ' ' + response.error_description;
      }
    } else if (response && response.errors && response.errors[0].message) {
      errorMessage = response.errors.reduce(function(array, message) {
        if (typeof message === 'string') {
          array.push(message);
        } else {
          Object.keys(message).forEach(function(key) {
            array.push(key + ' ' + message[key]);
          });
        }
      }, []).join('\n');
    }

    // Manually set a reasonable error when we get HTML back (currently 500s will do this).
    if (request.responseText.indexOf('<!DOCTYPE') !== -1 && errorMessage == null) {
      errorMessage = [
        'There was a problem on the server.',
        request.responseURL,
        '→',
        request.status,
      ].join(' ');
    }

    if (errorMessage === undefined) {
      if (responseText in request) {
        errorMessage = request.responseText.trim();
      } else {
        errorMessage = request.status + ' ' + request.statusText;
      }
    }

    throw new Error(errorMessage);
  }
};

module.exports = apiClient;

if (typeof window !== 'undefined') {
  window.zooAPI = apiClient;
}
