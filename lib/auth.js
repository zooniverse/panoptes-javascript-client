var JSONAPIClient = require('./json-api-client');
var Model = JSONAPIClient.Model;
var makeHTTPRequest = JSONAPIClient.makeHTTPRequest;
var makeCredentialHTTPRequest = JSONAPIClient.makeCredentialHTTPRequest;
var config = require('./config');
var apiClient = require('./api-client');
var getCSRFToken = require('./csrf-token');

// We don't want to wait until the token is already expired before refreshing it.
// attempt to get a new token 5mins (300sec) before the current one expires
var BEARER_TOKEN_EXPIRATION_ALLOWANCE = 300 * 1000;

const authClient = new Model({
  _currentUserPromise: null,

  _bearerToken: '',
  _bearerTokenExpiration: NaN,
  _refreshToken: '',
  _tokenRefreshPromise: null,

  async _getBearerToken() {
    console.log('Getting bearer token');
    if (this._bearerToken) {
      console.info('Already had a bearer token');
      return this._bearerToken;
    } else {
      var url = config.host + '/oauth/token';

      var data = {
        'grant_type': 'password',
        'client_id': config.clientAppID,
      };

      try {
        const response = await makeCredentialHTTPRequest('POST', url, data, config.jsonHeaders);
        const token = this._handleNewBearerToken(response);
        console.info('Got bearer token', token.slice(-6));
        return token;
      } catch (error) {
        console.error('Failed to get bearer token');
        return apiClient.handleError(error);
      }
    }
  },

  _handleNewBearerToken(request) {
    var response = JSON.parse(request.text);

    this._bearerToken = response.access_token;
    apiClient.headers.Authorization = 'Bearer ' + this._bearerToken;

    this._bearerTokenExpiration = Date.now() + (response.expires_in * 1000);
    this._refreshToken = response.refresh_token;

    this.emit('refresh', this._bearerToken);
    return this._bearerToken;
  },

  _bearerTokenIsExpired() {
    return Date.now() >= this._bearerTokenExpiration - BEARER_TOKEN_EXPIRATION_ALLOWANCE;
  },

  async _makeRefreshTokenRequest(data) {
    var url = config.host + '/oauth/token';
    let token = '';
    try {
      const response = await makeHTTPRequest('POST', url, data, config.jsonHeaders)
      token = this._handleNewBearerToken(response);
      console.info('Refreshed bearer token', token.slice(-6));
    } catch (error) {
      console.error('Failed to refresh bearer token');
      apiClient.handleError(request);
    }
    this._tokenRefreshPromise = null;
    return token;
  },

  async _refreshBearerToken() {
    if (this._tokenRefreshPromise === null) {
      console.log('Refreshing expired bearer token');

      var data = {
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
        client_id: config.clientAppID,
      };

      this._tokenRefreshPromise = this._makeRefreshTokenRequest(data);
    }

    return this._tokenRefreshPromise;
  },

  _deleteBearerToken() {
    this._bearerToken = '';
    delete apiClient.headers.Authorization;
    this._bearerTokenExpiration = NaN;
    this._refreshToken = '';
    console.log('Deleted bearer token');
  },

  async _getSession() {
    console.log('Getting session');
    try {
      const [user] = await apiClient.get('/me');
      console.info('Got session', user.login, user.id);
      return user;
    } catch (error) {
      console.error('Failed to get session');
      throw error;
    }
  },

  async _makeRegistrationRequest(data) {
    try {
      const url = config.host + '/users';
      await makeCredentialHTTPRequest('POST', url, data, config.jsonHeaders);
      await this._getBearerToken();
      const user = await this._getSession();
      console.info('Registered account', user.login, user.id);
      return user;
    } catch (error) {
      console.error('Failed to register');
      return apiClient.handleError(error);
    }
  },

  async register(given) {
    const user = await this.checkCurrent();
    if (user) {
      await this.signOut();
      return this.register(given);
    } else {
      const token = await getCSRFToken(config.host);
      const data = {
        authenticity_token: token,
        user: {
          login: given.login,
          email: given.email,
          password: given.password,
          credited_name: given.credited_name,
          global_email_communication: given.global_email_communication,
          project_id: given.project_id,
          beta_email_communication: given.beta_email_communication,
          project_email_communication: given.project_email_communication,
        },
      };

      const registrationRequest = this._makeRegistrationRequest(data);
      this._currentUserPromise = registrationRequest.catch(() => null);
      await this._currentUserPromise;
      this.emit('change', this._currentUserPromise);

      return registrationRequest;
    }
  },

  async _getUser() {
    try {
      const token = await this._getBearerToken();
      return this._getSession();
    } catch (error) {
      // Nobody's signed in. This isn't an error.
      console.info('No current user');
      return null;
    }
  },
  
  async checkCurrent() {
    if (!this._currentUserPromise) {
      console.log('Checking current user');
      this._currentUserPromise = this._getUser();
      await this._currentUserPromise;
      this.emit('change', this._currentUserPromise);
    }

    return this._currentUserPromise;
  },

  async checkBearerToken() {
    let awaitBearerToken;
    if (this._bearerTokenIsExpired()) {
      awaitBearerToken = await this._refreshBearerToken();
    } else {
      awaitBearerToken = this._bearerToken;
    }
    return awaitBearerToken;
  },

  async _makeSignInRequest(data) {
    try {
      const url = config.host + '/users/sign_in';
      await makeCredentialHTTPRequest('POST', url, data, config.jsonHeaders);
      await this._getBearerToken();
      const user = await this._getSession();
      console.info('Signed in', user.login, user.id);
      return user;
    } catch (error) {
      console.error('Failed to sign in');
      return apiClient.handleError(error);
    }
  },

  async signIn(credentials) {
    const user = await this.checkCurrent();
    if (user) {
      await this.signOut();
      return this.signIn(credentials);
    } else {
      console.log('Signing in', credentials.login);
      const token = await getCSRFToken(config.host)
      const data = {
        authenticity_token: token,
        user: {
          login: credentials.login,
          password: credentials.password,
          remember_me: true,
        },
      };

      const signInRequest = this._makeSignInRequest(data);
      this._currentUserPromise = signInRequest.catch(() => null);
      await this._currentUserPromise;
      this.emit('change', this._currentUserPromise);

      return signInRequest;
    }
  },

  async changePassword(given) {
    const user = await this.checkCurrent();
    if (user) {
      const token = await getCSRFToken(config.host);
      const data = {
        authenticity_token: token,
        user: {
          current_password: given.current,
          password: given.replacement,
          password_confirmation: given.replacement,
        },
      };

      const url = config.host + '/users';
      await makeCredentialHTTPRequest('PUT', url, data, config.jsonHeaders);
      // Resetting the password changes the underlying cookie session data
      // need to sign out and back in to refresh
      await this.signOut();
      return this.signIn({
        login: user.login,
        password: given.replacement,
      });
    } else {
      throw new Error('No signed-in user to change the password for');
    }
  },

  async requestPasswordReset(given) {
    const token = await getCSRFToken(config.host);
    const data = {
      authenticity_token: token,
      user: {
        email: given.email,
      },
    };

    return apiClient.post('/../users/password', data, config.jsonHeaders);
  },

  async resetPassword(given) {
    const authToken = await getCSRFToken(config.host);
    const data = {
      authenticity_token: authToken,
      user: {
        password: given.password,
        password_confirmation: given.confirmation,
        reset_password_token: given.token,
      },
    };

    const url = config.host + '/users/password';
    return makeCredentialHTTPRequest('PUT', url, data, config.jsonHeaders);
  },

  async disableAccount() {
    console.log('Disabling account');
    const user = await this.checkCurrent();
    if (user) {
      await user.delete();
      this._deleteBearerToken();
      this._currentUserPromise = Promise.resolve(null);
      await this._currentUserPromise;
      this.emit('change', this._currentUserPromise);
      console.info('Disabled account');
      return null;
    } else {
      throw new Error('Failed to disable account; not signed in');
    }
  },

  async signOut() {
    console.log('Signing out');
    const user = await this.checkCurrent();
    if (user) {
      const token = await getCSRFToken(config.host);
      const url = config.host + '/users/sign_out';
      const bearerToken = await this.checkBearerToken();

      const deleteHeaders = {
        ...config.jsonHeaders,
        ['X-CSRF-Token']: token,
        ['Authorization']: 'Bearer ' + bearerToken
      };

      try {
        makeCredentialHTTPRequest('DELETE', url, null, deleteHeaders);
        this._deleteBearerToken();
        this._currentUserPromise = Promise.resolve(null);
        await this._currentUserPromise;
        this.emit('change', this._currentUserPromise);
        console.info('Signed out');
        return null;
      } catch (error) {
        console.error('Failed to sign out');
        return apiClient.handleError(error);
      }
    } else {
      throw new Error('Failed to sign out; not signed in');
    }
  },

  async unsubscribeEmail(given) {
    const token = await getCSRFToken(config.host);
    const url = config.host + '/unsubscribe';

    const data = {
      authenticity_token: token,
      email: given.email,
    };

    return makeHTTPRequest('POST', url, data, config.jsonHeaders);
  },
});

module.exports = {
  changePassword: authClient.changePassword.bind(authClient),
  checkCurrent: authClient.checkCurrent.bind(authClient),
  checkBearerToken: authClient.checkBearerToken.bind(authClient),
  disableAccount: authClient.disableAccount.bind(authClient),
  listen: authClient.listen.bind(authClient),
  register: authClient.register.bind(authClient),
  requestPasswordReset: authClient.requestPasswordReset.bind(authClient),
  resetPassword: authClient.resetPassword.bind(authClient),
  signIn: authClient.signIn.bind(authClient),
  stopListening: authClient.stopListening.bind(authClient),
  signOut: authClient.signOut.bind(authClient),
  unsubscribeEmail: authClient.unsubscribeEmail.bind(authClient)
};
