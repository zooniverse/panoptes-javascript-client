/*
  Sugar's HTTP surface, against a real server rather than nock: mocking the
  contract under documentation would only prove the mock. sugarModule.mjs
  asserts that lib/sugar.js builds its client the same way.
*/
import { expect } from 'chai';
import JSONAPIClient from '../lib/json-api-client/index.js';
import {
  createClient,
  nextFrame,
  publish,
  restoreNetConnect,
  startSugar,
  target
} from './support/sugarTarget.mjs';

describe(`Sugar HTTP API (${target})`, function () {
  this.timeout(10000);

  let sugar;
  let apiClient;

  before(async function () {
    sugar = await startSugar();
    // The same construction lib/sugar.js performs, against the test target.
    apiClient = new JSONAPIClient(sugar.host, {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    });
  });

  after(async function () {
    await sugar?.close();
    restoreNetConnect();
  });

  describe('GET /presence', function () {
    it('returns a list of channels and counts', async function () {
      const response = await fetch(`${sugar.host}/presence`);
      expect(response.status).to.equal(200);
      expect(response.headers.get('content-type')).to.match(/application\/json/);
      const body = await response.json();
      expect(body).to.be.an('array');
      body.forEach(function (entry) {
        expect(entry).to.have.all.keys('channel', 'count');
        expect(entry.count).to.be.a('number');
      });
    });

    it('needs no authentication', async function () {
      const response = await fetch(`${sugar.host}/presence`);
      expect(response.status).to.equal(200);
    });
  });

  describe('GET /active_users', function () {
    it('returns a users array for a channel', async function () {
      const response = await fetch(`${sugar.host}/active_users?channel=zooniverse`);
      expect(response.status).to.equal(200);
      const body = await response.json();
      expect(body).to.have.property('users').that.is.an('array');
    });

    it('returns an empty list for an unknown channel', async function () {
      const response = await fetch(`${sugar.host}/active_users?channel=no-such-channel`);
      const body = await response.json();
      expect(body.users).to.deep.equal([]);
    });

    it('unwraps to a bare array through sugarApiClient', async function () {
      // JSONAPIClient unwraps the single top-level key, so consumers get an array
      // not an envelope. See PFE app/talk/active-users.jsx.
      const users = await apiClient.get('/active_users', { channel: 'zooniverse' });
      expect(users).to.be.an('array');
    });
  });

  describe('the authenticated publish endpoints', function () {
    const CASES = [
      {
        path: '/notify',
        key: 'notifications',
        type: 'notification',
        message: {
          user_id: '1',
          message: 'test',
          url: 'http://test.net',
          delivered: false
        }
      },
      {
        path: '/announce',
        key: 'announcements',
        type: 'announcement',
        message: {
          message: 'test',
          url: 'http://test.net',
          section: 'zooniverse',
          delivered: false
        }
      },
      {
        path: '/experiment',
        key: 'experiments',
        type: 'experiment',
        message: {
          user_id: '1',
          message: 'would you like to participate?',
          url: 'http://test.net',
          delivered: false
        }
      }
    ];

    CASES.forEach(function ({ path, key, type, message }) {
      describe(`POST ${path}`, function () {
        it('rejects a request with no credentials', async function () {
          const response = await fetch(`${sugar.host}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: [message] })
          });
          expect(response.status).to.equal(401);
        });

        it('rejects a request with wrong credentials', async function () {
          const response = await fetch(`${sugar.host}${path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from('wrong:wrong').toString('base64')}`
            },
            body: JSON.stringify({ [key]: [message] })
          });
          expect(response.status).to.equal(401);
        });

        it('challenges with a WWW-Authenticate header', async function () {
          const response = await fetch(`${sugar.host}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: [message] })
          });
          expect(response.headers.get('www-authenticate')).to.match(/^Basic realm=/);
        });

        it(`echoes the messages back with type "${type}" stamped on`, async function () {
          const response = await publish(sugar, path, { [key]: [message] });
          expect(response.status).to.equal(200);
          const body = await response.json();
          expect(body).to.deep.equal([{ ...message, type }]);
        });

        it('accepts a batch', async function () {
          const response = await publish(sugar, path, {
            [key]: [
              { ...message, message: 'one' },
              { ...message, message: 'two' }
            ]
          });
          expect(response.status).to.equal(200);
          const body = await response.json();
          expect(body).to.have.lengthOf(2);
          expect(body.map((entry) => entry.message)).to.deep.equal(['one', 'two']);
        });
      });
    });
  });

  describe('presence reflects real subscribers', function () {
    it('counts a subscriber and stops counting it after unsubscribe', async function () {
      const client = createClient(sugar);
      client.connect();
      await nextFrame(client, (frame) => frame.type === 'connection', 'connection');

      client.subscribeTo('http-presence-probe');
      await nextFrame(
        client,
        (frame) => frame.type === 'response' && frame.action === 'Subscribe',
        'Subscribe response'
      );

      const during = await (await fetch(`${sugar.host}/presence`)).json();
      const counted = during.find((entry) => entry.channel === 'http-presence-probe');
      expect(counted, 'channel missing while subscribed').to.exist;
      expect(counted.count).to.be.above(0);

      client.unsubscribeFrom('http-presence-probe');
      await nextFrame(
        client,
        (frame) => frame.type === 'response' && frame.action === 'Unsubscribe',
        'Unsubscribe response'
      );

      const after = await (await fetch(`${sugar.host}/presence`)).json();
      const remaining = after.find((entry) => entry.channel === 'http-presence-probe');
      expect(remaining ? remaining.count : 0).to.equal(0);

      client.disconnect();
    });
  });
});
