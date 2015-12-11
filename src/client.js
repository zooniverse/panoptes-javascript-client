import JSONAPIClient from 'json-api-client'
import Auth from './auth'

const DEFAULT_OPTS = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes.zooniverse.org',
  apiRoot: '/api',
  appID: null
}

export default class PanoptesClient extends JSONAPIClient {
  constructor(opts) {
    if (opts.appID === null) {
      throw Error('Must provide an app ID')
    }

    opts = Object.assign(DEFAULT_OPTS, opts);
    super(opts.host + opts.apiRoot, opts.headers)

    for(let key in opts) {
      this[key] = opts[key]
    }

    this.auth = new Auth(this)
  }

  authenticate(token) {
    this.token = token
    this.headers['Authorization'] = 'Bearer ' + this.token
  }

  removeAuthentication() {
    delete this.token
    delete this.headers['Authorization']
  }
}
