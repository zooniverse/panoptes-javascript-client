var oauth = require('../lib/oauth');

// This is just a temporary app ID for testing on staging.
var WILDCAM_GORONGOSA_EDUCATION_APP_ID = '17bdbeb57f54a3bf6344cf7150047879cfa1c8d5f9fd77d64923e6c81fe6e949';

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
