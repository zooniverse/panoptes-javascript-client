var test = require('blue-tape');
var statsClient = require('../lib/stats-client');

var GALAXY_ZOO_BARS_ID = '3';
var GALAXY_ZOO_BARS_WORKFLOW_ID = '1623';

if (process.env.NODE_ENV !== 'production') {
  console.log('We can currently only tests the stats client in production.');
  process.exit(1);
}

test('We can get stats for a project', function(t) {
  return statsClient.query({
    projectID: GALAXY_ZOO_BARS_ID,
    workflowID: GALAXY_ZOO_BARS_WORKFLOW_ID,
    type: 'classification',
    period: 'day'
  }).then(function(results) {
    return t.ok(Array.isArray(results), 'Should get an array back');
  });
});
