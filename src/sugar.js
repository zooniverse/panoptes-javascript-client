var SugarClient = require('sugar-client');
var JSONAPIClient = require('json-api-client');
var authClient = require('./auth');
var config = require('./config');

if (typeof window !== 'undefined') {
  SugarClient.Primus = require('sugar-client/primus');
  SugarClient.host = config.sugarHost;

  var sugarApiClient = new JSONAPIClient(config.sugarHost, {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  });

  var sugarClient = new SugarClient();

  auth.listen('change', function() {
    authClient.checkCurrent()
      .then(function(user) {
        if (user && authClient._bearerToken) {
          sugarClient.userId = user.id;
          sugarClient.authToken = authClient._bearerToken;

          if (process.env.NODE_ENV !== 'production') {
            sugarClient.on('response', function() {
              var args = Array.prototype.slice.call(arguments);
              console.log.apply(console, ['[SUGAR RESPONSE]'].concat(args));
            });
          }

          sugarClient.connect();
        } else {
          sugarClient.disconnect();
        }
      })
      .catch(function(e) {
        throw new Error('Failed to checkCurrent auth from sugar client');
      });
  });

  module.exports = {
    sugarClient: sugarClient,
    sugarApiClient: sugarApiClient,
  };
}
