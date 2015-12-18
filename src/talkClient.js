var JSONAPIClient = require('json-api-client').Resource;

var config = require('./config');
var apiClient = require('./apiClient');
var authClient = require('./authClient');

var talkClient = new JSONAPIClient(config.talkHost, {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

talkClient.headers = apiClient.headers;
talkClient.handleError = apiClient.handleError;

module.exports = talkClient;

if (typeof window !== 'undefined' && window !== null) {
  window.talkClient = talkClient;
}
