import { makeHTTPRequest } from 'json-api-client'
import { EventEmitter } from 'fbemitter'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

const TOKEN_EXPIRATION_ALLOWANCE = 10 * 1000

export default class Auth extends EventEmitter {
  constructor(client) {
    super()

    this.client = client
    this._bearerRefreshTimeout = NaN
  }

  _getAuthToken() {
    return makeHTTPRequest('GET', this.client.host + '/users/sign_in/?now=' + Date.now(), null, JSON_HEADERS)
      .then((response) => {
        return response.headers['x-csrf-token']
      }).catch((e) => {
        throw new Error(e)
      })
  }

  _getBearerToken() {
    if (this.client.token) {
      return Promise.resolve(this.client.token)
    }

    let data = {
      client_id: this.client.appID
    }

    if (typeof this.client.secret === 'undefined') {
      data['grant_type'] = 'password'
    } else {
      data['grant_type'] = 'client_credentials'
      data['client_secret'] = this.client.secret
    }

    return makeHTTPRequest('POST', this.client.host + '/oauth/token', data, JSON_HEADERS)
      .then((response) => {
        return this._handleNewBearerToken(response)
      }).catch((e) => {
        throw new Error(e)
      })
  }

  _handleNewBearerToken(response) {
    this.client.authenticate(response.body.access_token)

    let refresh = this._refreshBearerToken.bind(this, response.body.refresh_token);
    let timeToRefresh = (response.body.expires_in * 1000) - TOKEN_EXPIRATION_ALLOWANCE;
    this._bearerRefreshTimeout = setTimeout(refresh, timeToRefresh);

    return response.body.access_token
  }

  _refreshBearerToken(refreshToken) {
    let data = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.client.appID
    };

    return makeHTTPRequest('POST', this.client.host + '/oauth/token', data, JSON_HEADERS)
      .then((response) => {
        return this._handleNewBearerToken(response);
      }).catch((e) => {
        throw new Error(e)
      })
  }

  _deleteBearerToken() {
    this.client.removeAuthentication()
    clearTimeout(this._bearerRefreshTimeout)
  }

  _getSession() {
    return this.client.get('/me')
      .then((response) => response[0])
      .catch((e) => {
        throw new Error(e)
      })
  }

  _handleUserChange(user) {
    this.user = user
    this.emit('change', this.user)

    return this.user
  }

  getCurrent() {
    return this.user
  }

  checkCurrent() {
    return this._getBearerToken()
      .then(() => this._getSession())
      .then((user) => this._handleUserChange(user))
      .catch(function(e) {
        throw new Error('Error retrieving current user.')
      })
  }

  signIn(opts = {}) {
    if (this.user) {
      throw new Error('Cannot sign in, already have user')
    }

    return this._getAuthToken().then((token) => {
      let data = {
        authenticity_token: token,
        user: opts
      }

      return makeHTTPRequest('POST', this.client.host + '/users/sign_in', data, JSON_HEADERS)
        .then(() => this.checkCurrent())
        .catch(function(e) {
          throw new Error('Error signing in.')
        })
    })
  }

  signOut() {
    if (!this.user) {
      throw new Error('Cannot sign out, not signed in')
    }

    return this._getAuthToken().then((token) => {
      let deleteHeaders = Object.create(JSON_HEADERS)
      deleteHeaders['X-CSRF-Token'] = token

      return makeHTTPRequest('DELETE', this.client.host + '/users/sign_out', null, deleteHeaders)
        .then(() => {
          this._deleteBearerToken()
          this._handleUserChange(false)
          return null
        })
        .catch((e) => {
          throw new Error('Error signing out')
        })
    })
  }

  register(opts = {}) {
    if (this.user) {
      throw new Error('Cannot register, already have user')
    }

    return this._getAuthToken().then((token) => {
      let data = {
        authenticity_token: token,
        user: opts
      }

      return this.client.post('/../users', data, JSON_HEADERS)
        .then(() => this.checkCurrent())
        .catch((e) => {
          throw new Error('Error registering user')
        })
    })
  }

  changePassword(opts) {
    if (!this.user) {
      throw new Error('Cannot change password, not signed in')
    }

    if (typeof opts.current === 'undefined' || typeof opts.replacement === 'undefined') {
      throw new Error('Must supply both current and replacement password')
    }

    let originalUser = this.user

    return this._getAuthToken().then((token) => {
      let data = {
        authenticity_token: token,
        user: {
          current_password: opts.current,
          password: opts.replacement,
          password_confirmation: opts.replacement
        }
      }

      this.client.put('/../users', data, JSON_HEADERS)
        .then(() => this.signOut)
        .then(() => {
          this.signIn({
            login: originalUser.login,
            password: opts.replacement
          })
        })
    })
  }

  requestPasswordReset(opts) {
    if (typeof opts.email === 'undefined') {
      throw new Error('Must pass email to send reset request to')
    }

    return this._getAuthToken().then((token) => {
      let data = {
        authenticity_token: token,
        user: {email}
      }

      return this.client.post('/../users/password', data, JSON_HEADERS)
    })
  }

  resetPassword(opts) {
    if (typeof opts.password === 'undefined') {
      throw new Error('Must provide a password')
    }

    if (typeof opts.confirmation === 'undefined') {
      throw new Error('Must provide a password confirmation')
    }

    if (typeof opts.token === 'undefined') {
      throw new Error('Must provide a reset token')
    }

    this._getAuthToken().then((authToken) => {
      let data = {
        authenticity_token: authToken,
        user: {
          password: opts.password,
          password_confirmation: opts.confirmation,
          reset_password_token: opts.token
        }
      }

      return this.client.put('/../users/password', data, JSON_HEADERS)
    })
  }

  disableAccount() {
    if (!this.user) {
      throw new Error('Failed to disable account, not signed in')
    }

    return this.user.delete()
      .then(() => {
        this._deleteBearerToken()
        return null
      })
  }

  unsubscribeEmail(opts) {
    if (typeof opts.email === 'undefined') {
      throw new Error('Must provide an email')
    }

    return this._getAuthToken().then((token) => {
      let data = {
        authenticity_token: token,
        emai: opts.email
      }

      return makeHTTPRequest('POST', this.client.host + '/unsubscribe', data, JSON_HEADERS)
    })
  }
}
