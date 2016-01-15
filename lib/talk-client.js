var JSONAPIClient = require('json-api-client');
var config = require('./config');
var apiClient = require('./api-client');

var talkClient = new JSONAPIClient(config.talkHost, {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

talkClient.headers = apiClient.headers;
talkClient.handleError = apiClient.handleError;

module.exports = talkClient;
