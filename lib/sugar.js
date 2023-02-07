
var SugarClient = require('./SugarClient/client');
var JSONAPIClient = require('./json-api-client');
var auth = require('./auth');
var config = require('./config');

if (typeof navigator !== 'undefined') {
  SugarClient.Primus = require('./SugarClient/primus');
  SugarClient.host = config.sugarHost;

  var sugarApiClient = new JSONAPIClient(config.sugarHost, {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }, {
    beforeEveryRequest: function() {
      return auth.checkBearerToken()
        .then(function () {
          return null;
        });
    }
  });

  var sugarClient = new SugarClient();

  auth.listen('change', function() {
    auth.checkCurrent()
      .then(function(user) {
        if (user) {
          sugarClient.userId = user.id;
          auth.checkBearerToken()
            .then(function (token) {
              sugarClient.authToken = token;
              sugarClient.connect();
            })

          if (process.env.NODE_ENV !== 'production') {
            sugarClient.on('response', function() {
              var args = Array.prototype.slice.call(arguments);
              console.log.apply(console, ['[SUGAR RESPONSE]'].concat(args));
            });
          }
        } else {
          sugarClient.disconnect();
        }
      })
      .catch(function(e) {
        console.error(e)
        throw new Error('Failed to checkCurrent auth from sugar client');
      });
  });

  module.exports = {
    sugarClient: sugarClient,
    sugarApiClient: sugarApiClient,
  };
}
