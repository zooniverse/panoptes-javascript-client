# Sugar

[Sugar](https://github.com/zooniverse/sugar) is the Zooniverse notification
service. It pushes server-sent events to the browser over a websocket, falling
back to long polling. Talk notifications, project announcements and intervention
experiments all arrive this way.

> This page is generated from the JSDoc in `lib/SugarClient/client.js` by
> `npm run docs`. Do not edit it by hand: `npm run docs:check` fails in CI when
> it is out of sync. Every example below is executed against a real Sugar server
> by `test/sugarExamples.mjs`, and every frame shape is asserted by
> `test/sugarProtocol.mjs`.

## Quick start

```js
import { sugarClient } from 'panoptes-client/lib/sugar'

sugarClient.subscribeTo(`project-${project.id}`)
sugarClient.on('announcement', function (frame) {
  console.log(frame.data.message)
})
```

`lib/sugar.js` exports a ready-made `sugarClient`, already pointed at the right
host for your environment and already listening to Panoptes auth. Import that
rather than constructing your own.

It only exports in a browser. `typeof navigator === 'undefined'` makes the whole
module evaluate to `undefined`, so server-rendered code has to import it
dynamically. Where top-level `await` is not available, an immediately invoked
async function does the job:

```js
const isBrowser = typeof window !== 'undefined'
let sugarClient

;(async function initSugarClient() {
  if (isBrowser) {
    const sugar = await import('panoptes-client/lib/sugar')
    sugarClient = sugar.sugarClient
  }
})()
```

**That import resolves on a later tick, so guard every use.** Code that runs
soon after module evaluation can reach `sugarClient` while it is still
`undefined`:

```js
if (sugarClient) {
  sugarClient.subscribeTo(channel)
}
```

## Connection lifecycle

The socket is created with Primus's `manual: true`, so **nothing connects when
you import the module**. The only path to an open socket is:

```
auth 'change' or 'refresh'  ->  sugarClient.refreshToken(token)  ->  connect()
```

`refreshToken` connects only when the client has a `userId` and the token has
actually changed. Two consequences worth knowing:

- A logged-out visitor never opens a socket through `lib/sugar.js`. The server
  supports anonymous `session:` connections, but nothing in this client reaches
  them.
- You can subscribe before the socket is open. Pending subscriptions are re-sent
  100ms after the server acknowledges the connection.

## Channels

Two shapes, and the punctuation is not decorative:

| Channel | Example | Who may subscribe |
| --- | --- | --- |
| `user:<id>` | `user:1755` | only the connection authenticated as that user |
| `session:<sparkId>` | `session:X9b20cAX...` | only the connection it was issued to |
| `zooniverse` | `zooniverse` | anyone |
| `project-<id>` | `project-1755` | anyone |

Private channels use a colon. Public ones are plain or hyphenated. `project-1755`
is correct; `project:1755` is not a project channel at all.

**Subscribing to a channel you are not allowed to join is a silent no-op.** The
server sends no response frame and no error, and `subscribeTo` still returns
`true` and still records the channel locally. There is no way for the client to
detect the rejection. Do not treat the return value as authorization.

## Frames

Everything the server sends is a JSON object with a `type`. `on(type, handler)`
dispatches on it.

| `type` | Meaning |
| --- | --- |
| `connection` | sent once per socket; handled by the client, not dispatched |
| `response` | acknowledges a `Subscribe`, `Unsubscribe` or `Event` you sent |
| `notification` | a Talk notification published to your user channel |
| `announcement` | published to a public section channel |
| `experiment` | an intervention published to your user channel |

Published frames repeat the message type: once at the top level, and again
inside `data`. Listen on the top-level `type`, read the payload from `data`.

**Listeners and subscriptions are separate.** `unsubscribeFrom` stops the
messages arriving but leaves the listener registered; only `off` removes it. A
routine that subscribes and registers a listener together, then later only
unsubscribes, adds a second listener the next time it runs and handles every
message twice. Tear both down:

```js
sugarClient.unsubscribeFrom(channel)
sugarClient.off('notification', handler)
```

## HTTP API

The Sugar server also answers HTTP. `lib/sugar.js` exports `sugarApiClient`, a
`JSONAPIClient` pointed at the same host, for the read endpoints.

| Method | Path | Auth | Answers |
| --- | --- | --- | --- |
| GET | `/presence` | none | `[{ channel, count }]` for every channel with subscribers |
| GET | `/active_users?channel=<channel>` | none | `{ users: [{ id }] }` |
| POST | `/notify` | basic | echoes the messages with `type: "notification"` |
| POST | `/announce` | basic | echoes the messages with `type: "announcement"` |
| POST | `/experiment` | basic | echoes the messages with `type: "experiment"` |

Two things to watch:

- **`sugarApiClient.get('/active_users')` returns a bare array, not the
  envelope.** `JSONAPIClient` unwraps the single top-level key, so you get
  `[{ id }]` directly.
- Presence excludes private channels, and only logged-in users are recorded, so
  `/active_users` never lists anonymous visitors.

The POST endpoints are for server-side publishers and are rate limited to 100
requests per IP per 15 minutes.

## Reference

### Classes

<dl>
<dt><a href="#SugarClient">SugarClient</a></dt>
<dd><p>A client for <a href="https://github.com/zooniverse/sugar">Sugar</a>, the Zooniverse
notification service. Sugar delivers server-sent events over a websocket,
falling back to long polling.</p>
<p>Most consumers should not construct this. <code>panoptes-client/lib/sugar</code> exports
a ready-made <code>sugarClient</code> already wired to the right host and to Panoptes
auth. Construct one directly only when you need a second connection or a
different host.</p>
<p>Both statics must be set before the constructor runs. If either is missing the
constructor throws a bare string, not an <code>Error</code>, so a handler reading
<code>error.message</code> sees <code>undefined</code>.</p>
<p>The socket is created with <code>manual: true</code>, so constructing a client does not
open one. Something has to call <code>connect()</code>. In practice nothing calls it
directly: <code>lib/sugar.js</code> listens for Panoptes auth changes and calls
<code>refreshToken()</code>, which connects when a signed-in user&#39;s token changes. A
logged-out visitor therefore never opens a socket.</p>
</dd>
</dl>

### Typedefs

<dl>
<dt><a href="#SugarConnectionFrame">SugarConnectionFrame</a> : <code>object</code></dt>
<dd><p>A frame the server writes once, immediately after a socket opens. It is the
only frame the client handles itself rather than passing to listeners.</p>
</dd>
<dt><a href="#SugarResponseFrame">SugarResponseFrame</a> : <code>object</code></dt>
<dd><p>The server&#39;s acknowledgement of an action the client sent. Note that
unauthorized subscribes are a silent no-op: no response frame, and no error.</p>
</dd>
<dt><a href="#SugarMessageFrame">SugarMessageFrame</a> : <code>object</code></dt>
<dd><p>A message published to a channel this client subscribes to. The message type
appears twice: at the top level, which is what <code>on()</code> dispatches on, and
again inside <code>data</code>.</p>
</dd>
</dl>

<a name="SugarClient"></a>

### SugarClient
A client for [Sugar](https://github.com/zooniverse/sugar), the Zooniverse
notification service. Sugar delivers server-sent events over a websocket,
falling back to long polling.

Most consumers should not construct this. `panoptes-client/lib/sugar` exports
a ready-made `sugarClient` already wired to the right host and to Panoptes
auth. Construct one directly only when you need a second connection or a
different host.

Both statics must be set before the constructor runs. If either is missing the
constructor throws a bare string, not an `Error`, so a handler reading
`error.message` sees `undefined`.

The socket is created with `manual: true`, so constructing a client does not
open one. Something has to call `connect()`. In practice nothing calls it
directly: `lib/sugar.js` listens for Panoptes auth changes and calls
`refreshToken()`, which connects when a signed-in user's token changes. A
logged-out visitor therefore never opens a socket.

**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| host | <code>string</code> | the Sugar server, e.g. `https://notifications.zooniverse.org` |
| Primus | <code>object</code> | a Primus client exposing `connect(host, options)` |


* [SugarClient](#SugarClient)
    * [new SugarClient([userId], [authToken])](#new_SugarClient_new)
    * [.host()](#SugarClient+host) ⇒ <code>string</code>
    * [.refreshToken(token)](#SugarClient+refreshToken) ⇒ <code>Promise.&lt;undefined&gt;</code>
    * [.primusUrl(baseUrl)](#SugarClient+primusUrl) ⇒ <code>string</code> \| <code>undefined</code>
    * [.connect()](#SugarClient+connect) ⇒ <code>object</code>
    * [.disconnect()](#SugarClient+disconnect) ⇒ <code>object</code>
    * [.receiveData(data)](#SugarClient+receiveData) ⇒ <code>Array</code> \| <code>number</code>
    * [.subscribeTo(channel)](#SugarClient+subscribeTo) ⇒ <code>boolean</code>
    * [.unsubscribeFrom(channel)](#SugarClient+unsubscribeFrom) ⇒ <code>boolean</code> \| <code>undefined</code>
    * [.on(type, callback)](#SugarClient+on) ⇒ <code>number</code>
    * [.off(type, [callback])](#SugarClient+off) ⇒ <code>Array</code> \| <code>boolean</code>
    * [.emit(data)](#SugarClient+emit) ⇒ <code>Array</code>
    * [.createEvent(type, channel, data)](#SugarClient+createEvent) ⇒ <code>boolean</code>

<a name="new_SugarClient_new"></a>

#### new SugarClient([userId], [authToken])

| Param | Type | Description |
| --- | --- | --- |
| [userId] | <code>string</code> | a Panoptes user id. Omit for a logged-out visitor. |
| [authToken] | <code>string</code> | a Panoptes bearer token. Both are needed to   authenticate: the server verifies the token as a Panoptes-signed JWT and   requires its subject to match `userId`. |

**Example**  
```js
const SugarClient = require('panoptes-client/lib/SugarClient/client')
SugarClient.Primus = require('panoptes-client/lib/SugarClient/primus')
SugarClient.host = 'https://notifications.zooniverse.org'

const client = new SugarClient('1755', 'a-panoptes-bearer-token')
client.subscribeTo('zooniverse')
client.connect()
```
<a name="SugarClient+host"></a>

#### sugarClient.host() ⇒ <code>string</code>
The Sugar server this client talks to. Reads the static, so every instance
reports the same host.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>string</code> - the configured host  
**Example**  
```js
client.host()
```
<a name="SugarClient+refreshToken"></a>

#### sugarClient.refreshToken(token) ⇒ <code>Promise.&lt;undefined&gt;</code>
Reconnects with a new Panoptes token. This is how a socket normally opens:
`lib/sugar.js` subscribes to auth changes and calls this. Does nothing for
a logged-out client, or when the token has not actually changed, so it is
safe to call on every auth event.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>Promise.&lt;undefined&gt;</code> - resolves once the reconnect has been started,
  not once the socket is open. Wait for a connection frame for that.  

| Param | Type | Description |
| --- | --- | --- |
| token | <code>string</code> | a Panoptes bearer token |

**Example**  
```js
const client = new SugarClient('1755', 'the-old-token')
await client.refreshToken('the-new-token')
client.authToken
// => "the-new-token"
client.disconnect()
```
<a name="SugarClient+primusUrl"></a>

#### sugarClient.primusUrl(baseUrl) ⇒ <code>string</code> \| <code>undefined</code>
Puts the credentials on the socket's query string. Registered as Primus's
`outgoing::url` handler, so it runs on every connection attempt and picks
up whatever token the client holds at that moment. Not called directly.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>string</code> \| <code>undefined</code> - the query string it set, or undefined when the
  client has no credentials, in which case the connection is anonymous  

| Param | Type | Description |
| --- | --- | --- |
| baseUrl | <code>object</code> | the URL object Primus is about to connect to |

**Example**  
```js
const client = new SugarClient('1755', 'a-token')
const url = { query: null }
client.primusUrl(url)
url.query
// => "user_id=1755&auth_token=a-token"
```
<a name="SugarClient+connect"></a>

#### sugarClient.connect() ⇒ <code>object</code>
Opens the socket, closing any existing one first so credentials are picked
up fresh. Channels subscribed to before connecting are re-sent once the
server acknowledges the connection, so subscribing first is fine.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>object</code> - the underlying Primus socket  
**Example**  
```js
client.subscribeTo('zooniverse')
client.connect()
```
<a name="SugarClient+disconnect"></a>

#### sugarClient.disconnect() ⇒ <code>object</code>
Closes the socket and forgets the identity that came with it. Subscriptions
to public channels are kept, so a later `connect()` restores them, but
`user:` and `session:` subscriptions are dropped because they belong to the
connection that is going away.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>object</code> - the underlying Primus socket  
**Example**  
```js
client.disconnect()
client.userKey
// => null
```
<a name="SugarClient+receiveData"></a>

#### sugarClient.receiveData(data) ⇒ <code>Array</code> \| <code>number</code>
Primus's `data` handler. Consumes the connection frame itself, recording
`loggedIn` and `userKey` and re-sending every pending subscription 100ms
later. Everything else is dispatched to listeners registered with `on()`.

Logs every connection frame to `console.info`, unconditionally.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>Array</code> \| <code>number</code> - the listener results for a dispatched frame, or the
  `setTimeout` handle for a connection frame. Incidental; do not build on it.  

| Param | Type | Description |
| --- | --- | --- |
| data | [<code>SugarConnectionFrame</code>](#SugarConnectionFrame) \| [<code>SugarMessageFrame</code>](#SugarMessageFrame) \| [<code>SugarResponseFrame</code>](#SugarResponseFrame) | the frame |

**Example**  
```js
client.receiveData({ type: 'no-listeners-for-this' })
// => []
```
<a name="SugarClient+subscribeTo"></a>

#### sugarClient.subscribeTo(channel) ⇒ <code>boolean</code>
Subscribes to a channel. Channel names follow two shapes: private channels
are colon separated (`user:1755`, `session:<sparkId>`) and public ones are
plain or hyphenated (`zooniverse`, `project-1755`).

A client may only subscribe to its own private channel. Asking for someone
else's is a silent no-op on the server: no response frame, no error, and
this method still returns as though it worked.

Safe to call before `connect()`. Pending subscriptions are sent once the
connection frame arrives.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>boolean</code> - false when already subscribed, otherwise whether the
  request was written to the socket  

| Param | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | the channel to subscribe to |

**Example**  
```js
client.subscribeTo('zooniverse')
// => true

client.subscribeTo('zooniverse')
// => false
```
<a name="SugarClient+unsubscribeFrom"></a>

#### sugarClient.unsubscribeFrom(channel) ⇒ <code>boolean</code> \| <code>undefined</code>
Unsubscribes from a channel and stops counting this client in the channel's
presence. Leaves listeners registered with `on` in place: pair it with
`off` if you registered one alongside the subscription.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>boolean</code> \| <code>undefined</code> - undefined when not subscribed, otherwise
  whether the request was written to the socket  

| Param | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | the channel to leave |

**Example**  
```js
client.subscribeTo('project-1755')
client.unsubscribeFrom('project-1755')
// => true

client.unsubscribeFrom('never-subscribed')
// => undefined
```
<a name="SugarClient+on"></a>

#### sugarClient.on(type, callback) ⇒ <code>number</code>
Registers a listener for a frame type. The type is the frame's top-level
`type`, so `'notification'`, `'announcement'` or `'experiment'` for
published messages, and `'response'` for action acknowledgements. Listeners
are per client, not per channel: subscribe to the channels you want, then
filter on `frame.channel` if you need to.

Listeners and subscriptions are separate registries. `unsubscribeFrom` does
NOT remove a listener, only `off` does. A routine that subscribes and
registers together, and later only unsubscribes, will register a second
listener next time it runs and handle every message twice.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>number</code> - the number of listeners now registered for that type.
  Incidental; do not build on it.  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | the frame type to listen for |
| callback | <code>function</code> | receives the whole frame |

**Example**  
```js
client.on('announcement', function (frame) {
  console.log(frame.channel, frame.data.message)
})
```
<a name="SugarClient+off"></a>

#### sugarClient.off(type, [callback]) ⇒ <code>Array</code> \| <code>boolean</code>
Removes one listener, or every listener for a type when no callback is
given.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>Array</code> \| <code>boolean</code> - the remaining listeners when a callback was given,
  otherwise true, including for a type that was never registered  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | the frame type |
| [callback] | <code>function</code> | the exact function passed to `on()`. Omit to   remove them all. |

**Example**  
```js
const listener = function () {}
client.on('notification', listener)
client.off('notification', listener)
// => []

client.off('never-registered')
// => true
```
<a name="SugarClient+emit"></a>

#### sugarClient.emit(data) ⇒ <code>Array</code>
Dispatches a frame to the listeners registered for its type. Called by
`receiveData` for every frame that is not a connection frame; call it
directly only to simulate a frame.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>Array</code> - what each listener returned, in registration order  

| Param | Type | Description |
| --- | --- | --- |
| data | [<code>SugarMessageFrame</code>](#SugarMessageFrame) \| [<code>SugarResponseFrame</code>](#SugarResponseFrame) | the frame to dispatch |

**Example**  
```js
client.on('notification', function (frame) { return frame.data.message })
client.emit({ type: 'notification', data: { message: 'hello' } })
// => ["hello"]
```
<a name="SugarClient+createEvent"></a>

#### sugarClient.createEvent(type, channel, data) ⇒ <code>boolean</code>
Sends an event up to the server, which republishes it on
`outgoing:<channel>` for server-side consumers. Nothing in this client
subscribes to that, so other browsers will not see it. What the sender gets
back is a `response` frame echoing the payload with its `userKey` attached.

**Kind**: instance method of [<code>SugarClient</code>](#SugarClient)  
**Returns**: <code>boolean</code> - whether the event was written to the socket  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | an application-defined event type |
| channel | <code>string</code> | the channel to publish on |
| data | <code>object</code> | the payload |

**Example**  
```js
client.createEvent('classification', 'project-1755', { subject_id: '4234' })
// => true
```
<a name="SugarConnectionFrame"></a>

### SugarConnectionFrame : <code>object</code>
A frame the server writes once, immediately after a socket opens. It is the
only frame the client handles itself rather than passing to listeners.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | always `'connection'` |
| [userName] | <code>string</code> | the Panoptes display name, absent when logged out |
| loggedIn | <code>boolean</code> | whether the auth token was accepted |
| userKey | <code>string</code> | `user:<id>` when logged in, otherwise `session:<sparkId>` |

<a name="SugarResponseFrame"></a>

### SugarResponseFrame : <code>object</code>
The server's acknowledgement of an action the client sent. Note that
unauthorized subscribes are a silent no-op: no response frame, and no error.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | always `'response'` |
| action | <code>string</code> | `'Subscribe'`, `'Unsubscribe'` or `'Event'` |
| params | <code>object</code> | echoes the channel, and for `Event` the sender's userKey and data |

<a name="SugarMessageFrame"></a>

### SugarMessageFrame : <code>object</code>
A message published to a channel this client subscribes to. The message type
appears twice: at the top level, which is what `on()` dispatches on, and
again inside `data`.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | the channel it was published to |
| type | <code>string</code> | `'notification'`, `'announcement'` or `'experiment'` |
| data | <code>object</code> | the published message, with `type` stamped onto it |

