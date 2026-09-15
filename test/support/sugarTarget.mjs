/*
  What the Sugar tests run against, and the real SugarClients that talk to it.

    SUGAR_TEST_TARGET=fixture   (default) in-process, no Docker, ws only
    SUGAR_TEST_TARGET=live      a real Sugar server, default localhost:2999

  Same assertions either way; the fixture is only believable because the live
  run proves it matches, so run `npm test` and `npm run test:sugar:live` both.

  SugarClient just needs `Primus.connect(host, opts)` to return something with
  on/write/open/end, so the fixture uses a small ws adapter and no Primus. Live
  speaks engine.io and loads primus lazily: see primusTransport below.
*/
import nock from 'nock';
import { WebSocket } from 'ws';

// Browser globals that lib/sugar.js and the browserified primus bundle reach for
// at require time. Inert, and set before anything loads. Node 21 added a global
// `navigator`; on Node 20, which CI runs, lib/sugar.js exports nothing without
// this.
if (!globalThis.window) {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
}
if (!globalThis.navigator) {
  globalThis.navigator = { userAgent: 'node' };
}

const { createSugarServer, BASIC_AUTH } = await import('./sugarServer.mjs');
const { default: SugarClient } = await import('../../lib/SugarClient/client.js');

const LIVE_HOST = process.env.SUGAR_HOST || 'http://localhost:2999';

export const target = process.env.SUGAR_TEST_TARGET === 'live' ? 'live' : 'fixture';
export const isLive = target === 'live';

/*
  A real server verifies a Panoptes-signed JWT whose subject equals the
  query-string user_id (sugar/lib/panoptes.js), and nothing here can mint one.
  Supply SUGAR_TEST_USER_ID + SUGAR_TEST_JWT to run the logged-in paths against
  live; without them those tests skip with the reason, never silently pass.
*/
export const AUTHENTICATED_USER = {
  id: isLive ? process.env.SUGAR_TEST_USER_ID : '1',
  token: isLive ? process.env.SUGAR_TEST_JWT : 'any-token-the-fixture-accepts'
};

export const canAuthenticate = Boolean(AUTHENTICATED_USER.id && AUTHENTICATED_USER.token);

export const NO_AUTH_REASON =
  'needs a Panoptes-signed JWT: set SUGAR_TEST_USER_ID and SUGAR_TEST_JWT to run this against a live server';

// setup.mjs disables all net connections. Socket tests are the exception.
export function allowLoopback() {
  nock.enableNetConnect(/(localhost|127\.0\.0\.1)/);
}

export function restoreNetConnect() {
  nock.disableNetConnect();
}

// A Primus-shaped transport over a plain WebSocket, for the fixture target.
export function wsTransport() {
  return {
    connect(host, options) {
      const listeners = new Map();
      let socket = null;

      const emit = (event, ...args) =>
        (listeners.get(event) || []).slice().forEach((fn) => fn(...args));

      const transport = {
        on(event, callback) {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event).push(callback);
          return transport;
        },
        removeListener(event, callback) {
          const kept = (listeners.get(event) || []).filter((fn) => fn !== callback);
          listeners.set(event, kept);
          return transport;
        },
        open() {
          // Primus lets listeners decorate the URL first: that is how
          // SugarClient.primusUrl puts credentials on the query string.
          const url = new URL('/sugar', host);
          const decorated = { query: null };
          emit('outgoing::url', decorated);
          if (decorated.query) url.search = decorated.query;

          socket = new WebSocket(url.toString().replace(/^http/, 'ws'));
          socket.on('message', (raw) => {
            try {
              emit('data', JSON.parse(raw));
            } catch {
              // not part of this protocol
            }
          });
          socket.on('error', (error) => emit('error', error));
          return transport;
        },
        write(payload) {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
            return true;
          }
          // Queue until open, as Primus does.
          socket?.once('open', () => socket.send(JSON.stringify(payload)));
          return true;
        },
        end() {
          socket?.close();
          socket = null;
          return transport;
        }
      };

      if (options && options.manual === false) transport.open();
      return transport;
    }
  };
}

// The engine.io transport the real server speaks. Live target only.
async function primusTransport() {
  // The window shim above is what lets the client's `network: true` work: Primus
  // registers online/offline listeners on it, and the Socket getter snapshots
  // `global` into a fresh VM sandbox, so it must already be set.
  let Primus;
  try {
    ({ default: Primus } = await import('primus'));
    // createSocket builds a throwaway server to generate its client, so the
    // server transformer has to be present too.
    await import('engine.io');
    await import('engine.io-client');
  } catch (error) {
    throw new Error(
      'SUGAR_TEST_TARGET=live needs the engine.io transport the real server speaks.\n' +
        'Install it with: npm i --no-save primus engine.io engine.io-client\n' +
        `(${error.message})`
    );
  }

  const Socket = Primus.createSocket({ pathname: '/sugar', transformer: 'engine.io' });
  // Without `new`: that is the Node path. With `new` it runs the browser
  // initialise and dies on `window is not defined`.
  return { connect: (host, options) => Socket(host, options) };
}

let transport;

export async function startSugar() {
  allowLoopback();

  if (isLive) {
    const response = await fetch(`${LIVE_HOST}/presence`).catch(() => null);
    if (!response || response.status !== 200) {
      throw new Error(
        `SUGAR_TEST_TARGET=live but no Sugar server answered at ${LIVE_HOST}. ` +
          'Start it with `docker compose up -d` in the sugar repo.'
      );
    }
    transport = await primusTransport();
    return {
      host: LIVE_HOST,
      auth: {
        username: process.env.SUGAR_TALK_USERNAME || 'sugar',
        password: process.env.SUGAR_TALK_PASSWORD || 'sugar'
      },
      close: async () => {}
    };
  }

  transport = wsTransport();
  const server = await createSugarServer();
  return { host: server.host, auth: BASIC_AUTH, close: server.close };
}

// Omit userId/authToken for a logged-out visitor.
export function createClient(sugar, userId, authToken) {
  SugarClient.Primus = transport || wsTransport();
  SugarClient.host = sugar.host;
  return new SugarClient(userId, authToken);
}

// Resolves with the first frame matching the predicate.
export function nextFrame(client, predicate, label, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), timeout);
    client.primus.on('data', function onData(data) {
      if (predicate(data)) {
        clearTimeout(timer);
        client.primus.removeListener('data', onData);
        resolve(data);
      }
    });
  });
}

// Asserts no matching frame arrives. For the silent no-op paths.
export function noFrame(client, predicate, window = 300) {
  return new Promise((resolve, reject) => {
    function onData(data) {
      if (predicate(data)) {
        clearTimeout(timer);
        client.primus.removeListener('data', onData);
        reject(new Error(`expected no matching frame, got ${JSON.stringify(data)}`));
      }
    }
    const timer = setTimeout(() => {
      client.primus.removeListener('data', onData);
      resolve();
    }, window);
    client.primus.on('data', onData);
  });
}

export function publish(sugar, path, body) {
  const { username, password } = sugar.auth;
  return fetch(`${sugar.host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    },
    body: JSON.stringify(body)
  });
}

export { SugarClient };
