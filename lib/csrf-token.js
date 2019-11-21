function getCSRFToken() {
  console.log('Getting csrf token');
  var url = config.oauthHost + '/users/sign_in/?now=' + Date.now();
  return makeCredentialHTTPRequest('GET', url, null, JSON_HEADERS)
    .then(function (response) {
      var csrfToken = response.header['x-csrf-token'];
      console.info('Got auth token', csrfToken.slice(-6));
      return csrfToken;
    })
    .catch(function (response) {
      console.error('Failed to get csrf token');
      apiClient.handleError(response);
    });
};

module.exports = getCSRFToken;