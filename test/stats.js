var test = require('blue-tape');
var statsClient = require('../lib/stats-client');

var PROJECT_ID = '335'; // staging project "I Fancy Cats" ID = 335, production project "Galaxy Zoo: Bar Lengths" ID = 3
var WORKFLOW_ID = '693'; // staging workflow "I Fancy Cats - Cat me!" ID = 693, production workflow "Galaxy Zoo: Bar Lengths - Find Off-Center Bars" ID = 1623
var USER_ID = '1325801'; // staging "zootester1" ID = 1325801, production "zootester1" ID = 1459668

test('We can get stats for a project', function(t) {
  return statsClient.query({
    period: 'day',
    projectID: PROJECT_ID,
    type: 'classification'
  }).then(function(results) {
    return t.ok(Array.isArray(results), 'Should get an array back');
  });
});

test('We can get stats for a workflow', function(t) {
  return statsClient.query({
    period: 'day',
    type: 'classification',
    workflowID: WORKFLOW_ID
  }).then(function(results) {
    return t.ok(Array.isArray(results), 'Should get an array back');
  });
});

test('We can get stats for a user', function(t) {
  return statsClient.query({
    period: 'day',
    type: 'classification',
    userID: USER_ID
  }).then(function(results) {
    return t.ok(Array.isArray(results), 'Should get an array back');
  });
});

test('We can get stats for a user by project', function(t) {
  return statsClient.query({
    period: 'day',
    projectID: PROJECT_ID,
    type: 'classification',
    userID: USER_ID
  }).then(function(results) {
    return t.ok(Array.isArray(results), 'Should get an array back');
  });
});
