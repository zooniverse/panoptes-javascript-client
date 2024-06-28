var JSONAPIClient = require('./json-api-client');
var config = require('./config');
var apiClient = require('./api-client');

var talkClient = new JSONAPIClient(config.talkHost, {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Canary-Testing-Opt-In': 'always',
});

talkClient.params = apiClient.params;
talkClient.headers = apiClient.headers;
talkClient.handleError = apiClient.handleError;
talkClient.beforeEveryRequest = apiClient.beforeEveryRequest;

module.exports = talkClient;
