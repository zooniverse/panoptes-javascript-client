var DEFAULT_ENV = 'staging';

var API_HOSTS = {
  production: 'https://www.zooniverse.org',
  staging: 'https://panoptes-staging.zooniverse.org',
  development: 'https://panoptes-staging.zooniverse.org',
  test: 'https://panoptes-staging.zooniverse.org'
};

var API_APPLICATION_IDS = {
  production: 'f79cf5ea821bb161d8cbb52d061ab9a2321d7cb169007003af66b43f7b79ce2a',
  staging: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27',
  development: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27',
  test: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27'
};

var OAUTH_HOSTS = {
  production: 'https://www.zooniverse.org',
  staging: 'https://panoptes-staging.zooniverse.org',
  development: 'https://panoptes-staging.zooniverse.org',
  test: 'https://panoptes-staging.zooniverse.org'
};

var TALK_HOSTS = {
  production: 'https://talk.zooniverse.org',
  staging: 'https://talk-staging.zooniverse.org',
  development: 'https://talk-staging.zooniverse.org',
  test: 'https://talk-staging.zooniverse.org'
};

var SUGAR_HOSTS = {
  production: 'https://notifications.zooniverse.org',
  staging: 'https://notifications-staging.zooniverse.org',
  development: 'https://notifications-staging.zooniverse.org',
  test: 'https://notifications-staging.zooniverse.org'
};

var STAT_HOSTS = {
  production: 'https://stats.zooniverse.org',
  staging: 'https://stats-staging.zooniverse.org',
  development: 'https://stats-staging.zooniverse.org',
  test: 'https://stats-staging.zooniverse.org'
};

var hostFromShell = process.env.PANOPTES_API_HOST;
var appFromShell = process.env.PANOPTES_API_APPLICATION;
var talkFromShell = process.env.TALK_HOST;
var sugarFromShell = process.env.SUGAR_HOST;
var statFromShell = process.env.STAT_HOST;
var oauthFromShell = process.env.OAUTH_HOST;

var envFromBrowser = locationMatch(/\W?env=(\w+)/);
var envFromCreateReactApp = process.env.REACT_APP_ENV
var envFromShell = process.env.NODE_ENV;

var env = envFromBrowser || envFromCreateReactApp || envFromShell || DEFAULT_ENV;

if (!env.match(/^(production|staging|development|test)$/)) {
  throw new Error('Panoptes Javascript Client Error: Invalid Environment; ' +
    'try setting NODE_ENV to "staging" instead of "'+envFromShell+'".');
}

var defaultParams = {
  http_cache: true
}

var JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

if (typeof location !== 'undefined' && location !== null) {
  var query = window.location.search.substring(1);
  query = query.split('&');
  query.map(function(param) {
    var pair = param.split('=');
    var key = decodeURIComponent(pair[0]);
    var value = decodeURIComponent(pair[1]);
    if (defaultParams[key]) {
      defaultParams[key] = value;
    }
  });
}

module.exports = {
  host: hostFromShell || API_HOSTS[env],
  clientAppID: appFromShell || API_APPLICATION_IDS[env],
  talkHost: talkFromShell || TALK_HOSTS[env],
  sugarHost: sugarFromShell || SUGAR_HOSTS[env],
  statHost: statFromShell || STAT_HOSTS[env],
  oauthHost: oauthFromShell || OAUTH_HOSTS[env],
  params: defaultParams,
  jsonHeaders: JSON_HEADERS
};

// Try and match the location.search property against a regex. Basically mimics
// the CoffeeScript existential operator, in case we're not in a browser.
function locationMatch(regex) {
  var match;
  if (typeof location !== 'undefined' && location !== null) {
    match = location.search.match(regex);
  }

  return (match && match[1]) ? match[1] : undefined;
}
