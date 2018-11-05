var config = require('./config');
var JSONAPIClient = require('json-api-client');
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;

var statsClient = {
  query: function (params) {
    if (params.type === undefined || params.period === undefined) {
      return Promise.reject(new Error('Missing required parameter: type and period must be specified.'));
    }

    var data = {};
    if (params.workflowID) {
      data['workflow_id'] = params.workflowID;
    }
    if (params.projectID) {
      data['project_id'] = params.projectID;
    }
    if (params.userID) {
      data['user_id'] = params.userID;
    }
    
    var statsURL = [config.statHost, 'counts', params.type, params.period].join('/');

    return makeHTTPRequest('GET', statsURL, data).then(function (response) {
      var results = JSON.parse(response.text);
      return results['events_over_time']['buckets'];
    });
  }
};

module.exports = statsClient;
