# Panoptes Javascript Client

Work with the Panoptes API without writing a bunch of requests.

## Core Concepts

The Panoptes API is built on the [JSON-API spec](http://jsonapi.org/); reading the spec is the best way to understand it, but for the short version, read on...

The basic unit is the __Resource__. A Resource has a unique ID, and a type. In the case of the Zooniverse, type will correspond to things like projects, subjects and classifications.

Resources can also be __linked__ to each other, so subjects can be members of subject sets.

## Installing

You can install the library from [NPM](https://www.npmjs.com/):

`npm install panoptes-javascript-client`

## Getting Started

## Reference

The library exposes the following modules:

- [`apiClient`](#panoptes-javascript-client-apiclient)
- [`auth`](#panoptes-javascript-client-auth)
- [`talkClient`](#panoptes-javascript-client-talkclient)
- [`sugar`](#panoptes-javascript-client-sugar)

### apiClient

All your requests to the Panoptes API will use the `type()` method to set the Resource type you'll be working with. Other verbs are then chained on to the end.

#### Create a resource

Set a type and use `create()` to create a new local resource. To save it to the API, call its `save()` method.

__Arguments__

- options _(object)_ - the properties for the new resource

__Returns__

- Resource _(object)_

```
var foo = apiClient.type('subject_set').create({
    name: 'foo'
});
```

#### Modify a resource

Locally changes the properties of a resource by merging the arguments into its properties. To save the changes to the API, call its `save()` method.

__Arguments__

- options _(object)_ - the properties to change for the resource

__Returns__

- Resource _(object)_

```
var foo = apiClient.type('subject_set').create({
    name: 'foo'
});

foo.update({
    name: 'bar'
});
```

#### Save a resource

Saves a resource object to the API.

__Returns__

- Promise _(object)_ - resolves to the saved resource, or an error

```
var foo = apiClient.type('subject_set').create({
    name: 'foo'
});

foo.save()
    .then(function (response) {
        console.log(response);
    })
```


### Auth

#### login()

#### logout()

## Useful Links

- JSON API spec
- Panoptes API documentation
