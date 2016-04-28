var config = require('./config');
var JSONAPIClient = require('json-api-client');
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;

statsClient = {

  query: function (params) {
    if (!params.type || !params.period) {
      return Promise.reject( new Error('Missing required parameter: type and period must be specified.'));
    }
    var query = params.workflow_id ? "workflow_id=" + params.workflow_id : "project_id=" + params.project_id;
    var stats_url = [config.statHost, 'counts', params.type, params.period].join('/') + '?' + query;
    return makeHTTPRequest('GET', stats_url)
        .then(
          function (response) {
            var results = JSON.parse(response.text);
            return results["events_over_time"]["buckets"];
          }
        )
  }
}

module.exports = statsClient;
