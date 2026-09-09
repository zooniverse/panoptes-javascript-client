/*
  What lib/sugar.js exports and how it is wired, by importing it rather than
  matching its source. It guards on `typeof navigator !== 'undefined'` and its
  transport wants `window`; sugarTarget.mjs installs both.

  It reads its host from config at require time, so the loader clears the
  require cache and re-requires with SUGAR_HOST pointed at a sentinel.
*/
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { expect } from 'chai';
import { wsTransport } from './support/sugarTarget.mjs';

const require = createRequire(import.meta.url);

const SENTINEL = 'http://sugar.test.invalid';
const MODULES = ['../lib/sugar.js', '../lib/config.js', '../lib/SugarClient/client.js'];
const BUNDLE = require.resolve('../lib/SugarClient/primus.js');

// The bundle sugar.js hardwires pulls engine.io-client on construction. These
// tests are about sugar.js's wiring, so it gets the suite's ws transport.
function stubBundle() {
  const real = require.cache[BUNDLE];
  require.cache[BUNDLE] = { id: BUNDLE, filename: BUNDLE, loaded: true, exports: wsTransport() };
  return () => {
    if (real) require.cache[BUNDLE] = real;
    else delete require.cache[BUNDLE];
  };
}

/**
 * Requires lib/sugar.js fresh, with SUGAR_HOST at a sentinel and `auth.listen`
 * swapped for a recorder. sugar.js registers its listeners at module scope and
 * lib/auth.js exports `listen` but not `emit`, so capturing them at
 * registration is the only way to drive them.
 * @returns {{module: object, listeners: Map<string, Function[]>}}
 */
function loadSugar() {
  const previousHost = process.env.SUGAR_HOST;
  process.env.SUGAR_HOST = SENTINEL;

  const auth = require('../lib/auth.js');
  const realListen = auth.listen;
  const listeners = new Map();
  auth.listen = function (event, callback) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
  };

  const restoreBundle = stubBundle();
  MODULES.forEach((path) => {
    delete require.cache[require.resolve(path)];
  });

  try {
    return { module: require('../lib/sugar.js'), listeners };
  } finally {
    restoreBundle();
    auth.listen = realListen;
    if (previousHost === undefined) delete process.env.SUGAR_HOST;
    else process.env.SUGAR_HOST = previousHost;
  }
}

describe('lib/sugar.js', function () {
  let sugar;
  let listeners;

  before(function () {
    ({ module: sugar, listeners } = loadSugar());
  });

  after(function () {
    sugar?.sugarClient?.disconnect();
    // Leave the cache clean so later suites get the unmodified modules.
    MODULES.forEach((path) => {
      delete require.cache[require.resolve(path)];
    });
  });

  describe('exports', function () {
    it('exports exactly sugarClient and sugarApiClient', function () {
      expect(Object.keys(sugar)).to.have.members(['sugarClient', 'sugarApiClient']);
    });

    it('exports a ready-made SugarClient', function () {
      expect(sugar.sugarClient.constructor.name).to.equal('SugarClient');
    });

    it('exports a JSONAPIClient for the HTTP endpoints', function () {
      expect(sugar.sugarApiClient.constructor.name).to.equal('JSONAPIClient');
    });
  });

  describe('host wiring', function () {
    it('points the socket client at the configured Sugar host', function () {
      expect(sugar.sugarClient.host()).to.equal(SENTINEL);
    });

    it('points the API client at the same host', function () {
      expect(sugar.sugarApiClient.root).to.equal(SENTINEL);
    });

    it('takes the host from SUGAR_HOST, overriding the per-environment default', function () {
      const config = require('../lib/config.js');
      expect(config.sugarHost).to.equal(SENTINEL);
    });
  });

  describe('the API client', function () {
    it('sends and accepts JSON', function () {
      expect(sugar.sugarApiClient.headers).to.deep.equal({
        'Content-Type': 'application/json',
        Accept: 'application/json'
      });
    });

    it('refreshes the bearer token before every request', async function () {
      const auth = require('../lib/auth.js');
      const original = auth.checkBearerToken;
      let called = 0;
      auth.checkBearerToken = function () {
        called += 1;
        return Promise.resolve('a-token');
      };
      try {
        await sugar.sugarApiClient.beforeEveryRequest();
      } finally {
        auth.checkBearerToken = original;
      }
      expect(called, 'beforeEveryRequest did not call auth.checkBearerToken').to.equal(1);
    });
  });

  describe('the socket client starts idle', function () {
    it('has no credentials before an auth event', function () {
      expect(sugar.sugarClient.userId).to.be.undefined;
      expect(sugar.sugarClient.authToken).to.be.undefined;
    });

    it('has not connected on import', function () {
      // manual: true and nothing called connect(): a logged-out visitor never
      // gets a socket.
      expect(sugar.sugarClient.userKey).to.be.undefined;
      expect(sugar.sugarClient.loggedIn).to.be.undefined;
    });

    it('ignores a token refresh while logged out', async function () {
      await sugar.sugarClient.refreshToken('a-token');
      expect(sugar.sugarClient.authToken).to.be.undefined;
    });

    it('connects once it has a userId and the token changes', async function () {
      sugar.sugarClient.userId = '1755';
      let opened = 0;
      const original = sugar.sugarClient.primus.open;
      sugar.sugarClient.primus.open = function () {
        opened += 1;
        return this;
      };
      try {
        await sugar.sugarClient.refreshToken('a-new-token');
        expect(sugar.sugarClient.authToken).to.equal('a-new-token');
        expect(opened, 'refreshToken did not open the socket').to.equal(1);

        await sugar.sugarClient.refreshToken('a-new-token');
        expect(opened, 'an unchanged token should not reconnect').to.equal(1);
      } finally {
        sugar.sugarClient.primus.open = original;
        sugar.sugarClient.userId = undefined;
        sugar.sugarClient.authToken = undefined;
      }
    });
  });

  // The auth listeners ARE the connection lifecycle the docs describe: nothing
  // calls connect() directly, so an auth event is the only way a socket opens.
  describe('auth listeners', function () {
    const auth = require('../lib/auth.js');
    let restore;

    function stubAuth({ user, token }) {
      const originals = {
        checkCurrent: auth.checkCurrent,
        checkBearerToken: auth.checkBearerToken
      };
      auth.checkCurrent = () => Promise.resolve(user);
      auth.checkBearerToken = () => Promise.resolve(token);
      restore = () => Object.assign(auth, originals);
    }

    /** Runs every callback registered for an event and lets its promises settle. */
    async function fire(event, ...args) {
      (listeners.get(event) || []).forEach((callback) => callback(...args));
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
    }

    beforeEach(function () {
      sugar.sugarClient.userId = undefined;
      sugar.sugarClient.authToken = undefined;
    });

    afterEach(function () {
      restore?.();
      restore = null;
    });

    it('registers for both refresh and change', function () {
      expect([...listeners.keys()]).to.have.members(['refresh', 'change']);
    });

    it('hands a refreshed token to the socket client', async function () {
      sugar.sugarClient.userId = '1755';
      let opened = 0;
      const original = sugar.sugarClient.primus.open;
      sugar.sugarClient.primus.open = function () {
        opened += 1;
        return this;
      };
      try {
        await fire('refresh', 'a-refreshed-token');
        expect(sugar.sugarClient.authToken).to.equal('a-refreshed-token');
        expect(opened, 'a refreshed token should open the socket').to.equal(1);
      } finally {
        sugar.sugarClient.primus.open = original;
      }
    });

    it('adopts the signed-in user and their token on an auth change', async function () {
      stubAuth({ user: { id: '1755' }, token: 'a-session-token' });
      const original = sugar.sugarClient.primus.open;
      sugar.sugarClient.primus.open = function () {
        return this;
      };
      try {
        await fire('change');
        expect(sugar.sugarClient.userId).to.equal('1755');
        expect(sugar.sugarClient.authToken).to.equal('a-session-token');
      } finally {
        sugar.sugarClient.primus.open = original;
      }
    });

    it('logs response frames outside production', async function () {
      // On for every non-production build, not just local dev. Worth pinning.
      stubAuth({ user: { id: '1755' }, token: 'a-session-token' });
      const original = sugar.sugarClient.primus.open;
      sugar.sugarClient.primus.open = function () {
        return this;
      };
      const logged = [];
      const realLog = console.log;
      console.log = (...args) => logged.push(args);
      try {
        await fire('change');
        sugar.sugarClient.emit({ type: 'response', action: 'Subscribe' });
      } finally {
        console.log = realLog;
        sugar.sugarClient.primus.open = original;
      }
      expect(logged.some((args) => args[0] === '[SUGAR RESPONSE]')).to.be.true;
    });

    it('disconnects when the change resolves to no user', async function () {
      stubAuth({ user: null, token: null });
      let ended = 0;
      const original = sugar.sugarClient.primus.end;
      sugar.sugarClient.primus.end = function () {
        ended += 1;
        return this;
      };
      try {
        await fire('change');
        expect(ended, 'signing out should end the socket').to.be.above(0);
        expect(sugar.sugarClient.userKey).to.be.null;
      } finally {
        sugar.sugarClient.primus.end = original;
      }
    });
  });

  describe('browser-only export', function () {
    it('guards the whole module on navigator', function () {
      const source = readFileSync(
        fileURLToPath(new URL('../lib/sugar.js', import.meta.url)),
        'utf8'
      );
      // Not observable from inside Node, which always defines navigator.
      expect(source).to.include("typeof navigator !== 'undefined'");
    });
  });
});
