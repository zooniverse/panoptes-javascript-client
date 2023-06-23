# Panoptes Javascript Client

A full-featured client for handling API requests, authentication, and Talk in Zooniverse projects.

## Core API Concepts

The Panoptes API is built on the [JSON-API spec](http://jsonapi.org/); reading the spec is the best way to understand it, but for the short version, read on...

The basic unit is the __Resource__. A Resource has a unique ID, and a type. In the case of the Zooniverse, type will correspond to things like projects, subjects and classifications. Resources can also be __linked__ to each other, so subjects can be members of subject sets.

## Installing

You can install the client from [NPM](https://www.npmjs.com/package/panoptes-client):

`npm install panoptes-client`

## Getting Started

To use the client, you can `require` it in:

``` javascript
// ES5
var Panoptes = require('panoptes-client');

// ES5: just the apiClient
var apiClient = require('panoptes-client/lib/api-client');

// ES6
import Panoptes from 'panoptes-client';

// ES6: just the apiClient
import apiClient from 'panoptes-client/lib/api-client';
```

The library exposes the following modules:

- [`apiClient`](#panoptes-javascript-client-apiclient)
- [`auth`](#panoptes-javascript-client-auth)
- [`oauth`](#panoptes-javascript-client-oauth)
- [`sugar`](#panoptes-javascript-client-sugar)
- [`talkClient`](#panoptes-javascript-client-talkclient)

## Configuring your environment

There are currently options for running the client against the `staging` and `production` environments, which determine which endpoints are used for requests handled by the module. There are a few different ways to set which you want to use - __staging is the default environment__.

__Setting the environment via URL parameter__

If you're running the client in the browser, you can use the `env` URL parameter to override the current environment, like this:

```
// Default to staging
http://localhost:3000

// Switch to production
http://localhost:3000?env=production
```

If you're running an app using hash history, you'll need to add `?env=` _before_ the #, like this:

```
http://localhost:3000?env=production#/classify
```

__Setting the environment via `NODE_ENV`__

This is usually used for build processes etc before deployment. Note that setting `NODE_ENV` to production may have unintended side effects such as reduced logging, config changes to other parts of your app etc.

```
NODE_ENV=production npm run build
```

__Setting individual endpoints__

You can use the methods above to override the individual endpoints for each service. This isn't normally necessary, but look at [config.js](https://github.com/zooniverse/panoptes-javascript-client/blob/master/lib/config.js) for details on syntax to use.

## apiClient

The `apiClient` module gives you access to the Panoptes API, allowing you to work with subjects, sets, users, and other resources. A full list is available on the Panoptes API docs.

### Working with Types

An Type basically represents an API endpoint. Type objects are usually chained to their methods in order to perform queries, or create new Resources at that endpoint.

#### apiClient.type(type)

Creates a new Type object of a given type.

```js
var subjectType = apiClient.type('subjects');
```

> Type objects are almost always chained to `.get()` or `.create()`.

__Arguments__

- type _(string)_ - the type of Resource to be used

__Returns__

- Type _(object)_ - a Type object


#### Type.get(id, parameters)

Retrieves a single Resource, or an array of Resources.

__Arguments__

- id _(string / array)_ - the ID, or array of IDs to retrieve. *IDs must be strings*
- parameters _(object)_ - the query parameters to use

__Returns__

- Promise _(object)_ - resolves to a single Resource or an array of Resources

``` javascript
// Retrieve a Resource by ID
apiClient.type('subjects').get('1')
    .then(function (subject) {
        console.log(subject);
    });
}

// Retrieve multiple Resources by ID
apiClient.type('subjects').get(['1', '2', '3'])
    .then(function (subjects) { 
        console.log(subjects);
    });

// Retrieve a Resource by ID, skipping local cache
// (Any request with query params is passed to the server.)
apiClient.type('subjects').get('1', {}))
    .then(function (subjects) {
        console.log(subjects);
    });

// Retrieve a Resource by query (likewise, this is never cached)
apiClient.type('subjects').get({ id: '1' })
    .then(function (subjects) {
        console.log(subjects);
    });
```

#### Type.create(parameters)

Set a type and use `create()` to create a new local Resource. To save it to the API, call its `save()` method.

``` javascript
var foo = apiClient.type('subject_sets').create({
    name: 'foo'
});
```

__Arguments__

- options _(object)_ - the properties of the new Resource

__Returns__

- Resource _(object)_

### Working with Resources

Resource objects have the following methods available:

#### Resource.update(parameters)

Locally changes the properties of a resource by merging the arguments into its properties. To save the changes to the API, call its `save()` method.

``` javascript
var foo = apiClient.type('subject_sets').create({
    name: 'foo'
});

foo.update({
    name: 'bar'
});
```

__Arguments__

- parameters _(object)_ - the parameters to change for the resource

__Returns__

- Resource _(object)_


#### Resource.save()

Saves a resource object to the API.

``` javascript
var foo = apiClient.type('subject_sets').create({
    name: 'foo'
});

foo.save()
    .then(function (response) {
        console.log(response);
    })
```

__Returns__

- Promise _(object)_ - resolves to the saved Resource, or an error

#### Resource.delete()

Delete a resource object from the API.

``` javascript
var foo = apiClient.type('subject_sets').get('123');

foo.delete();
```

#### Resource.listen(function)

Start listening to a resource for changes, and call `function` on change.

``` javascript
apiClient.type('subjects').get('1')
    .then(function(subject) {
        subject.listen(handler);
    });

function handler() {
    console.log('The resource changed.');
}
```

__Arguments__

- function _(function)_ - function to be called when the resource changes

#### Resource.stopListening(function)

Stop listening to a resource for changes.

``` javascript
apiClient.type('subjects').get('1')
    .then(function(subject) {
        subject.stopListening(handler);
    });

function handler() {
    console.log('The resource changed.');
}
```

__Arguments__

- function _(function)_ - the function to be unbound

## Auth

The Auth module authenticates a user using the OAuth password grant flow. Use it to authenticate on any `*.zooniverse.org` domain.

### auth.checkCurrent()

Obtains an access token and refresh token, then resolves to the current Panoptes user. Run this once, on page load, in order to initialise `auth` state.

```js
const user = await auth.checkCurrent();
```

__Returns__

- Promise _(user)_ - resolves to the user object.

### auth.checkBearerToken()

Exchange the stored refresh token for an access token. `auth.checkCurrent()` must have resolved before this will work. Use this any time that you need a token in order to perform a credentialled request.

eg.

- POST an auth'ed classification.
- request a personalised subject queue.
- edit collections or favourites.
- view recent classifications.

```js
const user = await auth.checkCurrent();
const token = await auth.checkBearerToken();
```

__Returns__

- Promise _(string)_ - resolves to an access token, encoded as a base64 string.

### auth.signIn({ login, password })

Sign in to Zooniverse with your login and password. Implicitly obtains an access token and refresh token.

```js
const user = await auth.signIn({
  login: 'testUser',
  password: 'mySecretPassword'
});
```

__Arguments__

- credentials _(object)_ - Login credentials for the current user.

__Returns__

- Promise _(user)_ - resolves to the user object.

### auth.signOut()

Clear the stored user session and sign out.

### auth.changePassword({ current, replacement })

Change your Zooniverse password and invalidate your old access and refresh tokens.

```js
const user = await auth.changePassword({
  current: 'mySecretPassword',
  replacement: 'myNewSecretPassword'
});
```

__Arguments__

- Object _(object)_ - An object containing the `current` and `replacement` password.

__Returns__

- Promise _(user)_ - resolves to the user object.

### auth.resetPassword()

TBD

### auth.requestPasswordReset()

TBD

### auth.disableAccount()

TBD

### auth.unsubscribeEmail()

TBD

## OAuth

The OAuth module lets you use authenticate a user using the OAuth implicit grant method. Tokens are refreshed before they expire (currently at 2 hours).

### oauth.init(appID) 

Attempts to pick up an existing session, after which it checks for token details in the URL. This should be run before the start of your app, and the app init function chained to it. A React app might look like this:

```js
oauth.init(APP_ID)
  .then(function () {
    ReactDOM.render(
      // Add in your routes etc here...
    )
  });
```

__Arguments__

- appID _(string)_ - the OAuth app id to be used

__Returns__

- promise - resolves to the user object

### oauth.signIn(redirectUri)

Starts the sign in process. If there's an existing session, it'll be cleared and the user redirected to the Panoptes sign in page.

__Arguments__

- redirectUri _(string)_ - the URI to be returned to after the sign in process is completed and the user is returned to the app.


### oauth.signOut()

Signs the user out, both of the app and their Panoptes session.

__Returns__

- promise - resolves to null once the Panoptes session is terminated

### oauth.checkCurrent()

Attempts to retrieve the authorized user object.

__Returns__

- promise - resolves to a user object if there is an existing session, or null otherwise

#### How it works

The OAuth module works by creating a hidden iFrame and trying to open the Panoptes sign in page in it. If there's an existing session, it'll return your token details _without redirecting_, and those are extracted from the iFrame URL. If there isn't, it'll try and redirect you to the actual sign in page, which constitutes a security violation and throws an error. This is picked up and the client redirects the main window so the user can sign in.

## Useful Links

- [JSON API spec](http://jsonapi.org/)
- [Panoptes API documentation](http://docs.panoptes.apiary.io/)
