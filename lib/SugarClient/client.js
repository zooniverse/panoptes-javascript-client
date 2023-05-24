var auth = require('../auth');

class SugarClient {
  static initClass() {
    this.host = null;
    this.Primus = null;
  }

  constructor(userId, authToken) {
    this.primusUrl = this.primusUrl.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.receiveData = this.receiveData.bind(this);
    this.subscribeTo = this.subscribeTo.bind(this);
    this.unsubscribeFrom = this.unsubscribeFrom.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.__subscribeToChannels = this.__subscribeToChannels.bind(this);
    this.__subscribeTo = this.__subscribeTo.bind(this);
    this.createEvent = this.createEvent.bind(this);
    this.userId = userId;
    this.authToken = authToken;
    this.events = { };
    this.subscriptions = { };
    this.initializePrimus();
  }

  initializePrimus() {
    if (SugarClient.Primus == null) { throw 'SugarClient.Primus is not defined'; }
    if (SugarClient.host == null) { throw 'SugarClient.host is not defined'; }
    this.primus = SugarClient.Primus.connect(SugarClient.host, {
      websockets: true,
      network: true,
      manual: true
    }
    );

    this.primus.on('outgoing::url', this.primusUrl);
    return this.primus.on('data', this.receiveData);
  }

  host() {
    return SugarClient.host;
  }

  async refreshToken() {
    const token = await auth.checkBearerToken();
    this.authToken = token;
  }

  primusUrl(baseUrl) {
    if (this.userId && this.authToken) {
      this.refreshToken()
      return baseUrl.query = `user_id=${ this.userId }&auth_token=${ this.authToken }`;
    }
  }

  connect() {
    this.disconnect();
    return this.primus.open();
  }

  disconnect() {
    let key;
    let userKeys = [];
    userKeys = ((() => {
      const result = [];
      for (key in this.subscriptions) {
        const _ = this.subscriptions[key];
        if (key.match(/^(session|user):/i)) {
          result.push(key);
        }
      }
      return result;
    })());
    for (key of userKeys) { delete this.subscriptions[key]; }
    this.userKey = (this.loggedIn = null);
    return this.primus.end();
  }

  receiveData(data) {
    if (data.type === 'connection') {
      if (console && console.info) {
        console.info('[CONNECTED] ', data);
      }
      this.loggedIn = data.loggedIn;
      this.userKey = data.userKey;
      this.subscriptions[this.userKey] = true;
      return setTimeout(this.__subscribeToChannels, 100);
    } else {
      return this.emit(data);
    }
  }

  subscribeTo(channel) {
    if (this.subscriptions[channel]) { return false; }
    this.subscriptions[channel] = true;
    return this.__subscribeTo(channel);
  }

  unsubscribeFrom(channel) {
    if (!this.subscriptions[channel]) { return; }
    delete this.subscriptions[channel];
    return this.primus.write({action: 'Unsubscribe', params: { channel }});
  }

  on(type, callback) {
    if (!this.events[type]) { this.events[type] = []; }
    return this.events[type].push(callback);
  }

  off(type, callback) {
    if (callback && this.events[type]) {
      return this.events[type] = this.events[type].filter(cb => cb !== callback);
    } else {
      return delete this.events[type];
    }
  }

  emit(data) {
    const callbacks = this.events[data.type] || [];
    return callbacks.map((callback) => callback(data));
  }

  __subscribeToChannels() {
    return (() => {
      const result = [];
      for (let channel in this.subscriptions) {
        const _ = this.subscriptions[channel];
        result.push(this.__subscribeTo(channel));
      }
      return result;
    })();
  }

  __subscribeTo(channel) {
    return this.primus.write({action: 'Subscribe', params: { channel }});
  }

  createEvent(type, channel, data) {
    return this.primus.write({
      action: 'Event',
      params: { type, channel, data }});
  }
}
SugarClient.initClass();

if (typeof module !== 'undefined' && module !== null) {
  module.exports = SugarClient;
}
