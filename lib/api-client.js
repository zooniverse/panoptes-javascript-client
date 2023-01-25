var JSONAPIClient = require('./json-api-client');
var config = require('./config');

var apiClient = new JSONAPIClient(config.host + '/api', {
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.api+json; version=1',
}, {
  params: config.params,

  beforeEveryRequest: function() {
    var auth = require('./auth');
    return auth.checkBearerToken();
  },

  handleError: function(response) {
    var errorMessage;
    if (response instanceof Error) {
      return Promise.reject(response);
    } else if (response.body && typeof response.body === 'object') {
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
    } else {
      errorMessage = 'Unknown error (bad response)';
    }

    console.warn(errorMessage);
    var e = new Error(errorMessage);
    e.status = response.status;
    e.statusText = response.statusText;
    return Promise.reject(e);
  }
});

module.exports = apiClient;
