var oauth = require('../lib/oauth');

// This is just a temporary app ID for testing.
var WILDCAM_GORONGOSA_EDUCATION_APP_ID = '64aa60e488a555e2ef8b7f9d1621ec7e430dcb8b8baa0d00b8460eca5660d188';

document.body.insertAdjacentHTML('beforeend', [
  'Check the console.<br />',
  '<input type="text" id="app-id-input" value="' + WILDCAM_GORONGOSA_EDUCATION_APP_ID + '" size="65" />',
  '<button type="button" id="init-button">Init</button>',
  '<br />',
  '<button type="button" id="sign-in-button">Sign in</button>',
  '<button type="button" id="sign-out-button">Sign out</button>'
].join('\n'));

document.getElementById('init-button').addEventListener('click', function() {
  var appID = document.getElementById('app-id-input').value;
  console.log('Calling init...');
  oauth.init(appID).then(function() {
    console.log('Init successful', arguments);
  });
});

document.getElementById('sign-in-button').addEventListener('click', function() {
  console.log('Calling signIn...');
  oauth.signIn(location.href).then(function() {
    console.log('Sign-in successful', arguments);
  });
});

document.getElementById('sign-out-button').addEventListener('click', function() {
  console.log('Calling signOut...');
  oauth.signOut().then(function() {
    console.log('Sign-out successful', arguments);
  });
});

window.oauth = oauth;
