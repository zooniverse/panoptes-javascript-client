/*
  A reference implementation of the Sugar protocol, so the socket tests run in
  CI with no Docker. Each behaviour cites the part of zooniverse/sugar it
  mirrors. Presence is an in-memory Map rather than Redis; the observable
  responses are the same.

  Trustworthy only because the same suite also runs against the real server.
  See sugarTarget.mjs and SUGAR_TEST_TARGET.
*/
import http from 'node:http';
import { WebSocketServer } from 'ws';

export const BASIC_AUTH = { username: 'testUser', password: 'testPass' };

// server.js authorize: public channels are open, private ones only to their owner.
function authorize(userKey, channel) {
  if (!channel.match(/^(user|session)/)) return true;
  return channel === userKey;
}

// presence.js _isUserChannel: private channels are excluded from presence,
// which is why /active_users only ever reports logged-in users.
function isUserChannel(channel) {
  return Boolean(channel.match(/(session|user):/));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function authenticated(request) {
  const [scheme, encoded] = (request.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const [name, pass] = Buffer.from(encoded, 'base64').toString().split(':');
  return name === BASIC_AUTH.username && pass === BASIC_AUTH.password;
}

const PUBLISH = {
  '/notify': { key: 'notifications', type: 'notification' },
  '/announce': { key: 'announcements', type: 'announcement' },
  '/experiment': { key: 'experiments', type: 'experiment' }
};

export async function createSugarServer() {
  const subscribers = new Map(); // channel -> Set<socket>
  const presence = new Map(); // channel -> Set<userKey>
  let nextId = 0;

  function publish(channel, message) {
    for (const socket of subscribers.get(channel) || []) {
      // server.js clientSubscribe: the type is repeated at the top level and
      // the whole message nested under `data`.
      socket.send(JSON.stringify({ channel, type: message.type, data: message }));
    }
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const json = (payload, status = 200) => {
      response.setHeader('Content-Type', 'application/json');
      response.statusCode = status;
      response.end(JSON.stringify(payload));
    };

    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');

    if (request.method === 'GET' && url.pathname === '/presence') {
      return json(
        [...presence.entries()].map(([channel, users]) => ({ channel, count: users.size }))
      );
    }

    if (request.method === 'GET' && url.pathname === '/active_users') {
      const users = [...(presence.get(url.searchParams.get('channel')) || [])]
        .filter((userKey) => userKey.startsWith('user:'))
        .map((userKey) => ({ id: userKey.replace(/^user:/, '') }));
      return json({ users });
    }

    const endpoint = PUBLISH[url.pathname];
    if (request.method === 'POST' && endpoint) {
      if (!authenticated(request)) {
        response.writeHead(401, {
          'WWW-Authenticate': 'Basic realm=notifications.zooniverse.org"'
        });
        return response.end();
      }
      const body = await readBody(request);
      const messages = body[endpoint.key] || [];
      // server.js _sendMessage: stamp the type on, publish, echo back.
      messages.forEach((message) => {
        message.type = endpoint.type;
        publish(
          endpoint.type === 'announcement' ? message.section : `user:${message.user_id}`,
          message
        );
      });
      return json(messages);
    }

    response.statusCode = 404;
    response.end();
  });

  const sockets = new WebSocketServer({ server, path: '/sugar' });

  sockets.on('connection', (socket, request) => {
    const query = new URL(request.url, 'http://localhost').searchParams;
    // server.js: the literal string 'null' means absent, which is what the
    // client sends for a logged-out visitor.
    const userId = query.get('user_id') === 'null' ? null : query.get('user_id');
    const token = query.get('auth_token') === 'null' ? null : query.get('auth_token');

    // The real server verifies a Panoptes JWT here. Any token is accepted:
    // verification is the server's concern and sugar's own suite covers it.
    // All the client can observe is the resulting loggedIn and userKey.
    const loggedIn = Boolean(userId && token);
    const userKey = loggedIn ? `user:${userId}` : `session:fixture-${(nextId += 1)}`;
    const subscriptions = new Set();

    socket.send(
      JSON.stringify({
        type: 'connection',
        userName: loggedIn ? `user${userId}` : undefined,
        loggedIn,
        userKey
      })
    );

    socket.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }
      if (!data || !data.action) return;
      const channel = data.params?.channel;

      if (data.action === 'Subscribe') {
        // An unauthorized subscribe is a silent no-op. The client is never told.
        if (!channel || subscriptions.has(channel) || !authorize(userKey, channel)) return;
        subscriptions.add(channel);
        if (!subscribers.has(channel)) subscribers.set(channel, new Set());
        subscribers.get(channel).add(socket);
        if (!isUserChannel(channel)) {
          if (!presence.has(channel)) presence.set(channel, new Set());
          presence.get(channel).add(userKey);
        }
        socket.send(
          JSON.stringify({ type: 'response', action: 'Subscribe', params: { channel } })
        );
      }

      if (data.action === 'Unsubscribe') {
        if (!channel || !subscriptions.has(channel)) return;
        subscriptions.delete(channel);
        subscribers.get(channel)?.delete(socket);
        if (!isUserChannel(channel)) presence.get(channel)?.delete(userKey);
        socket.send(
          JSON.stringify({ type: 'response', action: 'Unsubscribe', params: { channel } })
        );
      }

      if (data.action === 'Event') {
        // server.js clientEvent publishes to `outgoing:<channel>`, which no
        // browser subscribes to. The sender only sees the response frame.
        socket.send(
          JSON.stringify({
            type: 'response',
            action: 'Event',
            params: {
              channel,
              userKey,
              type: data.params.type,
              data: data.params.data || {}
            }
          })
        );
      }
    });

    socket.on('close', () => {
      for (const channel of subscriptions) {
        subscribers.get(channel)?.delete(socket);
        if (!isUserChannel(channel)) presence.get(channel)?.delete(userKey);
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    host: `http://127.0.0.1:${server.address().port}`,
    async close() {
      for (const socket of sockets.clients) socket.terminate();
      await new Promise((resolve) => sockets.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
