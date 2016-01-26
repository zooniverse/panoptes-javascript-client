var test = require('blue-tape');
var auth = require('../lib/auth');

var TEST_LOGIN = 'TEST_' + new Date().toISOString().replace(/\W/g, '_');
var TEST_EMAIL = TEST_LOGIN.toLowerCase() + '@zooniverse.org';
var TEST_PASSWORD = 'P@$$wørd';

test('Checking the current user initially fails', function(t) {
  return auth.checkCurrent()
    .then(function(user) {
      if (user) {
        t.fail('Nobody should be signed in');
      } else {
        t.pass('Nobody is signed in');
      }
    });
});

test('Registering an account with no data fails', function(t) {
  var BLANK_REGISTRATION = {};
  return auth.register(BLANK_REGISTRATION)
    .then(function() {
      t.fail('Should not have been able to register');
    })
    .catch(function(error) {
      t.pass('An error should have been thrown.');
      t.ok(error.message.match(/^login(.+)blank/mi), 'Login error should mention "blank"');
      t.ok(error.message.match(/^email(.+)blank/mi), 'Email error should mention "blank"');
      t.ok(error.message.match(/^password(.+)blank/mi), 'Password error should mention "blank"');
    });
});

test('Registering an account with a short password fails', function(t) {
  var SHORT_PASSWORD_REGISTRATION = {
    login: TEST_LOGIN + '_short_password',
    email: TEST_EMAIL,
    password: TEST_PASSWORD.slice(0, 7),
  };
  return auth.register(SHORT_PASSWORD_REGISTRATION)
    .then(function() {
      t.fail('Should not have been able to register');
    })
    .catch(function(error) {
      t.ok(error.message.match(/^password(.+)short/mi), 'Password error should mention "short"');
    });
});

test('Registering a new account works', function(t) {
  var GOOD_REGISTRATION = {
    login: TEST_LOGIN,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  };
  return auth.register(GOOD_REGISTRATION)
    .then(function(user) {
      t.ok(user, 'Should have gotten the new user');
      t.equal(user.login, TEST_LOGIN, 'Login should be whatever login was given');
    });
});

test('Registering keeps you signed in', function(t) {
  return auth.checkCurrent()
    .then(function(user) {
      t.ok(user, 'Should have gotten a user');
      t.equal(user.login, TEST_LOGIN, 'Login should be whatever login was given');
    });
});

test('Sign out', function(t) {
  return auth.signOut()
    .then(function() {
      t.pass('Signed out');
    });
});

test('Registering an account with an already used login fails', function(t) {
  var DUPLICATE_REGISTRATION = {
    login: TEST_LOGIN,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  };
  return auth.register(DUPLICATE_REGISTRATION)
    .then(function() {
      t.fail('Should not have been able to register with a duplicate login');
    })
    .catch(function(error) {
      t.ok(error.message.match(/^login(.+)taken/mi), 'Login error should mention "taken"');
      t.ok(error.message.match(/^email(.+)taken/mi), 'Email error should mention "taken"');
    });
});

test('Signing in with an unknown login fails', function(t) {
  var BAD_LOGIN = {
    login: 'NOT_' + TEST_LOGIN,
    password: TEST_PASSWORD,
  };
  return auth.signIn(BAD_LOGIN)
    .then(function() {
      t.fail('Should not have been able to sign in with a bad login');
    })
    .catch(function(error) {
      // NOTE: A bad login should return the same error as a bad password.
      t.ok(error.message.match(/^invalid(.+)password/mi), 'Error should mention "invalid" and "password"');
    });
});

test('Signing in with the wrong password fails', function(t) {
  var BAD_PASSWORD = {
    login: TEST_LOGIN,
    password: 'NOT_' + TEST_PASSWORD,
  };
  return auth.signIn(BAD_PASSWORD)
    .then(function() {
      t.fail('Should not have been able to sign in with a bad password');
    })
    .catch(function(error) {
      t.ok(error.message.match(/^invalid(.+)password/mi), 'Error should mention "invalid" and "password"');
    });
});

test('Signing in with good details works', function(t) {
  var GOOD_LOGIN_DETAILS = {
    login: TEST_LOGIN,
    password: TEST_PASSWORD,
  };
  return auth.signIn(GOOD_LOGIN_DETAILS)
    .then(function(user) {
      t.ok(user, 'Should have gotten a user');
      t.ok(user.login == TEST_LOGIN, 'Login should be the original');
    });
});

test('Disabling an account works', function(t) {
  return auth.disableAccount()
    .then(function() {
      var OLD_LOGIN_DETAILS = {
        login: TEST_LOGIN,
        password: TEST_PASSWORD,
      };
      return auth.signIn(OLD_LOGIN_DETAILS)
        .then(function(user) {
          t.fail('Should not have been able to sign in to a disabled account');
        })
        .catch(function() {
          t.pass('Could not sign in to a disabled account');
        });
    });
});
