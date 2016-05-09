var JSONAPIClient = require('json-api-client');
var config = require('./config');

var apiClient = new JSONAPIClient(config.host + '/api', {
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.api+json; version=1',
}, {
  beforeEveryRequest: function() {
    var auth = require('./auth');
    return auth.checkBearerToken();
  },

  handleError: function(response) {
    var errorMessage;
    if (response instanceof Error) {
      throw response;
    } else if (typeof response.body === 'object') {
      if (response.body.error) {
        errorMessage = response.body.error;
        if (response.body.error_description) {
          errorMessage += ' ' + response.error_description;
        }
      } else if (Array.isArray(response.body.errors)) {
        errorMessage = response.body.errors.map(function(error) {
          if (typeof error.message === 'string') {
            return error.message;
          } else if (typeof error.message === 'object') {
            return Object.keys(error.message).map(function(key) {
              return key + ' ' + error.message[key];
            }).join('\n');
          }
        }).join('\n');
      } else {
        errorMessage = 'Unknown error (bad response body)';
      }
    } else if (response.text.indexOf('<!DOCTYPE') !== -1) {
      // Manually set a reasonable error when we get HTML back (currently 500s will do this).
      errorMessage = [
        'There was a problem on the server.',
        response.req.url,
        response.status,
        response.statusText,
      ].join(' ');
    } else {
      errorMessage = 'Unknown error (bad response)';
    }

    throw new Error(errorMessage);
  }
});

module.exports = apiClient;
