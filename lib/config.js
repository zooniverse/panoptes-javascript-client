var DEFAULT_ENV = 'staging';

var API_HOSTS = {
  production: 'https://www.zooniverse.org',
  staging: 'https://panoptes-staging.zooniverse.org',
  development: 'https://panoptes-staging.zooniverse.org',
};

var API_APPLICATION_IDS = {
  production: 'f79cf5ea821bb161d8cbb52d061ab9a2321d7cb169007003af66b43f7b79ce2a',
  staging: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27',
  development: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27',
};

var OAUTH_HOSTS = {
  production: 'https://panoptes.zooniverse.org',
  staging: 'https://panoptes-staging.zooniverse.org',
  development: 'https://panoptes-staging.zooniverse.org',
};

var TALK_HOSTS = {
  production: 'https://talk.zooniverse.org',
  staging: 'https://talk-staging.zooniverse.org',
  development: 'https://talk-staging.zooniverse.org',
};

var SUGAR_HOSTS = {
  production: 'https://notifications.zooniverse.org',
  staging: 'https://notifications-staging.zooniverse.org',
  development: 'https://notifications-staging.zooniverse.org',
};

var STAT_HOSTS = {
  production: 'https://stats.zooniverse.org'
};

var hostFromBrowser = locationMatch(/\W?panoptes-api-host=([^&]+)/);
var appFromBrowser = locationMatch(/\W?panoptes-api-application=([^&]+)/);
var talkFromBrowser = locationMatch(/\W?talk-host=([^&]+)/);
var sugarFromBrowser = locationMatch(/\W?sugar-host=([^&]+)/);
var statFromBrowser = locationMatch(/\W?stat-host=([^&]+)/);

var hostFromShell = process.env.PANOPTES_API_HOST;
var appFromShell = process.env.PANOPTES_API_APPLICATION;
var talkFromShell = process.env.TALK_HOST;
var sugarFromShell = process.env.SUGAR_HOST;
var statFromShell = process.env.STAT_HOST;

var envFromBrowser = locationMatch(/\W?env=(\w+)/);
var envFromShell = process.env.NODE_ENV;

var env = envFromBrowser || envFromShell || DEFAULT_ENV;

if (!env.match(/^(production|staging|development)$/)) {
  throw new Error('Panoptes Javascript Client Error: Invalid Environment; ' +
    'try setting NODE_ENV to "staging" instead of "'+envFromShell+'".');
}

module.exports = {
  host: hostFromBrowser || hostFromShell || API_HOSTS[env],
  clientAppID: appFromBrowser || appFromShell || API_APPLICATION_IDS[env],
  talkHost: talkFromBrowser || talkFromShell || TALK_HOSTS[env],
  sugarHost: sugarFromBrowser || sugarFromShell || SUGAR_HOSTS[env],
  statHost: statFromBrowser || statFromShell || STAT_HOSTS[env],
  oauthHost: OAUTH_HOSTS[env],
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
