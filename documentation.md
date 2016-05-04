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
- [`talkClient`](#panoptes-javascript-client-talkclient)
- [`sugar`](#panoptes-javascript-client-sugar)

## apiClient

The `apiClient` module gives you access to the Panoptes API, allowing you to work with subjects, sets, users, and other resources. A full list is available on the Panoptes API docs.

### Working with Types

An Type basically represents an API endpoint. Type objects are usually chained to their methods in order to perform queries, or create new Resources at that endpoint.

#### apiClient.type(type)

Creates a new Type object of a given type.

``` javascript
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

#### login()

#### logout()

## Useful Links

- [JSON API spec](http://jsonapi.org/)
- [Panoptes API documentation](http://docs.panoptes.apiary.io/)
