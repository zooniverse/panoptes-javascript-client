import JSONAPIClient from 'json-api-client';

import { exists } from './utils';
import auth from './auth';

const DEFAULT_OPTS = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.api+json; version=1'
  },
  host: 'https://panoptes.zooniverse.org',
  root: '/api',
  appID: null
}

let handleError = function(request) {
  let response, errorMessage = null;

  if ('message' in request) {
    throw request;
  } else if ('responseText' in request) {
    try {
      response = JSON.parse(request.responseText);
    } catch (error) {}

    if (exists(response) && exists(response.error)) {
      errorMessage = response.error;

      if (exists(response.error_description)) {
        errorMessage = errorMessage + ' ' + response.error_description;
      }
    } else if (exists(response) && exists(response.errors) && exists(response.errors[0].message)) {
      errorMessage = []

      response.errors.forEach(function(error) {
        let message = error.message;

        if (typeof message == 'string') {
          errorMessage.push(message);
        } else {
          let messageParts = [];
          for (let key in message) {
            let part = message[key];
            messageParts.push(key + ' ' + part);
          }
          errorMessage.push(messageParts.join("\n"));
        }
      });

      errorMessage = errorMessage.join("\n");
    }

    if (exists(request.responseText) && request.responseText.indexOf('<!DOCTYPE') != -1) {
      if (errorMessage == null) {
        errorMessage = request.responseText.trim() || request.status + ' ' + request.statusText;
      }
    }

    throw new Error(errorMessage);
  }
}

export default class PanoptesClient {
  constructor(opts) {
    if (typeof opts === 'undefined') {
      opts = DEFAULT_OPTS;
    }

    for (let key in DEFAULT_OPTS) {
      if (exists(opts[key])) {
        this[key] = opts[key];
      } else {
        this[key] = DEFAULT_OPTS[key];
      }
    }

    if (!exists(this.appID)) {
      throw Error('Must provide an app ID');
    }

    this.api = new JSONAPIClient(this.host + this.root, this.headers);
    this.api.handleError = handleError;
    this.api.auth = auth(this);
  }
}
