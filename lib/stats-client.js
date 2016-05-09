var config = require('./config');
var JSONAPIClient = require('json-api-client');
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;

var statsClient = {
  query: function (params) {
    if (params.type === undefined || params.period === undefined) {
      return Promise.reject(new Error('Missing required parameter: type and period must be specified.'));
    }

    var query = params.workflowID ? 'workflow_id=' + params.workflowID : 'project_id=' + params.projectID;
    var statsURL = [config.statHost, 'counts', params.type, params.period].join('/') + '?' + query;

    return makeHTTPRequest('GET', statsURL).then(function (response) {
      var results = JSON.parse(response.text);
      return results['events_over_time']['buckets'];
    });
  }
};

module.exports = statsClient;
