const basicOpts = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes-staging.zooniverse.org',
  apiRoot: '/api',
  appID: '535759b966935c297be11913acee7a9ca17c025f9f15520e7504728e71110a27'
}

const optsWithoutAppID = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes-staging.zooniverse.org',
  apiRoot: '/api'
}

const optsWithSecret = Object.assign({secret: '2ea8534e64537863daa1645bcb1464e01342880513e202fe0f37c3565c02324f'}, basicOpts)

const TEST_NAME = 'TEST_' + (new Date).toISOString().replace(/\W/g, '_')
const TEST_EMAIL = TEST_NAME.toLowerCase() + '@zooniverse.org'
const TEST_PASSWORD = 'P@$$wørd'

const testConfig = {
  projectID: '604', // Drake
  login: TEST_NAME,
  password: TEST_PASSWORD,
  email: TEST_EMAIL
}

export { basicOpts, optsWithoutAppID, optsWithSecret, testConfig }
