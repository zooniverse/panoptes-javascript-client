let test = require('blue-tape'),
    { exists } = require('../lib/utils'),
    PanoptesClient = require('../lib/client');

const TEST_NAME = 'TEST_' + (new Date).toISOString().replace(/\W/g, '_')
const TEST_EMAIL = TEST_NAME.toLowerCase() + '@zooniverse.org'
const TEST_PASSWORD = 'P@$$wørd'

let { api } = new PanoptesClient({
  appID: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27',
  host: 'https://panoptes-staging.zooniverse.org'
});
let { auth } = api;

test('Checking the current user initially fails', function(t) {
  return auth.checkCurrent()
    .then((user) => {
      if (user) {
        t.fail('Nobody should be signed in');
      } else {
        t.pass('Nobody is signed in');
      }
    });
});

test('Registering an account with no data fails', function(t) {
  const BLANK_REGISTRATION = {};
  return auth.register(BLANK_REGISTRATION)
    .then(() => {
      t.fail('Should not have been able to register');
    })
    .catch((error) => {
      t.pass('An error should have been thrown.');
      t.ok(error.message.match(/^display_name(.+)blank/mi), 'Display name error should mention "blank"');
      t.ok(error.message.match(/^email(.+)blank/mi), 'Email error should mention "blank"');
      t.ok(error.message.match(/^password(.+)blank/mi), 'Password error should mention "blank"');
    });
});


test('Registering an account with a short password fails', function(t) {
  const SHORT_PASSWORD_REGISTRATION = {
    display_name: TEST_NAME + '_short_password',
    email: TEST_EMAIL,
    password: TEST_PASSWORD.slice(0, 7)
  }

  return auth.register(SHORT_PASSWORD_REGISTRATION)
    .then(function() {
      t.fail('Should not have been able to register');
    })
    .catch(function(error) {
      t.ok(error.message.match(/^password(.+)short/mi), 'Password error should mention "short"');
    });
});

test('Registering a new account works', function(t) {
  const GOOD_REGISTRATION = {
    display_name: TEST_NAME,
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  }

  return auth.register(GOOD_REGISTRATION)
    .then(function(user) {
      t.ok(exists(user), 'Should have gotten the new user');
      t.ok(user.display_name == TEST_NAME, 'Display_name should be whatever display_name was given');
    });
});


test('Registering keeps you signed in', function(t) {
  return auth.checkCurrent()
    .then(function(user) {
      t.ok(exists(user), 'Should have gotten a user');
      t.ok(user.display_name == TEST_NAME, 'Display_name should be whatever display_name was given');
    });
});

test('Sign out', function(t) {
  return auth.signOut()
    .then(function() {
      t.pass('Signed out');
    });
});

test('Registering an account with an already used display_name fails', function(t) {
  const DUPLICATE_REGISTRATION = {
    display_name: TEST_NAME,
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  }

  return auth.register(DUPLICATE_REGISTRATION)
    .then(function() {
      t.fail('Should not have been able to register with a duplicate display_name');
    })
    .catch(function(error) {
      t.ok(error.message.match(/^display_name(.+)taken/mi), 'Display name error should mention "taken"');
      t.ok(error.message.match(/^email(.+)taken/mi), 'Email error should mention "taken"');
    });
});

test('Signing in with an unknown login fails', function(t) {
  const BAD_LOGIN = {
    display_name: 'NOT_' + TEST_NAME,
    password: TEST_PASSWORD
  }

  return auth.signIn(BAD_LOGIN)
    .then(function() {
      t.fail('Should not have been able to sign in with a bad login');
    })
    .catch(function(error) {
      console.log('error', error);
      // NOTE: A bad login should return the same error as a bad password.
      t.ok(error.message.match(/^invalid(.+)password/mi), 'Error should mention "invalid" and "password"');
    });
});

test('Signing in with the wrong password fails', function(t) {
  const BAD_PASSWORD = {
    display_name: TEST_NAME,
    password: 'NOT_' + TEST_PASSWORD
  }

  return auth.signIn(BAD_PASSWORD)
    .then(function() {
      t.fail('Should not have been able to sign in with a bad password');
    })
    .catch(function(error) {
      t.ok(error.message.match(/^invalid(.+)password/mi), 'Error should mention "invalid" and "password"');
    });
});

test('Signing in with good details works', function(t) {
  const GOOD_LOGIN_DETAILS = {
    display_name: TEST_NAME,
    password: TEST_PASSWORD
  }

  return auth.signIn(GOOD_LOGIN_DETAILS)
    .then(function(user) {
      t.ok(exists(user), 'Should have gotten a user');
      t.ok(user.display_name == TEST_NAME, 'Display name should be the original');
    })
});

test('Disabling an account works', function(t) {
  return auth.disableAccount()
    .then(function() {
      const OLD_LOGIN_DETAILS = {
        display_name: TEST_NAME,
        password: TEST_PASSWORD
      }

      return auth.signIn(OLD_LOGIN_DETAILS)
        .then(function(user) {
          t.fail('Should not have been able to sign in to a disabled account');
        })
        .catch(function() {
          t.pass('Could not sign in to a disabled account');
        });
    });
});
