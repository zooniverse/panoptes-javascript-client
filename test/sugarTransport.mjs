/*
  Proves the test transport itself: a real SugarClient, over a real socket, to
  whichever server SUGAR_TEST_TARGET points at. If this file is red, nothing
  else in the Sugar suite means anything.
*/
import { expect } from 'chai';
import {
  AUTHENTICATED_USER,
  canAuthenticate,
  createClient,
  nextFrame,
  NO_AUTH_REASON,
  restoreNetConnect,
  startSugar,
  SugarClient,
  target
} from './support/sugarTarget.mjs';

describe(`Sugar transport (${target})`, function () {
  this.timeout(10000);

  let sugar;
  let client;

  before(async function () {
    sugar = await startSugar();
  });

  after(async function () {
    await sugar?.close();
    restoreNetConnect();
  });

  afterEach(function () {
    client?.disconnect();
    client = null;
  });

  describe('required configuration', function () {
    /*
      The class docs say both statics must be set before the constructor runs,
      "or it throws". These assert that claim. Note both are bare strings, not
      Error objects, so a `catch (e) { e.message }` handler sees undefined.
    */
    let Primus;
    let host;

    beforeEach(function () {
      createClient(sugar);
      Primus = SugarClient.Primus;
      host = SugarClient.host;
    });

    afterEach(function () {
      SugarClient.Primus = Primus;
      SugarClient.host = host;
    });

    it('throws when Primus is not set', function () {
      SugarClient.Primus = null;
      expect(() => new SugarClient()).to.throw('SugarClient.Primus is not defined');
    });

    it('throws when host is not set', function () {
      SugarClient.host = null;
      expect(() => new SugarClient()).to.throw('SugarClient.host is not defined');
    });

    it('throws strings, not Errors', function () {
      SugarClient.host = null;
      let thrown;
      try {
        new SugarClient();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).to.be.a('string');
      expect(thrown).to.not.be.an.instanceOf(Error);
    });
  });

  it('opens a socket and receives a connection frame', async function () {
    if (!canAuthenticate) return this.skip(NO_AUTH_REASON);
    client = createClient(sugar, AUTHENTICATED_USER.id, AUTHENTICATED_USER.token);
    client.connect();
    const connection = await nextFrame(client, (d) => d.type === 'connection', 'connection');
    expect(connection.type).to.equal('connection');
    expect(connection.loggedIn).to.be.true;
    expect(connection.userKey).to.equal(`user:${AUTHENTICATED_USER.id}`);
  });

  it('identifies a logged-out visitor with a session key', async function () {
    client = createClient(sugar);
    client.connect();
    const connection = await nextFrame(client, (d) => d.type === 'connection', 'connection');
    expect(connection.loggedIn).to.be.false;
    expect(connection.userKey).to.match(/^session:/);
  });

  it('round trips a subscribe', async function () {
    client = createClient(sugar);
    client.connect();
    await nextFrame(client, (d) => d.type === 'connection', 'connection');
    client.subscribeTo('zooniverse');
    const response = await nextFrame(
      client,
      (d) => d.type === 'response' && d.action === 'Subscribe',
      'Subscribe response'
    );
    expect(response.params.channel).to.equal('zooniverse');
  });
});
