var config = require('./config');
var JSONAPIClient = require('./json-api-client');
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;

var erasClient = {
  query: function (params) {
    if (params.type === undefined) {
      return Promise.reject(new Error('Missing required parameter: type (either classifications or comments) must be specified.'));
    }

    var data = {};
    if (params.workflowID) {
      data['workflow_id'] = params.workflowID;
    }
    if (params.projectID) {
      data['project_id'] = params.projectID;
    }
    if (params.period) {
      data['period'] = params.period;
    }

    var erasURL = [config.erasHost, params.type].join('/');

    return makeHTTPRequest('GET', erasURL, data).then(function (response) {
      var results = JSON.parse(response.text);
      return results;
    });
  }
};

module.exports = erasClient;
