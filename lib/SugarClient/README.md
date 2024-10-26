# Sugar Client

A javascript client for [Sugar](https://github.com/zooniverse/sugar), a notification service using web sockets. 

## Primus library

This needs to be kept in sync with the Sugar Server's primus package installation whenever the server version updates due to the way the transport client library is embedded into the version of the primus package, https://github.com/primus/primus#client-library

In order to sync this client version with the server we can derive the latest [primus.js](./primus.js) file by [running the sugar server locally](https://github.com/zooniverse/sugar#development-via-docker--docker-compose) and downloading the primus.js file from sugar dev server via the web browser or via `curl -s http:localhost:2999/primus.js > primus.js`.

You can also download `primus.js` from https://notifications.zooniverse.org/primus.js.

You can then replace the local version of `primus.js` with the server dervied one from sugar server and PR to replace it here.
