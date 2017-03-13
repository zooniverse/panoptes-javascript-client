var JSONAPIClient = require('json-api-client');
var config = require('./config');

var apiClient = new JSONAPIClient(config.host + '/api', {
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.api+json; version=1',
}, {
  beforeEveryRequest: function() {
    console.log('using local panoptes-client');
    var auth = require('./auth');
    return auth.checkBearerToken();
  },

  handleError: function(error) {
    var errorMessage;
    if (typeof error.response.body === 'object') {
      if (error.response.body.error) {
        errorMessage = error.response.body.error;
        if (error.response.body.error_description) {
          errorMessage += ' ' + error.response.error_description;
        }
      } else if (Array.isArray(error.response.body.errors)) {
        errorMessage = error.response.body.errors.map(function(error) {
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
    } else if (error.response.text.indexOf('<!DOCTYPE') !== -1) {
      // Manually set a reasonable error when we get HTML back (currently 500s will do this).
      errorMessage = [
        'There was a problem on the server.',
        error.response.req.url,
        error.response.status,
        error.response.statusText,
      ].join(' ');
    } else {
      errorMessage = 'Unknown error (bad response)';
    }

    if (typeof error === 'undefined') {
      error = new Error(errorMessage);
    } else if (typeof error === 'object') {
      error.message = errorMessage;
    }

    throw error;
  }
});

module.exports = apiClient;
