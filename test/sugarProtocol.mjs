// The wire protocol frame by frame, so the @typedef blocks describe what was
// observed. Tests needing a Panoptes JWT skip on live with their reason.
import { expect } from 'chai';
import {
  AUTHENTICATED_USER,
  canAuthenticate,
  createClient,
  isLive,
  nextFrame,
  noFrame,
  NO_AUTH_REASON,
  publish,
  restoreNetConnect,
  startSugar,
  target
} from './support/sugarTarget.mjs';

describe(`Sugar wire protocol (${target})`, function () {
  this.timeout(10000);

  let sugar;
  const clients = [];

  function open(userId, authToken) {
    const client = createClient(sugar, userId, authToken);
    clients.push(client);
    client.connect();
    return client;
  }

  function connected(client) {
    return nextFrame(client, (frame) => frame.type === 'connection', 'connection frame');
  }

  function responseTo(client, action) {
    return nextFrame(
      client,
      (frame) => frame.type === 'response' && frame.action === action,
      `${action} response`
    );
  }

  before(async function () {
    sugar = await startSugar();
  });

  after(async function () {
    await sugar?.close();
    restoreNetConnect();
  });

  afterEach(function () {
    while (clients.length) clients.pop().disconnect();
  });

  describe('the connection frame', function () {
    it('gives a logged-out visitor a session key', async function () {
      const frame = await connected(open());
      expect(frame).to.include.keys('type', 'loggedIn', 'userKey');
      expect(frame.type).to.equal('connection');
      expect(frame.loggedIn).to.be.false;
      expect(frame.userKey).to.match(/^session:.+/);
    });

    it('omits userName when logged out', async function () {
      const frame = await connected(open());
      expect(frame.userName).to.be.undefined;
    });

    it('gives an authenticated user a user key and a name', async function () {
      if (!canAuthenticate) return this.skip(NO_AUTH_REASON);
      const frame = await connected(open(AUTHENTICATED_USER.id, AUTHENTICATED_USER.token));
      expect(frame.loggedIn).to.be.true;
      expect(frame.userKey).to.equal(`user:${AUTHENTICATED_USER.id}`);
      expect(frame.userName).to.be.a('string');
    });

    it('records loggedIn and userKey on the client', async function () {
      const client = open();
      const frame = await connected(client);
      expect(client.loggedIn).to.equal(frame.loggedIn);
      expect(client.userKey).to.equal(frame.userKey);
    });

    it('treats the literal string "null" as no credentials', async function () {
      // lib/sugar.js constructs its client before auth resolves, so the query
      // string can carry the string "null". The server strips it.
      const client = open('null', 'null');
      const frame = await connected(client);
      expect(frame.loggedIn).to.be.false;
      expect(frame.userKey).to.match(/^session:/);
    });
  });

  describe('Subscribe', function () {
    it('acknowledges a public channel', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('zooniverse');
      const response = await responseTo(client, 'Subscribe');
      expect(response).to.deep.equal({
        type: 'response',
        action: 'Subscribe',
        params: { channel: 'zooniverse' }
      });
    });

    it('acknowledges a hyphenated project channel', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('project-1755');
      const response = await responseTo(client, 'Subscribe');
      expect(response.params.channel).to.equal('project-1755');
    });

    it('acknowledges the connection\'s own session channel', async function () {
      const client = open();
      const frame = await connected(client);
      client.subscribeTo(frame.userKey);
      const response = await responseTo(client, 'Subscribe');
      expect(response.params.channel).to.equal(frame.userKey);
    });

    it('silently ignores another connection\'s session channel', async function () {
      const other = open();
      const otherFrame = await connected(other);
      const client = open();
      await connected(client);

      client.subscribeTo(otherFrame.userKey);
      // Scoped to the channel asked for: the client also auto-subscribes to its
      // OWN session channel on connect, which does get acknowledged.
      await noFrame(
        client,
        (frame) =>
          frame.type === 'response' &&
          frame.action === 'Subscribe' &&
          frame.params.channel === otherFrame.userKey
      );
    });

    it('silently ignores another user\'s channel', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('user:999999');
      await noFrame(
        client,
        (frame) =>
          frame.type === 'response' &&
          frame.action === 'Subscribe' &&
          frame.params.channel === 'user:999999'
      );
    });

    it('reports the silent rejection as success to the caller', async function () {
      // The asymmetry consumers have to know about: the client cannot tell an
      // accepted subscribe from a rejected one.
      const client = open();
      await connected(client);
      expect(client.subscribeTo('user:999999')).to.be.true;
      expect(client.subscriptions['user:999999']).to.be.true;
    });
  });

  describe('Unsubscribe', function () {
    it('acknowledges leaving a channel', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      client.unsubscribeFrom('zooniverse');
      const response = await responseTo(client, 'Unsubscribe');
      expect(response).to.deep.equal({
        type: 'response',
        action: 'Unsubscribe',
        params: { channel: 'zooniverse' }
      });
    });

    it('sends nothing for a channel it never joined', async function () {
      const client = open();
      await connected(client);
      client.unsubscribeFrom('never-joined');
      await noFrame(
        client,
        (frame) =>
          frame.type === 'response' &&
          frame.action === 'Unsubscribe' &&
          frame.params.channel === 'never-joined'
      );
    });
  });

  describe('Event', function () {
    it('echoes the payload with the sender\'s userKey attached', async function () {
      const client = open();
      const connection = await connected(client);
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      client.createEvent('testing', 'zooniverse', { hello: 'world' });
      const response = await responseTo(client, 'Event');
      expect(response.params).to.deep.equal({
        channel: 'zooniverse',
        userKey: connection.userKey,
        type: 'testing',
        data: { hello: 'world' }
      });
    });

    it('does not deliver the event to other subscribers', async function () {
      // Events are republished on `outgoing:<channel>` for server-side
      // consumers. Browsers never see each other's events.
      const listener = open();
      await connected(listener);
      listener.subscribeTo('zooniverse');
      await responseTo(listener, 'Subscribe');

      const sender = open();
      await connected(sender);
      sender.subscribeTo('zooniverse');
      await responseTo(sender, 'Subscribe');
      sender.createEvent('testing', 'zooniverse', { hello: 'world' });

      await noFrame(listener, (frame) => frame.type === 'testing');
    });
  });

  describe('published messages', function () {
    it('delivers an announcement to a public channel', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      const delivered = nextFrame(
        client,
        (frame) => frame.type === 'announcement',
        'announcement'
      );
      const response = await publish(sugar, '/announce', {
        announcements: [
          { message: 'hello', url: 'http://test.net', section: 'zooniverse', delivered: false }
        ]
      });
      expect(response.status).to.equal(200);

      const frame = await delivered;
      expect(frame.channel).to.equal('zooniverse');
      expect(frame.type).to.equal('announcement');
      expect(frame.data.message).to.equal('hello');
      // The quirk worth knowing: the type is stamped onto the message too.
      expect(frame.data.type).to.equal('announcement');
    });

    it('dispatches the delivered frame to on() listeners', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      const heard = new Promise((resolve) => client.on('announcement', resolve));
      await publish(sugar, '/announce', {
        announcements: [{ message: 'via listener', section: 'zooniverse' }]
      });

      const frame = await heard;
      expect(frame.data.message).to.equal('via listener');
    });

    it('does not deliver an announcement to a channel you did not join', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      await publish(sugar, '/announce', {
        announcements: [{ message: 'elsewhere', section: 'project-1755' }]
      });
      await noFrame(client, (frame) => frame.type === 'announcement');
    });

    it('delivers a notification to the user channel', async function () {
      if (!canAuthenticate) return this.skip(NO_AUTH_REASON);
      const client = open(AUTHENTICATED_USER.id, AUTHENTICATED_USER.token);
      const connection = await connected(client);
      client.subscribeTo(connection.userKey);
      await responseTo(client, 'Subscribe');

      const delivered = nextFrame(client, (frame) => frame.type === 'notification', 'notification');
      await publish(sugar, '/notify', {
        notifications: [
          {
            user_id: AUTHENTICATED_USER.id,
            message: 'hi',
            url: 'http://test.net',
            delivered: false
          }
        ]
      });

      const frame = await delivered;
      expect(frame.channel).to.equal(connection.userKey);
      expect(frame.data.message).to.equal('hi');
    });

    it('delivers an experiment to the user channel', async function () {
      if (!canAuthenticate) return this.skip(NO_AUTH_REASON);
      const client = open(AUTHENTICATED_USER.id, AUTHENTICATED_USER.token);
      const connection = await connected(client);
      client.subscribeTo(connection.userKey);
      await responseTo(client, 'Subscribe');

      const delivered = nextFrame(client, (frame) => frame.type === 'experiment', 'experiment');
      await publish(sugar, '/experiment', {
        experiments: [
          {
            user_id: AUTHENTICATED_USER.id,
            message: 'would you like to participate?',
            url: 'http://test.net',
            delivered: false
          }
        ]
      });

      const frame = await delivered;
      expect(frame.type).to.equal('experiment');
      expect(frame.channel).to.equal(connection.userKey);
    });
  });

  // Listeners and subscriptions are separate registries. Consumers pair
  // subscribeTo with unsubscribeFrom and forget that on() needs off().
  describe('listeners outlive subscriptions', function () {
    it('leaves an on() listener registered after unsubscribeFrom', async function () {
      const client = open();
      await connected(client);
      client.on('announcement', () => {});
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      client.unsubscribeFrom('zooniverse');
      await responseTo(client, 'Unsubscribe');

      expect(client.subscriptions.zooniverse).to.be.undefined;
      expect(client.events.announcement, 'the listener was dropped too').to.have.lengthOf(1);
    });

    it('fires a listener once per registration, not once per subscription', async function () {
      const client = open();
      await connected(client);

      let calls = 0;
      client.on('announcement', () => {
        calls += 1;
      });

      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');
      client.unsubscribeFrom('zooniverse');
      await responseTo(client, 'Unsubscribe');
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      const delivered = nextFrame(client, (frame) => frame.type === 'announcement', 'announcement');
      await publish(sugar, '/announce', {
        announcements: [{ message: 'once', section: 'zooniverse' }]
      });
      await delivered;

      expect(calls, 'resubscribing should not duplicate the listener').to.equal(1);
    });

    it('double-fires when on() is called again for the same handler role', async function () {
      // The hazard: a consumer that re-runs its subscribe routine registers a
      // second listener and counts every message twice.
      const client = open();
      await connected(client);

      let calls = 0;
      const handler = () => {
        calls += 1;
      };
      client.on('announcement', handler);
      client.on('announcement', handler);

      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      const delivered = nextFrame(client, (frame) => frame.type === 'announcement', 'announcement');
      await publish(sugar, '/announce', {
        announcements: [{ message: 'twice', section: 'zooniverse' }]
      });
      await delivered;

      expect(calls).to.equal(2);
    });

    it('off() is what actually removes it', async function () {
      const client = open();
      await connected(client);
      const handler = () => {};
      client.on('announcement', handler);
      client.off('announcement', handler);
      expect(client.events.announcement).to.deep.equal([]);
    });
  });

  describe('reconnection', function () {
    it('resends public subscriptions after reconnecting', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('zooniverse');
      await responseTo(client, 'Subscribe');

      client.connect();
      await connected(client);
      const response = await responseTo(client, 'Subscribe');
      expect(response.params.channel).to.equal('zooniverse');
    });

    it('drops the previous connection\'s session subscription', async function () {
      const client = open();
      const first = await connected(client);
      client.subscribeTo(first.userKey);
      await responseTo(client, 'Subscribe');

      client.disconnect();
      expect(client.subscriptions[first.userKey]).to.be.undefined;
      expect(client.userKey).to.be.null;
      expect(client.loggedIn).to.be.null;
    });
  });

  describe('presence', function () {
    it('counts a subscriber on a public channel', async function () {
      const client = open();
      await connected(client);
      client.subscribeTo('presence-probe');
      await responseTo(client, 'Subscribe');

      const response = await fetch(`${sugar.host}/presence`);
      expect(response.status).to.equal(200);
      const counts = await response.json();
      const channel = counts.find((entry) => entry.channel === 'presence-probe');
      expect(channel, 'presence-probe missing from /presence').to.exist;
      expect(channel.count).to.be.above(0);
    });

    it('excludes private channels from presence', async function () {
      const client = open();
      const connection = await connected(client);
      client.subscribeTo(connection.userKey);
      await responseTo(client, 'Subscribe');

      const response = await fetch(`${sugar.host}/presence`);
      const counts = await response.json();
      const channels = counts.map((entry) => entry.channel);
      expect(channels).to.not.include(connection.userKey);
    });

    it('reports no active users for an anonymous subscriber', async function () {
      // /active_users only ever lists logged-in users, because presence records
      // the userKey and session keys are filtered out.
      const client = open();
      await connected(client);
      client.subscribeTo('anonymous-probe');
      await responseTo(client, 'Subscribe');

      const response = await fetch(`${sugar.host}/active_users?channel=anonymous-probe`);
      const body = await response.json();
      expect(body.users).to.deep.equal([]);
    });
  });

  if (isLive) {
    describe('live server specifics', function () {
      it('serves the primus client library the vendored copy must match', async function () {
        const response = await fetch(`${sugar.host}/primus.js`);
        expect(response.status).to.equal(200);
        expect(await response.text()).to.include('Primus.prototype.version');
      });
    });
  }
});
