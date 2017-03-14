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

  handleError: function(error) {
    if (error instanceof Error)
      throw error;
    else {
      throw new Error('Unknown error (bad response)');
    }
  }
});

module.exports = apiClient;
