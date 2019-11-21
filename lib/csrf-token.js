var config = require('./config');
var apiClient = require('./api-client');

function getCSRFToken() {
  console.log('Getting CSRF token');
  var url = config.oauthHost + '/users/sign_in/?now=' + Date.now();
  return makeCredentialHTTPRequest('GET', url, null, config.jsonHeaders)
    .then(function (response) {
      var csrfToken = response.header['x-csrf-token'];
      console.info('Got CSRF token', csrfToken.slice(-6));
      return csrfToken;
    })
    .catch(function (response) {
      console.error('Failed to get csrf token');
      apiClient.handleError(response);
    });
};

module.exports = getCSRFToken;