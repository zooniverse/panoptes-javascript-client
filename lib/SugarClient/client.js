/**
 * A frame the server writes once, immediately after a socket opens. It is the
 * only frame the client handles itself rather than passing to listeners.
 * @typedef {object} SugarConnectionFrame
 * @property {string} type - always `'connection'`
 * @property {string} [userName] - the Panoptes display name, absent when logged out
 * @property {boolean} loggedIn - whether the auth token was accepted
 * @property {string} userKey - `user:<id>` when logged in, otherwise `session:<sparkId>`
 */

/**
 * The server's acknowledgement of an action the client sent. Note that
 * unauthorized subscribes are a silent no-op: no response frame, and no error.
 * @typedef {object} SugarResponseFrame
 * @property {string} type - always `'response'`
 * @property {string} action - `'Subscribe'`, `'Unsubscribe'` or `'Event'`
 * @property {object} params - echoes the channel, and for `Event` the sender's userKey and data
 */

/**
 * A message published to a channel this client subscribes to. The message type
 * appears twice: at the top level, which is what `on()` dispatches on, and
 * again inside `data`.
 * @typedef {object} SugarMessageFrame
 * @property {string} channel - the channel it was published to
 * @property {string} type - `'notification'`, `'announcement'` or `'experiment'`
 * @property {object} data - the published message, with `type` stamped onto it
 */

/**
 * A client for [Sugar](https://github.com/zooniverse/sugar), the Zooniverse
 * notification service. Sugar delivers server-sent events over a websocket,
 * falling back to long polling.
 *
 * Most consumers should not construct this. `panoptes-client/lib/sugar` exports
 * a ready-made `sugarClient` already wired to the right host and to Panoptes
 * auth. Construct one directly only when you need a second connection or a
 * different host.
 *
 * Both statics must be set before the constructor runs. If either is missing the
 * constructor throws a bare string, not an `Error`, so a handler reading
 * `error.message` sees `undefined`.
 *
 * The socket is created with `manual: true`, so constructing a client does not
 * open one. Something has to call `connect()`. In practice nothing calls it
 * directly: `lib/sugar.js` listens for Panoptes auth changes and calls
 * `refreshToken()`, which connects when a signed-in user's token changes. A
 * logged-out visitor therefore never opens a socket.
 *
 * @property {string} host - the Sugar server, e.g. `https://notifications.zooniverse.org`
 * @property {object} Primus - a Primus client exposing `connect(host, options)`
 *
 * @example
 * const SugarClient = require('panoptes-client/lib/SugarClient/client')
 * SugarClient.Primus = require('panoptes-client/lib/SugarClient/primus')
 * SugarClient.host = 'https://notifications.zooniverse.org'
 *
 * const client = new SugarClient('1755', 'a-panoptes-bearer-token')
 * client.subscribeTo('zooniverse')
 * client.connect()
 */
class SugarClient {
  static initClass() {
    this.host = null;
    this.Primus = null;
  }

  /**
   * @param {string} [userId] - a Panoptes user id. Omit for a logged-out visitor.
   * @param {string} [authToken] - a Panoptes bearer token. Both are needed to
   *   authenticate: the server verifies the token as a Panoptes-signed JWT and
   *   requires its subject to match `userId`.
   */
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

  /**
   * The Sugar server this client talks to. Reads the static, so every instance
   * reports the same host.
   * @returns {string} the configured host
   * @example
   * client.host()
   */
  host() {
    return SugarClient.host;
  }

  /**
   * Reconnects with a new Panoptes token. This is how a socket normally opens:
   * `lib/sugar.js` subscribes to auth changes and calls this. Does nothing for
   * a logged-out client, or when the token has not actually changed, so it is
   * safe to call on every auth event.
   * @param {string} token - a Panoptes bearer token
   * @returns {Promise<undefined>} resolves once the reconnect has been started,
   *   not once the socket is open. Wait for a connection frame for that.
   * @example
   * const client = new SugarClient('1755', 'the-old-token')
   * await client.refreshToken('the-new-token')
   * client.authToken
   * // => "the-new-token"
   * client.disconnect()
   */
  async refreshToken(token) {
    const tokenChanged = token !== this.authToken;
    if (this.userId && tokenChanged) {
      this.authToken = token;
      this.connect();
    }
  }

  /**
   * Puts the credentials on the socket's query string. Registered as Primus's
   * `outgoing::url` handler, so it runs on every connection attempt and picks
   * up whatever token the client holds at that moment. Not called directly.
   * @param {object} baseUrl - the URL object Primus is about to connect to
   * @returns {string|undefined} the query string it set, or undefined when the
   *   client has no credentials, in which case the connection is anonymous
   * @example
   * const client = new SugarClient('1755', 'a-token')
   * const url = { query: null }
   * client.primusUrl(url)
   * url.query
   * // => "user_id=1755&auth_token=a-token"
   */
  primusUrl(baseUrl) {
    if (this.userId && this.authToken) {
      return baseUrl.query = `user_id=${ this.userId }&auth_token=${ this.authToken }`;
    }
  }

  /**
   * Opens the socket, closing any existing one first so credentials are picked
   * up fresh. Channels subscribed to before connecting are re-sent once the
   * server acknowledges the connection, so subscribing first is fine.
   * @returns {object} the underlying Primus socket
   * @example
   * client.subscribeTo('zooniverse')
   * client.connect()
   */
  connect() {
    this.disconnect();
    return this.primus.open();
  }

  /**
   * Closes the socket and forgets the identity that came with it. Subscriptions
   * to public channels are kept, so a later `connect()` restores them, but
   * `user:` and `session:` subscriptions are dropped because they belong to the
   * connection that is going away.
   * @returns {object} the underlying Primus socket
   * @example
   * client.disconnect()
   * client.userKey
   * // => null
   */
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

  /**
   * Primus's `data` handler. Consumes the connection frame itself, recording
   * `loggedIn` and `userKey` and re-sending every pending subscription 100ms
   * later. Everything else is dispatched to listeners registered with `on()`.
   *
   * Logs every connection frame to `console.info`, unconditionally.
   * @param {SugarConnectionFrame|SugarMessageFrame|SugarResponseFrame} data - the frame
   * @returns {Array|number} the listener results for a dispatched frame, or the
   *   `setTimeout` handle for a connection frame. Incidental; do not build on it.
   * @example
   * client.receiveData({ type: 'no-listeners-for-this' })
   * // => []
   */
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

  /**
   * Subscribes to a channel. Channel names follow two shapes: private channels
   * are colon separated (`user:1755`, `session:<sparkId>`) and public ones are
   * plain or hyphenated (`zooniverse`, `project-1755`).
   *
   * A client may only subscribe to its own private channel. Asking for someone
   * else's is a silent no-op on the server: no response frame, no error, and
   * this method still returns as though it worked.
   *
   * Safe to call before `connect()`. Pending subscriptions are sent once the
   * connection frame arrives.
   * @param {string} channel - the channel to subscribe to
   * @returns {boolean} false when already subscribed, otherwise whether the
   *   request was written to the socket
   * @example
   * client.subscribeTo('zooniverse')
   * // => true
   *
   * client.subscribeTo('zooniverse')
   * // => false
   */
  subscribeTo(channel) {
    if (this.subscriptions[channel]) { return false; }
    this.subscriptions[channel] = true;
    return this.__subscribeTo(channel);
  }

  /**
   * Unsubscribes from a channel and stops counting this client in the channel's
   * presence. Leaves listeners registered with `on` in place: pair it with
   * `off` if you registered one alongside the subscription.
   * @param {string} channel - the channel to leave
   * @returns {boolean|undefined} undefined when not subscribed, otherwise
   *   whether the request was written to the socket
   * @example
   * client.subscribeTo('project-1755')
   * client.unsubscribeFrom('project-1755')
   * // => true
   *
   * client.unsubscribeFrom('never-subscribed')
   * // => undefined
   */
  unsubscribeFrom(channel) {
    if (!this.subscriptions[channel]) { return; }
    delete this.subscriptions[channel];
    return this.primus.write({action: 'Unsubscribe', params: { channel }});
  }

  /**
   * Registers a listener for a frame type. The type is the frame's top-level
   * `type`, so `'notification'`, `'announcement'` or `'experiment'` for
   * published messages, and `'response'` for action acknowledgements. Listeners
   * are per client, not per channel: subscribe to the channels you want, then
   * filter on `frame.channel` if you need to.
   *
   * Listeners and subscriptions are separate registries. `unsubscribeFrom` does
   * NOT remove a listener, only `off` does. A routine that subscribes and
   * registers together, and later only unsubscribes, will register a second
   * listener next time it runs and handle every message twice.
   * @param {string} type - the frame type to listen for
   * @param {function} callback - receives the whole frame
   * @returns {number} the number of listeners now registered for that type.
   *   Incidental; do not build on it.
   * @example
   * client.on('announcement', function (frame) {
   *   console.log(frame.channel, frame.data.message)
   * })
   */
  on(type, callback) {
    if (!this.events[type]) { this.events[type] = []; }
    return this.events[type].push(callback);
  }

  /**
   * Removes one listener, or every listener for a type when no callback is
   * given.
   * @param {string} type - the frame type
   * @param {function} [callback] - the exact function passed to `on()`. Omit to
   *   remove them all.
   * @returns {Array|boolean} the remaining listeners when a callback was given,
   *   otherwise true, including for a type that was never registered
   * @example
   * const listener = function () {}
   * client.on('notification', listener)
   * client.off('notification', listener)
   * // => []
   *
   * client.off('never-registered')
   * // => true
   */
  off(type, callback) {
    if (callback && this.events[type]) {
      return this.events[type] = this.events[type].filter(cb => cb !== callback);
    } else {
      return delete this.events[type];
    }
  }

  /**
   * Dispatches a frame to the listeners registered for its type. Called by
   * `receiveData` for every frame that is not a connection frame; call it
   * directly only to simulate a frame.
   * @param {SugarMessageFrame|SugarResponseFrame} data - the frame to dispatch
   * @returns {Array} what each listener returned, in registration order
   * @example
   * client.on('notification', function (frame) { return frame.data.message })
   * client.emit({ type: 'notification', data: { message: 'hello' } })
   * // => ["hello"]
   */
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

  /**
   * Sends an event up to the server, which republishes it on
   * `outgoing:<channel>` for server-side consumers. Nothing in this client
   * subscribes to that, so other browsers will not see it. What the sender gets
   * back is a `response` frame echoing the payload with its `userKey` attached.
   * @param {string} type - an application-defined event type
   * @param {string} channel - the channel to publish on
   * @param {object} data - the payload
   * @returns {boolean} whether the event was written to the socket
   * @example
   * client.createEvent('classification', 'project-1755', { subject_id: '4234' })
   * // => true
   */
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
